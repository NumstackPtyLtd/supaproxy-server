import { getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config.js'
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
