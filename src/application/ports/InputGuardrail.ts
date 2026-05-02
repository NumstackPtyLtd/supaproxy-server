/**
 * Input Guardrail port - re-exports from @supaproxy/guardrails.
 *
 * Each plugin is middleware that can modify, replace, or block a query.
 * The chain runner pipes the output of one filter into the next.
 *
 * Events emitted by the server after processing:
 *   guardrail.processed - every query that passes through the chain
 *   guardrail.modified  - query was modified by one or more filters
 *   guardrail.blocked   - query was blocked
 */
export type {
  GuardrailPlugin as InputGuardrail,
  GuardrailInput,
  GuardrailOutput,
  GuardrailStage,
  GuardrailContext,
  PatternRule,
  PatternAction,
} from '@supaproxy/guardrails'

export { runGuardrailChain } from './guardrailChain.js'
