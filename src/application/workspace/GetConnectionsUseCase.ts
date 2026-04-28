import type { WorkspaceRepository } from '../../domain/workspace/repository.js'

export class GetConnectionsUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(workspaceId: string) {
    const [connections, tools] = await Promise.all([
      this.workspaceRepo.findConnections(workspaceId),
      this.workspaceRepo.findTools(workspaceId),
    ])
    return { connections, tools }
  }
}
