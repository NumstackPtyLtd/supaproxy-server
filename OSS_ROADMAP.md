# OSS Readiness Roadmap

Tracked issues for making SupaProxy ready for public open source release. Work through these in priority order — each ticket is self-contained.

---

## Phase 1: Blockers (must fix before anyone sees the repo)

### OSS-001: Add test infrastructure and core test coverage
**Priority:** P0
**Effort:** 2-3 days
**Labels:** testing, critical

No test files exist anywhere. Vitest is installed but unused.

**Acceptance criteria:**
- [ ] Vitest configured with coverage reporting in `apps/server`
- [ ] Unit tests for `core/agent.ts` — mock AI provider, verify tool dispatch loop, error handling
- [ ] Unit tests for `auth/manager.ts` — JWT creation, verification, expiry, invalid tokens
- [ ] Unit tests for `core/conversation.ts` — findOrCreate, history retrieval, close flow
- [ ] Unit tests for `core/lifecycle.ts` — cold detection, close scheduling, stats generation
- [ ] Integration tests for API routes: `POST /api/auth/login`, `GET /api/workspaces`, `POST /api/workspaces/:id/query`, `GET /api/workspaces/:id/conversations`
- [ ] Integration tests for MCP connector: test, save, tool discovery
- [ ] `pnpm test` runs all tests and exits non-zero on failure
- [ ] Coverage threshold set (aim for 60% on server, enforce in CI)

**Notes:** Don't test the frontend yet — server is the critical path. Use `vitest` with `@hono/node-server` for integration tests.

---

### OSS-002: Replace all `as any` with typed database interfaces
**Priority:** P0
**Effort:** 1-2 days
**Labels:** type-safety, critical

79 instances of `as any` on mysql2 query results across 13 backend files. Contributors get zero IDE support.

**Acceptance criteria:**
- [ ] Create `apps/server/src/db/types.ts` with interfaces for every table: `Workspace`, `Connection`, `ConnectionTool`, `Consumer`, `Conversation`, `ConversationMessage`, `ConversationStats`, `OrgSettings`, `User`, `Organisation`, `AuditLog`
- [ ] Create a typed query helper: `async function query<T>(sql: string, params?: unknown[]): Promise<T[]>` that wraps `pool.execute` and returns typed rows
- [ ] Replace every `as any` in `routes/*.ts`, `core/*.ts`, `index.ts`, `consumers/*.ts`
- [ ] `grep -rn "as any" apps/server/src/ | wc -l` returns 0 (excluding `.d.ts` files)
- [ ] TypeScript compiles cleanly with no new `any` types

**Notes:** The `@supaproxy/shared` package already has entity types — reuse where possible but the DB row shapes may differ (snake_case, nullable fields from LEFT JOIN, etc.).

---

### OSS-003: Add input validation to all API routes
**Priority:** P0
**Effort:** 1 day
**Labels:** security, critical

Every route destructures `await c.req.json()` with zero validation. No length checks, type checks, or required field enforcement.

**Acceptance criteria:**
- [ ] Create validation schemas for every POST/PUT route body (Zod is already installed)
- [ ] Create a `validate<T>(schema: ZodSchema<T>, body: unknown): T` helper that returns 400 with field-level errors on failure
- [ ] Routes that take URL params (`:id`, `:key`) validate them as non-empty strings
- [ ] Workspace name: 1-255 chars, alphanumeric + spaces + hyphens
- [ ] Channel ID: non-empty string, max 100 chars
- [ ] API key fields: non-empty string, max 500 chars
- [ ] Query body: `query` required string 1-10000 chars, `history` optional array
- [ ] All validation errors return `{ error: string, fields?: Record<string, string> }` with 400 status

---

### OSS-004: Remove hardcoded secrets from .env.example
**Priority:** P0
**Effort:** 30 min
**Labels:** security, critical

`.env.example` contains functional defaults: `JWT_SECRET=supaproxy-dev-secret-change-in-production`, `DB_PASSWORD=supaproxy2026`. Someone will run these in production.

**Acceptance criteria:**
- [ ] `JWT_SECRET=` (empty, with comment: "Generate with `openssl rand -hex 32`")
- [ ] `DB_PASSWORD=` (empty, with comment: "Set a strong password, match docker-compose.yml")
- [ ] `docker-compose.yml` uses `${DB_PASSWORD}` env var instead of hardcoded password
- [ ] Server refuses to start if `JWT_SECRET` is the example value or shorter than 32 chars
- [ ] README quick start instructions include generating a real secret

---

### OSS-005: Add GitHub Actions CI pipeline
**Priority:** P0
**Effort:** 2 hours
**Labels:** ci-cd, critical

No automated checks exist. Contributors can't know if their PR breaks anything.

