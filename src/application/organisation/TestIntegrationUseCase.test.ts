import { describe, it, expect, vi } from 'vitest'
import { mockIntegrationTester } from '../../__tests__/mocks.js'
import { TestIntegrationUseCase } from './TestIntegrationUseCase.js'
import { ValidationError } from '../../domain/shared/errors.js'

describe('TestIntegrationUseCase', () => {
  function setup() {
    const tester = mockIntegrationTester()
    const useCase = new TestIntegrationUseCase(tester)
    return { tester, useCase }
  }

  it('execute returns result for supported type', async () => {
    const { tester, useCase } = setup()
    vi.mocked(tester.supports).mockReturnValue(true)
    vi.mocked(tester.test).mockResolvedValue({ ok: true, detail: { bot_name: 'bot', team: 'team' } })

    const result = await useCase.execute('slack', { bot_token: 'xoxb-test' })

    expect(tester.supports).toHaveBeenCalledWith('slack')
    expect(tester.test).toHaveBeenCalledWith('slack', { bot_token: 'xoxb-test' })
    expect(result).toEqual({ ok: true, detail: { bot_name: 'bot', team: 'team' } })
  })

  it('execute throws ValidationError for unsupported type', async () => {
    const { tester, useCase } = setup()
    vi.mocked(tester.supports).mockReturnValue(false)

    await expect(useCase.execute('unsupported', {})).rejects.toThrow(ValidationError)
    expect(tester.test).not.toHaveBeenCalled()
  })
})
