import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import { JwtTokenService } from './JwtTokenService.js'

const SECRET = 'test-secret-key'
const PAYLOAD = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  org_id: 'org-1',
}

describe('JwtTokenService', () => {
  const service = new JwtTokenService(SECRET)

  describe('sign', () => {
    it('returns a string token', () => {
      const token = service.sign(PAYLOAD)
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })
  })

  describe('verify', () => {
    it('returns the payload for a valid token', () => {
      const token = service.sign(PAYLOAD)
      const result = service.verify(token)
      expect(result).not.toBeNull()
      expect(result!.id).toBe(PAYLOAD.id)
      expect(result!.email).toBe(PAYLOAD.email)
      expect(result!.name).toBe(PAYLOAD.name)
      expect(result!.role).toBe(PAYLOAD.role)
      expect(result!.org_id).toBe(PAYLOAD.org_id)
    })

    it('returns null for an invalid token', () => {
      const result = service.verify('not.a.valid.token')
      expect(result).toBeNull()
    })

    it('returns null for a token signed with a different secret', () => {
      const otherService = new JwtTokenService('different-secret')
      const token = otherService.sign(PAYLOAD)
      const result = service.verify(token)
      expect(result).toBeNull()
    })

    it('returns null for an expired token', () => {
      const expired = jwt.sign(PAYLOAD, SECRET, { expiresIn: '0s' })
      const result = service.verify(expired)
      expect(result).toBeNull()
    })
  })
})
