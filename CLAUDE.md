# SupaProxy

AI operations platform. Open source, invite-only access.

## Architecture

```
Frontend (Astro, port 4322)        Backend (Hono, port 3001)
├── Rendering only                  ├── config.ts (requireEnv, no fallbacks)
├── Reads supaproxy_session cookie  ├── middleware/auth.ts (requireAuth)
├── Calls backend for data          ├── routes/ (modular routers)
└── No auth logic, no DB            │   ├── auth.ts, org.ts, queues.ts
                                    │   ├── workspaces.ts, conversations.ts
                                    │   ├── connectors.ts, query.ts
                                    ├── Redis (BullMQ queues, port 6380)
                                    └── MySQL (Docker, port 3308)
```

## Start Dev

```bash
docker compose up -d
./apps/server/node_modules/.bin/tsx apps/server/src/index.ts &
cd apps/web && npx astro dev --port 4322 &
```

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Turborepo + pnpm |
| Frontend | Astro 6 + Tailwind + React islands |
| Backend | Hono + TypeScript |
| Auth | JWT cookies via Hono (no auth libraries in frontend) |
| DB | MySQL 8 (Docker, port 3308) |
| Queue | Redis 7 + BullMQ (Docker, port 6380) |

## Code Rules

### Architecture
- **Auth in Hono, rendering in Astro.** No exceptions. No auth libraries in the frontend.
- **Use `requireAuth` middleware** for protected routes. Never manually parse JWT cookies in route handlers.
- **Routes in `apps/server/src/routes/`**, not in index.ts. Each file exports a Hono sub-app.
- **Config in `apps/server/src/config.ts`** via `requireEnv()`. All env vars throw if missing.
- **Business logic in services, not route handlers.** Route handlers validate input, call services, return responses.
- **Shared components in `apps/web/src/components/shared/`.** Field, Input, Textarea, and utility functions must not be duplicated across files.
- **Use `import.meta.dirname`** for config paths, not `process.cwd()`.
- **All visible UI state must be in the URL.** Tabs use `?tab=`, sub-views use `?view=`, filters use `?filter=`. Default values are omitted. Browser back/forward must work. Run `/shareable-urls` to audit.

### No Hardcoded Values
- **No env var fallbacks.** Never `|| 'http://localhost'` or `?? 'default'`. Use `requireEnv()` which throws if missing. Run `/no-defaults` to audit.
- **No hardcoded API URLs.** Use environment config.
- **No hardcoded model IDs in code.** Model options come from the API or config, not inline `<option>` tags.
- **No hardcoded secrets or fallbacks.** JWT secret, DB password, API keys must be required env vars with no default.
- **No hardcoded CORS origins or redirect URLs.** Use `requireEnv('DASHBOARD_URL')`, `requireEnv('CORS_ORIGINS')`.
- **No hardcoded hex colours in components.** Use Tailwind config or CSS variables.
- **No magic numbers.** Timeouts, limits, and thresholds must be named constants or config values.
- **No hardcoded localhost in logs.** Log the port or env-derived URL, not `http://localhost:${port}`.

### Provider Agnosticism
- **No AI provider names in UI or docs.** Say "AI provider", "language model", or "model tier".
- **No provider-specific token formats in UI.** No `sk-ant-`, `xoxb-`, `xapp-` as placeholders.
- **No internal company references.** Supaproxy is product-agnostic. Use generic examples.

### Type Safety
- **No `any` types.** Create interfaces for all DB results, API responses, and component props.
- **No `as any` casts.** If TypeScript cannot infer the type, define an interface.

### Error Handling
- **No empty catch blocks.** Every `.catch()` must log the actual error object, not a generic string.
- **Check `res.ok` before parsing.** Every `fetch().then(r => r.json())` must check the response status first. Or use `fetchJSON()` which handles this.
- **Validate JSON before using.** Wrap `JSON.parse()` in try/catch with fallback.
- **React Error Boundaries.** Every React island must be wrapped in `<ErrorBoundary>`. Component in `shared/ErrorBoundary.tsx`.

### Security
- **Never commit `.env` files.** Only `.env.example` with placeholders.
- **Use bcrypt for password hashing.** SHA256 is not acceptable.
- **JWT secret must be required.** No fallback values.
- **Cookie `secure: true` in production.** Use `IS_PRODUCTION` from config.
- **Sanitize all HTML rendering.** Every `dangerouslySetInnerHTML` must use DOMPurify. No exceptions.

