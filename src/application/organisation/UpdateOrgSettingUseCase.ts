import type { OrganisationRepository } from '../../domain/organisation/repository.js'
import { generateId } from '../../domain/shared/EntityId.js'

const SECRET_PATTERNS = ['token', 'secret', 'api_key', 'password']

function isSecretKey(key: string): boolean {
  return SECRET_PATTERNS.some(pattern => key.includes(pattern))
}

export class UpdateOrgSettingUseCase {
  constructor(private readonly orgRepo: OrganisationRepository) {}

  async execute(orgId: string, key: string, value: string): Promise<void> {
    const isSecret = isSecretKey(key)
    const existing = await this.orgRepo.findSetting(orgId, key)

    if (existing) {
      await this.orgRepo.upsertSetting(existing.id, orgId, key, value, isSecret)
    } else {
      await this.orgRepo.upsertSetting(generateId(), orgId, key, value, isSecret)
    }
  }
}
