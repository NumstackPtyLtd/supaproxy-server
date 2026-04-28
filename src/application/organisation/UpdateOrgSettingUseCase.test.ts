import { describe, it, expect, vi } from 'vitest'
import { mockOrgRepo } from '../../__tests__/mocks.js'
import { UpdateOrgSettingUseCase } from './UpdateOrgSettingUseCase.js'

describe('UpdateOrgSettingUseCase', () => {
  function setup() {
    const orgRepo = mockOrgRepo()
    const useCase = new UpdateOrgSettingUseCase(orgRepo)
    return { orgRepo, useCase }
  }

  it('execute detects secret keys containing "token"', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue(null)

    await useCase.execute('org-1', 'slack_bot_token', 'xoxb-value')

    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      expect.any(String), 'org-1', 'slack_bot_token', 'xoxb-value', true,
    )
  })

  it('execute detects secret keys containing "secret"', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue(null)

    await useCase.execute('org-1', 'app_secret', 'secret-value')

    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      expect.any(String), 'org-1', 'app_secret', 'secret-value', true,
    )
  })

  it('execute detects secret keys containing "api_key"', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue(null)

    await useCase.execute('org-1', 'provider_api_key', 'key-value')

    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      expect.any(String), 'org-1', 'provider_api_key', 'key-value', true,
    )
  })

  it('execute detects secret keys containing "password"', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue(null)

    await useCase.execute('org-1', 'db_password', 'pw-value')

    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      expect.any(String), 'org-1', 'db_password', 'pw-value', true,
    )
  })

  it('execute marks non-secret keys as not secret', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue(null)

    await useCase.execute('org-1', 'welcome_message', 'Hello')

    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      expect.any(String), 'org-1', 'welcome_message', 'Hello', false,
    )
  })

  it('execute creates new setting if not existing', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue(null)

    await useCase.execute('org-1', 'new_key', 'new-value')

    expect(orgRepo.findSetting).toHaveBeenCalledWith('org-1', 'new_key')
    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      expect.any(String), 'org-1', 'new_key', 'new-value', false,
    )
  })

  it('execute updates existing setting if found', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findSetting).mockResolvedValue({
      id: 'existing-id', key_name: 'some_key', value: 'old-value', is_secret: false,
    })

    await useCase.execute('org-1', 'some_key', 'updated-value')

    expect(orgRepo.upsertSetting).toHaveBeenCalledWith(
      'existing-id', 'org-1', 'some_key', 'updated-value', false,
    )
  })
})
