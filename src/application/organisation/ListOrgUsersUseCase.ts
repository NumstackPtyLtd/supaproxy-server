import type { OrganisationRepository } from '../../domain/organisation/repository.js'

export class ListOrgUsersUseCase {
  constructor(private readonly orgRepo: OrganisationRepository) {}

  async execute(orgId: string) {
    return this.orgRepo.listUsers(orgId)
  }
}
