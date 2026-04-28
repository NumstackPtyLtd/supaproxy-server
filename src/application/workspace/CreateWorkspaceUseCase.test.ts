import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, mockOrgRepo } from '../../__tests__/mocks.js'
import { CreateWorkspaceUseCase } from './CreateWorkspaceUseCase.js'
import { ConflictError } from '../../domain/shared/errors.js'

describe('CreateWorkspaceUseCase', () => {
  it('creates workspace with team ID', async () => {
    const wsRepo = mockWorkspaceRepo()
    const orgRepo = mockOrgRepo()
    const uc = new CreateWorkspaceUseCase(wsRepo, orgRepo)

    const result = await uc.execute({
      name: 'My Workspace',
      model: 'claude-sonnet-4-20250514',
      teamId: 'team-1',
      orgId: 'org-1',
    })

    expect(result).toEqual({
      id: 'ws-my-workspace',
      name: 'My Workspace',
      status: 'active',
    })
    expect(wsRepo.existsById).toHaveBeenCalledWith('ws-my-workspace')
    expect(wsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ws-my-workspace',
        orgId: 'org-1',
        teamId: 'team-1',
        name: 'My Workspace',
        model: 'claude-sonnet-4-20250514',
      }),
    )
    expect(orgRepo.findTeamByName).not.toHaveBeenCalled()
  })

  it('creates workspace with new team name', async () => {
    const wsRepo = mockWorkspaceRepo()
    const orgRepo = mockOrgRepo()
    const uc = new CreateWorkspaceUseCase(wsRepo, orgRepo)

    // findTeamByName returns null so a new team is created
    vi.mocked(orgRepo.findTeamByName).mockResolvedValue(null)

    const result = await uc.execute({
      name: 'Support Bot',
      model: 'claude-sonnet-4-20250514',
      teamName: 'Support Team',
      orgId: 'org-1',
    })

    expect(result.id).toBe('ws-support-bot')
    expect(orgRepo.findTeamByName).toHaveBeenCalledWith('org-1', 'Support Team')
    expect(orgRepo.createTeam).toHaveBeenCalledWith(
      expect.any(String),
      'org-1',
      'Support Team',
    )
    expect(wsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: expect.any(String),
      }),
    )
  })

  it('throws ConflictError if workspace already exists', async () => {
    const wsRepo = mockWorkspaceRepo()
    const orgRepo = mockOrgRepo()
    const uc = new CreateWorkspaceUseCase(wsRepo, orgRepo)

    vi.mocked(wsRepo.existsById).mockResolvedValue(true)

    await expect(
      uc.execute({
        name: 'Existing',
        model: 'claude-sonnet-4-20250514',
        orgId: 'org-1',
      }),
    ).rejects.toThrow(ConflictError)

    expect(wsRepo.create).not.toHaveBeenCalled()
  })

  it('generates workspace ID from name', async () => {
    const wsRepo = mockWorkspaceRepo()
    const orgRepo = mockOrgRepo()
    const uc = new CreateWorkspaceUseCase(wsRepo, orgRepo)

    const result = await uc.execute({
      name: 'Hello World 123',
      model: 'claude-sonnet-4-20250514',
      orgId: 'org-1',
    })

    expect(result.id).toBe('ws-hello-world-123')
  })
})
