import { Hono } from 'hono'
import { randomBytes, createHash } from 'crypto'
import { z } from 'zod'
import { getPool } from '../db/pool.js'
import { parseBody } from '../middleware/validate.js'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import type { ApiKeyRow, IdRow } from '../db/types.js'

const createKeySchema = z.object({
  label: z.string().min(1, 'Label is required').max(255),
  test: z.boolean().optional(),
})

const apiKeys = new Hono<AuthEnv>()

apiKeys.use('/api/workspaces/:id/api-keys', requireAuth)
apiKeys.use('/api/workspaces/:id/api-keys/*', requireAuth)

apiKeys.post('/api/workspaces/:id/api-keys', async (c) => {
  const db = getPool()
  const workspaceId = c.req.param('id')

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspaceId])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  const result = await parseBody(c, createKeySchema)
  if (!result.success) return result.response

  const { label, test } = result.data
  const prefix = test ? 'sp_test_' : 'sp_live_'
  const key = `${prefix}${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(key).digest('hex')
  const keyPrefix = key.slice(0, 16)
  const id = randomBytes(16).toString('hex')

  await db.execute(
    'INSERT INTO api_keys (id, workspace_id, key_hash, key_prefix, label) VALUES (?, ?, ?, ?, ?)',
    [id, workspaceId, keyHash, keyPrefix, label]
  )

  return c.json({ id, key, prefix: keyPrefix, label, created_at: new Date().toISOString() }, 201)
})

apiKeys.get('/api/workspaces/:id/api-keys', async (c) => {
  const db = getPool()
  const workspaceId = c.req.param('id')

  const [wsRows] = await db.execute<IdRow[]>('SELECT id FROM workspaces WHERE id = ?', [workspaceId])
  if (!wsRows[0]) return c.json({ error: 'Workspace not found' }, 404)

  const [rows] = await db.execute<ApiKeyRow[]>(
    'SELECT id, key_prefix, label, created_at, last_used_at FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
    [workspaceId]
  )

  return c.json({ keys: rows.map((k) => ({ id: k.id, prefix: k.key_prefix, label: k.label, created_at: k.created_at, last_used_at: k.last_used_at })) })
})

apiKeys.delete('/api/workspaces/:id/api-keys/:keyId', async (c) => {
  const db = getPool()
  const workspaceId = c.req.param('id')
  const keyId = c.req.param('keyId')

  const [rows] = await db.execute<ApiKeyRow[]>(
    'SELECT id FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL',
    [keyId, workspaceId]
  )
  if (!rows[0]) return c.json({ error: 'API key not found' }, 404)

  await db.execute('UPDATE api_keys SET revoked_at = NOW() WHERE id = ?', [keyId])

  return c.json({ status: 'revoked', message: 'API key revoked.' })
})

export default apiKeys
