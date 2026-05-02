import { describe, it, expect } from 'vitest'
import { runGuardrailChain } from './guardrailChain.js'
import { PatternGuardrail } from '@supaproxy/guardrails'
import type { GuardrailPlugin, ScreeningResult, GuardrailContext } from '@supaproxy/guardrails'

const ctx: GuardrailContext = { workspaceId: 'ws-1' }

describe('runGuardrailChain', () => {
  it('passes clean queries through unchanged', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'What is the weather today?', ctx)

    expect(result.finalAction).toBe('pass')
    expect(result.sanitisedQuery).toBe('What is the weather today?')
    expect(result.results).toHaveLength(1)
  })

  it('redacts email addresses', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'Send an email to john@example.com about the project', ctx)

    expect(result.finalAction).toBe('redact')
    expect(result.sanitisedQuery).toContain('[REDACTED:pii]')
    expect(result.sanitisedQuery).not.toContain('john@example.com')
  })

  it('blocks credit card numbers', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'My card number is 4111111111111111', ctx)

    expect(result.finalAction).toBe('block')
    expect(result.results[0].detectedCategories).toContain('pii')
  })

  it('blocks AWS access keys', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'Use this key AKIAIOSFODNN7EXAMPLE to access S3', ctx)

    expect(result.finalAction).toBe('block')
    expect(result.results[0].detectedCategories).toContain('credentials')
  })

  it('chains multiple guardrails - redactions accumulate', async () => {
    const first = new PatternGuardrail()
    const second: GuardrailPlugin = {
      id: 'custom',
      name: 'Custom',
      description: 'test',
      stage: 'pre-llm',
      async screen(query: string): Promise<ScreeningResult> {
        return { action: 'pass', source: 'custom', detectedCategories: [], confidence: 1, durationMs: 0 }
      },
    }

    const result = await runGuardrailChain([first, second], 'Contact john@example.com', ctx)

    expect(result.finalAction).toBe('redact')
    expect(result.results).toHaveLength(2)
    expect(result.results[0].action).toBe('redact')
    expect(result.results[1].action).toBe('pass')
  })

  it('first block stops the chain', async () => {
    const blocker: GuardrailPlugin = {
      id: 'blocker',
      name: 'Blocker',
      description: 'test',
      stage: 'pre-llm',
      async screen(): Promise<ScreeningResult> {
        return { action: 'block', source: 'blocker', detectedCategories: ['test'], confidence: 1, message: 'Blocked', durationMs: 0 }
      },
    }
    const neverReached: GuardrailPlugin = {
      id: 'never',
      name: 'Never',
      description: 'test',
      stage: 'pre-llm',
      async screen(): Promise<ScreeningResult> {
        throw new Error('Should not be called')
      },
    }

    const result = await runGuardrailChain([blocker, neverReached], 'test query', ctx)

    expect(result.finalAction).toBe('block')
    expect(result.results).toHaveLength(1)
  })

  it('empty guardrail list passes everything', async () => {
    const result = await runGuardrailChain([], 'anything goes', ctx)

    expect(result.finalAction).toBe('pass')
    expect(result.sanitisedQuery).toBe('anything goes')
  })
})
