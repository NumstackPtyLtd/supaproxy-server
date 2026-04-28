import { describe, it, expect, vi } from 'vitest'
import { mockOrgRepo, mockWorkspaceRepo } from '../../__tests__/mocks.js'
import { GetHealthUseCase } from './GetHealthUseCase.js'

describe('GetHealthUseCase', () => {
  it('executePublic returns status ok', async () => {
    const orgRepo = mockOrgRepo()
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetHealthUseCase(orgRepo, wsRepo)

    const result = await uc.executePublic()

    expect(result).toEqual({ status: 'ok' })
    expect(orgRepo.getSettingValue).not.toHaveBeenCalled()
    expect(wsRepo.getActiveWorkspaceCount).not.toHaveBeenCalled()
  })

  it('executeAuthenticated returns full details', async () => {
    const orgRepo = mockOrgRepo()
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetHealthUseCase(orgRepo, wsRepo)

    vi.mocked(orgRepo.getSettingValue).mockResolvedValue('sk-key-value')
    vi.mocked(orgRepo.findById).mockResolvedValue({ id: 'org-1', name: 'Test Org', slug: 'test-org', created_at: '2024-01-01' })
    vi.mocked(wsRepo.getActiveWorkspaceCount).mockResolvedValue(3)
    vi.mocked(wsRepo.getConnectedConnectionCount).mockResolvedValue(2)
    vi.mocked(wsRepo.getActiveConsumerCount).mockResolvedValue(1)

    const result = await uc.executeAuthenticated()

    expect(result).toEqual({
      status: 'ok',
      setup_complete: true,
      workspaces: 3,
      ai_configured: true,
      connections: 2,
      consumers: 1,
    })
  })
})