**Acceptance criteria:**
- [ ] `.github/workflows/ci.yml` with jobs for:
  - TypeScript compilation (`npx tsc --noEmit` for both apps)
  - Lint check (if ESLint configured)
  - Unit tests (`pnpm test`)
  - Build check (`pnpm build`)
- [ ] Runs on push to `main` and on all PRs
- [ ] Badge in README showing CI status
- [ ] Branch protection rule: CI must pass before merge (document in CONTRIBUTING.md)

---

## Phase 2: Credibility (looks professional)

### OSS-006: Fix XSS fallback in Markdown renderer
**Priority:** P1
**Effort:** 10 min
**Labels:** security

`conversation/TimelineEvents.tsx` Markdown component catches `marked.parse()` errors and falls back to **raw unsanitized content** (line 30: `html = content`). One malformed message = XSS.

**Acceptance criteria:**
- [ ] Catch block uses `DOMPurify.sanitize(content)` instead of raw `content`
- [ ] Add a test case: malformed markdown with `<script>` tag renders safely

---

### OSS-007: Add community files
**Priority:** P1
**Effort:** 2 hours
**Labels:** docs

Missing: `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, issue templates.

**Acceptance criteria:**
- [ ] `CONTRIBUTING.md` — dev setup (beyond docker-compose), PR process, code style (reference CLAUDE.md rules), where to ask questions
- [ ] `SECURITY.md` — how to report vulnerabilities (email, not public issue)
- [ ] `CODE_OF_CONDUCT.md` — Contributor Covenant or similar
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md` — steps to reproduce, expected vs actual, env info
- [ ] `.github/ISSUE_TEMPLATE/feature_request.md` — use case, proposed solution
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` — checklist (tests, types, no `any`, ran `/audit-code`)
- [ ] Fix README clone URL: replace `your-username` with actual GitHub org

---

### OSS-008: Move docs to markdown or add OpenAPI spec
**Priority:** P1
**Effort:** 1 day
**Labels:** docs

Docs are Astro components with hardcoded HTML. Every API change requires editing `.astro` files with raw `<table>` tags. They will drift within weeks.

**Acceptance criteria:** Pick ONE:

**Option A — Markdown docs:**
- [ ] Convert all `/pages/docs/**/*.astro` content to `.md` files in a `/docs` directory
- [ ] Astro renders them via content collections
- [ ] Contributors edit markdown, not HTML

**Option B — OpenAPI spec:**
- [ ] Generate `openapi.yaml` from route definitions (or write manually)
- [ ] Serve Swagger UI at `/docs/api`
- [ ] Remove the hand-written API reference page
- [ ] Validate spec in CI

---

### OSS-009: Add migration versioning
**Priority:** P1
**Effort:** 1 day
**Labels:** database

`migrations.ts` runs raw SQL on startup with `IF NOT EXISTS`. No versioning, no rollback, no tracking. Four `catch {}` blocks silently swallow ALTER TABLE errors (lines 261, 292, 302, 310) and use `as any` on query results.

**Acceptance criteria:**
- [ ] Create `schema_migrations` table: `(version INT, name VARCHAR, applied_at TIMESTAMP)`
- [ ] Each migration gets a version number and runs only once
- [ ] Failed migrations log the error and abort startup (not silent `catch {}`)
- [ ] `bin/migrate` CLI command to run migrations independently of server startup
- [ ] `bin/migrate:status` to show which migrations have been applied
- [ ] Rollback is optional but each migration should document what to undo

---

### OSS-010: Remove hardcoded pricing and make model-configurable
**Priority:** P1
**Effort:** 2 hours
**Labels:** agnosticism

`observability/audit.ts` hardcodes `$3/M input, $15/M output` (Sonnet pricing). Wrong for every other model.

**Acceptance criteria:**
- [ ] Create a `model_pricing` config (DB table or config file) mapping model ID → input/output cost per million tokens
- [ ] `estimateCost()` takes the model ID and looks up pricing
- [ ] Default pricing is configurable, not hardcoded
- [ ] If model pricing is unknown, display "N/A" instead of wrong numbers
- [ ] Remove hardcoded `claude-sonnet-4-20250514` from source code: `workspaces.ts:78` (INSERT default), `migrations.ts:88` (column default), `conversation.ts:233` (fallback), `demo.yaml:54`
- [ ] Replace `DEFAULT_MODEL=claude-sonnet-4-20250514` in `.env.example` with a generic placeholder

---

## Phase 3: Polish (good first impressions)

### OSS-011: Clean up `.claude/` directory for OSS consumers
**Priority:** P2
**Effort:** 1 hour
**Labels:** housekeeping

20+ skill files and internal dev tooling committed. Confusing for external contributors.

**Acceptance criteria:**
- [ ] Add a `README.md` inside `.claude/` explaining what it is and that it's optional
- [ ] Add `.claude/` section to `CONTRIBUTING.md` explaining skills are dev automation, not required
- [ ] Move `pre-commit.sh` hook to `.claude/hooks/` (already there) and document it
- [ ] Consider: should `.claude/settings.json` and `.claude/settings.local.json` be in `.gitignore`?

---

### OSS-012: Remove vapor features from UI
**Priority:** P2
**Effort:** 30 min
**Labels:** ui, honesty

"GraphQL" and "Database" shown in Add Connection modal with `enabled: false` in `lib/registries/connections.ts`. No code exists for either. Advertising features that don't exist erodes trust in OSS.

**Acceptance criteria:**
- [ ] Remove "GraphQL" and "Database" options from the connection type selector
- [ ] Remove `enabled: false` entries from `lib/registries/connections.ts`
- [ ] Or: hide them entirely until code exists (don't show "soon" labels)

---

### OSS-013: Fix console pollution
**Priority:** P2
**Effort:** 1 hour
**Labels:** logging

29 `console.*` calls across 14 frontend files (mix of `console.error`, `console.log`, `console.warn`). Backend is mostly clean — only 1 stray `console.warn` in `index.ts:55`.

**Acceptance criteria:**
- [ ] Backend: replace the one `console.warn` in `index.ts:55` with Pino
- [ ] Backend: add `LOG_LEVEL` env var (default: `info` in prod, `debug` in dev)
- [ ] Frontend: replace `console.error`/`console.warn` in hooks with a `logError()` wrapper that can be silenced in production
- [ ] Frontend: zero `console.log` in committed code (only `console.error` through the wrapper)

---

### OSS-014: Make SDK production-ready or mark as alpha
**Priority:** P2
**Effort:** 1-2 days
**Labels:** sdk

`packages/sdk` is a thin fetch wrapper with no retry, rate limiting, or error recovery.

**Acceptance criteria:** Pick ONE:

**Option A — Production-ready:**
- [ ] Add configurable retry with exponential backoff (3 retries default)
- [ ] Add request timeout configuration
- [ ] Add rate limit handling (429 → automatic retry after `Retry-After`)
- [ ] Add response caching for GET requests (optional, configurable)
- [ ] Add proper JSDoc on all public methods
- [ ] Publish to npm as `@supaproxy/sdk`

**Option B — Mark as alpha:**
- [ ] Add `⚠️ Alpha` badge to SDK README
- [ ] Document limitations: no retry, no rate limiting
- [ ] Add `@alpha` JSDoc tag on the class
- [ ] Don't publish to npm yet

---

### OSS-015: Slack consumer architecture — multi-tenant support
**Priority:** P2
**Effort:** 2-3 days
**Labels:** architecture

Slack consumer is a singleton started at boot. Can't run multiple bots, can't disconnect without restarting the server, token changes require full restart.

**Acceptance criteria:**
- [ ] Consumer manager pattern: `ConsumerManager.start(type, config)`, `.stop(type)`, `.restart(type)`
- [ ] Saving new tokens via Settings UI triggers consumer restart (no full server restart)
- [ ] Multiple consumers of the same type can run simultaneously (different workspaces, different bots)
- [ ] Consumer health endpoint: `GET /api/consumers/status` → `{ slack: "connected", api: "ready" }`
- [ ] Apply same pattern for future consumers (WhatsApp, Teams, etc.)

---

### OSS-016: Update brand section in CLAUDE.md
**Priority:** P3
**Effort:** 15 min
**Labels:** docs

CLAUDE.md brand section says primary color is `#F43F5E` (coral) but the actual CSS uses a completely different palette. The brand guidelines are stale.

**Acceptance criteria:**
- [ ] Update CLAUDE.md brand colors to match `global.css` CSS variables
- [ ] Or remove the brand section entirely and reference `global.css` as source of truth

---

### OSS-017: Add CHANGELOG.md and release tagging
**Priority:** P3
**Effort:** 30 min
**Labels:** docs, releases

No way to track what changed between versions.

**Acceptance criteria:**
- [ ] `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format
- [ ] Initial entry for v0.1.0 summarizing current state
- [ ] Git tag `v0.1.0` on the first public commit
- [ ] Document release process in CONTRIBUTING.md

---

## Summary

| Phase | Tickets | Effort | Goal |
|-------|---------|--------|------|
| 1: Blockers | OSS-001 to OSS-005 | ~5 days | Won't embarrass us |
| 2: Credibility | OSS-006 to OSS-010 | ~3 days | Looks professional |
| 3: Polish | OSS-011 to OSS-017 | ~4 days | Good first impressions |
| **Total** | **17 tickets** | **~12 days** | **Ready for public launch** |
