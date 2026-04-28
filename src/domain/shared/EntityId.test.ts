import { describe, it, expect } from 'vitest'
import { generateId, generateSlug, generateWorkspaceId } from './EntityId.js'

describe('generateId', () => {
  it('returns a 32-character hex string', () => {
    const id = generateId()
    expect(id).toHaveLength(32)
    expect(id).toMatch(/^[0-9a-f]{32}$/)
  })

  it('returns unique values on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

describe('generateSlug', () => {
  it('lowercases the input', () => {
    expect(generateSlug('HELLO')).toBe('hello')
  })

  it('replaces non-alphanumeric characters with hyphens', () => {
    expect(generateSlug('hello world!')).toBe('hello-world')
    expect(generateSlug('foo@bar#baz')).toBe('foo-bar-baz')
  })

  it('collapses multiple consecutive hyphens into one', () => {
    expect(generateSlug('foo---bar')).toBe('foo-bar')
  })

  it('strips leading hyphens', () => {
    expect(generateSlug('---leading')).toBe('leading')
  })

  it('strips trailing hyphens', () => {
    expect(generateSlug('trailing---')).toBe('trailing')
  })

  it('handles a mix of transformations', () => {
    expect(generateSlug('  My Cool Project!! ')).toBe('my-cool-project')
  })

  it('returns empty string for entirely non-alphanumeric input', () => {
    expect(generateSlug('---')).toBe('')
  })
})

describe('generateWorkspaceId', () => {
  it('prefixes the slug with "ws-"', () => {
    expect(generateWorkspaceId('Acme Corp')).toBe('ws-acme-corp')
  })

  it('applies slug rules to the name', () => {
    expect(generateWorkspaceId('  My Workspace!  ')).toBe('ws-my-workspace')
  })
})
