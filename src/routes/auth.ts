import { Hono } from 'hono'
import { setCookie, getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import pino from 'pino'
import { getPool } from '../db/pool.js'
import { findUserByEmail, verifyPassword, hashPassword } from '../auth/db.js'
import { JWT_SECRET, DASHBOARD_URL, IS_PRODUCTION, COOKIE_DOMAIN } from '../config.js'
import { parseBody } from '../middleware/validate.js'
import type { IdRow } from '../db/types.js'

const log = pino({ name: 'routes/auth' })

const SESSION_MAX_AGE = 86400 // 24h

const signupSchema = z.object({
  org_name: z.string().min(1, 'Organisation name is required').max(255),
  admin_name: z.string().min(1, 'Admin name is required').max(255),
  admin_email: z.string().email('A valid email is required').max(255),
  admin_password: z.string().min(8, 'Password must be at least 8 characters').max(255),
  workspace_name: z.string().min(1, 'Workspace name is required').max(255),
  team_name: z.string().min(1, 'Team name is required').max(255),
  system_prompt: z.string().max(10000).optional(),
})

const auth = new Hono()

// --- Signup (create account + org + workspace) ---
auth.post('/api/signup', async (c) => {
  const db = getPool()
  const result = await parseBody(c, signupSchema)
  if (!result.success) return result.response
  const { org_name, admin_name, admin_email, admin_password, workspace_name, team_name, system_prompt } = result.data

  const [emailCheck] = await db.execute<IdRow[]>('SELECT id FROM users WHERE email = ?', [admin_email])
  if (emailCheck[0]) {
    return c.json({ error: 'An account with this email already exists. Sign in instead.' }, 400)
  }

  const orgId = randomBytes(16).toString('hex')
  const userId = randomBytes(16).toString('hex')
  const teamId = randomBytes(16).toString('hex')
  const slug = org_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const wsId = `ws-${workspace_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`

  await db.execute(
    'INSERT INTO organisations (id, name, slug) VALUES (?, ?, ?)',
    [orgId, org_name, slug]
  )

  const hash = await hashPassword(admin_password)
  await db.execute(
    'INSERT INTO users (id, org_id, email, name, password_hash, org_role) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, orgId, admin_email, admin_name, hash, 'admin']
  )

  await db.execute(
    'INSERT INTO teams (id, org_id, name) VALUES (?, ?, ?)',
    [teamId, orgId, team_name]
  )

  await db.execute(
    `INSERT INTO workspaces (id, org_id, team_id, name, status, model, system_prompt, max_tool_rounds, created_by)
     VALUES (?, ?, ?, ?, 'active', '', ?, 10, ?)`,
    [wsId, orgId, teamId, workspace_name, system_prompt || 'You are a helpful assistant.', userId]
  )

  const token = jwt.sign(
    { id: userId, email: admin_email, name: admin_name, role: 'admin', org_id: orgId },
    JWT_SECRET,
    { expiresIn: '24h' }
  )

  setCookie(c, 'supaproxy_session', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
  })

  log.info({ org: org_name, admin: admin_email, workspace: wsId }, 'Setup complete — org, admin, team, workspace created')
  return c.json({ status: 'ok', org_id: orgId, user_id: userId, workspace_id: wsId })
})

// --- Login ---
const loginSchema = z.object({
  email: z.string().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
})

auth.post('/api/auth/login', async (c) => {
  const contentType = c.req.header('content-type') || ''
  const isFormSubmit = contentType.includes('form')

  let email: string
  let password: string

  if (isFormSubmit) {
    const body = await c.req.parseBody()
    email = body.email as string
    password = body.password as string
  } else {
    const result = await parseBody(c, loginSchema)
    if (!result.success) return result.response
    email = result.data.email
    password = result.data.password
  }

  if (!email || !password) {
    if (isFormSubmit && DASHBOARD_URL) return c.redirect(`${DASHBOARD_URL}/login?error=missing_fields`)
    return c.json({ error: 'Email and password are required.' }, 400)
  }

  const user = await findUserByEmail(email)
  if (!user) {
    if (isFormSubmit && DASHBOARD_URL) return c.redirect(`${DASHBOARD_URL}/login?error=invalid_credentials`)
    return c.json({ error: 'Invalid credentials.' }, 401)
  }

  const valid = await verifyPassword(password, user.password_hash)
  if (!valid) {
    if (isFormSubmit && DASHBOARD_URL) return c.redirect(`${DASHBOARD_URL}/login?error=invalid_credentials`)
    return c.json({ error: 'Invalid credentials.' }, 401)
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.org_role, org_id: user.org_id },
    JWT_SECRET,
    { expiresIn: '24h' }
  )

  setCookie(c, 'supaproxy_session', token, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }),
  })

  if (isFormSubmit && DASHBOARD_URL) return c.redirect(`${DASHBOARD_URL}/workspaces`)
  return c.json({
    status: 'ok',
    user: { id: user.id, email: user.email, name: user.name, role: user.org_role },
  })
})

// --- Session ---
auth.get('/api/auth/session', (c) => {
  const token = getCookie(c, 'supaproxy_session')
  if (!token) return c.json({ user: null })

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; name: string; role: string; org_id: string }
    return c.json({
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      }
    })
  } catch (err) {
    log.debug({ error: (err as Error).message }, 'Session token invalid')
    return c.json({ user: null })
  }
})

// --- Logout ---
auth.get('/api/auth/logout', (c) => {
  setCookie(c, 'supaproxy_session', '', { path: '/', maxAge: 0, ...(COOKIE_DOMAIN && { domain: COOKIE_DOMAIN }) })
  if (DASHBOARD_URL) return c.redirect(`${DASHBOARD_URL}/login`)
  return c.json({ status: 'ok' })
})

export default auth
