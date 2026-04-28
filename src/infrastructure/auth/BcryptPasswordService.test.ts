import { describe, it, expect } from 'vitest'
import { createHash, randomBytes } from 'crypto'
import { BcryptPasswordService } from './BcryptPasswordService.js'

describe('BcryptPasswordService', () => {
  const service = new BcryptPasswordService()

  describe('hash', () => {
    it('returns a bcrypt hash string', async () => {
      const hash = await service.hash('password123')
      expect(typeof hash).toBe('string')
      expect(hash).toMatch(/^\$2[aby]?\$\d{2}\$/)
    })

    it('produces different hashes for the same password', async () => {
      const hash1 = await service.hash('password123')
      const hash2 = await service.hash('password123')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verify', () => {
    it('returns true for a correct password', async () => {
      const hash = await service.hash('mypassword')
      const result = await service.verify('mypassword', hash)
      expect(result).toBe(true)
    })

    it('returns false for a wrong password', async () => {
      const hash = await service.hash('mypassword')
      const result = await service.verify('wrongpassword', hash)
      expect(result).toBe(false)
    })
  })

  describe('legacy SHA256 support', () => {
    it('returns true for a correct password with legacy salt:hash format', async () => {
      const password = 'legacypass'
      const salt = randomBytes(16).toString('hex')
      const hash = createHash('sha256').update(password + salt).digest('hex')
      const storedHash = `${salt}:${hash}`

      const result = await service.verify(password, storedHash)
      expect(result).toBe(true)
    })

    it('returns false for a wrong password with legacy salt:hash format', async () => {
      const salt = randomBytes(16).toString('hex')
      const hash = createHash('sha256').update('correctpass' + salt).digest('hex')
      const storedHash = `${salt}:${hash}`

      const result = await service.verify('wrongpass', storedHash)
      expect(result).toBe(false)
    })
  })
})
