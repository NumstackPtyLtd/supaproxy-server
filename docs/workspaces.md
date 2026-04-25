# Workspaces

A workspace is SupaProxy's unit of isolation. It binds together connections, knowledge, compliance rules, and consumers into a single governed environment for one team.

## Why workspaces

Without workspaces, you would have one big pool of tools, docs, and permissions. Support agents would see engineering's internal tools. Finance could accidentally query customer PII. Compliance rules would be global or nonexistent.

Workspaces solve this: each team's AI sees only what has been configured for it. Tools, knowledge, guardrails, and users are scoped per workspace.

## Workspace lifecycle

1. **Create** -- admin creates a workspace via the dashboard, assigning it to a team
2. **Connect** -- add connections (MCP servers, REST APIs) so the AI has tools
3. **Bind** -- add consumers (Slack channel, API key) so users can interact
4. **Configure** -- set the system prompt, model tier, and compliance rules
5. **Activate** -- queries start flowing. All guardrails and logging are active
6. **Monitor** -- usage, cost, errors visible in the Observability tab

## What a workspace contains

Each workspace brings together everything the AI needs to operate:

| Component | Purpose |
|---|---|
| Connections | Data sources the AI can query (MCP servers, REST APIs, databases) |
| Discovered tools | Functions the AI can call, auto-discovered from connections |
| Knowledge sources | Documents, wiki pages, and context the AI can search |
| Compliance rules | PII filtering, cost caps, rate limits -- inherited from the organisation baseline |
| Consumers | Channels where users interact -- Slack, API, WhatsApp |
| Permissions | Role-based access controlling which tools each user role can invoke |
| Audit trail | Every query logged with user, tools, cost, and duration |

## Workspace tabs

The workspace detail page has seven tabs:

- **Overview** -- query stats (today, week, month), cost MTD, connections, consumers, knowledge, compliance at a glance
- **Connections** -- data sources (MCP, REST, DB). Add, view discovered tools, check health
- **Consumers** -- delivery channels (Slack, API, WhatsApp). A channel can only belong to one workspace
- **Knowledge** -- documents and context the AI can search
- **Compliance** -- guardrails: PII filtering, cost caps, rate limits, content policies
- **Observability** -- full audit trail: every query with user, tools, tokens, cost, duration
- **Settings** -- workspace name, model tier, system prompt

## Isolation guarantees

| Boundary | What it means |
|---|---|
| Connection isolation | Workspace A cannot call workspace B's connections |
| Knowledge isolation | Indexed documents in workspace A are not searchable from workspace B |
| Cost isolation | Token spend is tracked per workspace, not pooled |
| Log isolation | Each workspace's audit trail is separate (org admins see all) |
| Channel isolation | A Slack channel belongs to exactly one workspace. No cross-workspace pollution |
