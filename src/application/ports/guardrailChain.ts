import type { GuardrailPlugin, GuardrailAction, GuardrailContext, ScreeningResult } from '@supaproxy/guardrails'

/**
 * Runs multiple guardrails in sequence.
 * First 'block' stops the chain. Redactions accumulate.
 */
export async function runGuardrailChain(
  guardrails: GuardrailPlugin[],
  query: string,
  context: GuardrailContext,
): Promise<{ finalAction: GuardrailAction; results: ScreeningResult[]; sanitisedQuery: string }> {
  const results: ScreeningResult[] = []
  let currentQuery = query

  for (const guardrail of guardrails) {
    const result = await guardrail.screen(currentQuery, context)
    results.push(result)

    if (result.action === 'block') {
      return { finalAction: 'block', results, sanitisedQuery: currentQuery }
    }

    if (result.action === 'redact' && result.sanitisedQuery) {
      currentQuery = result.sanitisedQuery
    }
  }

  const wasRedacted = results.some(r => r.action === 'redact')
  return {
    finalAction: wasRedacted ? 'redact' : 'pass',
    results,
    sanitisedQuery: currentQuery,
  }
}
