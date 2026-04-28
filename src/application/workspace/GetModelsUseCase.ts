import type { ModelRepository } from '../ports/ModelRepository.js'
import type { OrganisationRepository } from '../../domain/organisation/repository.js'

export class GetModelsUseCase {
  constructor(
    private readonly modelRepo: ModelRepository,
    private readonly orgRepo: OrganisationRepository,
  ) {}

  async execute() {
    const provider = await this.orgRepo.getSettingValue('ai_provider')
    const defaultModel = await this.orgRepo.getSettingValue('default_model')

    const rows = provider
      ? await this.modelRepo.listByProvider(provider)
      : await this.modelRepo.listAll()

    return rows.map(r => ({
      ...r,
      is_default: r.id === defaultModel,
    }))
  }
}
