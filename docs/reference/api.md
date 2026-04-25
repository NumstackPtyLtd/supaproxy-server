# API Endpoints

All endpoints served by the SupaProxy backend API.

## Health

```
GET /health
```

Returns server status, setup state, and workspace count. No auth required.

```json
200: { "status": "ok", "setup_complete": true, "workspaces": 2 }
```

## Signup

```
POST /api/signup
Content-Type: application/json

{
  "org_name": "Acme Corp",
  "admin_name": "Jane",
  "admin_email": "jane@acme.com",
  "admin_password": "securepass",
  "workspace_name": "Support Bot",
  "team_name": "Customer Support"
}
```

Creates an organisation, admin user, team, and first workspace in a single atomic call. Sets the session cookie automatically. Returns:

```json
200: {
  "status": "ok",
  "org_id": "de14cfd7...",
  "user_id": "20939ded...",
  "workspace_id": "ws-support-bot"
}
```

Rejects if the email is already registered.

## Auth

### Login

```
POST /api/auth/login
Content-Type: application/x-www-form-urlencoded

email=jane@acme.com&password=securepass
```

On success: sets session cookie (JWT, httpOnly, 24h), 302 redirects to `/workspaces`.

On failure: 302 redirects to `/login?error=invalid_credentials`.

### Session

```
GET /api/auth/session
Cookie: reclaim_session=...
```

```json
200: { "user": { "id": "...", "email": "...", "name": "...", "role": "admin" } }
200: { "user": null }  // not authenticated
```

### Logout

```
GET /api/auth/logout
```

Clears the cookie and redirects to `/login`.

## Organisation

### Get org

```
GET /api/org
Cookie: reclaim_session=...
```

```json
200: { "org": { "id": "...", "name": "Acme Corp", "slug": "acme-corp", "created_at": "..." } }
```

### Update org

```
PUT /api/org

{ "name": "Acme Group" }
```

### Get settings

```
GET /api/org/settings
```

Returns all org settings. Secret values are masked.

```json
200: { "settings": { "messaging_bot_token": "--------", "ai_provider_key": "--------" } }
```

### Update a setting

```
PUT /api/org/settings/:key

{ "value": "your-credential-here" }
```

Keys: `messaging_bot_token`, `messaging_app_token`, `ai_provider_key`.

### Test Slack connection

```
POST /api/org/integrations/slack/test

{ "bot_token": "your-bot-token" }
```

```json
200: { "bot_name": "SupaProxy", "team": "Acme Corp" }
400: { "error": "Slack error: invalid_auth" }
```

### List users

```
GET /api/org/users
```

```json
200: { "users": [{ "id": "...", "name": "Jane", "email": "...", "org_role": "admin", "created_at": "..." }] }
```

## Teams

```
GET /api/teams
```

```json
200: { "teams": [{ "id": "...", "name": "Customer Support" }] }
```

## Workspaces

### List workspaces

```
GET /api/workspaces
```

```json
200: { "workspaces": [{
  "id": "ws-support-bot",
  "name": "Support Bot",
  "team": "Customer Support",
  "status": "active",
  "model": "balanced",
  "connection_count": 1,
  "tool_count": 4,
  "knowledge_count": 0,
  "queries_today": 12,
  "cost_mtd": 0.45
}] }
```

### Workspace detail

```
GET /api/workspaces/:id
```

Returns the full workspace with all child data: connections, tools, knowledge sources, guardrails, consumers, permissions, and stats.

### Update workspace

```
PUT /api/workspaces/:id

{ "name": "Support Assistant", "model": "powerful", "system_prompt": "..." }
```

### Create workspace

```
POST /api/workspaces

{
  "name": "HR Assistant",
  "team_name": "Human Resources",
  "system_prompt": "You are the HR Assistant..."
}
```

If `team_name` matches an existing team, it reuses it. Otherwise creates a new team.

### Workspace activity

```
GET /api/workspaces/:id/activity?limit=20&offset=0
```

```json
200: { "activity": [{
  "id": "...",
  "user_name": "Jane",
  "query": "What's the status of order ORD-2026-001?",
  "tools_called": ["get_order_status"],
  "connections_hit": ["order-service"],
  "tokens_input": 860,
  "tokens_output": 310,
  "cost_usd": 0.008,
  "duration_ms": 2340,
  "created_at": "2026-04-18T12:00:00Z"
}], "total": 45 }
```

## Connectors

### Add MCP connection

```
POST /api/connectors/mcp

{
  "workspace_id": "ws-support-bot",
  "name": "order-service",
  "command": "node",
  "args": ["/opt/services/order-mcp/index.js"]
}
```

```json
200: { "status": "saved", "message": "MCP connection saved. Tools will be discovered on the next query." }
```

### Bind Slack channel

```
POST /api/connectors/slack-channel

{
  "workspace_id": "ws-support-bot",
  "channel_id": "C0EXAMPLE123",
  "channel_name": "#support-assist"
}
```

Rejects if the channel is already bound to another workspace.

```json
200: { "status": "saved", "message": "Channel #support-assist bound to this workspace." }
400: { "error": "This channel is already bound to \"HR Assistant\". A channel can only belong to one workspace." }
```

## Query

### Send a query

```
POST /api/workspaces/:id/query
Cookie: reclaim_session=...

{
  "query": "What's the order status for ORD-2026-001?",
  "history": []
}
```

Runs the agent loop for the specified workspace. Connects to MCP servers, discovers tools, invokes the language model, executes tool calls, and returns the answer.

```json
200: {
  "answer": "Order ORD-2026-001 is currently DELIVERED...",
  "tools_called": ["get_order_status"],
  "connections_hit": ["order-service"],
  "tokens": { "input": 860, "output": 310 },
  "cost_usd": 0.008,
  "duration_ms": 2340,
  "error": null
}
```
