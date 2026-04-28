import { describe, it, expect, vi } from 'vitest'
import { mockOrgRepo } from '../../__tests__/mocks.js'
import { UpdateOrgUseCase } from './UpdateOrgUseCase.js'

describe('UpdateOrgUseCase', () => {
  function setup() {
    const orgRepo = mockOrgRepo()
    const useCase = new UpdateOrgUseCase(orgRepo)
    return { orgRepo, useCase }
  }

  it('execute calls updateName on repo', async () => {
    const { orgRepo, useCase } = setup()

    await useCase.execute('org-1', 'New Name')

    expect(orgRepo.updateName).toHaveBeenCalledWith('org-1', 'New Name')
  })
})
