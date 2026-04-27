import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import type { RowDataPacket } from 'mysql2'
import pino from 'pino'
import { getPool } from '../db/pool.js'
import { parseBody } from '../middleware/validate.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import type { IdRow } from '../db/types.js'

/** Consumer bound to another workspace */
interface BoundConsumerRow extends RowDataPacket {
  workspace_id: string
  workspace_name: string
}

/** Slack auth.test API response */
interface SlackAuthTestResponse {
  ok: boolean
  error?: string
  user?: string
  team?: string
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

const consumerChannelSchema = z.object({
  type: z.string().min(1, 'Consumer type is required'),
  workspace_id: z.string().min(1, 'workspace_id is required').max(255),
  channel_id: z.string().min(1, 'channel_id is required').max(100),
  channel_name: z.string().max(255).optional(),
})

const consumerConnectSchema = z.object({
  type: z.string().min(1, 'Consumer type is required'),
  workspace_id: z.string().min(1, 'workspace_id is required').max(255),
  credentials: z.record(z.string().max(500)),
  channel_id: z.string().max(100).optional(),
})

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

// ── Consumer type registry ──
// Each consumer type registers a credential validator and a connect handler.
// New consumer types (WhatsApp, Discord, webhook) plug in here without new routes.

interface ConsumerTypeHandler {
  /** Validate credentials and return a config object to store */
  buildConfig(credentials: Record<string, string>, channelId?: string, channelName?: string): string
  /** Verify credentials are valid (e.g. call external API). Throws on failure. */
  verifyCredentials(credentials: Record<string, string>): Promise<void>
  /** Start the consumer after connecting. Optional — some types don't need a running process. */
  start?(credentials: Record<string, string>): Promise<void>
}

async function verifySlackCredentials(credentials: Record<string, string>): Promise<void> {
  const botToken = credentials.bot_token
  if (!botToken) throw new Error('bot_token is required')
  const res = await fetch('https://slack.com/api/auth.test', {
    headers: { Authorization: `Bearer ${botToken}` },
  })
  const data: SlackAuthTestResponse = await res.json()
  if (!data.ok) throw new Error(`Invalid bot token: ${data.error}`)
  log.info({ bot_user: data.user, team: data.team }, 'Consumer credentials verified')
}

const consumerTypes: Record<string, ConsumerTypeHandler> = {
  slack: {
    buildConfig(credentials, channelId, channelName) {
      return JSON.stringify({
        bot_token: credentials.bot_token,
        app_token: credentials.app_token,
        channels: channelId ? [channelId] : [],
        channel_name: channelName || (channelId ? `#channel-${channelId}` : null),
        allow_dms: true,
        thread_context: true,
      })
    },
    verifyCredentials: verifySlackCredentials,
    async start(credentials) {
      const { startSlackConsumer } = await import('../consumers/slack.js')
      await startSlackConsumer(credentials.bot_token, credentials.app_token)
    },
  },
}

// Bind a channel to a workspace consumer
connectors.post('/api/connectors/consumer/channel', async (c) => {
  const db = getPool()
  const result = await parseBody(c, consumerChannelSchema)
  if (!result.success) return result.response
  const { type, workspace_id, channel_id, channel_name } = result.data

  if (!consumerTypes[type]) {
    return c.json({ error: `Unsupported consumer type: ${type}` }, 400)
  }

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspace_id])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  const [bound] = await db.execute<BoundConsumerRow[]>(
    `SELECT c.workspace_id, w.name as workspace_name FROM consumers c
     JOIN workspaces w ON c.workspace_id = w.id
     WHERE c.type = ? AND c.workspace_id != ? AND JSON_CONTAINS(c.config, JSON_QUOTE(?), '$.channels')`,
    [type, workspace_id, channel_id]
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
    'SELECT id FROM consumers WHERE workspace_id = ? AND type = ?', [workspace_id, type]
  )

  if (existing[0]) {
    await db.execute('UPDATE consumers SET config = ?, status = "active" WHERE id = ?', [config, existing[0].id])
  } else {
    await db.execute(
      'INSERT INTO consumers (id, workspace_id, type, config, status) VALUES (?, ?, ?, ?, "active")',
      [randomBytes(16).toString('hex'), workspace_id, type, config]
    )
  }

  return c.json({ status: 'saved', message: `Channel ${channel_name || channel_id} bound to this workspace.` })
})

// Connect a consumer to a workspace (validates credentials, stores config, starts consumer)
connectors.post('/api/connectors/consumer', async (c) => {
  const db = getPool()
  const result = await parseBody(c, consumerConnectSchema)
  if (!result.success) return result.response
  const { type, workspace_id, credentials, channel_id } = result.data

  const handler = consumerTypes[type]
  if (!handler) {
    return c.json({ error: `Unsupported consumer type: ${type}` }, 400)
  }

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspace_id])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  try {
    await handler.verifyCredentials(credentials)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400)
  }

  const config = handler.buildConfig(credentials, channel_id)

  const [existing] = await db.execute<IdRow[]>(
    'SELECT id FROM consumers WHERE workspace_id = ? AND type = ?', [workspace_id, type]
  )

  if (existing[0]) {
    await db.execute('UPDATE consumers SET config = ?, status = "active" WHERE id = ?', [config, existing[0].id])
  } else {
    await db.execute(
      'INSERT INTO consumers (id, workspace_id, type, config, status) VALUES (?, ?, ?, ?, "active")',
      [randomBytes(16).toString('hex'), workspace_id, type, config]
    )
  }

  if (handler.start) {
    try {
      await handler.start(credentials)
      return c.json({ status: 'connected', message: 'Connected. The consumer is now active.' })
    } catch (err) {
      return c.json({ status: 'saved', message: `Credentials saved but the consumer could not start: ${(err as Error).message}. Check the credentials and try again.` })
    }
  }

  return c.json({ status: 'saved', message: 'Consumer configured.' })
})

// Bind a Slack channel to a workspace (SDK-facing shorthand)
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

  return c.json({ status: 'ok', message: `Channel ${channel_name || channel_id} bound to this workspace.` })
})

// Connect Slack bot to a workspace with credentials (SDK-facing shorthand)
connectors.post('/api/connectors/slack', async (c) => {
  const db = getPool()
  const result = await parseBody(c, slackConnectSchema)
  if (!result.success) return result.response
  const { workspace_id, bot_token, app_token, channel_id } = result.data

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspace_id])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  const credentials = { bot_token, app_token }
  try {
    await verifySlackCredentials(credentials)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400)
  }

  const config = consumerTypes.slack.buildConfig(credentials, channel_id)

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
    await consumerTypes.slack.start!(credentials)
    return c.json({ status: 'ok', message: 'Connected. The Slack consumer is now active.' })
  } catch (err) {
    return c.json({ status: 'ok', message: `Credentials saved but the consumer could not start: ${(err as Error).message}. Check the credentials and try again.` })
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
