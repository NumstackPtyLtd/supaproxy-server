import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import { parseBody } from './validate.js'

const testSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  age: z.number().int().min(0).optional(),
})

function createApp() {
  const app = new Hono()
  app.post('/test', async (c) => {
    const result = await parseBody(c, testSchema)
    if (!result.success) return result.response
    return c.json({ ok: true, data: result.data })
  })
  return app
}

describe('parseBody', () => {
  it('parses valid input', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', age: 30 }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Alice')
    expect(body.data.age).toBe(30)
  })

  it('returns 400 for missing required fields', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Validation failed')
    expect(body.fields.name).toBeDefined()
  })

  it('returns 400 for invalid field types', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', age: 'not-a-number' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.fields.age).toBeDefined()
  })

  it('returns 400 for empty name', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.fields.name).toBe('Name is required')
  })

  it('handles malformed JSON gracefully', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('accepts optional fields when missing', async () => {
    const app = createApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.age).toBeUndefined()
  })
})
