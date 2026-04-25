# SupaProxy

[![CI](https://github.com/NumstackPtyLtd/supaproxy/actions/workflows/ci.yml/badge.svg)](https://github.com/NumstackPtyLtd/supaproxy/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

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
- **SDK** — typed TypeScript client for building your own UI or integrations

## Quick start

Requires Docker.

```bash
git clone https://github.com/NumstackPtyLtd/supaproxy.git
cd supaproxy
./init.sh
```

This generates secrets, builds containers, and starts the API server:

- **API**: http://localhost:3001
- **Health check**: http://localhost:3001/health

### Using the SDK

```typescript
import { SupaProxyClient } from '@supaproxy/sdk';

const client = new SupaProxyClient('http://localhost:3001');
const { workspaces } = await client.workspaces.list();
const result = await client.workspaces.query('ws-my-workspace', {
  query: 'What tickets are open?'
});
```

### Manual setup (without Docker)

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full dev setup with Node.js and pnpm.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Slack /    │────▶│   SupaProxy  │────▶│   MCP Server    │
│   WhatsApp   │     │   Server     │     │   (your tools)  │
│   API / SDK  │◀────│              │◀────│                 │
└─────────────┘     └──────────────┘     └─────────────────┘
```

- **Server** — Node.js (Hono + BullMQ). Agent loop, MCP client, consumers, lifecycle manager, conversation analysis
- **Database** — MySQL 8. Conversations, messages, audit logs, stats, knowledge sources, guardrails
- **Queue** — Redis + BullMQ. Cold messages, conversation stats generation
- **SDK** — TypeScript client (`@supaproxy/sdk`) for building frontends and integrations

## Configuration

See `apps/server/.env.example` for all environment variables.

## Tech stack

| Component | Stack |
|-----------|-------|
| Server | Node.js, TypeScript, Hono, BullMQ |
| Database | MySQL 8 |
| Queue | Redis 7 |
| AI | Any LLM (Anthropic, OpenAI, etc.) |
| MCP | Model Context Protocol SDK |
| Consumers | Slack Bolt, API, SDK |

## Packages

| Package | Description |
|---------|-------------|
| `@supaproxy/shared` | Shared types, entities, and API contracts |
| `@supaproxy/sdk` | TypeScript API client (alpha) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code style, and PR process.

## License

MIT — see [LICENSE](LICENSE). Managed by Numstack Pty Ltd.
