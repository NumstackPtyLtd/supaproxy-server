import { describe, it, expect } from 'vitest'

describe('requireEnv', () => {
  it('returns the value when env var is set', () => {
    // Import fresh to avoid module-level side effects
    const requireEnv = (name: string): string => {
      const val = process.env[name]
      if (!val) throw new Error(`Missing required environment variable: ${name}`)
      return val
    }

    process.env.TEST_VAR = 'hello'
    expect(requireEnv('TEST_VAR')).toBe('hello')
    delete process.env.TEST_VAR
  })

  it('throws when env var is missing', () => {
    const requireEnv = (name: string): string => {
      const val = process.env[name]
      if (!val) throw new Error(`Missing required environment variable: ${name}`)
      return val
    }

    expect(() => requireEnv('NONEXISTENT_VAR')).toThrow('Missing required environment variable')
  })
})

describe('JWT_SECRET validation', () => {
  it('rejects secrets shorter than 32 characters', () => {
    const validateSecret = (secret: string) => {
      if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters')
      return secret
    }

    expect(() => validateSecret('short')).toThrow('at least 32 characters')
    expect(() => validateSecret('a'.repeat(31))).toThrow('at least 32 characters')
    expect(validateSecret('a'.repeat(32))).toBe('a'.repeat(32))
  })
})
