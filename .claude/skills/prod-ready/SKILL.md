---
name: prod-ready
description: >
  Checks code for patterns that break in production. Catches XSS vulnerabilities,
  memory leaks, missing error boundaries, insecure cookies, missing res.ok checks,
  hardcoded localhost, and debug leftovers. Run before deploying or merging to main.
---

# Prod Ready

Scan for code that works in dev but breaks, leaks, or is exploitable in production.

## Step 1: XSS — dangerouslySetInnerHTML

```bash
grep -rn "dangerouslySetInnerHTML" apps/web/src/ --include="*.tsx" | grep -v node_modules
```

Every `dangerouslySetInnerHTML` MUST be sanitized with DOMPurify:
```tsx
import DOMPurify from 'dompurify';
const clean = DOMPurify.sanitize(marked.parse(content));
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

If DOMPurify is not installed, install it:
```bash
pnpm add dompurify && pnpm add -D @types/dompurify
```

**Never** render user-controlled content as raw HTML without sanitization.

## Step 2: Memory Leaks — setInterval, setTimeout, fetch without cleanup

```bash
# setInterval without cleanup (must be in useEffect with clearInterval, or usePolling hook)
grep -rn "setInterval" apps/web/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "usePolling\|clearInterval"

# setTimeout without cleanup
grep -rn "setTimeout" apps/web/src/ --include="*.tsx" | grep -v node_modules

# addEventListener without removeEventListener
grep -rn "addEventListener" apps/web/src/ --include="*.tsx" | grep -v node_modules

# fetch in useEffect without AbortController
grep -rn "useEffect" apps/web/src/ --include="*.tsx" -A 5 | grep "fetch\|fetchJSON" | grep -v "abort\|AbortController\|signal"
```

Rules:
- Every `setInterval` must use `usePolling` hook or be inside `useEffect` with `clearInterval` in cleanup
- Every `setTimeout` in a component must be cleared on unmount
- Every `addEventListener` must have a matching `removeEventListener` in cleanup
- Every `fetch` in `useEffect` must use `AbortController` that aborts on cleanup

## Step 3: Missing res.ok Checks

```bash
# Find .json() calls that might not check res.ok first
grep -rn "\.json()" apps/web/src/ --include="*.tsx" --include="*.ts" --include="*.astro" | grep -v node_modules | grep -v "fetchJSON\|res\.ok\|!res"
```

Every `fetch().then(r => r.json())` MUST check `res.ok` before parsing:
```tsx
const res = await fetch(url);
if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
const data = await res.json();
```

Or use `fetchJSON()` which handles this automatically.

## Step 4: React Error Boundaries

```bash
# Check if any error boundary exists
grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError" apps/web/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```

Every React island (`client:load`, `client:idle`) in an Astro page MUST be wrapped in an error boundary. If no error boundary exists, create `apps/web/src/components/shared/ErrorBoundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error('React error boundary caught:', error); }
  render() {
    if (this.state.hasError) return this.props.fallback ?? <div>Something went wrong.</div>;
    return this.props.children;
  }
}
```

## Step 5: Cookie Security

```bash
grep -rn "secure:" apps/server/src/ --include="*.ts" | grep -v node_modules
```

Every cookie must use `secure: IS_PRODUCTION` (imported from config), never `secure: false`.

## Step 6: No Hardcoded Localhost in Runtime Output

```bash
grep -rn "localhost" apps/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules | grep -v SKILL.md | grep -v ".env" | grep -v "\.example" | grep -v "// " | grep -v CLAUDE.md
```

Logs, error messages, and responses must not contain hardcoded localhost URLs. Use env-derived values.

## Step 7: Debug Leftovers

```bash
# console.log (should be console.warn/error or removed)
grep -rn "console\.log" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SKILL.md

# TODO/FIXME/HACK
grep -rn "TODO\|FIXME\|HACK\|XXX" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v SKILL.md
```

## Step 8: Error Messages That Leak Internals

```bash
grep -rn "stack\|__dirname\|process\.cwd" apps/server/src/routes/ --include="*.ts" | grep -v node_modules
```

Error responses to clients should be generic. Log full errors server-side.

## Step 9: Missing CORS/Auth for Endpoints

```bash
grep -rn "app\.\(get\|post\|put\|delete\)(" apps/server/src/routes/ --include="*.ts" | grep -v "requireAuth\|optionalAuth\|/health\|/api/auth\|/api/models"
```

## Step 10: Accessibility — Modals

```bash
# Modals missing role="dialog"
grep -rn "fixed inset-0\|fixed.*z-50" apps/web/src/ --include="*.tsx" | grep -v node_modules
```

Every modal overlay MUST have:
- `role="dialog"` and `aria-modal="true"` on the dialog container
- `aria-labelledby` pointing to the title
- Escape key handler to close
- Focus trap (tab key stays within modal)

Check each result to verify these attributes exist.

## Step 11: Accessibility — Tabs & Navigation ARIA

```bash
# Tab UIs without proper ARIA roles
grep -rn "activeTab\|currentTab\|selectedTab\|tab ===\|tab ==" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort -u

# Check if those files have proper ARIA
grep -rn "role=\"tablist\"\|role=\"tab\"\|aria-selected" apps/web/src/components/ --include="*.tsx" | grep -v node_modules

# Navigation without aria-current
grep -rn "pathname.*===\|isActive\|active.*class" apps/web/src/ --include="*.tsx" --include="*.astro" | grep -v node_modules | grep -v "aria-current"
```

Rules:
- Every tab-like UI: `role="tablist"` on container, `role="tab"` + `aria-selected="true|false"` on each button
- Every nav with visual active state: `aria-current="page"` on the active link

## Step 12: ErrorBoundary Actually Wrapping Components

```bash
# Find React islands in Astro pages
grep -rn "client:load\|client:idle" apps/web/src/pages/ --include="*.astro" | grep -v node_modules

# Check how many are wrapped in ErrorBoundary
grep -rn "ErrorBoundary" apps/web/src/pages/ --include="*.astro" | grep -v node_modules
```

ErrorBoundary must not just exist — it must **wrap** every React island. A single unhandled error in an unwrapped island crashes the entire component tree.

## Step 13: User-Facing Error States

```bash
# Server-side fetches in Astro frontmatter — check for error UI
grep -rn "await fetch" apps/web/src/pages/ --include="*.astro" -A 5 | grep -v node_modules
```

When a server-side fetch fails, users must see an error message, not an empty page. Check that failed fetches render an error banner or message, not just `console.error`.

## Step 14: CSRF on POST Forms

```bash
grep -rn 'method="POST"\|method="post"' apps/web/src/ --include="*.astro" --include="*.tsx" | grep -v node_modules
```

POST forms must have CSRF protection — either a token or rely on SameSite cookie + CORS origin check.

## Step 15: Silent Catch Blocks

```bash
# Catch blocks with no logging and no error propagation
grep -rn "catch {" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -rn "catch (.*) {" apps/web/src/ --include="*.ts" --include="*.tsx" -A 2 | grep -v "console\.\|throw\|setState\|setError\|set.*Error\|reject"
```

Every catch block must either log the error, propagate it, or set an error state with the actual error message. Generic strings like "Failed" without the error detail are insufficient.

## Report

Group findings:
- **CRITICAL**: XSS, memory leaks, missing error boundaries, insecure cookies
- **HIGH**: Missing res.ok, hardcoded localhost, missing auth
- **MEDIUM**: Debug code, TODOs, console.logs, missing ARIA
- **LOW**: Cosmetic

Fix all CRITICAL and HIGH before merging.
