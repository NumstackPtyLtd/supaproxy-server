import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock config to avoid env var requirements
vi.mock('../config.js', () => ({
  LOG_DIR: '/tmp/test-logs',
}))

const { estimateCost } = await import('./audit.js')

describe('estimateCost', () => {
  it('returns correct cost for known model', () => {
    const cost = estimateCost({ input: 1_000_000, output: 1_000_000 }, 'claude-sonnet-4-20250514')
    expect(cost).toBe(18)
  })

  it('calculates fractional costs', () => {
    const cost = estimateCost({ input: 500, output: 100 }, 'claude-sonnet-4-20250514')
    expect(cost).toBeCloseTo(0.003)
  })

  it('returns null for unknown model', () => {
    expect(estimateCost({ input: 1000, output: 1000 }, 'unknown-model')).toBeNull()
  })

  it('returns null when model is undefined', () => {
    expect(estimateCost({ input: 1000, output: 1000 })).toBeNull()
  })

  it('returns 0 for zero tokens', () => {
    expect(estimateCost({ input: 0, output: 0 }, 'gpt-4o')).toBe(0)
  })

  it('handles gpt-4o pricing', () => {
    const cost = estimateCost({ input: 1_000_000, output: 1_000_000 }, 'gpt-4o')
    expect(cost).toBe(12.5)
  })

  it('handles gpt-4o-mini pricing', () => {
    const cost = estimateCost({ input: 1_000_000, output: 1_000_000 }, 'gpt-4o-mini')
    expect(cost).toBeCloseTo(0.75)
  })
})
