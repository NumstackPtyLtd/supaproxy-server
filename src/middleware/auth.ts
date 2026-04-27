import { getCookie } from 'hono/cookie'
import { createHash } from 'crypto'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'
import { getPool } from '../db/pool.js'
import type { ApiKeyRow } from '../db/types.js'
import type { Context, Next } from 'hono'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  org_id: string
}

export type AuthEnv = {
  Variables: {
    user: AuthUser | null
  }
}

/** Require a valid JWT. Returns 401 if missing/invalid. Sets c.get('user'). */
export async function requireAuth(c: Context, next: Next) {
  const token = getCookie(c, 'supaproxy_session')
  if (!token) return c.json({ error: 'Not authenticated' }, 401)

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: 'Invalid session' }, 401)
  }
}

export type ApiKeyEnv = {
  Variables: {
    workspace_id: string
    is_test_key: boolean
  }
}

/** Require a valid API key. Returns 401 if missing, invalid, or revoked. Sets workspace_id and is_test_key on context. */
export async function requireApiKey(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return c.json({ error: 'API key required' }, 401)

  const key = authHeader.slice(7)
  if (!key.startsWith('sp_live_') && !key.startsWith('sp_test_')) {
    return c.json({ error: 'Invalid API key format' }, 401)
  }

  const keyHash = createHash('sha256').update(key).digest('hex')
  const db = getPool()
  const [rows] = await db.execute<ApiKeyRow[]>(
    'SELECT id, workspace_id, revoked_at FROM api_keys WHERE key_hash = ?',
    [keyHash]
  )

  const apiKey = rows[0]
  if (!apiKey) return c.json({ error: 'Invalid API key' }, 401)
  if (apiKey.revoked_at) return c.json({ error: 'API key has been revoked' }, 401)

  c.set('workspace_id', apiKey.workspace_id)
  c.set('is_test_key', key.startsWith('sp_test_'))

  // Update last_used_at without blocking the request
  db.execute('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [apiKey.id]).catch(() => {})

  await next()
}

/** Parse JWT if present but don't require it. Sets c.get('user') or null. */
export async function optionalAuth(c: Context, next: Next) {
  const token = getCookie(c, 'supaproxy_session')
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as AuthUser
      c.set('user', payload)
    } catch {
      c.set('user', null)
    }
  } else {
    c.set('user', null)
  }
  await next()
}
