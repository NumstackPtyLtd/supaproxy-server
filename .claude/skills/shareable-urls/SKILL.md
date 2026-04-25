---
name: shareable-urls
description: >
  Enforces that all UI state is reflected in the URL so links are always shareable.
  Run when adding new tabs, sections, filters, or any toggleable UI state.
  Also run during code review to catch state that is not URL-backed.
---

# Shareable URLs

Every piece of visible UI state must be in the URL. If someone copies the URL and pastes it, they must see the exact same view.

## Rules

1. **Tabs/sections** use `?tab=` parameter
2. **Sub-views within a tab** use `?view=` parameter
3. **Filters** use `?filter=` or `?status=` parameters
4. **Pagination** uses `?page=` or `?offset=` parameters
5. **Selected items** use `?id=` parameter (for slide-overs, modals showing a specific record)
6. **Default values** are omitted from the URL (clean URLs when on the default view)

## Pattern

Use the `pushUrl` helper in WorkspaceDetail.tsx as the reference pattern:

```typescript
function pushUrl(params: Record<string, string | null>) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === 'default') url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.pushState({}, '', url.toString());
}
```

Every state setter that changes the visible view must call `pushUrl`.

Every component must read initial state from the URL on mount:
```typescript
const [tab, setTabState] = useState(getFromUrl('tab', 'default'));
```

Every component must handle `popstate` (browser back/forward):
```typescript
useEffect(() => {
  const onPop = () => setTabState(getFromUrl('tab', 'default'));
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}, []);
```

## Audit

When auditing, search for state that is NOT URL-backed:

```bash
# Find useState calls that might control visible views
grep -rn "useState.*'default'\|useState.*false\|useState.*null" apps/web/src/components/ --include="*.tsx" | grep -v node_modules

# Check if pushUrl or history.pushState is called
grep -rn "pushUrl\|pushState\|searchParams" apps/web/src/components/ --include="*.tsx" | grep -v node_modules
```

Any `useState` that controls which content is shown (tabs, filters, selected items) must have a corresponding URL parameter.

## Exceptions

These do NOT need URL backing:
- Form input values (text being typed)
- Loading states
- Error messages
- Modal open/close (unless showing a specific record)
- Hover states
- Animation states
