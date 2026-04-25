# SupaProxy

**One proxy for all your AI.** Route any LLM to any team through one governed layer. Guardrails, cost tracking, fraud detection, conversation analytics — without building bot infrastructure.

## What it does

SupaProxy sits between your teams and your AI models. You bring the LLM (Anthropic, OpenAI, etc.) and the data sources (via MCP). SupaProxy handles everything in between.

- **Workspaces** — each team gets an isolated AI proxy with its own model, prompt, knowledge, and guardrails
- **MCP connections** — plug in any MCP server (stdio or HTTP) and tools are discovered automatically
- **Multi-consumer** — Slack, WhatsApp, API, or any channel. One workspace, many entry points
- **Guardrails** — PII filtering, compliance rules, cost caps. Set at the org level, enforce per-workspace
- **Conversation lifecycle** — open → cold → closed with configurable timeouts and AI-generated follow-ups
- **Post-conversation analysis** — sentiment, resolution status, knowledge gaps, compliance violations, fraud indicators
- **Cost tracking** — per-query token counts, cost per conversation, monthly spend per workspace
- **Dashboard** — real-time overview of everything flowing through the proxy

## Quick start

Requires Docker.

```bash
git clone https://github.com/NumstackPtyLtd/supaproxy.git
cd supaproxy
./init.sh
```

This generates secrets, builds containers, and starts everything. Once running:

- **Dashboard**: http://localhost:4322
- **API**: http://localhost:3001

Visit http://localhost:4322/signup to create your organisation and first workspace.

### Manual setup (without Docker)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full dev setup with Node.js and pnpm.

## Connect your MCP server

In the dashboard, go to your workspace → **Connections** → **Add MCP Server**.

**STDIO** (local):
```
Command: php
Args: bin/console mcp:serve
```

**HTTP** (remote/production):
```
URL: https://your-service.example.com/mcp
```

The assistant discovers tools automatically and makes them available to users.

## Add Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Socket Mode**, add `connections:write` scope to the App-Level Token
3. Add Bot Token Scopes: `app_mentions:read`, `chat:write`, `reactions:write`, `groups:read`, `groups:history`, `im:history`, `im:read`
4. Subscribe to bot events: `app_mention`, `message.groups`, `message.im`
5. Install the app to your workspace
6. In Supaproxy dashboard → **Settings** → paste the Bot Token and App Token
7. Bind a channel to your workspace

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Slack /    │────▶│   Supaproxy    │────▶│   MCP Server    │
│   WhatsApp   │     │   Server     │     │   (your tools)  │
│   API        │◀────│              │◀────│                 │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────▼───────┐
                    │  Dashboard   │
                    │  (Astro)     │
                    └──────────────┘
```

- **Server** — Node.js (Hono + BullMQ). Agent loop, MCP client, Slack consumer, lifecycle manager, conversation analysis
- **Dashboard** — Astro + React + Tailwind. Workspace management, conversation viewer, analytics, settings
- **Database** — MySQL 8. Conversations, messages, audit logs, stats, knowledge sources, guardrails
- **Queue** — Redis + BullMQ. Cold messages, conversation stats generation

## Configuration

See:
- `apps/server/.env.example` — backend config
- `apps/web/.env.example` — dashboard config

## Tech stack

| Component | Stack |
|-----------|-------|
| Server | Node.js, TypeScript, Hono, BullMQ |
| Dashboard | Astro, React, Tailwind CSS |
| Database | MySQL 8 |
| Queue | Redis 7 |
| AI | Any LLM (Anthropic, OpenAI, etc.) |
| MCP | Model Context Protocol SDK |
| Slack | Slack Bolt (Socket Mode) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code style, and PR process.

## License

MIT — see [LICENSE](LICENSE). Managed by Numstack Pty Ltd.
