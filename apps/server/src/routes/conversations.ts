import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import type { RowDataPacket } from 'mysql2'
import pino from 'pino'
import { getPool } from '../db/pool.js'
import type { ConversationRow, ConversationStatsRow, TotalRow } from '../db/types.js'

/** JOIN of conversations + conversation_stats for list queries */
interface ConversationWithStatsRow extends RowDataPacket {
  id: string
  workspace_id: string
  consumer_type: string
  external_thread_id: string | null
  status: 'open' | 'cold' | 'closed'
  user_id: string | null
  user_name: string | null
  channel: string | null
  message_count: number
  first_message_at: string | null
  last_activity_at: string | null
  cold_at: string | null
  closed_at: string | null
  parent_conversation_id: string | null
  created_at: string
  updated_at: string
  sentiment_score: number | null
  resolution_status: string | null
  summary: string | null
  total_cost_usd: number | null
  category: string | null
  knowledge_gaps: string | null
  compliance_violations: string | null
  fraud_indicators: string | null
  tools_used: string | null
  stats_message_count: number | null
  duration_seconds: number | null
  stats_status: 'pending' | 'complete' | 'failed' | null
}

/** Distinct filter values row from conversations + stats */
interface ConversationFilterRow extends RowDataPacket {
  status: string | null
  consumer_type: string | null
  category: string | null
  resolution_status: string | null
}

/** Joined message + audit log fields */
interface MessageWithAuditRow extends RowDataPacket {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  audit_log_id: string | null
  tools_called: string | null
  connections_hit: string | null
  tokens_input: number | null
  tokens_output: number | null
  cost_usd: number | null
  duration_ms: number | null
  query_error: string | null
}

/** Partial stats row for close endpoint */
interface StatsStatusRow extends RowDataPacket {
  id: string
  stats_status: 'pending' | 'complete' | 'failed'
}

const log = pino({ name: 'routes/conversations' })

const conversations = new Hono()

conversations.get('/api/workspaces/:id/conversations', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')
  const status = c.req.query('status')
  const limit = parseInt(c.req.query('limit') || '20')
  const offset = parseInt(c.req.query('offset') || '0')

  const category = c.req.query('category')
  const resolution = c.req.query('resolution')
  const consumer = c.req.query('consumer')

  let where = 'c.workspace_id = ?'
  const params: (string | number)[] = [wsId]
  if (status) { where += ' AND c.status = ?'; params.push(status) }
  if (category) { where += ' AND cs.category = ?'; params.push(category) }
  if (resolution) { where += ' AND cs.resolution_status = ?'; params.push(resolution) }
  if (consumer) { where += ' AND c.consumer_type = ?'; params.push(consumer) }

  const [rows] = await db.execute<ConversationWithStatsRow[]>(`
    SELECT c.*, cs.sentiment_score, cs.resolution_status, cs.summary, cs.total_cost_usd,
           cs.category, cs.knowledge_gaps, cs.compliance_violations, cs.fraud_indicators, cs.tools_used, cs.message_count as stats_message_count,
           cs.duration_seconds, cs.stats_status
    FROM conversations c
    LEFT JOIN conversation_stats cs ON cs.conversation_id = c.id
    WHERE ${where}
    ORDER BY c.last_activity_at DESC LIMIT ${limit} OFFSET ${offset}
  `, params)

  const [countRows] = await db.execute<TotalRow[]>(`
    SELECT COUNT(*) as total FROM conversations c
    LEFT JOIN conversation_stats cs ON cs.conversation_id = c.id
    WHERE ${where}
  `, params)

  // Return distinct filter values for dynamic filter bar
  const [filterRows] = await db.execute<ConversationFilterRow[]>(`
    SELECT
      DISTINCT c.status, c.consumer_type, cs.category, cs.resolution_status
    FROM conversations c
    LEFT JOIN conversation_stats cs ON cs.conversation_id = c.id
    WHERE c.workspace_id = ?
  `, [wsId])

  const filters: Record<string, string[]> = { status: [], consumer: [], category: [], resolution: [] }
  for (const r of filterRows) {
    if (r.status && !filters.status.includes(r.status)) filters.status.push(r.status)
    if (r.consumer_type && !filters.consumer.includes(r.consumer_type)) filters.consumer.push(r.consumer_type)
    if (r.category && !filters.category.includes(r.category)) filters.category.push(r.category)
    if (r.resolution_status && !filters.resolution.includes(r.resolution_status)) filters.resolution.push(r.resolution_status)
  }

  return c.json({ conversations: rows, total: countRows[0].total, filters })
})

conversations.get('/api/workspaces/:id/conversations/:cid', async (c) => {
  const db = getPool()
  const cid = c.req.param('cid')

  const [convRows] = await db.execute<ConversationRow[]>('SELECT * FROM conversations WHERE id = ?', [cid])
  if (!convRows[0]) return c.json({ error: 'Conversation not found' }, 404)

  const [messages] = await db.execute<MessageWithAuditRow[]>(
    `SELECT cm.id, cm.role, cm.content, cm.created_at, cm.audit_log_id,
            al.tools_called, al.connections_hit, al.tokens_input, al.tokens_output,
            al.cost_usd, al.duration_ms, al.error as query_error
     FROM conversation_messages cm
     LEFT JOIN audit_logs al ON cm.audit_log_id = al.id
     WHERE cm.conversation_id = ? ORDER BY cm.seq ASC`, [cid]
  )
  const [statsRows] = await db.execute<ConversationStatsRow[]>('SELECT * FROM conversation_stats WHERE conversation_id = ?', [cid])

  return c.json({
    conversation: convRows[0],
    messages,
    stats: statsRows[0] || null,
  })
})

conversations.post('/api/workspaces/:id/conversations/:cid/close', async (c) => {
  const db = getPool()
  const cid = c.req.param('cid')

  const [convRows] = await db.execute<ConversationRow[]>('SELECT * FROM conversations WHERE id = ?', [cid])
  if (!convRows[0]) return c.json({ error: 'Conversation not found' }, 404)

  if (convRows[0].status !== 'closed') {
    await db.execute("UPDATE conversations SET status = 'closed', closed_at = NOW() WHERE id = ?", [cid])
  }

  const statsId = randomBytes(16).toString('hex')
  const [existingStats] = await db.execute<StatsStatusRow[]>('SELECT id, stats_status FROM conversation_stats WHERE conversation_id = ?', [cid])
  if (existingStats[0]) {
    if (existingStats[0].stats_status !== 'complete') {
      await db.execute("UPDATE conversation_stats SET stats_status = 'pending' WHERE id = ?", [existingStats[0].id])
    }
  } else {
    await db.execute(
      "INSERT INTO conversation_stats (id, conversation_id, stats_status) VALUES (?, ?, 'pending')",
      [statsId, cid]
    )
  }

  try {
    const { statsQueue } = await import('../core/lifecycle.js')
    await statsQueue.add('generate-stats', { conversationId: cid })
    log.info({ conversationId: cid }, 'Conversation closed manually, analysis queued')
  } catch (err) {
    log.warn({ error: (err as Error).message }, 'Could not queue stats — lifecycle will pick it up')
  }

  return c.json({ status: 'closed', message: 'Conversation closed. Analysis is running.' })
})

export default conversations
