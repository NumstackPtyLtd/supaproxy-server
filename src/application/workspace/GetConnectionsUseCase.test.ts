import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, stubConnection } from '../../__tests__/mocks.js'
import { GetConnectionsUseCase } from './GetConnectionsUseCase.js'

describe('GetConnectionsUseCase', () => {
  it('returns connections and tools', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetConnectionsUseCase(wsRepo)

    const connections = [stubConnection({ id: 'conn-1' })]
    const tools = [{ id: 'tool-1', name: 'test-tool', connection_id: 'conn-1', description: 'A test tool', input_schema: '{}', is_write: false }]
    vi.mocked(wsRepo.findConnections).mockResolvedValue(connections)
    vi.mocked(wsRepo.findTools).mockResolvedValue(tools)

    const result = await uc.execute('ws-test')

    expect(wsRepo.findConnections).toHaveBeenCalledWith('ws-test')
    expect(wsRepo.findTools).toHaveBeenCalledWith('ws-test')
    expect(result).toEqual({ connections, tools })
  })
})
