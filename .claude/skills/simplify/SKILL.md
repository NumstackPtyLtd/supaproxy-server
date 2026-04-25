---
name: simplify
description: >
  Review recently changed code for reuse, quality, and safety.
  Catches XSS, memory leaks, duplicate types, dead code, magic numbers,
  missing error handling, and accessibility gaps. Run after writing code.
---

# Simplify

Review the current diff or specified files. Find and fix everything below.

## Step 1: Identify Changes

```bash
git diff --name-only
git diff --cached --name-only
```

If no changes, ask the user which files to review.

## Step 2: Security — XSS & Sanitization

For each changed `.tsx` file:
- Check for `dangerouslySetInnerHTML` — must use DOMPurify
- Check for user-controlled content rendered as HTML
- Check for `marked.parse()` or markdown rendering — output must be sanitized

## Step 3: Memory Safety

For each changed file:
- Every `setInterval` must use `usePolling` hook or have `clearInterval` cleanup
- Every `setTimeout` must be cleared on unmount
- Every `fetch` in `useEffect` must have `AbortController` + abort on cleanup
- Every `addEventListener` must have matching `removeEventListener`

## Step 4: Error Handling

- Every `.catch()` must log the actual error object, not a generic string
- Every `fetch().then(r => r.json())` must check `res.ok` first, or use `fetchJSON()`
- No empty catch blocks
- Components with `dangerouslySetInnerHTML` or complex rendering should be inside `<ErrorBoundary>`

## Step 5: Type Safety

- No `any` types — create interfaces for every data shape
- No `as any` casts — use proper type assertions or declare `App.Locals` in `env.d.ts`
- No duplicate type definitions — check if the type already exists in `apps/web/src/types/`
- No inline type definitions that should be shared — if 2+ files use the same shape, move to `types/`

## Step 6: Dead Code

- Check for deprecated functions still being called (`@deprecated`)
- Check for backward-compat re-exports that are no longer imported
- Check for SDK client (`api` from `lib/config`) — if unused, note it for migration
- Remove commented-out code

## Step 7: Magic Numbers

- Every timeout, interval, delay must be a named constant
- Every array slice limit must be a named constant
- Every pagination limit must be a named constant
- Pattern: `const POLL_INTERVAL_MS = 3000;` at module scope

## Step 8: Component Patterns

- Components over 200 lines → split (run `/split-components`)
- Modals must use shared `<Modal>` component, not reimplemented overlays
- Modals must have `role="dialog"`, `aria-modal="true"`, escape key handler
- Icon-only buttons must have `aria-label`
- Forms must have labeled inputs

## Step 9: Theme Consistency

- No hardcoded hex (`text-[#666]`, `bg-[#111]`, `border-[#222]`)
- Use CSS variables: `var(--text-muted)`, `var(--bg-surface)`, `var(--border-color)`
- No duplicate theme values — `lib/utils.ts` `theme` object should not duplicate CSS vars from `global.css`

## Step 10: Provider Agnosticism

- No provider names in UI strings (Claude, Anthropic, OpenAI)
- No provider-specific token formats as placeholders (`xoxb-`, `xapp-`, `sk-ant-`)
- Model IDs from API/config, never hardcoded

## Step 11: Data Layer Consistency

- `credentials: 'include'` on every API call
- Use the SDK client from `lib/config` when available (replaces deprecated `fetchJSON`)
- POST/PUT/DELETE use raw `fetch` with manual `res.ok` check
- No raw `fetch` in components — all fetch logic lives in hooks
- `fetchJSON` is deprecated — flag any remaining usage for migration

## Step 12: Consumer Hardcoding

- No consumer type literals (`'slack'`, `'whatsapp'`) outside of registries
- No consumer-specific copy in components ("Bind a Slack channel...")
- No inline SVG icons for consumers — use registry
- Consumer form fields come from registry, not inline conditional blocks
- Adding a new consumer must be a ONE-file change

## Step 13: Duplicated UI Blocks

- Check if the same table/list/card markup exists in 2+ components
- If yes, extract to a shared component in `shared/`
- Common offender: conversation tables, status pill rendering, metric cards

## Step 14: Silent Catch Blocks

- Every `catch` block must log the error OR set error state with the actual error message
- Generic strings like `"Failed"` without the original error are insufficient
- `catch { /* comment */ }` with no action is a violation

## Step 15: Apply Fixes

Fix all issues found. Then verify:
```bash
# Zero any types
grep -rn ": any\|as any\|<any>" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts" | wc -l

# Zero hardcoded hex
grep -rn 'text-\[#\|bg-\[#\|border-\[#' apps/web/src/components/ --include="*.tsx" | grep -v node_modules | wc -l

# Zero empty catches
grep -rn "catch {}\|\.catch(() => {})" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
```

Present the diff summary and ask the user to review.
