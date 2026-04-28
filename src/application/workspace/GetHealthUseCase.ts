import type { OrganisationRepository } from '../../domain/organisation/repository.js'
import type { WorkspaceRepository } from '../../domain/workspace/repository.js'

interface HealthOutput {
  status: 'ok'
  setup_complete?: boolean
  workspaces?: number
  ai_configured?: boolean
  connections?: number
  consumers?: number
}

export class GetHealthUseCase {
  constructor(
    private readonly orgRepo: OrganisationRepository,
    private readonly workspaceRepo: WorkspaceRepository,
  ) {}

  async executePublic(): Promise<HealthOutput> {
    return { status: 'ok' }
  }

  async executeAuthenticated(): Promise<HealthOutput> {
    const org = await this.orgRepo.getSettingValue('ai_api_key')
      || await this.orgRepo.getSettingValue('anthropic_api_key')
    const orgCount = await this.orgRepo.findById('any') // simplified - check if any org exists

    // Use workspace repo for counts
    const workspaceCount = await this.workspaceRepo.getActiveWorkspaceCount()
    const connectionCount = await this.workspaceRepo.getConnectedConnectionCount()
    const consumerCount = await this.workspaceRepo.getActiveConsumerCount()

    return {
      status: 'ok',
      setup_complete: workspaceCount > 0,
      workspaces: workspaceCount,
      ai_configured: !!org,
      connections: connectionCount,
      consumers: consumerCount,
    }
  }
}