### Memory Safety
- **No raw `setInterval` in components.** Use the `usePolling` hook (`apps/web/src/hooks/usePolling.ts`).
- **AbortController on every fetch in useEffect.** Abort on cleanup to prevent setState on unmounted components.
- **Every `addEventListener` needs `removeEventListener`** in the useEffect cleanup function.
- **No magic number timeouts.** Every `setTimeout`/`setInterval` value must be a named constant.

### Accessibility
- **Every modal uses `<Modal>` from `shared/Modal.tsx`.** No reimplementing overlays. Must have `role="dialog"`, `aria-modal`, escape key, focus trap.
- **Icon-only buttons must have `aria-label`.** No `<button><X /></button>` without a label.
- **Tabs must have `role="tablist"` / `role="tab"` / `aria-selected`.**

### Component Architecture
- **Max 200 lines per component.** Split into sub-components in a directory (`workspace/`, `conversation/`).
- **Data fetching in hooks, not components.** Components call hooks + render JSX. Zero `fetch()` in `.tsx` render files.
- **Types defined once in `apps/web/src/types/`.** No duplicate interface definitions across files.
- **Registries in `apps/web/src/lib/registries/`.** Consumer labels, status badges, category badges — one source of truth.
- **State machines over boolean sprawl.** Use `FetchState<T>` from `types/state.ts`, not `loading` + `error` + `data` booleans.

### Testing
- **New features need tests.** At minimum: unit tests for services, integration tests for API endpoints.
- **Run `/audit-code` before PRs.** Full codebase scan including security, types, dead code.
- **Run `/simplify` after writing code.** Catches XSS, memory leaks, magic numbers, duplicates.
- **Run `/prod-ready` before deploying.** XSS, memory leaks, error boundaries, cookies.

## Skills

| Skill | Purpose |
|---|---|
| `/audit-code` | Full codebase scan: security, types, dead code, duplicates, architecture |
| `/simplify` | Post-code review: XSS, memory leaks, magic numbers, error handling, a11y |
| `/prod-ready` | Pre-deploy: XSS, memory leaks, error boundaries, cookies, res.ok, ARIA |
| `/no-defaults` | Env var enforcement: no `\|\| 'fallback'` patterns |
| `/rebrand` | Legacy naming cleanup |
| `/extract-hooks` | Move fetch/polling/state from components into typed hooks |
| `/state-machine` | Replace boolean sprawl with discriminated unions |
| `/split-components` | Break large components, ensure Modal/ErrorBoundary/TabBar exist |
| `/unify-theme` | Kill hardcoded hex, enforce CSS variables, fix Astro styles |
| `/type-registry` | Single source of truth for consumer/status/category maps |
| `/shareable-urls` | Audit that all UI state is URL-backed |
| `/add-api-route` | Scaffold a new route with auth middleware |
| `/add-page` | Scaffold an Astro page with env-driven API fetch |
| `/debug-mcp` | Diagnose MCP connection failures: ports, headers, tools, agent runtime |
| `/debug-clients` | Diagnose consumer issues: any type (Slack, API, WhatsApp), token checks, bindings, lifecycle |
| `/agnosticism` | Enforce provider/client agnosticism: no hardcoded providers, generic naming, pluggable architecture |

## Hooks

- **Pre-commit**: blocks commits with hardcoded URLs, provider leaks, or committed secrets. Warns on `any` types and empty catch blocks.

## Brand

Source of truth: `apps/web/src/styles/global.css` CSS variables. Dark theme is default.
Dark: `#000` bg, `#0a0a0a` card, `#111` surface, `#fff` heading, `#a1a1a1` body, `#666` muted, `#222` borders, `#fff` primary btn.
Light: `#f8fafc` bg, `#fff` card, `#f1f5f9` surface, `#0f172a` heading, `#334155` body, `#94a3b8` muted, `#e2e8f0` borders, `#0f172a` primary btn.
Status: `#10B981` success, `#EF4444` error, `#F59E0B` warning, `#3B82F6` info.
Fonts: Inter + JetBrains Mono.
Radius: `rounded-sm` buttons/inputs, `rounded` modals/cards.
