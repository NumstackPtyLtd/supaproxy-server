# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- API key management: `POST/GET/DELETE /api/workspaces/:id/api-keys` routes for creating, listing, and revoking workspace API keys
- `requireApiKey` middleware and `ApiKeyEnv` type — bearer token auth path for the MCP server
- `api_keys` table (migration 6): hashed key storage, display prefix, label, audit timestamps
- OpenAPI documentation for all three API key routes under the new `API Keys` tag

## [0.1.0] - 2026-04-25

### Added
- Workspace management with isolated AI proxies (model, prompt, tools, guardrails per workspace)
- MCP connection support (stdio and HTTP transports) with automatic tool discovery
- Slack consumer with Socket Mode support
- API consumer for programmatic access
- Conversation lifecycle management (open, cold, closed) with configurable timeouts
- AI-powered post-conversation analysis (sentiment, resolution, knowledge gaps, compliance, fraud)
- Cost tracking with per-query token counts and monthly spend
- Real-time dashboard with workspace overview, conversation viewer, and analytics
- Organisation-level settings and compliance rules
- JWT-based authentication
- Zod input validation on all API routes
- Typed database layer with zero `as any` casts
- Migration versioning system with schema tracking
- GitHub Actions CI pipeline (typecheck, test, build)
- Frontend logging wrapper (silenced in production)

### Security
- Required env vars with no fallback defaults — server refuses to start without them
- JWT secret minimum length enforcement (32 chars)
- DOMPurify sanitization on all rendered HTML including error fallbacks
- Hardcoded secrets removed from .env.example and docker-compose
