import type { WorkspaceRepository } from '../../domain/workspace/repository.js'
import type { McpClientFactory } from '../ports/McpClient.js'
import { generateId } from '../../domain/shared/EntityId.js'
import { NotFoundError, ValidationError } from '../../domain/shared/errors.js'

interface SaveMcpInput {
  workspaceId: string
  name: string
  transport?: string
  url?: string
  command?: string
  args?: string[]
}

interface SaveMcpOutput {
  status: string
  message: string
  tools?: number
}

export class SaveMcpConnectionUseCase {
  constructor(
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly mcpFactory: McpClientFactory,
  ) {}

  async execute(input: SaveMcpInput): Promise<SaveMcpOutput> {
    const resolvedTransport = input.transport || (input.url ? 'http' : 'stdio')

    if (resolvedTransport === 'http' && !input.url) {
      throw new ValidationError('Server URL is required for HTTP transport')
    }
    if (resolvedTransport === 'stdio' && !input.command) {
      throw new ValidationError('Command is required for STDIO transport')
    }

    const exists = await this.workspaceRepo.existsById(input.workspaceId)
    if (!exists) throw new NotFoundError('Workspace', input.workspaceId)

    const config = resolvedTransport === 'http'
      ? JSON.stringify({ transport: 'http', url: input.url })
      : JSON.stringify({ transport: 'stdio', command: input.command, args: input.args || [] })

    const existing = await this.workspaceRepo.findConnectionByName(input.workspaceId, input.name)

    let connId: string
    if (existing) {
      connId = existing.id
      await this.workspaceRepo.updateConnectionConfig(connId, config)
      await this.workspaceRepo.deleteToolsByConnection(connId)
    } else {
      connId = generateId()
      await this.workspaceRepo.createConnection(connId, input.workspaceId, input.name, 'mcp', config)
    }

    if (resolvedTransport === 'http' && input.url) {
      return this.discoverAndSaveTools(connId, input.url)
    }

    return { status: 'saved', message: 'Connection saved. Tools will be discovered on the first query.' }
  }

  private async discoverAndSaveTools(connId: string, url: string): Promise<SaveMcpOutput> {
    try {
      const connection = await this.mcpFactory.connectHttp(url, undefined, 'supaproxy')
      try {
        if (connection.tools.length > 0) {
          await this.workspaceRepo.createTools(
            connection.tools.map(t => ({
              id: generateId(),
              connectionId: connId,
              name: t.name,
              description: t.description || '',
              inputSchema: JSON.stringify(t.inputSchema || {}),
              isWrite: false,
            }))
          )
        }
        await this.workspaceRepo.updateConnectionStatus(connId, 'connected')
        return { status: 'saved', message: `Connected \u2014 ${connection.tools.length} tools discovered.`, tools: connection.tools.length }
      } finally {
        await connection.close()
      }
    } catch (err) {
      return { status: 'saved', message: `Saved but could not discover tools: ${(err as Error).message}`, tools: 0 }
    }
  }
}
