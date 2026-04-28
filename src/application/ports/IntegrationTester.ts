export interface IntegrationTestResult {
  ok: boolean
  detail?: Record<string, unknown>
  error?: string
}

export interface IntegrationTester {
  test(type: string, credentials: Record<string, string>): Promise<IntegrationTestResult>
  supports(type: string): boolean
}
