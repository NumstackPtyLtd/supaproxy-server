import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import pino from 'pino'
import type { RowDataPacket } from 'mysql2'
import { getPool } from '../db/pool.js'
import { parseBody } from '../middleware/validate.js'
import { requireAuth, type AuthUser, type AuthEnv } from '../middleware/auth.js'
import type {
  IdRow,
  TotalRow,
} from '../db/types.js'


// ── Inline row types for JOIN / aggregate queries ──

interface TeamRow extends RowDataPacket {
  id: string
  name: string
}

interface WorkspaceListRow extends RowDataPacket {
  id: string
  name: string
  team: string | null
  status: string
  model: string
  created_at: string
  connection_count: number
  tool_count: number
  knowledge_count: number
  queries_today: number
  cost_mtd: number
}

interface WorkspaceSummaryRow extends RowDataPacket {
  id: string
  name: string
  status: string
  model: string
  system_prompt: string | null
  max_tool_rounds: number
  cold_timeout_minutes: number | null
  close_timeout_minutes: number | null
  created_by: string | null
  team: string | null
}

interface WorkspaceDetailRow extends RowDataPacket {
  id: string
  org_id: string | null
  team_id: string | null
  name: string
  status: string
  model: string
  system_prompt: string | null
  max_tool_rounds: number
  max_thread_history: number
  cold_timeout_minutes: number | null
  close_timeout_minutes: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  team: string | null
}

interface ConnectionSelectRow extends RowDataPacket {
  id: string
  name: string
  type: string
  status: string
  config: string
}

interface ToolJoinRow extends RowDataPacket {
  id: string
  name: string
  description: string | null
  input_schema: string | null
  is_write: boolean
  connection_name: string
}

interface ToolDetailJoinRow extends RowDataPacket {
  id: string
  name: string
  description: string | null
  input_schema: string | null
  is_write: boolean
  connection_name: string
  connection_type: string
}

interface ConsumerSelectRow extends RowDataPacket {
  id: string
  type: string
  config: string
  status: string
}

interface KnowledgeRow extends RowDataPacket {
  id: string
  type: string
  name: string
  config: string
  status: string
  chunks: number
  last_synced_at: string | null
}

interface KnowledgeGapRow extends RowDataPacket {
  knowledge_gaps: string | null
  conversation_id: string
  user_name: string | null
  last_activity_at: string | null
}

interface GuardrailRow extends RowDataPacket {
  id: string
  rule_type: string
  enabled: boolean
  config: string
}

interface ComplianceViolationRow extends RowDataPacket {
  compliance_violations: string | null
  conversation_id: string
  user_name: string | null
  last_activity_at: string | null
  created_at: string
}

interface PermissionRow extends RowDataPacket {
  role: string
  tool_patterns: string | null
}

interface WorkspaceStatsRow extends RowDataPacket {
  today: number
  week: number
  month: number
  avg_ms: number
  cost_mtd: number
  errors_week: number
  total_week: number
}

interface ActivityLogRow extends RowDataPacket {
  id: string
  consumer_type: string | null
  channel: string | null
  user_name: string | null
  query: string
  tools_called: string | null
  connections_hit: string | null
  tokens_input: number
  tokens_output: number
  cost_usd: number
  duration_ms: number
  error: string | null
  created_at: string
}

interface TicketSummaryRow extends RowDataPacket {
  open_count: number | null
  cold_count: number | null
  closed_today: number | null
  closed_week: number | null
}

interface SentimentRow extends RowDataPacket {
  sentiment_score: number
  cnt: number
}

interface ComplianceStatsRow extends RowDataPacket {
  compliance_violations: string | null
  conversation_id: string
  created_at: string
}

interface KnowledgeGapStatsRow extends RowDataPacket {
  knowledge_gaps: string | null
  created_at: string
}

interface ResolutionRow extends RowDataPacket {
  resolution_status: string
  cnt: number
}

interface CategoryRow extends RowDataPacket {
  category: string
  cnt: number
}

interface ChannelRow extends RowDataPacket {
  consumer_type: string
  cnt: number
}

interface CostUsageRow extends RowDataPacket {
  cost_today: number
  cost_week: number
  cost_month: number
  q_today: number
  q_week: number
  q_month: number
}

