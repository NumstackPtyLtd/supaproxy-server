import { describe, it, expect } from 'vitest'
import { runGuardrailChain } from './guardrailChain.js'
import { PatternGuardrail } from '@supaproxy/guardrails'
import type { GuardrailPlugin, GuardrailInput, GuardrailOutput } from '@supaproxy/guardrails'

const ctx = { workspaceId: 'ws-1' }

describe('runGuardrailChain', () => {
  it('passes clean queries through unchanged', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'What is the weather today?', ctx)

    expect(result.blocked).toBe(false)
    expect(result.query).toBe('What is the weather today?')
    expect(result.original).toBe('What is the weather today?')
  })

  it('masks email addresses with hash', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'Send email to john@example.com about project', ctx)

    expect(result.blocked).toBe(false)
    expect(result.query).not.toContain('john@example.com')
    expect(result.query).toContain('[hash:')
    expect(result.original).toContain('john@example.com')
  })

  it('blocks credit card numbers', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'My card number is 4111111111111111', ctx)

    expect(result.blocked).toBe(true)
    expect(result.reason).toBeDefined()
    expect(result.annotations.some(a => a.includes('blocked'))).toBe(true)
  })

  it('blocks AWS access keys', async () => {
    const guardrail = new PatternGuardrail()
    const result = await runGuardrailChain([guardrail], 'Use this key AKIAIOSFODNN7EXAMPLE', ctx)

    expect(result.blocked).toBe(true)
  })

  it('chains multiple filters, modifications accumulate', async () => {
    const first = new PatternGuardrail()
    const uppercaser: GuardrailPlugin = {
      id: 'upper',
      name: 'Upper',
      description: 'test',
      stage: 'pre-llm',
      configSchema: { fields: [] }, version: '1.0.0', author: 'test',
      async process(input: GuardrailInput): Promise<GuardrailOutput> {
        return { action: 'continue', query: input.query.toUpperCase(), annotations: ['uppercased'] }
      },
    }

    const result = await runGuardrailChain([first, uppercaser], 'hello world', ctx)

    expect(result.blocked).toBe(false)
    expect(result.query).toBe('HELLO WORLD')
    expect(result.annotations).toContain('uppercased')
  })

  it('first block stops the chain', async () => {
    const blocker: GuardrailPlugin = {
      id: 'blocker',
      name: 'Blocker',
      description: 'test',
      stage: 'pre-llm',
      configSchema: { fields: [] }, version: '1.0.0', author: 'test',
      async process(): Promise<GuardrailOutput> {
        return { action: 'block', reason: 'Blocked by test', annotations: ['test-blocked'] }
      },
    }
    const neverReached: GuardrailPlugin = {
      id: 'never',
      name: 'Never',
      description: 'test',
      stage: 'pre-llm',
      configSchema: { fields: [] }, version: '1.0.0', author: 'test',
      async process(): Promise<GuardrailOutput> {
        throw new Error('Should not be called')
      },
    }

    const result = await runGuardrailChain([blocker, neverReached], 'test query', ctx)

    expect(result.blocked).toBe(true)
    expect(result.reason).toBe('Blocked by test')
  })

  it('empty chain passes everything', async () => {
    const result = await runGuardrailChain([], 'anything goes', ctx)

    expect(result.blocked).toBe(false)
    expect(result.query).toBe('anything goes')
  })

  it('metadata accumulates through the chain', async () => {
    const filter1: GuardrailPlugin = {
      id: 'f1', name: 'F1', description: 'test', stage: 'pre-llm', configSchema: { fields: [] }, version: '1.0.0', author: 'test',
      async process(): Promise<GuardrailOutput> {
        return { action: 'continue', metadata: { scanned: true } }
      },
    }
    const filter2: GuardrailPlugin = {
      id: 'f2', name: 'F2', description: 'test', stage: 'pre-llm', configSchema: { fields: [] }, version: '1.0.0', author: 'test',
      async process(input: GuardrailInput): Promise<GuardrailOutput> {
        return { action: 'continue', metadata: { previousScanned: input.metadata.scanned } }
      },
    }

    const result = await runGuardrailChain([filter1, filter2], 'test', ctx)

    expect(result.metadata.scanned).toBe(true)
    expect(result.metadata.previousScanned).toBe(true)
  })

  it('original query is always preserved', async () => {
    const replacer: GuardrailPlugin = {
      id: 'replacer', name: 'Replacer', description: 'test', stage: 'pre-llm', configSchema: { fields: [] }, version: '1.0.0', author: 'test',
      async process(): Promise<GuardrailOutput> {
        return { action: 'continue', query: 'completely different query' }
      },
    }

    const result = await runGuardrailChain([replacer], 'original sensitive query', ctx)

    expect(result.query).toBe('completely different query')
    expect(result.original).toBe('original sensitive query')
  })
})
