import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { RowDataPacket } from 'mysql2'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import pino from 'pino'
import { getPool } from '../db/pool.js'
import { runAgent } from '../core/agent.js'
import { JWT_SECRET } from '../config.js'
import { parseBody } from '../middleware/validate.js'
import type { WorkspaceRow } from '../db/types.js'

/** JWT payload for authenticated users */
interface SessionPayload {
  id: string
  name: string
  email: string
  org_id: string
  org_role: string
}

/** Connection row subset needed for agent dispatch */
interface ConnectionConfigRow extends RowDataPacket {
  name: string
  type: string
  config: string
}

const queryBodySchema = z.object({
  query: z.string().min(1, 'Query is required').max(10000),
  session_id: z.string().max(255).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(100).optional(),
})

const log = pino({ name: 'routes/query' })

const query = new Hono()

query.post('/api/workspaces/:id/query', async (c) => {
  const db = getPool()
  const wsId = c.req.param('id')

  const [wsRows] = await db.execute<WorkspaceRow[]>('SELECT * FROM workspaces WHERE id = ? AND status = "active"', [wsId])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)
  const ws = wsRows[0]

  const [connections] = await db.execute<ConnectionConfigRow[]>(
    'SELECT name, type, config FROM connections WHERE workspace_id = ?', [wsId]
  )

  const parsed = await parseBody(c, queryBodySchema)
  if (!parsed.success) return parsed.response
  const queryText = parsed.data.query

  // Get user from JWT (optional)
  let user: SessionPayload | null = null
  const token = getCookie(c, 'supaproxy_session')
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET) as SessionPayload
    } catch (err) {
      log.debug({ error: (err as Error).message }, 'JWT verification failed for query session')
    }
  }

  const { findOrCreateConversation, getConversationHistory } = await import('../core/conversation.js')
  const sessionId = parsed.data.session_id || `api:${user?.id || 'anon'}:${wsId}:${Date.now()}`
  const conversationId = await findOrCreateConversation(wsId, 'api', sessionId, user?.name, undefined)
  const history = await getConversationHistory(conversationId)

  const result = await runAgent(queryText, {
    workspaceId: wsId,
    model: ws.model,
    systemPrompt: ws.system_prompt || 'You are a helpful assistant.',
    maxToolRounds: ws.max_tool_rounds || 10,
    mcpServers: connections.map((conn) => ({
      name: conn.name,
      type: conn.type,
      config: conn.config,
    })),
  }, history, {
    consumerType: 'api',
    userId: user?.id,
    userName: user?.name,
    conversationId,
  })

  return c.json({
    answer: result.answer,
    tools_called: result.toolsCalled,
    connections_hit: result.connectionsHit,
    tokens: { input: result.tokensInput, output: result.tokensOutput },
    cost_usd: result.costUsd,
    duration_ms: result.durationMs,
    error: result.error,
    conversation_id: conversationId,
    session_id: sessionId,
  })
})

export default query