interface RecentConversationRow extends RowDataPacket {
  id: string
  status: string
  user_name: string | null
  channel: string | null
  message_count: number
  first_message_at: string | null
  last_activity_at: string | null
  consumer_type: string
  sentiment_score: number | null
  resolution_status: string | null
  total_cost_usd: number | null
  summary: string | null
  category: string | null
}

interface ViolationItem {
  rule: string
  description: string
}

interface KnowledgeGapItem {
  topic: string
  [key: string]: unknown
}

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(255),
  model: z.string().min(1, 'Model is required').max(100),
  team_id: z.string().max(255).optional(),
  team_name: z.string().max(255).optional(),
  system_prompt: z.string().max(10000).optional(),
  org_id: z.string().max(255).optional(),
}).refine((data) => data.team_id || data.team_name, {
  message: 'Select a team or enter a new team name.',
  path: ['team_id'],
})

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  model: z.string().min(1).max(255).optional(),
  system_prompt: z.string().max(10000).optional(),
  cold_timeout_minutes: z.number().int().min(1).max(10080).nullable().optional(),
  close_timeout_minutes: z.number().int().min(1).max(10080).nullable().optional(),
})

const log = pino({ name: 'routes/workspaces' })

const workspaces = new Hono<AuthEnv>()

workspaces.use('/api/workspaces/*', requireAuth)
workspaces.use('/api/workspaces', requireAuth)
workspaces.use('/api/teams', requireAuth)
workspaces.use('/api/connections/*', requireAuth)

// List teams (scoped to authenticated user's org)
workspaces.get('/api/teams', async (c) => {
  const db = getPool()
  const user = c.get('user') as AuthUser
  const [teams] = await db.execute<TeamRow[]>('SELECT id, name FROM teams WHERE org_id = ? ORDER BY name', [user.org_id])
  return c.json({ teams })
})

