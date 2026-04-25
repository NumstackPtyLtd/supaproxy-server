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

const log = pino({ name: 'supaproxy' })

// --- Init ---
const pool = getPool()
await runMigrations(pool)

// --- Hono app ---
const app = new Hono()
app.use('*', cors({ origin: CORS_ORIGINS, credentials: true }))

// Health check
app.get('/health', async (c) => {
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
})

// Models — served from DB in production, this is the bootstrap fallback
app.get('/api/models', async (c) => {
  try {
    const [rows] = await pool.execute<ModelRow[]>(
      "SELECT id, label, is_default FROM models WHERE enabled = 1 ORDER BY sort_order"
    )
    if (rows.length > 0) {
      return c.json({ models: rows })
    }
  } catch (err) {
    // Table may not exist yet — fall through to fallback
    log.warn({ error: err instanceof Error ? err.message : err }, 'Models table query failed, using fallback')
  }
  // Models table not yet seeded — return empty list
  return c.json({ models: [] })
})

// Mount route modules
app.route('/', auth)
app.route('/', org)
app.route('/', queuesRouter)
app.route('/', workspacesRouter)
app.route('/', conversationsRouter)
app.route('/', connectorsRouter)
app.route('/', queryRouter)

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
