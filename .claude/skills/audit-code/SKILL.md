---
name: audit-code
description: >
  Comprehensive code quality audit. Finds security issues, memory leaks,
  type safety violations, dead code, duplicated types, missing error handling,
  accessibility gaps, and architecture violations. Run before PRs or periodically.
---

# Code Audit

Run a comprehensive quality scan across the SupaProxy codebase. Report findings grouped by severity.

## Step 1: Sub-Audits

Run these skill audits first — they have their own detailed checks:

- `/no-defaults` — env var fallbacks
- `/prod-ready` — production safety (XSS, cookies, memory leaks, error boundaries, res.ok)
- `/rebrand` — legacy naming

## Step 2: Provider-Specific References

The UI and docs must be provider-agnostic.

```bash
# Provider names in UI code
grep -rn "claude\|anthropic\|sk-ant\|sonnet\|haiku\|opus\|openai\|gpt-" apps/web/src/ --include="*.tsx" --include="*.ts" --include="*.astro" -i | grep -v node_modules | grep -v SKILL.md | grep -v CLAUDE.md

# Provider-specific token format placeholders
grep -rn "xoxb-\|xapp-\|sk-ant-\|sk-proj-" apps/web/src/ --include="*.tsx" | grep -v node_modules
```

Model IDs come from the API, never hardcoded. Token placeholders should be generic (e.g. "paste your token").

## Step 3: Type Safety

```bash
# any types (target: zero)
echo "=== any types ===" && grep -rn ": any\|as any\|<any>\|= any" apps/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules | grep -v ".d.ts" | wc -l

# Worst offenders
grep -rn ": any\|as any\|<any>" apps/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules | grep -v ".d.ts" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10

# Astro.locals as any (should declare App.Locals interface in env.d.ts)
grep -rn "as any" apps/web/src/ --include="*.astro" | grep -v node_modules
```

Target: zero `any` types. Astro locals must be typed via `src/env.d.ts`:
```ts
declare namespace App { interface Locals { user?: { id: string; name: string; email: string; role: string } } }
```

## Step 4: Duplicate Type Definitions

```bash
# Find interfaces/types defined in multiple files
for t in ComplianceViolation KnowledgeGap FraudIndicator Conversation ConversationMessage; do
  echo "=== $t ===" && grep -rn "interface $t\|type $t " apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
done
```

Every type should be defined ONCE in `apps/web/src/types/` and imported. No local duplicate interfaces.

## Step 5: Dead Code & Unused Exports

```bash
# Deprecated functions still in use
grep -rn "@deprecated" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# For each deprecated export, check if anything imports it
# fetchJSON is @deprecated — check if it's still imported
grep -rn "fetchJSON" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "@deprecated" | grep -v "config.ts"

# Backward-compat re-exports (STATUS_BADGE, CATEGORY_BADGE, CONSUMER_LABEL)
for ex in STATUS_BADGE CATEGORY_BADGE CONSUMER_LABEL; do
  echo "=== $ex ===" && grep -rn "$ex" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "// backward"
done

# SDK client usage (should be migrated to, or removed if unused)
grep -rn "import.*api.*from.*config\|api\." apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v fetchJSON
```

Plan: either complete the SDK migration or remove the dead SDK export.

## Step 6: Error Handling

```bash
# Empty catch blocks
grep -rn "catch {}\|catch () {}\|\.catch(() => {})\|catch {\s*}" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules

# Catch blocks that swallow error details (generic message, no logging)
grep -rn "catch.*{.*setError\|catch.*{.*console" apps/web/src/ --include="*.tsx" | grep -v node_modules

# Missing res.ok checks — fetch().then(r => r.json()) without status check
grep -rn "\.json()" apps/web/src/ --include="*.tsx" --include="*.ts" --include="*.astro" | grep -v node_modules | grep -v "res.ok\|res\.ok\|!res"
```

Rules:
- Every `.catch()` must log the actual error, not a generic string
- Every `fetch().then(r => r.json())` must check `res.ok` first
- No empty catch blocks

## Step 7: Magic Numbers

```bash
# Hardcoded timeouts/intervals
grep -rn "setTimeout\|setInterval\|\.timeout\|delay:" apps/web/src/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep "[0-9]\{3,\}"

# Hardcoded limits
grep -rn "slice(0,\|\.slice(-\|limit:" apps/web/src/ --include="*.tsx" | grep -v node_modules | grep "[0-9]"
```

Every timeout, interval, limit, and threshold must be a named constant:
```ts
const POLL_INTERVAL_MS = 3000;
const REDIRECT_DELAY_MS = 1500;
const MAX_VISIBLE_TOOLS = 12;
```

## Step 8: Architecture Violations

```bash
# Auth logic in frontend (should be in Hono only)
grep -rn "jwt\|jsonwebtoken\|bcrypt" apps/web/src/ --include="*.ts" --include="*.tsx" --include="*.astro" | grep -v node_modules

# DB queries in Astro pages (should fetch from API)
grep -rn "getPool\|db\.execute" apps/web/src/ --include="*.astro" --include="*.tsx" | grep -v node_modules

# Raw fetch in components (should use hooks or fetchJSON)
grep -rn "fetch(" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "fetchJSON\|useMcp\|useConversation"
```