// Create workspace
workspaces.post('/api/workspaces', async (c) => {
  const db = getPool()
  const result = await parseBody(c, createWorkspaceSchema)
  if (!result.success) return result.response
  const { name, model, team_id, team_name, system_prompt, org_id } = result.data

  // Resolve org_id from request body or authenticated user
  const user = c.get('user') as AuthUser
  const resolvedOrgId = org_id || user.org_id

  // Resolve or create team
  let resolvedTeamId = team_id
  if (!resolvedTeamId && team_name) {
    const [existing] = await db.execute<IdRow[]>(
      'SELECT id FROM teams WHERE org_id = ? AND name = ?', [resolvedOrgId, team_name]
    )
    if (existing[0]) {
      resolvedTeamId = existing[0].id
    } else {
      resolvedTeamId = randomBytes(16).toString('hex')
      try {
        await db.execute(
          'INSERT INTO teams (id, org_id, name) VALUES (?, ?, ?)',
          [resolvedTeamId, resolvedOrgId, team_name]
        )
        log.info({ team: team_name }, 'Team created')
      } catch (err: unknown) {
        // Unique constraint violation — team was created by a concurrent request
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
          const [retry] = await db.execute<IdRow[]>(
            'SELECT id FROM teams WHERE org_id = ? AND name = ?', [resolvedOrgId, team_name]
          )
          if (retry[0]) {
            resolvedTeamId = retry[0].id
          } else {
            return c.json({ error: 'Failed to resolve team.' }, 500)
          }
        } else {
          throw err
        }
      }
    }
  }

  const wsId = `ws-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;

  const [existingWs] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [wsId])
  if (existingWs[0]) {
    return c.json({ error: 'A workspace with this name already exists.' }, 400)
  }

  await db.execute(
    `INSERT INTO workspaces (id, org_id, team_id, name, status, model, system_prompt, max_tool_rounds)
     VALUES (?, ?, ?, ?, 'active', ?, ?, 10)`,
    [wsId, resolvedOrgId || null, resolvedTeamId || null, name, model, system_prompt || 'You are a helpful assistant.']
  )

  log.info({ workspace: wsId, name }, 'Workspace created')
  return c.json({ id: wsId, name, status: 'active' })
})

// List workspaces
workspaces.get('/api/workspaces', async (c) => {
  const db = getPool()
  const [rows] = await db.execute<WorkspaceListRow[]>(`
    SELECT w.id, w.name, t.name as team, w.status, w.model, w.created_at,
      (SELECT COUNT(*) FROM connections WHERE workspace_id = w.id) as connection_count,
      (SELECT COUNT(*) FROM connection_tools ct JOIN connections cn ON ct.connection_id = cn.id WHERE cn.workspace_id = w.id) as tool_count,
      (SELECT COUNT(*) FROM knowledge_sources WHERE workspace_id = w.id) as knowledge_count,
      (SELECT COUNT(*) FROM audit_logs WHERE workspace_id = w.id AND created_at > NOW() - INTERVAL 1 DAY) as queries_today,
      (SELECT COALESCE(SUM(cost_usd), 0) FROM audit_logs WHERE workspace_id = w.id AND MONTH(created_at) = MONTH(NOW()) AND YEAR(created_at) = YEAR(NOW())) as cost_mtd
    FROM workspaces w
    LEFT JOIN teams t ON w.team_id = t.id
    WHERE w.status != 'archived'
    ORDER BY w.name
  `)
  return c.json({ workspaces: rows })
})

// Workspace summary (lightweight)
workspaces.get('/api/workspaces/:id/summary', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const [rows] = await db.execute<WorkspaceSummaryRow[]>(
    'SELECT w.id, w.name, w.status, w.model, w.system_prompt, w.max_tool_rounds, w.cold_timeout_minutes, w.close_timeout_minutes, w.created_by, t.name as team FROM workspaces w LEFT JOIN teams t ON w.team_id = t.id WHERE w.id = ?', [wsId]
  )
  if (!rows[0]) return c.json({ error: 'Workspace not found' }, 404)
  return c.json({ workspace: rows[0] })
})

// Delete connection
workspaces.delete('/api/connections/:id', async (c) => {
  const db = getPool()
  const connId = c.req.param('id')
  await db.execute('DELETE FROM connection_tools WHERE connection_id = ?', [connId])
  await db.execute('DELETE FROM connections WHERE id = ?', [connId])
  return c.json({ status: 'ok' })
})

// Workspace connections
workspaces.get('/api/workspaces/:id/connections', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const [connections] = await db.execute<ConnectionSelectRow[]>('SELECT id, name, type, status, config FROM connections WHERE workspace_id = ?', [wsId])
  const [tools] = await db.execute<ToolJoinRow[]>(`
    SELECT ct.id, ct.name, ct.description, ct.input_schema, ct.is_write, cn.name as connection_name
    FROM connection_tools ct JOIN connections cn ON ct.connection_id = cn.id WHERE cn.workspace_id = ?
  `, [wsId])
  return c.json({ connections, tools })
})

// Workspace consumers
workspaces.get('/api/workspaces/:id/consumers', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const [consumers] = await db.execute<ConsumerSelectRow[]>('SELECT id, type, config, status FROM consumers WHERE workspace_id = ?', [wsId])
  return c.json({ consumers })
})

// Workspace knowledge
workspaces.get('/api/workspaces/:id/knowledge', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const [knowledge] = await db.execute<KnowledgeRow[]>('SELECT id, type, name, config, status, chunks, last_synced_at FROM knowledge_sources WHERE workspace_id = ?', [wsId])

  const [gapRows] = await db.execute<KnowledgeGapRow[]>(`
    SELECT cs.knowledge_gaps, cs.conversation_id, c.user_name, c.last_activity_at
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete'
    ORDER BY cs.created_at DESC LIMIT 20
  `, [wsId])

  const gaps: Array<KnowledgeGapItem & { conversation_id: string; user_name: string | null; timestamp: string | null }> = []
  for (const r of gapRows) {
    const g: KnowledgeGapItem[] = typeof r.knowledge_gaps === 'string' ? JSON.parse(r.knowledge_gaps) : (r.knowledge_gaps || [])
    for (const gi of g) {
      gaps.push({ ...gi, conversation_id: r.conversation_id, user_name: r.user_name, timestamp: r.last_activity_at })
    }
  }

  return c.json({ knowledge, gaps })
})

// Workspace compliance
workspaces.get('/api/workspaces/:id/compliance', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const [guardrails] = await db.execute<GuardrailRow[]>('SELECT id, rule_type, enabled, config FROM guardrails WHERE workspace_id = ?', [wsId])

  const [violationRows] = await db.execute<ComplianceViolationRow[]>(`
    SELECT cs.compliance_violations, cs.conversation_id, c.user_name, c.last_activity_at
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete'
    ORDER BY cs.created_at DESC LIMIT 20
  `, [wsId])

  const violations: Array<ViolationItem & { conversation_id: string; user_name: string | null; timestamp: string | null }> = []
  for (const r of violationRows) {
    const v: ViolationItem[] = typeof r.compliance_violations === 'string' ? JSON.parse(r.compliance_violations) : (r.compliance_violations || [])
    for (const vi of v) {
      violations.push({ ...vi, conversation_id: r.conversation_id, user_name: r.user_name, timestamp: r.last_activity_at })
    }
  }

  return c.json({ guardrails, violations })
})

// Workspace detail (full)
workspaces.get('/api/workspaces/:id', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')

  const [wsRows] = await db.execute<WorkspaceDetailRow[]>(
    'SELECT w.*, t.name as team FROM workspaces w LEFT JOIN teams t ON w.team_id = t.id WHERE w.id = ?', [wsId]
  )
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)
  const ws = wsRows[0]

  const [connections] = await db.execute<ConnectionSelectRow[]>(
    'SELECT id, name, type, status, config FROM connections WHERE workspace_id = ?', [wsId]
  )
  const [tools] = await db.execute<ToolDetailJoinRow[]>(`
    SELECT ct.id, ct.name, ct.description, ct.input_schema, ct.is_write, cn.name as connection_name, cn.type as connection_type
    FROM connection_tools ct JOIN connections cn ON ct.connection_id = cn.id
    WHERE cn.workspace_id = ?
  `, [wsId])
  const [knowledge] = await db.execute<KnowledgeRow[]>(
    'SELECT id, type, name, config, status, chunks, last_synced_at FROM knowledge_sources WHERE workspace_id = ?', [wsId]
  )
  const [guardrailRows] = await db.execute<GuardrailRow[]>(
    'SELECT id, rule_type, enabled, config FROM guardrails WHERE workspace_id = ?', [wsId]
  )
  const [consumers] = await db.execute<ConsumerSelectRow[]>(
    'SELECT id, type, config, status FROM consumers WHERE workspace_id = ?', [wsId]
  )
  const [permissions] = await db.execute<PermissionRow[]>(
    'SELECT role, tool_patterns FROM permissions WHERE workspace_id = ?', [wsId]
  )

  const [statsRows] = await db.execute<WorkspaceStatsRow[]>(`
    SELECT
      (SELECT COUNT(*) FROM audit_logs WHERE workspace_id = ? AND created_at > NOW() - INTERVAL 1 DAY) as today,
      (SELECT COUNT(*) FROM audit_logs WHERE workspace_id = ? AND created_at > NOW() - INTERVAL 7 DAY) as week,
      (SELECT COUNT(*) FROM audit_logs WHERE workspace_id = ? AND MONTH(created_at) = MONTH(NOW())) as month,
      (SELECT COALESCE(AVG(duration_ms), 0) FROM audit_logs WHERE workspace_id = ? AND created_at > NOW() - INTERVAL 1 DAY) as avg_ms,
      (SELECT COALESCE(SUM(cost_usd), 0) FROM audit_logs WHERE workspace_id = ? AND MONTH(created_at) = MONTH(NOW())) as cost_mtd,
      (SELECT COUNT(*) FROM audit_logs WHERE workspace_id = ? AND error IS NOT NULL AND created_at > NOW() - INTERVAL 7 DAY) as errors_week,
      (SELECT COUNT(*) FROM audit_logs WHERE workspace_id = ? AND created_at > NOW() - INTERVAL 7 DAY) as total_week
  `, [wsId, wsId, wsId, wsId, wsId, wsId, wsId])

  const stats = statsRows[0]
  const errorRate = stats.total_week > 0 ? stats.errors_week / stats.total_week : 0

  return c.json({
    workspace: ws,
    connections,
    tools,
    knowledge,
    guardrails: guardrailRows,
    consumers,
    permissions,
    stats: {
      today: stats.today,
      week: stats.week,
      month: stats.month,
      avg_ms: Math.round(stats.avg_ms),
      cost_mtd: Number(stats.cost_mtd),
      error_rate: errorRate,
    },
  })
})

// Update workspace
workspaces.put('/api/workspaces/:id', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const result = await parseBody(c, updateWorkspaceSchema)
  if (!result.success) return result.response
  const { name, model, system_prompt, cold_timeout_minutes, close_timeout_minutes } = result.data

  const [existing] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [wsId])
  if (!existing[0]) return c.json({ error: 'Workspace not found' }, 404)

  await db.execute(
    'UPDATE workspaces SET name = COALESCE(?, name), model = COALESCE(?, model), system_prompt = COALESCE(?, system_prompt), cold_timeout_minutes = COALESCE(?, cold_timeout_minutes), close_timeout_minutes = COALESCE(?, close_timeout_minutes), updated_at = NOW() WHERE id = ?',
    [name || null, model || null, system_prompt ?? null, cold_timeout_minutes || null, close_timeout_minutes || null, wsId]
  )

  return c.json({ status: 'ok' })
})

// Activity log
workspaces.get('/api/workspaces/:id/activity', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')

  const [rows] = await db.execute<ActivityLogRow[]>(
    `SELECT id, consumer_type, channel, user_name, query, tools_called, connections_hit,
            tokens_input, tokens_output, cost_usd, duration_ms, error, created_at
     FROM audit_logs WHERE workspace_id = ?
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [wsId]
  )
  const [countRows] = await db.execute<TotalRow[]>(
    'SELECT COUNT(*) as total FROM audit_logs WHERE workspace_id = ?', [wsId]
  )

  return c.json({ activity: rows, total: countRows[0].total })
})

