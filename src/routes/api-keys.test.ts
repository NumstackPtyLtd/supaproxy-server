import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createHash } from 'crypto'

// Mock config to avoid requiring real env vars
vi.mock('../config.js', () => ({
  JWT_SECRET: 'test-secret-that-is-at-least-32-chars-long',
  PORT: 3001,
  CORS_ORIGINS: ['http://localhost:4322'],
  DASHBOARD_URL: 'http://localhost:4322',
  IS_PRODUCTION: false,
  DEFAULT_MODEL: 'claude-3-5-sonnet-20241022',
}))

// Mock pool to avoid DB dependencies
const mockExecute = vi.fn()
vi.mock('../db/pool.js', () => ({
  getPool: vi.fn(() => ({ execute: mockExecute })),
}))

// Mock requireAuth to always pass — route auth is tested separately
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/auth.js')>()
  return {
    ...actual,
    requireAuth: vi.fn((_c: unknown, next: () => Promise<void>) => next()),
  }
})

const apiKeysRouter = (await import('./api-keys.js')).default
const { requireApiKey } = await import('../middleware/auth.js')
import type { ApiKeyEnv } from '../middleware/auth.js'

// ── requireApiKey middleware ─────────────────────────────────────────

describe('requireApiKey', () => {
  function createTestApp() {
    const app = new Hono<ApiKeyEnv>()
    app.use('*', requireApiKey)
    app.get('/test', (c) => c.json({ workspace_id: c.get('workspace_id'), is_test: c.get('is_test_key') }))
    return app
  }

  beforeEach(() => {
    mockExecute.mockReset()
  })

  it('returns 401 when Authorization header is missing', async () => {
    const app = createTestApp()
    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('API key required')
  })

  it('returns 401 when Authorization header is not Bearer', async () => {
    const app = createTestApp()
    const res = await app.request('/test', { headers: { Authorization: 'Basic abc123' } })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('API key required')
  })

  it('returns 401 for invalid key prefix', async () => {
    const app = createTestApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer invalid_key_12345' } })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid API key format')
  })

  it('returns 401 when key is not found in DB', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const app = createTestApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer sp_live_notfound' } })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid API key')
  })

  it('returns 401 for a revoked key', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'key-1', workspace_id: 'ws-1', revoked_at: '2026-01-01' }]])
    const app = createTestApp()
    const res = await app.request('/test', { headers: { Authorization: 'Bearer sp_live_revokedkey1234' } })
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('API key has been revoked')
  })

  it('passes through with a valid sp_live_ key and sets context', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'key-1', workspace_id: 'ws-abc', revoked_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // last_used_at update
    const app = createTestApp()
    const key = 'sp_live_' + 'a'.repeat(64)
    const res = await app.request('/test', { headers: { Authorization: `Bearer ${key}` } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.workspace_id).toBe('ws-abc')
    expect(body.is_test).toBe(false)
  })

  it('sets is_test_key true for sp_test_ keys', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'key-2', workspace_id: 'ws-xyz', revoked_at: null }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
    const app = createTestApp()
    const key = 'sp_test_' + 'b'.repeat(64)
    const res = await app.request('/test', { headers: { Authorization: `Bearer ${key}` } })
    expect(res.status).toBe(200)
    expect((await res.json()).is_test).toBe(true)
  })

  it('hashes the key before querying DB', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const app = createTestApp()
    const key = 'sp_live_' + 'c'.repeat(64)
    await app.request('/test', { headers: { Authorization: `Bearer ${key}` } })
    const queriedHash = mockExecute.mock.calls[0][1][0]
    const expectedHash = createHash('sha256').update(key).digest('hex')
    expect(queriedHash).toBe(expectedHash)
  })
})

// ── API key routes ───────────────────────────────────────────────────

describe('POST /api/workspaces/:id/api-keys', () => {
  beforeEach(() => mockExecute.mockReset())

  it('creates a key and returns it once', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'ws-1' }]]) // workspace lookup
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // insert

    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'My integration' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.key).toMatch(/^sp_live_[0-9a-f]{64}$/)
    expect(body.prefix).toBe(body.key.slice(0, 16))
    expect(body.label).toBe('My integration')
    expect(body.id).toBeDefined()
  })

  it('creates a test key when test: true', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'ws-1' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])

    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Test key', test: true }),
    })

    const body = await res.json()
    expect(body.key).toMatch(/^sp_test_/)
  })

  it('returns 404 for unknown workspace', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await apiKeysRouter.request('/api/workspaces/unknown/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Key' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when label is missing', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'ws-1' }]])
    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/workspaces/:id/api-keys', () => {
  beforeEach(() => mockExecute.mockReset())

  it('lists active keys without raw key values', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'ws-1' }]])
      .mockResolvedValueOnce([[
        { id: 'k1', key_prefix: 'sp_live_abcd12', label: 'Integration', created_at: '2026-04-27', last_used_at: null },
      ]])

    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0].prefix).toBe('sp_live_abcd12')
    expect(body.keys[0]).not.toHaveProperty('key')
    expect(body.keys[0]).not.toHaveProperty('key_hash')
  })

  it('returns empty array when no keys exist', async () => {
    mockExecute.mockResolvedValueOnce([[{ id: 'ws-1' }]]).mockResolvedValueOnce([[]])
    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys')
    expect(res.status).toBe(200)
    expect((await res.json()).keys).toHaveLength(0)
  })

  it('returns 404 for unknown workspace', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await apiKeysRouter.request('/api/workspaces/unknown/api-keys')
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/workspaces/:id/api-keys/:keyId', () => {
  beforeEach(() => mockExecute.mockReset())

  it('revokes an active key', async () => {
    mockExecute
      .mockResolvedValueOnce([[{ id: 'k1' }]]) // key lookup
      .mockResolvedValueOnce([{ affectedRows: 1 }]) // update

    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys/k1', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('revoked')
  })

  it('returns 404 when key does not exist', async () => {
    mockExecute.mockResolvedValueOnce([[]])
    const res = await apiKeysRouter.request('/api/workspaces/ws-1/api-keys/nope', { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
