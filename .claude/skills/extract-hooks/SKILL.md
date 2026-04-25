# Extract Hooks

Refactor React components that contain inline data fetching, polling, or complex state management into custom hooks.

## When to run
- Component has 3+ `useState` calls related to a single data flow (fetch + loading + error)
- Component contains `useEffect` with `fetch()` calls
- Component has polling logic (`setInterval` inside event handlers or effects)
- Component mixes data fetching with presentation
- After creating a new page or feature component

## Step 1: Identify extraction targets

```bash
# Components with heavy state (5+ useState = flag)
grep -rn "useState" apps/web/src/components/ --include="*.tsx" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10

# Components with inline fetch calls (should be in hooks)
grep -rn "fetch(" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "fetchJSON"

# setInterval in components (should use usePolling)
grep -rn "setInterval" apps/web/src/components/ --include="*.tsx" | grep -v node_modules
```

## Step 2: Group related state into hooks

For each flagged component:

1. **Identify data flows** — group `useState` calls by what they serve:
   - Fetch flow: `data` + `loading` + `error` → `useXxxQuery()`
   - Mutation flow: `saving` + `error` + `success` → `useXxxMutation()`
   - Polling flow: `setInterval` + cleanup → use `usePolling` hook
   - Form state: multiple field states → `useXxxForm()` with single state object

2. **Create hook files** in `apps/web/src/hooks/`:
   - Pattern: `use[Entity][Action].ts`
   - One hook per file
   - Every hook has a typed return interface

3. **Hook return shape** — always return a typed object, never a tuple for 3+ values:
   ```ts
   interface UseConversationResult {
     state: FetchState<ConversationData>;
     reload: () => void;
     close: () => Promise<void>;
   }
   ```

## Step 3: Move logic into hooks

- Move ALL `fetch()` calls out of components into hooks
- Move ALL `useEffect` data-fetching into hooks
- Move ALL polling `setInterval`/`clearInterval` into hooks
- Component should only call hook + render JSX

## Step 4: Mandatory safety patterns

### AbortController on every fetch in useEffect
```ts
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller.signal);
  return () => controller.abort();
}, [deps]);
```

### Polling via usePolling hook (never raw setInterval)
```ts
usePolling(async () => {
  const data = await fetchJSON(url);
  if (data.status === 'complete') return true; // stop
  return false; // continue
}, 3000, enabled);
```

### State machines over boolean sprawl
Use `FetchState<T>` from `types/state.ts` instead of `loading` + `error` + `data` booleans:
```ts
const [state, setState] = useState<FetchState<Data>>({ status: 'idle' });
```

## Step 5: Data layer consistency

Hooks should use the `api` SDK client from `lib/config` when available. If the SDK doesn't cover the endpoint, use raw `fetch` with:
- `credentials: 'include'`
- `res.ok` check before `.json()`
- Typed response parsing

**`fetchJSON` is deprecated.** During extraction, replace `fetchJSON` calls with the SDK client or properly typed raw `fetch`. Do not carry deprecated helpers into new hooks.

## Step 6: Eliminate props drilling

When extracting hooks, check if the parent component passes 5+ data props to children. If so:
- Create a React Context with a provider at the page level
- The hook populates the context; children consume it directly
- This eliminates prop chains like `WorkspaceDetail → WorkspaceOverview → (6 props)`

## Step 7: Verify

- Component file should have ZERO `fetch()` calls
- Component file should have ZERO `useEffect` with data fetching
- Component `useState` count should be 0-3 (UI-only state like tab selection)
- All hooks have proper TypeScript return types (no `any`)
- All hooks clean up on unmount (AbortController, clearInterval)
- No `setInterval` exists outside of `usePolling`
- No `fetchJSON` calls remain (deprecated)
- Props drilling reduced — no component passes 5+ data props

## Known extraction targets

These components have inline fetch and need hooks extracted:

| Component | Hook to create | Fetch calls |
|-----------|---------------|-------------|
| `OrgSettings.tsx` | `useOrgSettings` | 8 fetch calls (save, test, load queues, retry, drain) |
| `WorkspaceDetail.tsx` | `useWorkspaceData` | 4 fetchJSON calls (models, health, summary, sections) |
| `WorkspaceSettings.tsx` | `useWorkspaceSettings` | 1 fetch (save) |
| `ConversationDetail.tsx` | `useConversationDetail` | 3 fetch calls (load, poll, close) |
| `TestPlayground.tsx` | `useTestQuery` | 1 fetch (query) |
| `AddConsumerModal.tsx` | `useAddConsumer` | 2 fetch calls (load settings, save) |
| `WorkspaceConnections.tsx` | `useDeleteConnection` | 1 fetch (delete) |
| `SetupWizard.tsx` | `useSetup` | 1 fetch (signup POST) |

## Rules
- Hooks go in `apps/web/src/hooks/`, one hook per file
- Every hook has a typed return interface
- No `any` types in hooks
- Every `fetch` in a hook gets an `AbortController`
- Every interval uses `usePolling` — never raw `setInterval` in components
- `credentials: 'include'` on every API call
- Check `res.ok` before `.json()` on every non-fetchJSON call
- Replace `fetchJSON` with SDK client during extraction
- Use Context to eliminate props drilling when extracting shared data hooks
