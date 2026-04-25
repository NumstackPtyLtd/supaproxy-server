# Workspace Schema

Workspaces are stored in the database, not configuration files. All configuration is managed through the dashboard and API. This page documents the data model.

## Workspace fields

| Field | Type | Default | Description |
|---|---|---|---|
| id | VARCHAR(64) | auto | Generated from name: `ws-support-bot` |
| org_id | VARCHAR(64) | - | Organisation this workspace belongs to |
| team_id | VARCHAR(64) | - | Team that owns this workspace |
| name | VARCHAR(255) | - | Display name shown in dashboard |
| status | ENUM | active | `active`, `paused`, or `archived` |
| model | VARCHAR(100) | balanced | Model tier for queries (fast, balanced, powerful) |
| system_prompt | TEXT | null | Instructions that guide the AI's behaviour |
| max_tool_rounds | INT | 10 | Max tool-call iterations per query |
| max_thread_history | INT | 50 | Max messages kept in conversation context |
| created_by | VARCHAR(64) | null | User who created this workspace |

## Connections (connections table)

| Field | Type | Description |
|---|---|---|
| name | VARCHAR(100) | Connection identifier, unique per workspace |
| type | ENUM | `mcp`, `rest`, `graphql`, `database`, `webhook` |
| status | ENUM | `connected`, `disconnected`, `error`, `idle` |
| config | JSON | Connection-specific configuration |

### MCP connection config

```json
{
  "transport": "stdio",
  "command": "node",
  "args": ["/opt/services/order-mcp/index.js"],
  "env": { "MCP_ENV_LABEL": "local" }
}
```

### REST API connection config (planned)

```json
{
  "base_url": "https://api.example.com/v1",
  "auth": { "type": "bearer", "token_setting": "example_api_token" },
  "tools": [
    { "name": "get-user", "method": "GET", "path": "/users/{userId}", "args": ["userId"] },
    { "name": "send-notification", "method": "POST", "path": "/notify", "args": ["userId", "message"], "write": true }
  ]
}
```

## Connection tools (connection_tools table)

Populated automatically when SupaProxy connects to an MCP server and calls `tools/list`.

| Field | Type | Description |
|---|---|---|
| name | VARCHAR(100) | Tool name, unique per connection |
| description | TEXT | What the tool does (shown to the language model) |
| input_schema | JSON | JSON Schema for tool arguments |
| is_write | BOOLEAN | Whether the tool modifies data |

## Knowledge sources (knowledge_sources table)

| Field | Type | Description |
|---|---|---|
| type | ENUM | `confluence`, `file`, `inline`, `url` |
| name | VARCHAR(255) | Display name |
| config | JSON | Source-specific config (space key, file path, URL, etc.) |
| status | ENUM | `pending`, `syncing`, `synced`, `error` |
| chunks | INT | Number of indexed chunks |

## Consumers (consumers table)

| Field | Type | Description |
|---|---|---|
| type | ENUM | `slack`, `api`, `web-chat`, `whatsapp` |
| config | JSON | Consumer-specific config |
| status | ENUM | `active` or `inactive` |

### Slack consumer config

```json
{
  "channels": ["C0EXAMPLE123"],
  "channel_name": "#support-assist",
  "allow_dms": true,
  "thread_context": true
}
```

A channel ID can only appear in one workspace's consumer. The API enforces this constraint.

## Guardrails (guardrails table)

| Field | Type | Description |
|---|---|---|
| rule_type | VARCHAR(50) | Rule identifier, unique per workspace |
| enabled | BOOLEAN | Whether the rule is active |
| config | JSON | Rule-specific configuration |

### Example guardrail configs

```json
// PII filter
{ "rule_type": "pii_filter", "config": { "fields": ["phone", "email", "id_number"] } }

// Cost cap
{ "rule_type": "cost_cap", "config": { "monthly_usd": 50 } }

// Rate limit
{ "rule_type": "rate_limit", "config": { "per_user_per_minute": 10, "per_workspace_per_hour": 500 } }
```

## Permissions (permissions table)

| Field | Type | Description |
|---|---|---|
| role | VARCHAR(50) | Role name, unique per workspace |
| tool_patterns | JSON | Glob patterns for allowed tools |

```json
{ "role": "support", "tool_patterns": ["get-*", "check-*", "find-*"] }
{ "role": "ops", "tool_patterns": ["*"] }
```

## Audit logs (audit_logs table)

Every query is logged with full telemetry. See the [Observability](../observability.md) page for details.
