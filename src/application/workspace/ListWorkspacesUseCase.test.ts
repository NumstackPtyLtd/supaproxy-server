import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo } from '../../__tests__/mocks.js'
import { ListWorkspacesUseCase } from './ListWorkspacesUseCase.js'
import type { WorkspaceListItemData } from '../../domain/workspace/repository.js'

function stubWorkspaceListItem(overrides: Partial<WorkspaceListItemData> = {}): WorkspaceListItemData {
  return {
    id: 'ws-test', name: 'Test Workspace', team: null, status: 'active',
    model: 'claude-sonnet-4-20250514', created_at: '2024-01-01',
    connection_count: 0, tool_count: 0, knowledge_count: 0,
    queries_today: 0, cost_mtd: 0,
    ...overrides,
  }
}

describe('ListWorkspacesUseCase', () => {
  it('delegates to repo.listNonArchived', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new ListWorkspacesUseCase(wsRepo)

    const workspaces = [stubWorkspaceListItem({ id: 'ws-1' }), stubWorkspaceListItem({ id: 'ws-2' })]
    vi.mocked(wsRepo.listNonArchived).mockResolvedValue(workspaces)

    const result = await uc.execute('org-1')

    expect(wsRepo.listNonArchived).toHaveBeenCalledWith('org-1')
    expect(result).toEqual(workspaces)
  })

  it('passes null orgId for open-source (single-tenant) mode', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new ListWorkspacesUseCase(wsRepo)

    const workspaces = [stubWorkspaceListItem({ id: 'ws-1' })]
    vi.mocked(wsRepo.listNonArchived).mockResolvedValue(workspaces)

    const result = await uc.execute(null)

    expect(wsRepo.listNonArchived).toHaveBeenCalledWith(null)
    expect(result).toEqual(workspaces)
  })
})
