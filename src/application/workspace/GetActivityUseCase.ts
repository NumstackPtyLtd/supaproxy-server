import type { WorkspaceRepository } from '../../domain/workspace/repository.js'

export class GetActivityUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(workspaceId: string, limit: number, offset: number) {
    return this.workspaceRepo.findActivityLog(workspaceId, limit, offset)
  }
}
