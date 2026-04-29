import type { WorkspaceRepository } from '../../domain/workspace/repository.js'

export class ListWorkspacesUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(orgId: string | null) {
    return this.workspaceRepo.listNonArchived(orgId)
  }
}
