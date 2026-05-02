/**
 * Input Guardrail port — re-exports from @supaproxy/guardrails.
 *
 * The GuardrailPlugin interface from the package IS the port.
 * This file provides the chain runner and type aliases.
 *
 * Pipeline stages:
 *   pre-llm  — input screening (before LLM receives the query)
 *   post-llm — output validation (before user receives the response)
 *
 * Events emitted by the server after screening:
 *   guardrail.triggered — any non-pass result
 *   guardrail.blocked   — query blocked
 *   guardrail.redacted  — content redacted
 */
export type {
  GuardrailPlugin as InputGuardrail,
  GuardrailAction,
  GuardrailStage,
  GuardrailContext,
  ScreeningResult,
  PatternRule,
} from '@supaproxy/guardrails'

export { runGuardrailChain } from './guardrailChain.js'
