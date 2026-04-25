# Quick Start

Get up and running with SupaProxy in under 5 minutes.

## 1. Sign up

Visit your SupaProxy instance and create an account. The signup flow has three steps:

1. **Organisation** -- name your organisation (e.g. "Acme Corp")
2. **Account** -- create your admin account (name, email, password)
3. **Workspace** -- create your first workspace and assign it to a team

Everything is created in a single step. You are automatically signed in and redirected to the workspace.

## 2. Configure your workspace

Inside the workspace, use the tabs to set up:

- **Connections** -- add an MCP server or REST API so the AI has tools to call
- **Consumers** -- bind a Slack channel so users can query via Slack
- **Knowledge** -- add documents and pages for context
- **Compliance** -- configure guardrails like PII filtering and cost caps
- **Settings** -- set the system prompt, model tier, and workspace name

## 3. Set up integrations

Go to **Settings** in the top nav to configure organisation-level integrations:

- **Messaging bot** -- add your bot credentials. This is the single SupaProxy bot shared by all workspaces. Individual workspaces bind channels to it
- **AI provider** -- add your AI provider API credentials, used by all workspaces for AI queries

## 4. Query

Once a connection is configured, you can query the workspace:

- **Via API**: `POST /api/workspaces/:id/query` with a JSON body containing your query
- **Via Slack**: mention the SupaProxy bot in a bound channel

All queries are logged in the Observability tab with tokens, cost, duration, and tools called.
