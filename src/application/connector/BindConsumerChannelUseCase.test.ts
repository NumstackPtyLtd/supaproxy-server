import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, stubConsumer } from '../../__tests__/mocks.js'
import { BindConsumerChannelUseCase } from './BindConsumerChannelUseCase.js'
import { NotFoundError, ConflictError } from '../../domain/shared/errors.js'

describe('BindConsumerChannelUseCase', () => {
  it('binds channel to workspace', async () => {
    const repo = mockWorkspaceRepo()

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerBoundToChannel).mockResolvedValue(null)
    vi.mocked(repo.findConsumerByType).mockResolvedValue(null)

    const uc = new BindConsumerChannelUseCase(repo)
    const result = await uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      channelId: 'C123',
      channelName: '#general',
    })

    expect(repo.createConsumer).toHaveBeenCalledWith(
      expect.any(String), 'ws-test', 'slack',
      expect.stringContaining('"channels":["C123"]'),
    )
    expect(result.status).toBe('saved')
    expect(result.message).toContain('#general')
  })

  it('throws ConflictError if channel already bound elsewhere', async () => {
    const repo = mockWorkspaceRepo()

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerBoundToChannel).mockResolvedValue({
      workspace_id: 'ws-other',
      workspace_name: 'Other Workspace',
    })

    const uc = new BindConsumerChannelUseCase(repo)

    await expect(uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      channelId: 'C123',
    })).rejects.toThrow(ConflictError)
  })

  it('throws NotFoundError if workspace not found', async () => {
    const repo = mockWorkspaceRepo()

    vi.mocked(repo.existsById).mockResolvedValue(false)

    const uc = new BindConsumerChannelUseCase(repo)

    await expect(uc.execute({
      type: 'slack',
      workspaceId: 'ws-missing',
      channelId: 'C123',
    })).rejects.toThrow(NotFoundError)
  })

  it('updates existing consumer config', async () => {
    const repo = mockWorkspaceRepo()
    const existing = stubConsumer({ id: 'consumer-existing' })

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerBoundToChannel).mockResolvedValue(null)
    vi.mocked(repo.findConsumerByType).mockResolvedValue(existing)

    const uc = new BindConsumerChannelUseCase(repo)
    await uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      channelId: 'C456',
      channelName: '#support',
    })

    expect(repo.updateConsumerConfig).toHaveBeenCalledWith(
      'consumer-existing',
      expect.stringContaining('"channels":["C456"]'),
    )
    expect(repo.createConsumer).not.toHaveBeenCalled()
  })
})
