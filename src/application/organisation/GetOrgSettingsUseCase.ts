import type { OrganisationRepository } from '../../domain/organisation/repository.js'

interface SettingsOutput {
  settings: Record<string, string>
  configured: Record<string, boolean>
}

export class GetOrgSettingsUseCase {
  constructor(private readonly orgRepo: OrganisationRepository) {}

  async execute(orgId: string): Promise<SettingsOutput> {
    const rows = await this.orgRepo.listSettings(orgId)
    const settings: Record<string, string> = {}
    const configured: Record<string, boolean> = {}
    for (const r of rows) {
      settings[r.key_name] = r.is_secret ? '••••••••' : r.value
      configured[r.key_name] = r.value.length > 0
    }
    return { settings, configured }
  }
}
