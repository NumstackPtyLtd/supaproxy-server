import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, mockConversationRepo } from '../../__tests__/mocks.js'
import { GetComplianceUseCase } from './GetComplianceUseCase.js'

describe('GetComplianceUseCase', () => {
  it('returns guardrails and parsed violations', async () => {
    const wsRepo = mockWorkspaceRepo()
    const convRepo = mockConversationRepo()
    vi.mocked(wsRepo.findGuardrails).mockResolvedValue([
      { id: 'g1', rule_type: 'pii_filter', enabled: true, config: '{}' },
    ])
    vi.mocked(convRepo.getComplianceViolationsByWorkspace).mockResolvedValue([
      { compliance_violations: JSON.stringify([{ rule: 'PII', description: 'Email leaked' }]), conversation_id: 'c1', user_name: 'Bob', last_activity_at: '2024-01-01' },
    ])

    const useCase = new GetComplianceUseCase(wsRepo, convRepo)
    const result = await useCase.execute('ws-test')

    expect(result.guardrails).toHaveLength(1)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].rule).toBe('PII')
    expect(result.violations[0].conversation_id).toBe('c1')
  })

  it('handles null compliance_violations gracefully', async () => {
    const wsRepo = mockWorkspaceRepo()
    const convRepo = mockConversationRepo()
    vi.mocked(convRepo.getComplianceViolationsByWorkspace).mockResolvedValue([
      { compliance_violations: null, conversation_id: 'c1', user_name: null, last_activity_at: null },
    ])

    const useCase = new GetComplianceUseCase(wsRepo, convRepo)
    const result = await useCase.execute('ws-test')

    expect(result.violations).toHaveLength(0)
  })
})
