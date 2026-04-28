import type { WorkspaceRepository } from '../../domain/workspace/repository.js'
import { NotFoundError } from '../../domain/shared/errors.js'

export class GetWorkspaceDetailUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(workspaceId: string) {
    const workspace = await this.workspaceRepo.findByIdWithTeam(workspaceId)
    if (!workspace) throw new NotFoundError('Workspace', workspaceId)

    const [connections, tools, knowledge, guardrails, consumers, permissions, stats] = await Promise.all([
      this.workspaceRepo.findConnections(workspaceId),
      this.workspaceRepo.findToolsDetailed(workspaceId),
      this.workspaceRepo.findKnowledge(workspaceId),
      this.workspaceRepo.findGuardrails(workspaceId),
      this.workspaceRepo.findConsumers(workspaceId),
      this.workspaceRepo.findPermissions(workspaceId),
      this.workspaceRepo.getStats(workspaceId),
    ])

    const errorRate = stats.total_week > 0 ? stats.errors_week / stats.total_week : 0

    return {
      workspace,
      connections,
      tools,
      knowledge,
      guardrails,
      consumers,
      permissions,
      stats: {
        today: stats.today,
        week: stats.week,
        month: stats.month,
        avg_ms: Math.round(stats.avg_ms),
        cost_mtd: Number(stats.cost_mtd),
        error_rate: errorRate,
      },
    }
  }
}
