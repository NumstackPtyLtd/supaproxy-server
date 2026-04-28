import type { OrganisationRepository } from '../../domain/organisation/repository.js'
import { NotFoundError } from '../../domain/shared/errors.js'

export class GetOrgUseCase {
  constructor(private readonly orgRepo: OrganisationRepository) {}

  async execute(orgId: string) {
    const org = await this.orgRepo.findById(orgId)
    if (!org) throw new NotFoundError('Organisation', orgId)
    return org
  }
}
