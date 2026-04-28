import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, stubWorkspace } from '../../__tests__/mocks.js'
import { GetWorkspaceDetailUseCase } from './GetWorkspaceDetailUseCase.js'
import { NotFoundError } from '../../domain/shared/errors.js'

describe('GetWorkspaceDetailUseCase', () => {
  it('returns workspace with all related data and stats', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetWorkspaceDetailUseCase(wsRepo)

    const ws = stubWorkspace()
    vi.mocked(wsRepo.findByIdWithTeam).mockResolvedValue({ ...ws, team: 'Engineering' })
    vi.mocked(wsRepo.findConnections).mockResolvedValue([])
    vi.mocked(wsRepo.findToolsDetailed).mockResolvedValue([])
    vi.mocked(wsRepo.findKnowledge).mockResolvedValue([])
    vi.mocked(wsRepo.findGuardrails).mockResolvedValue([])
    vi.mocked(wsRepo.findConsumers).mockResolvedValue([])
    vi.mocked(wsRepo.findPermissions).mockResolvedValue([])
    vi.mocked(wsRepo.getStats).mockResolvedValue({
      today: 10, week: 50, month: 200, avg_ms: 1234.5,
      cost_mtd: 12.34, errors_week: 5, total_week: 50,
    })

    const result = await uc.execute('ws-test')

    expect(result.workspace).toEqual(expect.objectContaining({ id: 'ws-test' }))
    expect(result.connections).toEqual([])
    expect(result.tools).toEqual([])
    expect(result.knowledge).toEqual([])
    expect(result.guardrails).toEqual([])
    expect(result.consumers).toEqual([])
    expect(result.permissions).toEqual([])
    expect(result.stats).toEqual({
      today: 10,
      week: 50,
      month: 200,
      avg_ms: 1235,
      cost_mtd: 12.34,
      error_rate: 0.1,
    })
  })

  it('throws NotFoundError if not found', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetWorkspaceDetailUseCase(wsRepo)

    vi.mocked(wsRepo.findByIdWithTeam).mockResolvedValue(null)

    await expect(uc.execute('ws-missing')).rejects.toThrow(NotFoundError)
  })

  it('calculates error rate correctly', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetWorkspaceDetailUseCase(wsRepo)

    vi.mocked(wsRepo.findByIdWithTeam).mockResolvedValue(stubWorkspace())
    vi.mocked(wsRepo.getStats).mockResolvedValue({
      today: 0, week: 0, month: 0, avg_ms: 0,
      cost_mtd: 0, errors_week: 0, total_week: 0,
    })

    const result = await uc.execute('ws-test')

    // When total_week is 0, error_rate should be 0 (no division by zero)
    expect(result.stats.error_rate).toBe(0)
  })
})
