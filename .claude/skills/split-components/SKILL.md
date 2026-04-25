# Split Components

Break large components (200+ lines) into focused, testable atomic components. Ensure shared structural components exist and are reused.

## When to run
- Any `.tsx` file over 200 lines
- Component has multiple `{condition && (<giant JSX block>)}` sections
- Component renders distinct UI regions (header, sidebar, main content, modal states)
- A function inside `.map()` returns 20+ lines of JSX
- A modal pattern is being reimplemented instead of using the shared `Modal` component

## Step 1: Measure

```bash
echo "=== Components over 200 lines ==="
wc -l apps/web/src/components/*.tsx apps/web/src/components/**/*.tsx 2>/dev/null | awk '$1 > 200 {print}' | sort -rn
```

## Step 2: Verify shared structural components exist

These MUST exist in `apps/web/src/components/shared/`. If missing, create them first:

### Modal.tsx (REQUIRED)
```tsx
interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string; // default 'max-w-[520px]'
}
```
Must include:
- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` pointing to the title element
- Escape key handler (`useEffect` with keydown listener + cleanup)
- Backdrop click to close (`onClick` on overlay, `stopPropagation` on dialog)
- Focus trap (first focusable element gets focus on mount)
- `z-50` overlay with backdrop blur/opacity
- Close button with `aria-label="Close"`

### ErrorBoundary.tsx (REQUIRED)
```tsx
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  static getDerivedStateFromError(error: Error) { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('React error boundary:', error); }
  render() { return this.state.hasError ? (this.props.fallback ?? <div>Something went wrong.</div>) : this.props.children; }
}
```

### TabBar.tsx (OPTIONAL)
```tsx
interface Tab { id: string; label: string; disabled?: boolean }
interface TabBarProps { tabs: Tab[]; active: string; onChange: (id: string) => void }
```
Must include `role="tablist"`, `role="tab"`, `aria-selected` on each tab.

## Step 3: Audit modal reimplementations

```bash
# Find all modal-like overlays
grep -rn "fixed inset-0\|fixed.*z-50" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "shared/Modal"
```

Every result should use the shared `<Modal>` component instead of reimplementing:
- Backdrop click handling
- Escape key handling
- Close button
- z-index overlay

## Step 4: Identify split boundaries

For each large component, identify natural boundaries:

### By UI region
- **Page shell** (breadcrumbs, header, layout) → stays in page component
- **Sidebar** → `[Page]Sidebar.tsx`
- **Tab content** → `[Page][Tab]Tab.tsx`
- **Modal content** (form vs success) → separate components inside `<Modal>`

### By repeated pattern
- **List item renderers** inside `.map()` → `[Entity]Row.tsx`
- **Timeline events** → `TimelineNode.tsx` + per-type renderers via `Record<type, Component>`
- **Form sections** → `[Entity]Form.tsx`
- **Duplicated UI blocks** — if the same table/card/list appears in 2+ components, extract to shared (e.g., `ConversationTable` used in both Overview and Observability)

### By responsibility
- **Data display** (read-only) → pure component, receives data as props, zero hooks
- **Data mutation** (forms, actions) → component with hooks
- **Layout/chrome** (modal wrapper, tab bar) → reusable shared component

### Props drilling → Context
If a parent passes 5+ props through to children, introduce a React Context:
- Create `[Feature]Context.tsx` with provider + `use[Feature]` hook
- Parent wraps children in provider
- Children consume context directly instead of receiving drilled props

## Step 5: Wrap React islands in ErrorBoundary

Every React component hydrated in an Astro page (`client:load`, `client:idle`) must be wrapped:

```astro
<ErrorBoundary client:load>
  <WorkspaceDetail client:load workspaceId={wsId} />
</ErrorBoundary>
```

Or wrap inside the component itself at the top level.

## Step 6: Find duplicated UI blocks

```bash
# Tables/lists that appear in multiple components
grep -rn "<th\|<thead" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn

# Same status/category rendering logic in multiple files
grep -rn "getStatus\|getCategory\|getConsumer" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

If the same table/card/list structure appears in 2+ files, extract to `shared/[Name].tsx`.

## Step 7: Verify

```bash
# No component over 200 lines (hard limit)
wc -l apps/web/src/components/*.tsx apps/web/src/components/**/*.tsx 2>/dev/null | awk '$1 > 200 {print}' | sort -rn

# No modal reimplementations (should use shared Modal)
grep -rn "fixed inset-0" apps/web/src/components/ --include="*.tsx" | grep -v node_modules | grep -v "shared/Modal"

# No duplicated table/list blocks across components
# (manual review — compare files flagged in Step 6)

# ErrorBoundary exists
ls apps/web/src/components/shared/ErrorBoundary.tsx 2>/dev/null

# Modal exists
ls apps/web/src/components/shared/Modal.tsx 2>/dev/null
```

## Rules
- Max 200 lines per component file (hard limit), target 100
- Every component receives data via props, not via internal fetch (hooks handle fetching)
- Pure display components have zero hooks — just props → JSX
- Shared structural components (Modal, ErrorBoundary, TabBar) go in `shared/`
- Page-specific sub-components go next to parent: `workspace/`, `conversation/`
- No JSX blocks over 20 lines inside `.map()` — extract to a named component
- Every extracted component gets its own `interface Props` (no inline prop types)
- Every modal uses `<Modal>` from shared — no reimplementation
- Every React island is wrapped in `<ErrorBoundary>`
