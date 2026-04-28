import { describe, it, expect, vi } from 'vitest'
import { mockOrgRepo } from '../../__tests__/mocks.js'
import { GetOrgUseCase } from './GetOrgUseCase.js'
import { NotFoundError } from '../../domain/shared/errors.js'

describe('GetOrgUseCase', () => {
  function setup() {
    const orgRepo = mockOrgRepo()
    const useCase = new GetOrgUseCase(orgRepo)
    return { orgRepo, useCase }
  }

  it('execute returns org data', async () => {
    const { orgRepo, useCase } = setup()
    const orgData = { id: 'org-1', name: 'Acme Corp', slug: 'acme-corp', created_at: '2024-01-01' }
    vi.mocked(orgRepo.findById).mockResolvedValue(orgData)

    const result = await useCase.execute('org-1')

    expect(orgRepo.findById).toHaveBeenCalledWith('org-1')
    expect(result).toEqual(orgData)
  })

  it('execute throws NotFoundError if not found', async () => {
    const { orgRepo, useCase } = setup()
    vi.mocked(orgRepo.findById).mockResolvedValue(null)

    await expect(useCase.execute('missing-org')).rejects.toThrow(NotFoundError)
  })
})
