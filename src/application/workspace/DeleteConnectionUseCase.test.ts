import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo } from '../../__tests__/mocks.js'
import { DeleteConnectionUseCase } from './DeleteConnectionUseCase.js'

describe('DeleteConnectionUseCase', () => {
  it('deletes tools then connection', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new DeleteConnectionUseCase(wsRepo)

    await uc.execute('conn-1')

    expect(wsRepo.deleteToolsByConnection).toHaveBeenCalledWith('conn-1')
    expect(wsRepo.deleteConnection).toHaveBeenCalledWith('conn-1')

    // Verify tools are deleted before the connection
    const toolsCall = vi.mocked(wsRepo.deleteToolsByConnection).mock.invocationCallOrder[0]
    const connCall = vi.mocked(wsRepo.deleteConnection).mock.invocationCallOrder[0]
    expect(toolsCall).toBeLessThan(connCall)
  })
})
