import { describe, it, expect, vi } from 'vitest'
import { ConsumerPosterRegistryImpl } from './ConsumerPosterRegistryImpl.js'
import type { ColdMessageTarget } from '../../application/ports/ConsumerPoster.js'

const makeTarget = (consumerType: string): ColdMessageTarget => ({
  conversationId: 'conv-1',
  consumerType,
  channel: 'general',
  externalThreadId: 'thread-1',
})

describe('ConsumerPosterRegistryImpl', () => {
  it('returns true when posting to a registered consumer type', async () => {
    const registry = new ConsumerPosterRegistryImpl()
    const poster = vi.fn().mockResolvedValue(undefined)

    registry.register('slack', poster)
    const result = await registry.post(makeTarget('slack'), 'hello')

    expect(result).toBe(true)
  })

  it('returns false when posting to an unregistered consumer type', async () => {
    const registry = new ConsumerPosterRegistryImpl()
    const result = await registry.post(makeTarget('teams'), 'hello')

    expect(result).toBe(false)
  })

  it('calls the poster function with the correct arguments', async () => {
    const registry = new ConsumerPosterRegistryImpl()
    const poster = vi.fn().mockResolvedValue(undefined)
    const target = makeTarget('slack')
    const text = 'test message'

    registry.register('slack', poster)
    await registry.post(target, text)

    expect(poster).toHaveBeenCalledOnce()
    expect(poster).toHaveBeenCalledWith(target, text)
  })

  it('supports multiple consumer types independently', async () => {
    const registry = new ConsumerPosterRegistryImpl()
    const slackPoster = vi.fn().mockResolvedValue(undefined)
    const teamsPoster = vi.fn().mockResolvedValue(undefined)

    registry.register('slack', slackPoster)
    registry.register('teams', teamsPoster)

    await registry.post(makeTarget('slack'), 'slack msg')
    await registry.post(makeTarget('teams'), 'teams msg')

    expect(slackPoster).toHaveBeenCalledOnce()
    expect(teamsPoster).toHaveBeenCalledOnce()
  })
})
