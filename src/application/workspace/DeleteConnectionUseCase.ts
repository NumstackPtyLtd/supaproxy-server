import type { WorkspaceRepository } from '../../domain/workspace/repository.js'

export class DeleteConnectionUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(connectionId: string): Promise<void> {
    await this.workspaceRepo.deleteToolsByConnection(connectionId)
    await this.workspaceRepo.deleteConnection(connectionId)
  }
}
