import type { IntegrationTester, IntegrationTestResult } from '../ports/IntegrationTester.js'
import { ValidationError } from '../../domain/shared/errors.js'

export class TestIntegrationUseCase {
  constructor(private readonly tester: IntegrationTester) {}

  async execute(type: string, credentials: Record<string, string>): Promise<IntegrationTestResult> {
    if (!this.tester.supports(type)) {
      throw new ValidationError(`Unsupported integration type: ${type}`)
    }
    return this.tester.test(type, credentials)
  }
}
