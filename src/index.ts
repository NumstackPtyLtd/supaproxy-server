import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getCookie } from 'hono/cookie'
import pino from 'pino'
import { getPool } from './db/pool.js'
import { runMigrations } from './db/migrations.js'
import { CORS_ORIGINS, DASHBOARD_URL, PORT } from './config.js'
import { createContainer } from './container.js'
import docs from './openapi.js'

const log = pino({ name: 'supaproxy' })

// --- Init ---
const pool = getPool()
await runMigrations(pool)

// --- Composition root ---
const container = createContainer(pool)

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
    const token = getCookie(c, 'supaproxy_session')
    const payload = token ? container.tokenService.verify(token) : null

    if (!payload) return c.json({ status: 'ok' })

    const result = await container.getHealthUseCase.executeAuthenticated()
    return c.json(result)
  } catch (err) {
    log.error({ error: (err as Error).message }, 'Health check failed')
    return c.json({ status: 'error' }, 500)
  }
})

// Models endpoint
app.get('/api/models', async (c) => {
  const models = await container.getModelsUseCase.execute()
  return c.json({ models })
})

// Mount route modules
app.route('/', container.authRoutes)
app.route('/', container.orgRoutes)
app.route('/', container.queueRoutes)
app.route('/', container.workspaceRoutes)
app.route('/', container.conversationRoutes)
app.route('/', container.connectorRoutes)
app.route('/', container.queryRoutes)

// API docs (mounted last)
app.route('/', docs)

// --- Start ---
const workspaceCount = await container.workspaceRepo.getActiveWorkspaceCount()
log.info({ port: PORT, workspaces: workspaceCount }, 'SupaProxy server starting')

serve({ fetch: app.fetch, port: PORT }, async () => {
  log.info({ port: PORT }, 'SupaProxy API listening')
  log.info({ dashboard: DASHBOARD_URL }, 'Dashboard URL')

  // Start Slack bot
  try {
    const botToken = await container.orgRepo.getSettingValue('slack_bot_token')
    const appToken = await container.orgRepo.getSettingValue('slack_app_token')
    if (botToken && appToken) {
      const { startSlackConsumer } = await import('./infrastructure/consumers/SlackConsumer.js')
      await startSlackConsumer(botToken, appToken, container)
    } else {
      log.info('Slack bot not configured - set tokens in Settings > Integrations')
    }
  } catch (err) {
    log.warn({ error: (err as Error).message }, 'Slack consumer failed - server continues without it')
  }

  // Start lifecycle workers
  await container.queueService.startWorkers(container.lifecycleUseCase)
})
