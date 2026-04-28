import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, stubConsumer } from '../../__tests__/mocks.js'
import { ConnectConsumerUseCase } from './ConnectConsumerUseCase.js'
import type { ConsumerTypeHandler } from './ConnectConsumerUseCase.js'
import { ValidationError, NotFoundError } from '../../domain/shared/errors.js'

function stubHandler(overrides: Partial<ConsumerTypeHandler> = {}): ConsumerTypeHandler {
  return {
    buildConfig: vi.fn().mockReturnValue('{"token":"t"}'),
    verifyCredentials: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('ConnectConsumerUseCase', () => {
  it('connects with valid handler, verifies credentials, builds config', async () => {
    const repo = mockWorkspaceRepo()
    const handler = stubHandler()
    const handlers = { slack: handler }

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerByType).mockResolvedValue(null)

    const uc = new ConnectConsumerUseCase(repo, handlers)
    const result = await uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      credentials: { token: 'xoxb-123' },
    })

    expect(handler.verifyCredentials).toHaveBeenCalledWith({ token: 'xoxb-123' })
    expect(handler.buildConfig).toHaveBeenCalledWith({ token: 'xoxb-123' }, undefined)
    expect(repo.createConsumer).toHaveBeenCalledWith(
      expect.any(String), 'ws-test', 'slack', '{"token":"t"}',
    )
    expect(result.status).toBe('saved')
  })

  it('throws ValidationError for unsupported type', async () => {
    const repo = mockWorkspaceRepo()

    const uc = new ConnectConsumerUseCase(repo, {})

    await expect(uc.execute({
      type: 'teams',
      workspaceId: 'ws-test',
      credentials: {},
    })).rejects.toThrow(ValidationError)
  })

  it('throws NotFoundError if workspace not found', async () => {
    const repo = mockWorkspaceRepo()
    const handler = stubHandler()

    vi.mocked(repo.existsById).mockResolvedValue(false)

    const uc = new ConnectConsumerUseCase(repo, { slack: handler })

    await expect(uc.execute({
      type: 'slack',
      workspaceId: 'ws-missing',
      credentials: { token: 'xoxb-123' },
    })).rejects.toThrow(NotFoundError)
  })

  it('returns saved status if handler has no start', async () => {
    const repo = mockWorkspaceRepo()
    const handler = stubHandler() // no start method

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerByType).mockResolvedValue(null)

    const uc = new ConnectConsumerUseCase(repo, { slack: handler })
    const result = await uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      credentials: { token: 'xoxb-123' },
    })

    expect(result.status).toBe('saved')
    expect(result.message).toBe('Consumer configured.')
  })

  it('returns connected if start succeeds', async () => {
    const repo = mockWorkspaceRepo()
    const handler = stubHandler({ start: vi.fn().mockResolvedValue(undefined) })

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerByType).mockResolvedValue(null)

    const uc = new ConnectConsumerUseCase(repo, { slack: handler })
    const result = await uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      credentials: { token: 'xoxb-123' },
    })

    expect(handler.start).toHaveBeenCalledWith({ token: 'xoxb-123' })
    expect(result.status).toBe('connected')
  })

  it('returns saved with error message if start fails', async () => {
    const repo = mockWorkspaceRepo()
    const handler = stubHandler({ start: vi.fn().mockRejectedValue(new Error('Socket timeout')) })

    vi.mocked(repo.existsById).mockResolvedValue(true)
    vi.mocked(repo.findConsumerByType).mockResolvedValue(null)

    const uc = new ConnectConsumerUseCase(repo, { slack: handler })
    const result = await uc.execute({
      type: 'slack',
      workspaceId: 'ws-test',
      credentials: { token: 'xoxb-123' },
    })

    expect(result.status).toBe('saved')
    expect(result.message).toContain('Socket timeout')
  })
})
