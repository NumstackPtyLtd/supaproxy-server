# What is SupaProxy

SupaProxy is an AI operations platform. It lets teams connect their data sources, curate knowledge, set compliance rules, and deploy governed AI -- without each team building their own.

## The problem

When teams start adopting AI independently, organisations face real risk:

- **Compliance nightmare** -- each team chooses its own AI provider, stores credentials differently, and handles sensitive data with no shared standard. One team redacts PII, another does not. There is no audit trail across the organisation
- **Security exposure** -- API keys in environment files, unvetted third-party tools, no ability to block a compromised or flagged connection across all teams at once. Every new bot is a new attack surface
- **Audit cost** -- when security or compliance asks "which teams are using AI, what data can it access, and who approved it?", nobody has a single answer. Each team's setup has to be reviewed individually
- **Inconsistent experience** -- five teams build five bots with different UX, different error handling, and different quality. Users do not know what to expect
- **No cost visibility** -- AI spend is scattered across team budgets with no central view. Overruns are discovered after the fact
- **Duplicated effort** -- every team rebuilds authentication, logging, bot infrastructure, and guardrails from scratch. Engineering time is spent on plumbing instead of the domain-specific work that actually matters

## What SupaProxy does

SupaProxy gives the organisation a single platform to govern AI operations. Teams focus on their **connections** -- the domain-specific data sources they are experts in. SupaProxy handles everything else:

| Concern | Team owns | SupaProxy owns |
|---|---|---|
| Data access | MCP server or API endpoints | Connection registry, tool discovery, agent loop |
| Knowledge | Content (docs, pages) | Ingestion, indexing, retrieval |
| Security | Nothing | Auth, role-based access, credential storage, connection blocking |
| Compliance | Nothing | PII filtering, cost caps, rate limits, org-wide baseline that workspaces cannot weaken |
| Observability | Nothing | Full audit trail per query -- who asked, what tools were called, what data was accessed, what it cost |
| Delivery | Nothing | One bot shared across all workspaces, API access, multi-channel |

### Organisation-level control

Org admins set the compliance baseline: which PII fields must be redacted, what the monthly cost cap is, which connections are approved or blocked. Workspaces can add stricter rules but cannot loosen the baseline. If a connection is flagged as a security risk, the admin blocks it once and it is disabled across every workspace immediately.

## Key concepts

**Organisation** -- the top-level entity. Owns all workspaces, users, integrations, and the compliance baseline. Each signup creates a new organisation.

**Workspace** -- an isolated environment for one team. Contains connections, knowledge, guardrails, and consumers. Each workspace's tools, data, and audit trail are fully separated from every other workspace.

**Connection** -- a data source the AI can call. [MCP servers](https://modelcontextprotocol.io/introduction) are the primary type: they advertise tools automatically. REST APIs, databases, and webhooks are also supported.

**Consumer** -- an entry point where users interact with the AI. A Slack channel, an API key, or a WhatsApp number. A channel can only belong to one workspace -- no cross-workspace data pollution.

**Knowledge source** -- documents, pages, or text the AI can search for context. Wiki pages, files, URLs, inline text. Indexed and scoped per workspace.

**Compliance rule** -- a platform-enforced guardrail. PII filtering, write confirmation, cost caps, rate limits. Set at the organisation level, inherited by all workspaces.

## How the agent works

Under the hood, SupaProxy runs a tool-use loop:

1. Connect to the workspace's data sources and discover available tools
2. Send the user's query and the available tools to the language model
3. The model decides which tools to call and returns structured requests
4. SupaProxy executes each tool call against the correct connection and feeds results back
5. Repeat until the model returns a final answer

Every query is logged with full telemetry: who asked, what tools were called, what connections were hit, token usage, cost, and duration.
