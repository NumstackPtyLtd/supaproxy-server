# Observability

Every query through SupaProxy is logged. Who asked, what tools were called, which connections were hit, how many tokens were used, what it cost, and how long it took. This is the foundation for cost management, debugging, and compliance auditing.

## Audit log entry

Each query produces one log entry:

```json
{
  "timestamp": "2026-04-17T10:15:00Z",
  "workspace_id": "ws-support-bot",
  "consumer": "slack",
  "channel": "C0EXAMPLE123",
  "user_id": "U12345",
  "user_name": "Jane S.",
  "query": "What's the order status for ORD-2026-001?",
  "tools_called": [
    { "name": "get-order-status", "connection": "order-service", "duration_ms": 320 }
  ],
  "knowledge_chunks_used": 0,
  "tokens": { "input": 860, "output": 310 },
  "cost_usd": 0.008,
  "guardrails": { "pii_filtered": false, "write_confirmed": false },
  "duration_ms": 950,
  "error": null
}
```

## What you can answer with this data

| Question | Log fields |
|---|---|
| How much is this workspace costing us? | Sum of `cost_usd` per workspace per month |
| Which tools are most used? | Count of `tools_called[].name` |
| Which connections are slowest? | Avg of `tools_called[].duration_ms` grouped by connection |
| Who's using the AI most? | Count per `user_id` |
| Are guardrails firing? | `guardrails.pii_filtered` and `guardrails.rate_limited` counts |
| What failed? | Entries where `error` is not null |
| Was PII exposed? | Entries where `guardrails.pii_filtered` is true -- the filter caught it |

## Dashboard metrics

The workspace detail page shows live-ish metrics derived from the audit log:

- **Queries today/week/month** -- volume trend
- **Cost MTD** -- current spend vs cap, with progress bar
- **Avg latency** -- end-to-end query time including tool calls
- **Error rate** -- percentage of queries that failed
- **Per-connection stats** -- calls and latency per data source
- **Per-tool stats** -- calls and latency per tool

## Export

Audit logs can be exported as JSONL for external analysis. The Observability tab has an Export button that downloads the current workspace's logs for the selected time range.

Future: direct integration with popular observability platforms for real-time dashboards and alerting.

## Storage

| Environment | Storage | Retention |
|---|---|---|
| Development | Local database | Unlimited |
| Production | Production database | Configurable per workspace (default 90 days) |

## What is NOT logged

- The full AI response text (too large, PII risk) -- only response length
- Tool result payloads (may contain customer data) -- only the tool name and args
- Conversation history (retained in-memory for thread context, not persisted to audit log)

The audit log captures **metadata about what happened**, not the content of the data. This keeps the log safe to export and review without PII concerns.
