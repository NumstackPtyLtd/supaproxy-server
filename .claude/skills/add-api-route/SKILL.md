---
name: add-api-route
description: >
  Scaffolds a new API endpoint following DDD architecture. Creates repository
  interface method, MySQL implementation, application use case, and thin
  presentation route handler. Wires everything through the container.
---

# Add API Route (DDD)

Every new endpoint touches exactly four layers. Never skip a layer.

## Step 1: Determine the domain aggregate

Which aggregate does this endpoint belong to?

| Aggregate | Repository interface | MySQL implementation |
|---|---|---|
| Organisation | `domain/organisation/repository.ts` | `infrastructure/persistence/mysql/MysqlOrganisationRepository.ts` |
| Workspace | `domain/workspace/repository.ts` | `infrastructure/persistence/mysql/MysqlWorkspaceRepository.ts` |
| Conversation | `domain/conversation/repository.ts` | `infrastructure/persistence/mysql/MysqlConversationRepository.ts` |
| Audit | `domain/audit/repository.ts` | `infrastructure/persistence/mysql/MysqlAuditLogRepository.ts` |

If none fit, consider whether this needs a new aggregate.

## Step 2: Add repository interface method (Domain layer)

Add the method signature to the repository interface in `src/domain/{aggregate}/repository.ts`:

```typescript
// In the repository interface - pure contract, no implementation details
export interface WorkspaceRepository {
  // ... existing methods ...
  findWidgetsByWorkspace(workspaceId: string): Promise<WidgetData[]>
}

// Define the return type next to the interface
export interface WidgetData {
  id: string
  name: string
  workspace_id: string
}
```

Rules:
- **No SQL, no mysql2 types, no RowDataPacket** in domain interfaces.
- Return plain data interfaces, not DB row types.
- Method names describe the query intent, not the SQL.

## Step 3: Implement in MySQL repository (Infrastructure layer)

Add the implementation in `src/infrastructure/persistence/mysql/Mysql{Aggregate}Repository.ts`:

```typescript
import type { RowDataPacket } from 'mysql2'

interface WidgetRow extends RowDataPacket {
  id: string
  name: string
  workspace_id: string
}

// Inside the class:
async findWidgetsByWorkspace(workspaceId: string): Promise<WidgetData[]> {
  const [rows] = await this.pool.execute<WidgetRow[]>(
    'SELECT id, name, workspace_id FROM widgets WHERE workspace_id = ?',
    [workspaceId]
  )
  return rows
}
```

Rules:
- **All SQL lives here and ONLY here.**
- RowDataPacket types are private to this file.
- Use parameterised queries with `?` placeholders.

## Step 4: Create use case (Application layer)

Create `src/application/{domain}/{VerbNounUseCase}.ts`:

```typescript
import type { WorkspaceRepository } from '../../domain/workspace/repository.js'
import { NotFoundError } from '../../domain/shared/errors.js'

export class GetWidgetsUseCase {
  constructor(private readonly workspaceRepo: WorkspaceRepository) {}

  async execute(workspaceId: string) {
    const exists = await this.workspaceRepo.existsById(workspaceId)
    if (!exists) throw new NotFoundError('Workspace', workspaceId)
    return this.workspaceRepo.findWidgetsByWorkspace(workspaceId)
  }
}
```

Rules:
- **Constructor takes interfaces, not concrete classes.**
- **Single `execute()` method.**
- **Throw domain errors** (`NotFoundError`, `ConflictError`, `ValidationError`).
- **NEVER import from `infrastructure/`.**

## Step 4b: Write the use case test FIRST (TDD - MANDATORY)

Before implementing the use case, write the test:

```typescript
// src/application/workspace/GetWidgetsUseCase.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mockWorkspaceRepo, stubWorkspace } from '../../__tests__/mocks.js'
import { NotFoundError } from '../../domain/shared/errors.js'
import { GetWidgetsUseCase } from './GetWidgetsUseCase.js'

describe('GetWidgetsUseCase', () => {
  it('returns widgets for an existing workspace', async () => {
    const wsRepo = mockWorkspaceRepo()
    vi.mocked(wsRepo.existsById).mockResolvedValue(true)
    vi.mocked(wsRepo.findWidgetsByWorkspace).mockResolvedValue([{ id: 'w1', name: 'Widget 1', workspace_id: 'ws-test' }])
    const useCase = new GetWidgetsUseCase(wsRepo)

    const result = await useCase.execute('ws-test')

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Widget 1')
  })

  it('throws NotFoundError if workspace does not exist', async () => {
    const wsRepo = mockWorkspaceRepo()
    const useCase = new GetWidgetsUseCase(wsRepo)

    await expect(useCase.execute('ws-missing')).rejects.toThrow(NotFoundError)
  })
})
```

Run the test to confirm it fails (RED), then implement the use case (GREEN):
```bash
npx vitest run src/application/workspace/GetWidgetsUseCase.test.ts
```

## Step 5: Add route handler (Presentation layer)

Add to the relevant route factory in `src/presentation/routes/{module}.ts`:

```typescript
// In the deps interface:
interface WidgetRouteDeps {
  getWidgetsUseCase: GetWidgetsUseCase
  requireAuth: (c: Context, next: Next) => Promise<Response | void>
}

// In the route factory:
router.get('/api/workspaces/:id/widgets', async (c) => {
  try {
    const widgets = await deps.getWidgetsUseCase.execute(c.req.param('id'))
    return c.json({ widgets })
  } catch (err) {
    if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
    throw err
  }
})
```

Rules:
- **Route handlers do three things:** parse request, call use case, format response.
- **No SQL, no business logic, no direct DB access.**
- **Catch domain errors and map to HTTP status codes.**

## Step 6: Wire in container.ts

```typescript
// 1. Import the use case
import { GetWidgetsUseCase } from './application/workspace/GetWidgetsUseCase.js'

// 2. Instantiate with repository interface
const getWidgetsUseCase = new GetWidgetsUseCase(workspaceRepo)

// 3. Pass to route factory
const workspaceRoutes = createWorkspaceRoutes({ ..., getWidgetsUseCase })

// 4. Export from container
return { ..., getWidgetsUseCase }
```

## Step 7: Verify

```bash
npx tsc --noEmit                    # Must compile clean
pnpm test                            # Must pass
curl -s http://localhost:3001/api/workspaces/ws-test/widgets | python3 -m json.tool
```

## Anti-patterns (NEVER do these)

- Calling `getPool()` in a route handler or use case
- Putting SQL in a use case
- Importing from `infrastructure/` in a use case
- Putting business logic in a route handler
- Skipping the use case layer ("it's just a simple query")
