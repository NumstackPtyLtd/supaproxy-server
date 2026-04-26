import { describe, it, expect, vi } from 'vitest'

// Mock the pool to avoid config/DB dependencies
vi.mock('../db/pool.js', () => ({
  getPool: vi.fn(),
}))

const { hashPassword, verifyPassword } = await import('./db.js')

describe('password hashing', () => {
  it('hashes and verifies a password with bcrypt', async () => {
    const hash = await hashPassword('test-password-123')
    expect(hash).not.toBe('test-password-123')
    expect(hash.startsWith('$2')).toBe(true)

    const valid = await verifyPassword('test-password-123', hash)
    expect(valid).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-password')
    const valid = await verifyPassword('wrong-password', hash)
    expect(valid).toBe(false)
  })

  it('verifies legacy SHA256 hashes', async () => {
    const { createHash, randomBytes } = await import('crypto')
    const salt = randomBytes(16).toString('hex')
    const hash = createHash('sha256').update('legacy-pass' + salt).digest('hex')
    const stored = `${salt}:${hash}`

    const valid = await verifyPassword('legacy-pass', stored)
    expect(valid).toBe(true)

    const invalid = await verifyPassword('wrong-pass', stored)
    expect(invalid).toBe(false)
  })
})
