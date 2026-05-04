import type { McpClientFactory } from '../ports/McpClient.js'

interface TestResult {
  ok: boolean
  tools?: number
  server?: string
  toolNames?: string[]
  error?: string
}

export class TestMcpConnectionUseCase {
  constructor(private readonly mcpFactory: McpClientFactory) {}

  async execute(transport: string, url?: string, command?: string, headers?: Record<string, string>): Promise<TestResult> {
    if (transport === 'http') {
      if (!url) return { ok: false, error: 'Server URL is required' }
      return this.mcpFactory.testHttp(url, headers)
    }
    return { ok: false, error: 'STDIO connections are tested on first query.' }
  }
}
