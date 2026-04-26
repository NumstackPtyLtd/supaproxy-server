import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import type { RowDataPacket } from 'mysql2'
import pino from 'pino'
import { getPool } from '../db/pool.js'
import { parseBody } from '../middleware/validate.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import type { IdRow } from '../db/types.js'

/** Slack auth.test API response */
interface SlackAuthTestResponse {
  ok: boolean
  error?: string
  user?: string
  team?: string
}

/** Consumer bound to another workspace */
interface BoundConsumerRow extends RowDataPacket {
  workspace_id: string
  workspace_name: string
}

/** JSON-RPC response envelope */
interface JsonRpcResponse {
  jsonrpc: string
  id: number
  result?: Record<string, unknown>
  error?: { message: string; code?: number }
  message?: string
}

/** MCP tool from tools/list result */
interface McpToolEntry {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

/** JSON-RPC response with tools list */
interface JsonRpcToolsResponse extends JsonRpcResponse {
  result?: { tools?: McpToolEntry[] } & Record<string, unknown>
}

const slackChannelSchema = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required').max(255),
  channel_id: z.string().min(1, 'channel_id is required').max(100),
  channel_name: z.string().max(255).optional(),
})

const slackConnectSchema = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required').max(255),
  bot_token: z.string().min(1, 'bot_token is required').max(500),
  app_token: z.string().min(1, 'app_token is required').max(500),
  channel_id: z.string().max(100).optional(),
})

const mcpTestSchema = z.object({
  transport: z.enum(['http', 'stdio']).optional(),
  url: z.string().url().max(2048).optional(),
  command: z.string().max(1000).optional(),
})

const mcpSaveSchema = z.object({
  workspace_id: z.string().min(1, 'workspace_id is required').max(255),
  name: z.string().min(1, 'name is required').max(255),
  transport: z.enum(['http', 'stdio']).optional(),
  url: z.string().url().max(2048).optional(),
  command: z.string().max(1000).optional(),
  args: z.array(z.string().max(1000)).max(50).optional(),
})

const log = pino({ name: 'routes/connectors' })

const connectors = new Hono<AuthEnv>()

connectors.use('/api/connectors/*', requireAuth)

// Bind a Slack channel to a workspace (uses the org-wide bot)
connectors.post('/api/connectors/slack-channel', async (c) => {
  const db = getPool()
  const result = await parseBody(c, slackChannelSchema)
  if (!result.success) return result.response
  const { workspace_id, channel_id, channel_name } = result.data

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspace_id])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  const [bound] = await db.execute<BoundConsumerRow[]>(
    `SELECT c.workspace_id, w.name as workspace_name FROM consumers c
     JOIN workspaces w ON c.workspace_id = w.id
     WHERE c.type = 'slack' AND c.workspace_id != ? AND JSON_CONTAINS(c.config, JSON_QUOTE(?), '$.channels')`,
    [workspace_id, channel_id]
  )
  if (bound[0]) {
    return c.json({ error: `This channel is already bound to "${bound[0].workspace_name}". A channel can only belong to one workspace.` }, 400)
  }

  const config = JSON.stringify({
    channels: [channel_id],
    channel_name: channel_name || `#${channel_id}`,
    allow_dms: true,
    thread_context: true,
  })

  const [existing] = await db.execute<IdRow[]>(
    'SELECT id FROM consumers WHERE workspace_id = ? AND type = "slack"', [workspace_id]
  )

  if (existing[0]) {
    await db.execute('UPDATE consumers SET config = ?, status = "active" WHERE id = ?', [config, existing[0].id])
  } else {
    await db.execute(
      'INSERT INTO consumers (id, workspace_id, type, config, status) VALUES (?, ?, "slack", ?, "active")',
      [randomBytes(16).toString('hex'), workspace_id, config]
    )
  }

  return c.json({ status: 'saved', message: `Channel ${channel_name || channel_id} bound to this workspace.` })
})

// Connect the org-wide bot (admin only, stores tokens globally)
connectors.post('/api/connectors/slack', async (c) => {
  const db = getPool()
  const result = await parseBody(c, slackConnectSchema)
  if (!result.success) return result.response
  const { workspace_id, bot_token, app_token, channel_id } = result.data

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspace_id])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${bot_token}` },
    })
    const data: SlackAuthTestResponse = await res.json()
    if (!data.ok) {
      return c.json({ error: `Invalid bot token: ${data.error}` }, 400)
    }
    log.info({ bot_user: data.user, team: data.team }, 'Slack bot token verified')
  } catch {
    return c.json({ error: 'Could not verify bot token' }, 400)
  }

  const config = JSON.stringify({
    bot_token,
    app_token,
    channels: channel_id ? [channel_id] : [],
    channel_name: channel_id ? `#channel-${channel_id}` : null,
    allow_dms: true,
    thread_context: true,
  })

  const [existing] = await db.execute<IdRow[]>(
    'SELECT id FROM consumers WHERE workspace_id = ? AND type = "slack"', [workspace_id]
  )

  if (existing[0]) {
    await db.execute('UPDATE consumers SET config = ?, status = "active" WHERE id = ?', [config, existing[0].id])
  } else {
    await db.execute(
      'INSERT INTO consumers (id, workspace_id, type, config, status) VALUES (?, ?, "slack", ?, "active")',
      [randomBytes(16).toString('hex'), workspace_id, config]
    )
  }

  try {
    const { startSlackConsumer } = await import('../consumers/slack.js')
    await startSlackConsumer(bot_token, app_token)
    return c.json({ status: 'connected', message: 'Connected. The bot is now active in your channel.' })
  } catch (err) {
    return c.json({ status: 'saved', message: `Tokens saved but the bot could not start: ${(err as Error).message}. Check the tokens and try again.` })
  }
})

