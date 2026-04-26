import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import type { RowDataPacket } from 'mysql2'
import { getPool } from '../db/pool.js'
import { requireAuth, type AuthUser, type AuthEnv } from '../middleware/auth.js'
import { parseBody } from '../middleware/validate.js'
import type { IdRow } from '../db/types.js'

/** Organisation row for the GET /api/org query (subset of columns) */
interface OrgInfoRow extends RowDataPacket {
  id: string
  name: string
  slug: string
  created_at: string
}

/** Settings row for the GET /api/org/settings query */
interface OrgSettingInfoRow extends RowDataPacket {
  key_name: string
  value: string
  is_secret: boolean
}

/** User list row for GET /api/org/users */
interface OrgUserRow extends RowDataPacket {
  id: string
  name: string
  email: string
  org_role: string
  created_at: string
}

/** Slack auth.test API response */
interface SlackAuthTestResponse {
  ok: boolean
  error?: string
  user?: string
  team?: string
}

/** Integration test handler — validates credentials for a consumer type */
interface IntegrationTestResult {
  ok: boolean
  detail?: Record<string, unknown>
  error?: string
}

type IntegrationTestFn = (credentials: Record<string, string>) => Promise<IntegrationTestResult>

const integrationTesters: Record<string, IntegrationTestFn> = {
  async slack(credentials) {
    const botToken = credentials.bot_token
    if (!botToken) return { ok: false, error: 'bot_token is required' }
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const data: SlackAuthTestResponse = await res.json()
    if (!data.ok) return { ok: false, error: data.error }
    return { ok: true, detail: { bot_name: data.user, team: data.team } }
  },
}

const updateOrgSchema = z.object({
  name: z.string().min(1, 'Organisation name is required').max(255),
})

const updateOrgSettingSchema = z.object({
  value: z.string().max(5000),
})

const integrationTestSchema = z.object({
  type: z.string().min(1, 'Integration type is required'),
  credentials: z.record(z.string().max(500)),
})

const org = new Hono<AuthEnv>()

// All org routes require auth
org.use('/api/org/*', requireAuth)
org.use('/api/org', requireAuth)

org.get('/api/org', async (c) => {
  const db = getPool()
  const user = c.get('user') as AuthUser
  const [rows] = await db.execute<OrgInfoRow[]>('SELECT id, name, slug, created_at FROM organisations WHERE id = ?', [user.org_id])
  if (!rows[0]) return c.json({ error: 'Organisation not found' }, 404)
  return c.json({ org: rows[0] })
})

org.put('/api/org', async (c) => {
  const db = getPool()
  const user = c.get('user') as AuthUser
  const result = await parseBody(c, updateOrgSchema)
  if (!result.success) return result.response
  await db.execute('UPDATE organisations SET name = ? WHERE id = ?', [result.data.name, user.org_id])
  return c.json({ status: 'ok' })
})

org.get('/api/org/settings', async (c) => {
  const db = getPool()
  const user = c.get('user') as AuthUser
  const [rows] = await db.execute<OrgSettingInfoRow[]>('SELECT key_name, value, is_secret FROM org_settings WHERE org_id = ?', [user.org_id])
  const settings: Record<string, string> = {}
  const configured: Record<string, boolean> = {}
  for (const r of rows) {
    settings[r.key_name] = r.is_secret ? '••••••••' : r.value
    configured[r.key_name] = !!(r.value && r.value.length > 0)
  }
  return c.json({ settings, configured })
})

org.put('/api/org/settings/:key', async (c) => {
  const db = getPool()
  const user = c.get('user') as AuthUser
  const key = c.req.param('key')
  const result = await parseBody(c, updateOrgSettingSchema)
  if (!result.success) return result.response
  const { value } = result.data
  const isSecret = key.includes('token') || key.includes('secret') || key.includes('api_key') || key.includes('password')

  const [existing] = await db.execute<IdRow[]>('SELECT id FROM org_settings WHERE org_id = ? AND key_name = ?', [user.org_id, key])
  if (existing[0]) {
    await db.execute('UPDATE org_settings SET value = ?, is_secret = ? WHERE id = ?', [value, isSecret, existing[0].id])
  } else {
    await db.execute('INSERT INTO org_settings (id, org_id, key_name, value, is_secret) VALUES (?, ?, ?, ?, ?)',
      [randomBytes(16).toString('hex'), user.org_id, key, value, isSecret])
  }
  return c.json({ status: 'ok' })
})

org.post('/api/org/integrations/test', async (c) => {
  const result = await parseBody(c, integrationTestSchema)
  if (!result.success) return result.response
  const { type, credentials } = result.data

  const tester = integrationTesters[type]
  if (!tester) {
    return c.json({ error: `Unsupported integration type: ${type}` }, 400)
  }

  try {
    const testResult = await tester(credentials)
    if (!testResult.ok) return c.json({ error: testResult.error }, 400)
    return c.json(testResult.detail || { status: 'ok' })
  } catch {
    return c.json({ error: `Could not reach ${type} service` }, 400)
  }
})

org.get('/api/org/users', async (c) => {
  const db = getPool()
  const user = c.get('user') as AuthUser
  const [rows] = await db.execute<OrgUserRow[]>('SELECT id, name, email, org_role, created_at FROM users WHERE org_id = ? ORDER BY created_at', [user.org_id])
  return c.json({ users: rows })
})

export default org
