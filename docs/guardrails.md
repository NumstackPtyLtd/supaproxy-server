# Guardrails

Guardrails are the screening layer that sits between consumers and the LLM. They intercept queries and responses to detect, redact, or block sensitive content before it leaves your infrastructure.

## Pipeline stages

Guardrails run at two points in the conversation flow:

| Stage | When | What it screens | Example |
|---|---|---|---|
| `pre-llm` | After user sends query, before LLM receives it | User input | PII, credentials, IP, confidential data |
| `post-llm` | After LLM responds, before user receives it | Model output | Hallucinations, toxic content, brand violations |

Each stage supports multiple guardrails chained in sequence. The first `block` stops the chain. Redactions accumulate through the chain.

## Actions

| Action | What happens |
|---|---|
| `pass` | No issue detected. Content forwarded unchanged. |
| `redact` | Sensitive tokens replaced with `[REDACTED:category]`. Sanitised version forwarded. |
| `block` | Content rejected. User receives an explanation. Nothing forwarded. |

## Built-in guardrails (open source)

### PatternInputGuardrail

Regex and token matching. No model required, no data egress. Covers:
- South African ID numbers
- Credit card numbers (Luhn-validated)
- Email addresses
- Phone numbers
- Custom regex patterns per workspace

### LlmInputGuardrail

Calls any OpenAI-compatible endpoint to classify the query. Self-hosters point this at Ollama, a private Azure deployment, or any locally-hosted model. The screening happens privately before the query reaches the public LLM.

## Marketplace guardrails

Third-party guardrails install via the marketplace. They register as pipeline plugins with a `pre-llm` or `post-llm` stage and run as part of the guardrail chain.

Example marketplace plugins:
- **Redact** (by Numstack) - Advanced PII detection with ML-based entity recognition
- **Safety** (by Numstack) - Output validation for hallucinations, toxicity, brand voice

## Events

Every guardrail screening emits events that marketplace products can subscribe to via hooks:

| Event | When | Payload |
|---|---|---|
| `guardrail.triggered` | Any non-pass result | source, action, categories, confidence |
| `guardrail.blocked` | Query blocked | source, categories, message |
| `guardrail.redacted` | Content redacted | source, categories, redacted fields |

### Why events matter

Events connect guardrails to the broader product ecosystem:

- **Sherlock** subscribes to `guardrail.triggered` - blocked queries are a fraud signal (user may be attempting data exfiltration)
- **Abide** subscribes to `guardrail.blocked` - a blocked query could indicate a policy violation worth logging for compliance
- **Audit** subscribes to all guardrail events - every screening decision is part of the immutable compliance trail

## Guardrail chain execution

```
User query
  │
  ▼
┌─────────────────────┐
│ PatternInputGuardrail│ ── regex/token matching (fast, no external calls)
└──────────┬──────────┘
           │ pass or redacted query
           ▼
┌─────────────────────┐
│ LlmInputGuardrail   │ ── calls private model endpoint (deeper analysis)
└──────────┬──────────┘
           │ pass or redacted query
           ▼
┌─────────────────────┐
│ Marketplace plugins  │ ── installed guardrails run in install order
└──────────┬──────────┘
           │
           ▼
       Forward to LLM (or block)
```

1. Each guardrail receives the output of the previous one
2. First `block` stops the entire chain
3. Redactions accumulate through the chain
4. Events emitted after each guardrail completes
5. All results logged to audit trail (original query preserved)

## Audit logging

When a query is screened, three fields are added to the audit log:

| Field | Type | Description |
|---|---|---|
| `input_screening_action` | `pass`, `redact`, `block`, or `null` | Final action taken |
| `input_screening_categories` | `string[]` or `null` | All detected categories across the chain |
| `input_screening_ms` | `number` or `null` | Total screening duration |

When the action is `redact`, the audit log `query` field stores the **original** query. The sanitised version is what was forwarded to the LLM. Both are recorded. Compliance teams need to know what was actually said.

## Configuration

Guardrails are configured per workspace. A workspace can have:
- No guardrails (default, behaves like today)
- Pattern-only (fast, no external dependencies)
- Pattern + LLM (defense in depth)
- Pattern + LLM + marketplace plugins (full chain)

Configuration is stored in workspace settings and managed via the dashboard UI or API.