## Step 9: Hardcoded Hex Colours

```bash
echo "=== Hardcoded hex in TSX ===" && grep -rn 'text-\[#\|bg-\[#\|border-\[#' apps/web/src/ --include="*.tsx" | grep -v node_modules | wc -l
echo "=== Hardcoded hex in Astro ===" && grep -rn '#[0-9A-Fa-f]\{6\}' apps/web/src/ --include="*.astro" | grep -v node_modules | grep -v "fill=" | wc -l
```

Target: zero in `.tsx`. Astro layouts/docs should also use CSS vars.

## Step 10: Duplicated Components & UI Blocks

```bash
# Duplicated structural components
for comp in "function Field" "function Input" "function Modal" "function TabBar"; do
  echo "=== $comp ===" && grep -rn "$comp" apps/web/src/ --include="*.tsx" | grep -v node_modules
done

# Duplicated UI blocks — find identical table/list renders in multiple files
# Example: ConversationTable markup in both WorkspaceOverview and WorkspaceObservability
grep -rn "<th" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

If the same table/list/card markup appears in 2+ components, extract to a shared component.

## Step 11: Component Size

```bash
wc -l apps/web/src/components/*.tsx apps/web/src/components/**/*.tsx 2>/dev/null | awk '$1 > 200 {print}' | sort -rn
```

Target: no component over 200 lines.

## Step 12: ErrorBoundary Wrapping (Not Just Existence)

```bash
# ErrorBoundary must WRAP every React island, not just exist in shared/
# Check Astro pages for unwrapped client:load components
grep -rn "client:load\|client:idle" apps/web/src/pages/ --include="*.astro" | grep -v "ErrorBoundary"

# Check components that render without ErrorBoundary wrapping
grep -rn "ErrorBoundary" apps/web/src/components/ --include="*.tsx" | grep -v "shared/ErrorBoundary" | grep -v node_modules
```

Every React island in an Astro page must be wrapped. Components with fetch logic or complex rendering should wrap their content internally.

## Step 13: Accessibility — Tabs & Navigation

```bash
# Tabs missing role="tablist" / role="tab" / aria-selected
grep -rn "tab.*active\|activeTab\|currentTab\|selectedTab" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort -u

# For each file above, check for proper ARIA:
grep -rn "role=\"tablist\"\|role=\"tab\"\|aria-selected" apps/web/src/components/ --include="*.tsx" | grep -v node_modules

# Navigation missing aria-current="page"
grep -rn "aria-current" apps/web/src/components/ apps/web/src/layouts/ --include="*.tsx" --include="*.astro" | grep -v node_modules
```

Rules:
- Every tab UI must have `role="tablist"` on container, `role="tab"` + `aria-selected` on each tab
- Every navigation with active state must use `aria-current="page"`

## Step 14: Consumer Types — Registry Completeness

```bash
# Hardcoded consumer type unions in component files (should only be in registry)
grep -rn "'slack' | 'api' | 'whatsapp'\|'slack'\|'whatsapp'" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "import"

# Inline SVG icons for consumers (should be in registry)
grep -rn "svg.*slack\|svg.*whatsapp\|SlackIcon\|WhatsAppIcon" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "import.*registries\|import.*consumers"

# Hardcoded consumer-specific copy (descriptions, placeholders)
grep -rn "Slack channel\|WhatsApp\|Bind a Slack\|bot token" apps/web/src/components/ --include="*.tsx" | grep -v node_modules
```

Consumer types, labels, icons, descriptions, and form fields must ALL come from the registry. Adding a new consumer should be a ONE-file change.

## Step 15: Props Drilling & State Design

```bash
# Components passing 5+ props (potential drilling)
grep -rn "Props {" apps/web/src/components/ --include="*.tsx" -A 10 | grep -v node_modules

# Boolean state sprawl (3+ related booleans that should be a union)
grep -rn "useState<boolean>" apps/web/src/components/ --include="*.tsx" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10
```

If a component passes 5+ props through to children, consider React Context or a shared hook. If 3+ boolean states are mutually exclusive, use a discriminated union.

## Step 16: CSRF & Form Security

```bash
# Forms with POST action but no CSRF token
grep -rn 'method="POST"\|method="post"' apps/web/src/ --include="*.astro" --include="*.tsx" | grep -v node_modules
```

POST forms should include CSRF tokens or use same-origin cookie-based auth with proper CORS.

## Step 17: Hardcoded Brand Text

```bash
# Brand name hardcoded in templates (should be a config constant)
grep -rn "SupaProxy" apps/web/src/ --include="*.astro" --include="*.tsx" | grep -v node_modules | grep -v "supaproxy_session\|@supaproxy\|SKILL\|CLAUDE"
```

Brand name should come from a config constant, not scattered string literals.

## Report Format

Group findings by severity:
- **CRITICAL**: Security (XSS, secrets), memory leaks, missing auth
- **HIGH**: Type safety, dead code, missing error handling, architecture violations
- **MEDIUM**: Magic numbers, duplicated types, component size, provider leaks
- **LOW**: Naming, style, documentation

For each finding: file, line, what's wrong, what it should be.

End with an action plan prioritised by impact.
