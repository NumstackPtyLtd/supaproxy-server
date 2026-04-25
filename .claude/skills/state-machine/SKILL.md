# State Machine

Replace boolean state sprawl (`loading`, `saving`, `error`, `success`, `saved`) with discriminated union state machines that make impossible states unrepresentable.

## When to run
- Component has 3+ boolean `useState` calls that are mutually exclusive
- Component has `saving && error` or `loading && success` impossible combinations
- Handler functions set multiple state variables in sequence (`setSaving(true); setError(''); setSuccess('');`)

## Step 1: Identify boolean sprawl

```bash
# Find components with multiple boolean states
grep -rn "useState(false)\|useState(true)\|useState('')" apps/web/src/components/ --include="*.tsx" | awk -F: '{print $1}' | sort | uniq -c | sort -rn | head -10
```

## Step 2: Design state machines

Replace groups of related booleans with a single discriminated union:

**Before (impossible states possible):**
```ts
const [loading, setLoading] = useState(false);
const [saving, setSaving] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
const [saved, setSaved] = useState(false);
```

**After (impossible states impossible):**
```ts
type FormStatus =
  | { state: 'idle' }
  | { state: 'testing'; }
  | { state: 'saving'; }
  | { state: 'saved'; tools?: number; toolNames?: string[] }
  | { state: 'error'; message: string };

const [status, setStatus] = useState<FormStatus>({ state: 'idle' });
```

## Step 3: Common patterns

### Fetch state
```ts
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

### Mutation state
```ts
type MutationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'error'; message: string };
```

### Multi-step flow (test → save → done)
```ts
type ConnectionFlow =
  | { step: 'form' }
  | { step: 'testing' }
  | { step: 'test-passed'; tools: number; toolNames: string[] }
  | { step: 'test-failed'; error: string }
  | { step: 'saving' }
  | { step: 'saved'; tools: number; toolNames: string[] }
  | { step: 'error'; message: string };
```

## Step 4: Update conditionals

**Before:** `{saving ? 'Saving...' : testing ? 'Testing...' : 'Save'}`
**After:** `{status.state === 'saving' ? 'Saving...' : status.state === 'testing' ? 'Testing...' : 'Save'}`

Or better — a lookup:
```ts
const BUTTON_LABEL: Record<FormStatus['state'], string> = {
  idle: 'Save', testing: 'Testing...', saving: 'Saving...', saved: 'Done', error: 'Retry'
};
```

## Step 5: Put state machine types in shared location

- Generic types (`FetchState<T>`, `MutationState`) go in `apps/web/src/types/state.ts`
- Component-specific types stay in the component or its hook file

## Rules
- No groups of 3+ related boolean `useState` calls
- State transitions must be explicit (no setting 5 variables in a row)
- Every state machine type must be a discriminated union with a `status` or `state` field
- Error messages live IN the error state, not in a separate variable
- `useReducer` is acceptable for complex state machines with many transitions
