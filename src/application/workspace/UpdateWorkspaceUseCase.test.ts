import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo } from '../../__tests__/mocks.js'
import { UpdateWorkspaceUseCase } from './UpdateWorkspaceUseCase.js'
import { NotFoundError } from '../../domain/shared/errors.js'

describe('UpdateWorkspaceUseCase', () => {
  it('updates workspace fields', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new UpdateWorkspaceUseCase(wsRepo)

    vi.mocked(wsRepo.existsById).mockResolvedValue(true)

    await uc.execute('ws-test', { name: 'Renamed', model: 'claude-sonnet-4-20250514' })

    expect(wsRepo.existsById).toHaveBeenCalledWith('ws-test')
    expect(wsRepo.update).toHaveBeenCalledWith('ws-test', {
      name: 'Renamed',
      model: 'claude-sonnet-4-20250514',
    })
  })

  it('throws NotFoundError if workspace not found', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new UpdateWorkspaceUseCase(wsRepo)

    vi.mocked(wsRepo.existsById).mockResolvedValue(false)

    await expect(uc.execute('ws-missing', { name: 'New Name' })).rejects.toThrow(NotFoundError)
    expect(wsRepo.update).not.toHaveBeenCalled()
  })
})
