import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, stubWorkspace } from '../../__tests__/mocks.js'
import { GetWorkspaceSummaryUseCase } from './GetWorkspaceSummaryUseCase.js'
import { NotFoundError } from '../../domain/shared/errors.js'

describe('GetWorkspaceSummaryUseCase', () => {
  it('returns workspace summary', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetWorkspaceSummaryUseCase(wsRepo)

    const summary = stubWorkspace({ id: 'ws-test', name: 'Test' })
    vi.mocked(wsRepo.getSummary).mockResolvedValue(summary)

    const result = await uc.execute('ws-test')

    expect(wsRepo.getSummary).toHaveBeenCalledWith('ws-test')
    expect(result).toEqual(summary)
  })

  it('throws NotFoundError if not found', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetWorkspaceSummaryUseCase(wsRepo)

    vi.mocked(wsRepo.getSummary).mockResolvedValue(null)

    await expect(uc.execute('ws-missing')).rejects.toThrow(NotFoundError)
  })
})
