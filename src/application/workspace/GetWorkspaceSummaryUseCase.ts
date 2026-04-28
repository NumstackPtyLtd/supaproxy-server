import type { WorkspaceRepository } from '../../domain/workspace/repository.js'
import { NotFoundError } from '../../domain/shared/errors.js'

export class GetWorkspaceSummaryUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(workspaceId: string) {
    const workspace = await this.workspaceRepo.getSummary(workspaceId)
    if (!workspace) throw new NotFoundError('Workspace', workspaceId)
    return workspace
  }
}
