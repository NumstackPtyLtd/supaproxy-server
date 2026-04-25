# Compliance

Compliance rules are platform-enforced guardrails. They apply to every query in a workspace -- teams can't bypass them, even accidentally. This is what separates a governed platform from a collection of scripts.

## Available rules

### PII Filter

Scans every AI response before it reaches the user. Configured fields (phone, email, ID number, address) are redacted and replaced with `[REDACTED]`.

```yaml
guardrails:
  pii_filter: true
  pii_fields: ["phone", "email", "id_number", "address"]
```

The filter runs on the final response text, not on tool results. The AI can see the data internally (needed for reasoning) but the user-facing output is cleaned.

### Write Confirmation

Tools that modify data (send message, confirm payment, cancel subscription) require explicit user confirmation. The AI pauses, shows what it's about to do, and waits for a "yes".

```yaml
  write_confirmation: true
  write_tool_patterns: ["send-*", "confirm-*", "cancel-*", "create-*"]
```

Tools matching these patterns trigger the confirmation flow. Read-only tools execute immediately.

### Cost Cap

Monthly spending limit for AI model tokens per workspace. When the cap is reached, queries are rejected with a message explaining why.

```yaml
  cost_cap_monthly_usd: 50
```

Cost is estimated per query based on token usage (input + output) and the configured model's pricing. The dashboard shows current spend vs cap.

### Rate Limiting

Prevents individual users or the workspace from excessive usage. Two levels:

```yaml
  rate_limit:
    per_user_per_minute: 10
    per_workspace_per_hour: 500
```

Rate-limited queries return a message asking the user to wait. No partial execution.

### Content Policy (planned)

Block responses about specific topics -- competitor products, legal advice, investment recommendations. Configurable per workspace.

### Data Residency (planned)

Restrict which regions' data can appear in responses. Relevant for cross-border services where different jurisdictions have different residency requirements.

### Audit Retention

How long query logs are stored. Default: 90 days. Configurable per workspace for compliance requirements.

## Enforcement order

```
Query arrives
  +-- 1. Rate limit check        -> reject if exceeded
  +-- 2. Cost cap check           -> reject if over budget
  +-- 3. User permission check    -> reject if role doesn't match
  +-- 4. Tool permission filter   -> hide tools user can't access
  +-- 5. Agent loop executes      -> LLM + tool calls
  +-- 6. Write confirmation       -> pause if write tool detected
  +-- 7. PII filter               -> redact configured fields
  +-- 8. Content policy           -> block if topic is restricted
  +-- 9. Audit log                -> record everything
```

Pre-query guardrails (1-4) prevent expensive operations from even starting. Post-response guardrails (7-8) clean the output before the user sees it. Everything is logged (9).

## Overrides

There are no per-query overrides. If a guardrail is enabled, it applies to every query in the workspace. To change a rule, update the workspace config. Changes take effect immediately -- no restart needed.

> This is intentional. If guardrails could be bypassed per-query, they wouldn't be guardrails -- they'd be suggestions.
