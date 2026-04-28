import type { IntegrationTester, IntegrationTestResult } from '../../application/ports/IntegrationTester.js'

interface SlackAuthTestResponse {
  ok: boolean
  error?: string
  user?: string
  team?: string
}

export class SlackIntegrationTester implements IntegrationTester {
  supports(type: string): boolean {
    return type === 'slack'
  }

  async test(type: string, credentials: Record<string, string>): Promise<IntegrationTestResult> {
    if (type !== 'slack') return { ok: false, error: `Unsupported type: ${type}` }

    const botToken = credentials.bot_token
    if (!botToken) return { ok: false, error: 'bot_token is required' }

    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${botToken}` },
    })
    const data: SlackAuthTestResponse = await res.json()
    if (!data.ok) return { ok: false, error: data.error }
    return { ok: true, detail: { bot_name: data.user, team: data.team } }
  }
}
