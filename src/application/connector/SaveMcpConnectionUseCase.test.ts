import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, mockMcpFactory, stubConnection } from '../../__tests__/mocks.js'
import { SaveMcpConnectionUseCase } from './SaveMcpConnectionUseCase.js'
import { ValidationError, NotFoundError } from '../../domain/shared/errors.js'

describe('SaveMcpConnectionUseCase', () => {
  it('saves HTTP connection and discovers tools', async () => {
    const wsRepo = mockWorkspaceRepo()
    const factory = mockMcpFactory()

    vi.mocked(wsRepo.existsById).mockResolvedValue(true)
    vi.mocked(wsRepo.findConnectionByName).mockResolvedValue(null)

    const uc = new SaveMcpConnectionUseCase(wsRepo, factory)
    const result = await uc.execute({
      workspaceId: 'ws-test',
      name: 'my-mcp',
      transport: 'http',
      url: 'http://localhost:8080',
    })

    expect(wsRepo.createConnection).toHaveBeenCalledWith(
      expect.any(String), 'ws-test', 'my-mcp', 'mcp',
      JSON.stringify({ transport: 'http', url: 'http://localhost:8080' }),
    )
    expect(factory.connectHttp).toHaveBeenCalledWith('http://localhost:8080', undefined, 'supaproxy')
    expect(wsRepo.createTools).toHaveBeenCalled()
    expect(wsRepo.updateConnectionStatus).toHaveBeenCalledWith(expect.any(String), 'connected')
    expect(result.status).toBe('saved')
    expect(result.tools).toBe(1)
  })

  it('saves STDIO connection without tool discovery', async () => {
    const wsRepo = mockWorkspaceRepo()
    const factory = mockMcpFactory()

    vi.mocked(wsRepo.existsById).mockResolvedValue(true)
    vi.mocked(wsRepo.findConnectionByName).mockResolvedValue(null)

    const uc = new SaveMcpConnectionUseCase(wsRepo, factory)
    const result = await uc.execute({
      workspaceId: 'ws-test',
      name: 'my-stdio',
      transport: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server'],
    })

    expect(wsRepo.createConnection).toHaveBeenCalledWith(
      expect.any(String), 'ws-test', 'my-stdio', 'mcp',
      JSON.stringify({ transport: 'stdio', command: 'npx', args: ['@modelcontextprotocol/server'] }),
    )
    expect(factory.connectHttp).not.toHaveBeenCalled()
    expect(result.status).toBe('saved')
    expect(result.message).toContain('first query')
  })

  it('throws ValidationError if HTTP without URL', async () => {
    const wsRepo = mockWorkspaceRepo()
    const factory = mockMcpFactory()

    const uc = new SaveMcpConnectionUseCase(wsRepo, factory)

    await expect(uc.execute({
      workspaceId: 'ws-test',
      name: 'bad',
      transport: 'http',
    })).rejects.toThrow(ValidationError)
  })

  it('throws NotFoundError if workspace not found', async () => {
    const wsRepo = mockWorkspaceRepo()
    const factory = mockMcpFactory()

    vi.mocked(wsRepo.existsById).mockResolvedValue(false)

    const uc = new SaveMcpConnectionUseCase(wsRepo, factory)

    await expect(uc.execute({
      workspaceId: 'ws-missing',
      name: 'test',
      transport: 'http',
      url: 'http://localhost:8080',
    })).rejects.toThrow(NotFoundError)
  })

  it('updates existing connection by name', async () => {
    const wsRepo = mockWorkspaceRepo()
    const factory = mockMcpFactory()
    const existing = stubConnection({ id: 'conn-existing' })

    vi.mocked(wsRepo.existsById).mockResolvedValue(true)
    vi.mocked(wsRepo.findConnectionByName).mockResolvedValue(existing)

    const uc = new SaveMcpConnectionUseCase(wsRepo, factory)
    await uc.execute({
      workspaceId: 'ws-test',
      name: 'test-mcp',
      transport: 'http',
      url: 'http://localhost:9090',
    })

    expect(wsRepo.updateConnectionConfig).toHaveBeenCalledWith(
      'conn-existing',
      JSON.stringify({ transport: 'http', url: 'http://localhost:9090' }),
    )
    expect(wsRepo.deleteToolsByConnection).toHaveBeenCalledWith('conn-existing')
    expect(wsRepo.createConnection).not.toHaveBeenCalled()
  })
})
