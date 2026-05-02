# Guardrails

Guardrails are middleware for AI queries. They sit in the pipeline between the consumer and the LLM, and each one can inspect, modify, replace, or block the query before it moves to the next stage.

## The middleware model

Each guardrail is a filter. It receives the query in its current state, does whatever it needs to do, and passes its version forward. Like Express middleware for HTTP requests, but for AI conversations.

```
User query
  → Filter 1 (pattern matching, masks PII)
  → Filter 2 (AI classifier, catches nuance)
  → Filter 3 (domain-specific, industry terms)
  → Forward to LLM (or block with explanation)
```

Each filter receives:
- `query` - the current state (may be modified by previous filters)
- `original` - the unmodified input (always preserved for audit)
- `context` - workspace, user, consumer type
- `metadata` - accumulated by previous filters

Each filter returns:
- `action: 'continue'` - pass to next filter (optionally with modified query)
- `action: 'block'` - stop the chain, return reason to user

## Pipeline stages

| Stage | When | Example filters |
|---|---|---|
| `pre-llm` | Before the query reaches the LLM | PII masking, credential blocking, content classification |
| `post-llm` | Before the response reaches the user | Hallucination detection, toxic content filtering, brand voice |

## Pattern actions

The built-in PatternGuardrail supports four actions per rule:

| Action | What it does | Example |
|---|---|---|
| `mask` | Replace matched content with a placeholder | `john@example.com` → `[PII]` |
| `hash` | Replace with a consistent hash (same input = same output) | `john@example.com` → `[hash:a1b2c3d4]` |
| `remove` | Strip the matched content entirely | `john@example.com` → `` |
| `block` | Stop the query from proceeding | Credit card numbers, private keys |

Custom replacements can be specified per rule.

## Built-in guardrails

### PatternGuardrail

Regex and token matching. No model required, no data egress. Built-in rules cover:
- South African ID numbers (mask)
- Credit card numbers (block)
- Email addresses (hash)
- Phone numbers (mask)
- API keys, AWS keys, private keys (block)

Custom rules can be added per workspace.

### LlmGuardrail

Calls any OpenAI-compatible endpoint to analyse the query. The AI can suggest modifications (find/replace pairs) or block entirely. Point it at Ollama, a private Azure deployment, or any locally-hosted model.

## Marketplace guardrails

Third-party guardrails install via the marketplace. They implement the same `GuardrailPlugin` interface and join the chain as additional filters.

## Events

Every query that passes through the guardrail pipeline emits events:

| Event | When |
|---|---|
| `guardrail.processed` | Every query that goes through the chain |
| `guardrail.modified` | Query was modified by one or more filters |
| `guardrail.blocked` | Query was blocked |

## Audit logging

When a query is processed, three fields are written to the audit log:

| Field | Description |
|---|---|
| `input_screening_action` | `modified`, `block`, or `null` (no guardrails) |
| `input_screening_categories` | Annotations from all filters in the chain |
| `input_screening_ms` | Total pipeline duration |

The audit log `query` field stores the **original** query. The modified version is what was forwarded to the LLM. Both are recorded.

## Best practices

### Keep filters focused
Each filter should do one thing. A PII filter should not also check for credentials. Separate concerns make the chain easier to debug and maintain.

### Order matters
Fast, cheap filters first (pattern matching). Slow, expensive filters last (LLM classification). This minimises latency for clean queries.

### Fail open by default
If a filter errors, it should return `continue` (not block). A failed guardrail should not silently prevent all queries. Log the error and let the query through.

### Domain experts own their filters
A fintech compliance team maintains the trading terminology filter. A healthcare organisation maintains the HIPAA filter. The platform provides the pipeline. The domain experts provide the intelligence.

### Cache where possible
Guardrail decisions for identical queries should be cacheable. For AI-based filters, consider semantic caching where similar (not just identical) queries can reuse previous decisions.

## Configuration

Guardrails are configured per workspace. A workspace can have:
- No guardrails (default, behaves like today)
- Pattern-only (fast, no external dependencies)
- Pattern + LLM (defence in depth)
- Pattern + LLM + marketplace plugins (full chain)
