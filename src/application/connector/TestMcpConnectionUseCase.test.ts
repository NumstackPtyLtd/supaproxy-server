import { describe, it, expect, vi } from 'vitest'
import { mockMcpFactory } from '../../__tests__/mocks.js'
import { TestMcpConnectionUseCase } from './TestMcpConnectionUseCase.js'

describe('TestMcpConnectionUseCase', () => {
  it('HTTP transport delegates to mcpFactory.testHttp', async () => {
    const factory = mockMcpFactory()
    const testResult = { ok: true, tools: 2, server: 'test-server', toolNames: ['a', 'b'] }

    vi.mocked(factory.testHttp).mockResolvedValue(testResult)

    const uc = new TestMcpConnectionUseCase(factory)
    const result = await uc.execute('http', 'http://localhost:8080')

    expect(factory.testHttp).toHaveBeenCalledWith('http://localhost:8080')
    expect(result).toEqual(testResult)
  })

  it('returns error for STDIO transport', async () => {
    const factory = mockMcpFactory()

    const uc = new TestMcpConnectionUseCase(factory)
    const result = await uc.execute('stdio', undefined, 'npx')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('STDIO connections are tested on first query.')
    expect(factory.testHttp).not.toHaveBeenCalled()
  })

  it('returns error if HTTP with no URL', async () => {
    const factory = mockMcpFactory()

    const uc = new TestMcpConnectionUseCase(factory)
    const result = await uc.execute('http')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Server URL is required')
    expect(factory.testHttp).not.toHaveBeenCalled()
  })
})
