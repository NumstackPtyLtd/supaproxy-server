# SupaProxy Architecture Refactor Plan

## Current State
- 37 API endpoints in a single 1,250-line index.ts
- 23 raw fetch() calls across 8 frontend files
- 178 hardcoded color references
- 0 tests
- No SDK, no type safety on API calls
- Inline components that should be shared

## Phase 1: Foundation (SDK + Types + Constants)
**Goal**: Every API call goes through a typed SDK. Every color through a theme constant.

### 1a. Shared Types (`packages/shared`)
- Create interfaces for ALL API responses and entities
- Conversation, Message, ConversationStats, Connection, Tool, Consumer, etc.
- Zod schemas for runtime validation

### 1b. API SDK (`packages/sdk`)
- Typed client class with methods per endpoint group
- Auth, Workspaces, Connections, Conversations, Org, Queues
- Handles credentials, base URL, error wrapping
- Used by both web frontend and future CLI/integrations

### 1c. Theme Constants (`packages/shared/theme.ts`)
- All colors as semantic tokens (not hex values)
- Export for both CSS-in-JS and Tailwind plugin
- Single source of truth — no more `text-[#a1a1a1]`

## Phase 2: Server Architecture (Router Split + Middleware)
**Goal**: index.ts → modular routers with middleware.

### 2a. Router modules
- `routes/auth.ts` — login, logout, session, signup
- `routes/org.ts` — org settings, users, queues
- `routes/workspaces.ts` — CRUD, dashboard, settings
- `routes/conversations.ts` — list, detail, close, filters
- `routes/connectors.ts` — MCP, Slack, channel binding
- `routes/query.ts` — agent loop

### 2b. Middleware
- `middleware/auth.ts` — JWT extraction, user injection
- `middleware/org.ts` — org resolution from user
- `middleware/validate.ts` — Zod request validation

## Phase 3: Component Library (`packages/ui`)
**Goal**: Reusable, tested, theme-aware components.

### 3a. Extract shared components
- FilterDropdown, StepIndicator, LoadingButton
- Modal, ConfirmDialog, Toast
- DataTable (replaces inline table rendering)
- StatusBadge, CategoryBadge (already started in ConversationUI)
- MetricCard, StatRow
- Timeline, TimelineEvent

### 3b. Storybook or component catalog
- Visual testing for all components
- Theme toggle in catalog

## Phase 4: Testing
**Goal**: Confidence to ship.

### 4a. Server tests (vitest)
- Agent loop unit tests (mock MCP, mock LLM)
- Conversation lifecycle tests
- Stats generation tests
- API endpoint integration tests

### 4b. Frontend tests (vitest + @testing-library/react)
- Component unit tests (FilterDropdown, FormFields, badges)
- SDK integration tests
- Page smoke tests

### 4c. E2E (Playwright, future)
- Signup → create workspace → add connection → query → close → analyse

## Phase 5: Skills & Agents
**Goal**: Claude Code can manage the codebase.

### Skills
- `/add-component` — scaffold a new shared component with test
- `/add-endpoint` — scaffold a new API route with types + SDK method
- `/add-consumer` — scaffold a new consumer type (WhatsApp, etc.)
- `/audit-theme` — check for hardcoded colors
- `/audit-types` — check for `any` usage

## Execution Order
1. Phase 1a (types) — unblocks everything
2. Phase 1b (SDK) — biggest impact, removes all raw fetch
3. Phase 2a (routers) — makes server maintainable
4. Phase 3a (components) — makes frontend maintainable
5. Phase 4a (server tests) — confidence
6. Phase 1c (theme) — visual consistency
7. Phase 4b (frontend tests)
8. Phase 5 (skills)