// Dashboard
workspaces.get('/api/workspaces/:id/dashboard', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')

  const [ticketRows] = await db.execute<TicketSummaryRow[]>(`
    SELECT
      SUM(status = 'open') as open_count,
      SUM(status = 'cold') as cold_count,
      SUM(status = 'closed' AND DATE(closed_at) = CURDATE()) as closed_today,
      SUM(status = 'closed' AND closed_at > NOW() - INTERVAL 7 DAY) as closed_week
    FROM conversations WHERE workspace_id = ?
  `, [wsId])
  const t = ticketRows[0] || {}

  const [sentimentRows] = await db.execute<SentimentRow[]>(`
    SELECT cs.sentiment_score, COUNT(*) as cnt
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete' AND cs.sentiment_score IS NOT NULL
    GROUP BY cs.sentiment_score
  `, [wsId])
  const sentDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sentTotal = 0, sentSum = 0
  for (const r of sentimentRows) {
    sentDist[r.sentiment_score] = r.cnt
    sentTotal += r.cnt
    sentSum += r.sentiment_score * r.cnt
  }

  const [compRows] = await db.execute<ComplianceStatsRow[]>(`
    SELECT cs.compliance_violations, cs.conversation_id, cs.created_at
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete'
    ORDER BY cs.created_at DESC LIMIT 50
  `, [wsId])
  let totalViolations = 0
  const recentViolations: Array<ViolationItem & { conversation_id: string; timestamp: string }> = []
  const violationsByRule: Record<string, number> = {}
  for (const r of compRows) {
    const v: ViolationItem[] = typeof r.compliance_violations === 'string' ? JSON.parse(r.compliance_violations) : (r.compliance_violations || [])
    totalViolations += v.length
    for (const vi of v) {
      violationsByRule[vi.rule] = (violationsByRule[vi.rule] || 0) + 1
      if (recentViolations.length < 5) {
        recentViolations.push({ rule: vi.rule, description: vi.description, conversation_id: r.conversation_id, timestamp: r.created_at })
      }
    }
  }

  const [gapRows] = await db.execute<KnowledgeGapStatsRow[]>(`
    SELECT cs.knowledge_gaps, cs.created_at
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete'
    ORDER BY cs.created_at DESC LIMIT 50
  `, [wsId])
  const gapCounts: Record<string, { count: number; last_seen: string }> = {}
  for (const r of gapRows) {
    const gaps: KnowledgeGapItem[] = typeof r.knowledge_gaps === 'string' ? JSON.parse(r.knowledge_gaps) : (r.knowledge_gaps || [])
    for (const g of gaps) {
      if (!gapCounts[g.topic]) gapCounts[g.topic] = { count: 0, last_seen: r.created_at }
      gapCounts[g.topic].count++
    }
  }
  const topGaps = Object.entries(gapCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([topic, { count, last_seen }]) => ({ topic, count, last_seen }))

  const [resRows] = await db.execute<ResolutionRow[]>(`
    SELECT cs.resolution_status, COUNT(*) as cnt
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete'
    GROUP BY cs.resolution_status
  `, [wsId])
  const resolution: Record<string, number> = { resolved: 0, unresolved: 0, escalated: 0, abandoned: 0 }
  for (const r of resRows) resolution[r.resolution_status] = r.cnt

  const [catRows] = await db.execute<CategoryRow[]>(`
    SELECT cs.category, COUNT(*) as cnt
    FROM conversation_stats cs
    JOIN conversations c ON cs.conversation_id = c.id
    WHERE c.workspace_id = ? AND cs.stats_status = 'complete' AND cs.category IS NOT NULL
    GROUP BY cs.category ORDER BY cnt DESC
  `, [wsId])
  const categories: Record<string, number> = {}
  for (const r of catRows) categories[r.category] = r.cnt

  const [chanRows] = await db.execute<ChannelRow[]>(`
    SELECT consumer_type, COUNT(*) as cnt
    FROM conversations WHERE workspace_id = ?
    GROUP BY consumer_type ORDER BY cnt DESC
  `, [wsId])
  const channels: Record<string, number> = {}
  for (const r of chanRows) channels[r.consumer_type] = r.cnt

  const [costRows] = await db.execute<CostUsageRow[]>(`
    SELECT
      COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL 1 DAY THEN cost_usd ELSE 0 END), 0) as cost_today,
      COALESCE(SUM(CASE WHEN created_at > NOW() - INTERVAL 7 DAY THEN cost_usd ELSE 0 END), 0) as cost_week,
      COALESCE(SUM(CASE WHEN MONTH(created_at) = MONTH(NOW()) THEN cost_usd ELSE 0 END), 0) as cost_month,
      SUM(CASE WHEN created_at > NOW() - INTERVAL 1 DAY THEN 1 ELSE 0 END) as q_today,
      SUM(CASE WHEN created_at > NOW() - INTERVAL 7 DAY THEN 1 ELSE 0 END) as q_week,
      SUM(CASE WHEN MONTH(created_at) = MONTH(NOW()) THEN 1 ELSE 0 END) as q_month
    FROM audit_logs WHERE workspace_id = ?
  `, [wsId])
  const cu = costRows[0] || {}

  const [recentRows] = await db.execute<RecentConversationRow[]>(`
    SELECT c.id, c.status, c.user_name, c.channel, c.message_count,
      c.first_message_at, c.last_activity_at, c.consumer_type,
      cs.sentiment_score, cs.resolution_status, cs.total_cost_usd, cs.summary, cs.category
    FROM conversations c
    LEFT JOIN conversation_stats cs ON cs.conversation_id = c.id
    WHERE c.workspace_id = ?
    ORDER BY c.last_activity_at DESC LIMIT 10
  `, [wsId])

  return c.json({
    tickets: {
      open: Number(t.open_count) || 0,
      cold: Number(t.cold_count) || 0,
      closed_today: Number(t.closed_today) || 0,
      closed_week: Number(t.closed_week) || 0,
    },
    sentiment: {
      average: sentTotal > 0 ? Math.round((sentSum / sentTotal) * 10) / 10 : 0,
      distribution: sentDist,
    },
    compliance: {
      total_violations: totalViolations,
      recent: recentViolations,
      by_rule: violationsByRule,
    },
    knowledge_gaps: { topics: topGaps },
    resolution,
    cost: { today: Number(cu.cost_today) || 0, this_week: Number(cu.cost_week) || 0, this_month: Number(cu.cost_month) || 0 },
    usage: { queries_today: Number(cu.q_today) || 0, queries_this_week: Number(cu.q_week) || 0, queries_this_month: Number(cu.q_month) || 0 },
    recent_conversations: recentRows,
    categories,
    channels,
  })
})

export default workspaces
