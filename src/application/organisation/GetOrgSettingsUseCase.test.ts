import { describe, it, expect, vi } from 'vitest'
import { mockOrgRepo } from '../../__tests__/mocks.js'
import { GetOrgSettingsUseCase } from './GetOrgSettingsUseCase.js'

describe('GetOrgSettingsUseCase', () => {
  function setup() {
    const orgRepo = mockOrgRepo()
    const useCase = new GetOrgSettingsUseCase(orgRepo)
    return { orgRepo, useCase }
  }

  it('execute masks secret values and returns configured flags', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.listSettings).mockResolvedValue([
      { id: 's-1', key_name: 'slack_bot_token', value: 'xoxb-real-token', is_secret: true },
      { id: 's-2', key_name: 'welcome_message', value: 'Hello there', is_secret: false },
      { id: 's-3', key_name: 'api_key', value: '', is_secret: true },
    ])

    const result = await useCase.execute('org-1')

    expect(orgRepo.listSettings).toHaveBeenCalledWith('org-1')
    expect(result.settings.slack_bot_token).toBe('••••••••')
    expect(result.settings.welcome_message).toBe('Hello there')
    expect(result.settings.api_key).toBe('••••••••')

    expect(result.configured.slack_bot_token).toBe(true)
    expect(result.configured.welcome_message).toBe(true)
    expect(result.configured.api_key).toBe(false)
  })
})
