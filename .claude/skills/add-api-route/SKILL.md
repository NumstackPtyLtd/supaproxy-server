---
name: add-api-route
description: >
  Adds a new API endpoint to the Hono backend. Handles auth middleware,
  Zod input validation, database queries, and response formatting.
---

# Add API Route

## Step 1: Determine which route module it belongs to

Routes are split into modules in `src/routes/`:

| Module | Prefix | Purpose |
|---|---|---|
| `auth.ts` | `/api/auth/*`, `/api/signup` | Login, logout, session, signup |
| `org.ts` | `/api/org/*` | Org CRUD, settings, users |
| `queues.ts` | `/api/org/queues/*` | Queue management |
| `workspaces.ts` | `/api/workspaces/*`, `/api/teams` | Workspace CRUD, dashboard, activity |
| `conversations.ts` | `/api/workspaces/:id/conversations/*` | Conversation list, detail, close |
| `connectors.ts` | `/api/connectors/*` | MCP, Slack connectors |
| `query.ts` | `/api/workspaces/:id/query` | Agent loop |

If the endpoint does not fit an existing module, create a new route file and mount it in `index.ts`.

## Step 2: Add the route

Use the auth middleware and Zod validation -- do not manually verify JWTs or parse bodies:

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { requireAuth, type AuthUser, type AuthEnv } from '../middleware/auth.js'
import { parseBody } from '../middleware/validate.js'
import { getPool } from '../db/pool.js'
import type { RowDataPacket } from 'mysql2'

// Define typed row interfaces for DB results
interface YourRow extends RowDataPacket {
  id: string
  name: string
  org_id: string
}

const router = new Hono<AuthEnv>()

// Apply auth to all routes in this group
router.use('/api/your-resource/*', requireAuth)

router.get('/api/your-resource', async (c) => {
  const user = c.get('user') as AuthUser
  const db = getPool()

  const [rows] = await db.execute<YourRow[]>(
    'SELECT * FROM table WHERE org_id = ?',
    [user.org_id]
  )
  return c.json({ data: rows })
})

// Define Zod schema for input validation
const CreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

router.post('/api/your-resource', async (c) => {
  const user = c.get('user') as AuthUser
  const result = await parseBody(c, CreateSchema)
  if (!result.success) return result.response

  const { name, description } = result.data
  const db = getPool()

  // Execute action
  // Return result
  return c.json({ status: 'ok' })
})

export default router
```

## Step 3: Mount in index.ts (if new module)

```typescript
import newRouter from './routes/new-module.js'
app.route('/', newRouter)
```

## Step 4: Rules

- **Use `requireAuth` middleware** -- never manually parse JWT cookies in route handlers
- **Use `AuthEnv` type parameter** on Hono instance so `c.get('user')` is typed
- **Use `parseBody(c, schema)`** for input validation with Zod schemas
- **Type all DB rows** -- interfaces extending `RowDataPacket` in `db/types.ts` or locally
- **Database**: use `getPool()` from `./db/pool.js`
- **No business logic in route handlers**: extract to `core/` service modules if complex
- **No hardcoded URLs or secrets**: use `config.ts` exports
- **Error responses**: return `c.json({ error: 'message' }, statusCode)` -- never leak internals

## Step 5: Restart and verify

Run `/restart-servers` for the Hono backend. Verify the new endpoint returns the expected response:

```bash
curl -s http://localhost:3001/api/your-resource | python3 -m json.tool
```