// Test MCP connection
connectors.post('/api/connectors/mcp/test', async (c) => {
  const result = await parseBody(c, mcpTestSchema)
  if (!result.success) return result.response
  const { transport, url, command } = result.data
  const resolvedTransport = transport || (url ? 'http' : 'stdio')

  if (resolvedTransport === 'http') {
    if (!url) return c.json({ error: 'Server URL is required' }, 400)
    try {
      const mcpHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'x-moo-request-id': `sp-init-${Date.now()}` }
      const res = await fetch(url, {
        method: 'POST',
        headers: mcpHeaders,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'supaproxy-test', version: '1.0.0' } } }),
        signal: AbortSignal.timeout(10000),
      })
      const initData: JsonRpcResponse = await res.json()
      if (initData.error) return c.json({ ok: false, error: `MCP error: ${initData.error.message || initData.message}` })

      const toolRes = await fetch(url, {
        method: 'POST',
        headers: { ...mcpHeaders, 'x-moo-request-id': `sp-tools-${Date.now()}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
        signal: AbortSignal.timeout(10000),
      })
      const toolData: JsonRpcToolsResponse = await toolRes.json()
      const tools: McpToolEntry[] = toolData.result?.tools || []
      return c.json({ ok: true, tools: tools.length, server: (initData.result?.serverInfo as Record<string, unknown>)?.name || 'unknown', toolNames: tools.map((t) => t.name) })
    } catch (err) {
      return c.json({ ok: false, error: `Connection failed: ${(err as Error).message}` })
    }
  }

  return c.json({ ok: false, error: 'STDIO connections are tested on first query.' })
})

// Save MCP connection
connectors.post('/api/connectors/mcp', async (c) => {
  const db = getPool()
  const result = await parseBody(c, mcpSaveSchema)
  if (!result.success) return result.response
  const { workspace_id, name, transport, url, command, args } = result.data

  const resolvedTransport = transport || (url ? 'http' : 'stdio')

  if (resolvedTransport === 'http' && !url) {
    return c.json({ error: 'Server URL is required for HTTP transport' }, 400)
  }
  if (resolvedTransport === 'stdio' && !command) {
    return c.json({ error: 'Command is required for STDIO transport' }, 400)
  }

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspace_id])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  const config = resolvedTransport === 'http'
    ? JSON.stringify({ transport: 'http', url })
    : JSON.stringify({ transport: 'stdio', command, args: args || [] })

  const [existing] = await db.execute<IdRow[]>(
    'SELECT id FROM connections WHERE workspace_id = ? AND name = ?', [workspace_id, name]
  )

  let connId: string
  if (existing[0]) {
    connId = existing[0].id
    await db.execute('UPDATE connections SET config = ?, status = "disconnected" WHERE id = ?', [config, connId])
    await db.execute('DELETE FROM connection_tools WHERE connection_id = ?', [connId])
  } else {
    connId = randomBytes(16).toString('hex')
    await db.execute(
      'INSERT INTO connections (id, workspace_id, name, type, status, config) VALUES (?, ?, ?, "mcp", "disconnected", ?)',
      [connId, workspace_id, name, config]
    )
  }

  // Discover tools immediately for HTTP connections
  if (resolvedTransport === 'http' && url) {
    try {
      const saveHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'x-moo-request-id': `sp-save-init-${Date.now()}` }
      const initRes = await fetch(url, {
        method: 'POST',
        headers: saveHeaders,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'supaproxy', version: '1.0.0' } } }),
        signal: AbortSignal.timeout(10000),
      })
      await initRes.json()

      const toolRes = await fetch(url, {
        method: 'POST',
        headers: { ...saveHeaders, 'x-moo-request-id': `sp-save-tools-${Date.now()}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
        signal: AbortSignal.timeout(10000),
      })
      const toolData: JsonRpcToolsResponse = await toolRes.json()
      const tools: McpToolEntry[] = toolData.result?.tools || []

      if (tools.length > 0) {
        const values = tools.map((t) => [randomBytes(16).toString('hex'), connId, t.name, t.description || '', JSON.stringify(t.inputSchema || {}), 0])
        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
        await db.execute(
          `INSERT INTO connection_tools (id, connection_id, name, description, input_schema, is_write) VALUES ${placeholders}`,
          values.flat()
        )
      }

      await db.execute('UPDATE connections SET status = "connected" WHERE id = ?', [connId])
      return c.json({ status: 'saved', message: `Connected — ${tools.length} tools discovered.`, tools: tools.length })
    } catch (err) {
      return c.json({ status: 'saved', message: `Saved but could not discover tools: ${(err as Error).message}`, tools: 0 })
    }
  }

  return c.json({ status: 'saved', message: 'Connection saved. Tools will be discovered on the first query.' })
})

export default connectors
