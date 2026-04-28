import type { OrganisationRepository } from '../../domain/organisation/repository.js'

export class UpdateOrgUseCase {
  constructor(private readonly orgRepo: OrganisationRepository) {}

  async execute(orgId: string, name: string): Promise<void> {
    await this.orgRepo.updateName(orgId, name)
  }
}
