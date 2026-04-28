import { describe, it, expect, vi } from 'vitest'
import { mockConversationRepo, stubConversation } from '../../__tests__/mocks.js'
import { GetConversationDetailUseCase } from './GetConversationDetailUseCase.js'
import { NotFoundError } from '../../domain/shared/errors.js'

describe('GetConversationDetailUseCase', () => {
  it('returns conversation with messages and stats', async () => {
    const repo = mockConversationRepo()
    const conv = stubConversation()
    const messages = [{ role: 'user', content: 'hello' }]
    const stats = { id: 'stats-1', conversation_id: 'conv-1', stats_status: 'complete' as const }

    vi.mocked(repo.findById).mockResolvedValue(conv)
    vi.mocked(repo.findMessagesWithAudit).mockResolvedValue(messages as never[])
    vi.mocked(repo.findStats).mockResolvedValue(stats as never)

    const uc = new GetConversationDetailUseCase(repo)
    const result = await uc.execute('conv-1')

    expect(repo.findById).toHaveBeenCalledWith('conv-1')
    expect(repo.findMessagesWithAudit).toHaveBeenCalledWith('conv-1')
    expect(repo.findStats).toHaveBeenCalledWith('conv-1')
    expect(result).toEqual({ conversation: conv, messages, stats })
  })

  it('throws NotFoundError if conversation does not exist', async () => {
    const repo = mockConversationRepo()
    vi.mocked(repo.findById).mockResolvedValue(null)

    const uc = new GetConversationDetailUseCase(repo)

    await expect(uc.execute('missing')).rejects.toThrow(NotFoundError)
  })
})
