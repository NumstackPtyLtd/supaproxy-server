import type { WorkspaceRepository } from '../../domain/workspace/repository.js'

export class ListWorkspacesUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute() {
    return this.workspaceRepo.listNonArchived()
  }
}
