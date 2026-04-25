# Configure Guardrails

Guardrails are rules the platform enforces on every query. This guide walks through configuring each one.

## PII Filter

Prevents customer personal data from appearing in AI responses.

```yaml
guardrails:
  pii_filter: true
  pii_fields: ["phone", "email", "id_number", "address"]
```

**How it works**: after the AI generates a response, SupaProxy scans the text for patterns matching the configured fields. Matches are replaced with `[REDACTED]`.

**When to use**: any workspace where support agents or non-developers interact with customer data. Even if the tool returns a phone number, the user sees `[REDACTED]`.

**Tradeoff**: the AI can still reason about the data internally (it needs to for tool calls). The filter only applies to the final user-facing response.

## Write Confirmation

Forces the AI to pause and ask for confirmation before executing write operations.

```yaml
  write_confirmation: true
  write_tool_patterns: ["send-*", "confirm-*", "cancel-*", "create-*", "update-*", "delete-*"]
```

**How it works**: when the AI selects a tool matching a write pattern, SupaProxy injects a confirmation step. The AI shows what it's about to do and waits for the user to type "yes".

**When to use**: always, for any workspace that has write tools. There's no good reason to allow silent writes from AI.

## Cost Cap

Monthly spending limit for AI model tokens.

```yaml
  cost_cap_monthly_usd: 50
```

**How it works**: SupaProxy estimates cost per query based on token usage and the configured model's pricing. When cumulative monthly cost reaches the cap, new queries are rejected with a message.

**Setting the right cap**:

| Usage level | Queries/day | Suggested cap |
|---|---|---|
| Light (demo, dev) | 5-20 | $10-20 |
| Medium (small team) | 20-100 | $30-75 |
| Heavy (support team) | 100-500 | $75-200 |

Start low. You can always increase. The dashboard shows current spend vs cap so you can adjust before hitting the limit.

## Rate Limiting

Prevents abuse or runaway bots.

```yaml
  rate_limit:
    per_user_per_minute: 10
    per_workspace_per_hour: 500
```

**Per-user**: protects against one person flooding the AI. 10/min is generous for human use -- a bot integration might need more.

**Per-workspace**: protects against the whole team accidentally running up costs. 500/hour is ~8/min across all users.

## Content Policy (planned)

```yaml
  content_policy:
    blocked_topics: ["competitor products", "legal advice", "investment recommendations"]
```

Scans AI responses for mentions of blocked topics. If detected, the response is replaced with a generic message explaining the topic is out of scope.

## Audit Retention

```yaml
  audit_retention_days: 90
```

How long query logs are stored. After this period, logs are archived or deleted. Regulated industries may require longer retention.

## Recommended starting config

For a new workspace, start with this and adjust based on usage:

```yaml
guardrails:
  pii_filter: true
  pii_fields: ["phone", "email", "id_number"]
  write_confirmation: true
  write_tool_patterns: ["send-*", "confirm-*", "cancel-*", "create-*"]
  cost_cap_monthly_usd: 30
  rate_limit:
    per_user_per_minute: 10
    per_workspace_per_hour: 300
  audit_retention_days: 90
```

PII filter and write confirmation should always be on. Cost cap and rate limits depend on expected usage.
