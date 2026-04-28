import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo } from '../../__tests__/mocks.js'
import { GetActivityUseCase } from './GetActivityUseCase.js'

describe('GetActivityUseCase', () => {
  it('delegates to repo with limit and offset', async () => {
    const wsRepo = mockWorkspaceRepo()
    const uc = new GetActivityUseCase(wsRepo)

    const activityResult = {
      rows: [{
        id: 'log-1', consumer_type: 'slack', channel: '#general',
        user_name: 'Test User', query: 'What is the status?',
        tools_called: 'get_status', connections_hit: 'conn-1',
        tokens_input: 100, tokens_output: 50, cost_usd: 0.01,
        duration_ms: 500, error: null, created_at: '2024-01-01',
      }],
      total: 1,
    }
    vi.mocked(wsRepo.findActivityLog).mockResolvedValue(activityResult)

    const result = await uc.execute('ws-test', 20, 0)

    expect(wsRepo.findActivityLog).toHaveBeenCalledWith('ws-test', 20, 0)
    expect(result).toEqual(activityResult)
  })
})
