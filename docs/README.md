# SupaProxy Documentation

## Getting Started

- [Overview](overview.md) -- What SupaProxy is and the problems it solves
- [Quick Start](quick-start.md) -- Get up and running in under 5 minutes

## Core Concepts

- [Workspaces](workspaces.md) -- Isolation, lifecycle, and what a workspace contains
- [Connections](connections.md) -- Data sources, MCP servers, tool discovery, and the agent loop
- [Knowledge](knowledge.md) -- Indexed documents, source types, and per-workspace isolation
- [Compliance](compliance.md) -- Guardrails: PII filtering, cost caps, rate limits, enforcement order
- [Observability](observability.md) -- Audit logs, dashboard metrics, and what gets logged

## Guides

- [Add a Connection](guides/add-connection.md) -- Connect an MCP server, REST API, or database
- [Add Knowledge Sources](guides/add-knowledge.md) -- Wiki pages, files, inline text
- [Configure Guardrails](guides/configure-guardrails.md) -- PII filter, write confirmation, cost caps, rate limits
- [Deploy to Production](guides/deploy.md) -- Containers, env vars, security checklist, scaling

## Reference

- [API Endpoints](reference/api.md) -- Full API reference: auth, workspaces, connectors, query
- [Environment Variables](reference/env.md) -- Backend and frontend configuration
- [Workspace Schema](reference/workspace-config.md) -- Database schema for workspaces, connections, tools, consumers, guardrails
