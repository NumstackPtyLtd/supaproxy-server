import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import pino from 'pino'
import { getPool } from './db/pool.js'
import { runMigrations } from './db/migrations.js'
import { CORS_ORIGINS, DASHBOARD_URL, PORT } from './config.js'
import type { CountRow, ValueRow, ModelRow } from './db/types.js'

// Route modules
import auth from './routes/auth.js'
import org from './routes/org.js'
import queuesRouter from './routes/queues.js'
import workspacesRouter from './routes/workspaces.js'
import conversationsRouter from './routes/conversations.js'
import connectorsRouter from './routes/connectors.js'
import queryRouter from './routes/query.js'
import docs from './openapi.js'

const log = pino({ name: 'supaproxy' })

// --- Init ---
const pool = getPool()
await runMigrations(pool)

// --- Hono app ---
const app = new Hono()
app.use('*', cors({
  origin: (origin) => CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0],
  credentials: true,
}))
app.onError((err, c) => {
  log.error({ error: err.message, stack: err.stack }, 'Unhandled error')
  return c.json({ error: 'Internal Server Error' }, 500)
})

// Health check
app.get('/health', async (c) => {
  try {
    const [orgRows] = await pool.execute<CountRow[]>('SELECT COUNT(*) as c FROM organisations')
    const [wsRows] = await pool.execute<CountRow[]>('SELECT COUNT(*) as c FROM workspaces WHERE status = "active"')
    const [aiRows] = await pool.execute<ValueRow[]>("SELECT value FROM org_settings WHERE key_name IN ('ai_api_key', 'anthropic_api_key') AND value IS NOT NULL AND value != '' LIMIT 1")
    const [connRows] = await pool.execute<CountRow[]>("SELECT COUNT(*) as c FROM connections WHERE status = 'connected'")
    return c.json({
      status: 'ok',
      setup_complete: orgRows[0].c > 0,
      workspaces: wsRows[0].c,
      ai_configured: aiRows[0]?.value ? true : false,
      connections: connRows[0].c,
    })
  } catch (err) {
    log.error({ error: (err as Error).message }, 'Health check failed')
    return c.json({ status: 'error', message: (err as Error).message }, 500)
  }
})

app.get('/api/models', async (c) => {
  // Return models for the configured provider, or all if no provider set
  const [providerRows] = await pool.execute<ValueRow[]>(
    "SELECT value FROM org_settings WHERE key_name = 'ai_provider'"
  )
  const provider = providerRows[0]?.value

  const [defaultRows] = await pool.execute<ValueRow[]>(
    "SELECT value FROM org_settings WHERE key_name = 'default_model'"
  )
  const defaultModel = defaultRows[0]?.value

  let rows: ModelRow[]
  if (provider) {
    [rows] = await pool.execute<ModelRow[]>(
      "SELECT id, label, is_default FROM models WHERE enabled = 1 AND provider = ? ORDER BY sort_order",
      [provider]
    )
  } else {
    [rows] = await pool.execute<ModelRow[]>(
      "SELECT id, label, is_default FROM models WHERE enabled = 1 ORDER BY sort_order"
    )
  }

  // Mark the org's chosen default
  const models = rows.map(r => ({
    ...r,
    is_default: r.id === defaultModel,
  }))

  return c.json({ models })
})

// Mount route modules
app.route('/', auth)
app.route('/', org)
app.route('/', queuesRouter)
app.route('/', workspacesRouter)
app.route('/', conversationsRouter)
app.route('/', connectorsRouter)
app.route('/', queryRouter)

// API docs (mounted last — spec-only routes for /docs, /api/openapi.json, /public/*)
app.route('/', docs)

// --- Start ---
const [wsCount] = await pool.execute<CountRow[]>('SELECT COUNT(*) as c FROM workspaces WHERE status = "active"')
log.info({ port: PORT, workspaces: wsCount[0].c }, 'SupaProxy server starting')

serve({ fetch: app.fetch, port: PORT }, async () => {
  log.info({ port: PORT }, 'SupaProxy API listening')
  log.info({ dashboard: DASHBOARD_URL }, 'Dashboard URL')

  // Start Slack bot from org_settings (org-wide bot)
  try {
    const [botTokenRows] = await pool.execute<ValueRow[]>(
      "SELECT value FROM org_settings WHERE key_name = 'slack_bot_token' LIMIT 1"
    )
    const [appTokenRows] = await pool.execute<ValueRow[]>(
      "SELECT value FROM org_settings WHERE key_name = 'slack_app_token' LIMIT 1"
    )
    const botToken = botTokenRows[0]?.value
    const appToken = appTokenRows[0]?.value
    if (botToken && appToken) {
      const { startSlackConsumer } = await import('./consumers/slack.js')
      await startSlackConsumer(botToken, appToken)
    } else {
      log.info('Slack bot not configured - set tokens in Settings > Integrations')
    }
  } catch (err) {
    log.warn({ error: (err as Error).message }, 'Slack consumer failed - server continues without it')
  }

  // Start conversation lifecycle loop
  const { startLifecycleLoop } = await import('./core/lifecycle.js')
  startLifecycleLoop()
})
