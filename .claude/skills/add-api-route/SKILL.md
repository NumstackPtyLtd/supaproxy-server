---
name: add-api-route
description: >
  Adds a new API endpoint to the Hono backend. Handles auth checks,
  input validation, database queries, and response formatting.
  Use when the frontend needs new data.
---

# Add API Route

## Step 1: Determine which route module it belongs to

Routes are split into modules in `apps/server/src/routes/`:

| Module | Prefix | Purpose |
|---|---|---|
| `auth.ts` | `/api/auth/*`, `/api/signup` | Login, logout, session, signup |
| `org.ts` | `/api/org/*` | Org CRUD, settings, users |
| `queues.ts` | `/api/org/queues/*` | Queue management |
| `workspaces.ts` | `/api/workspaces/*`, `/api/teams` | Workspace CRUD, dashboard, activity |
| `conversations.ts` | `/api/workspaces/:id/conversations/*` | Conversation list, detail, close |
| `connectors.ts` | `/api/connectors/*` | MCP, Slack connectors |
| `query.ts` | `/api/workspaces/:id/query` | Agent loop |

If the endpoint doesn't fit an existing module, create a new route file and mount it in `index.ts`.

## Step 2: Add the route

Use the auth middleware — don't manually verify JWTs:

```typescript
import { Hono } from 'hono'
import { requireAuth, type AuthUser, type AuthEnv } from '../middleware/auth.js'
import { getPool } from '../db/pool.js'

const router = new Hono<AuthEnv>()

// Apply auth to all routes in this group
router.use('/api/your-resource/*', requireAuth)

router.get('/api/your-resource', async (c) => {
  const user = c.get('user') as AuthUser
  const db = getPool()

  const [rows] = await db.execute('SELECT * FROM table WHERE org_id = ?', [user.org_id]) as any
  return c.json({ data: rows })
})

router.post('/api/your-resource', async (c) => {
  const user = c.get('user') as AuthUser
  const db = getPool()
  const body = await c.req.json()

  // Validate input
  if (!body.name) return c.json({ error: 'Name is required.' }, 400)

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

- **Use `requireAuth` middleware** — never manually parse JWT cookies in route handlers
- **Use `AuthEnv` type parameter** on Hono instance so `c.get('user')` is typed
- **Database**: use `getPool()` from `./db/pool.js`
- **Validation**: validate input before querying. Return 400 with a message for bad input.
- **No business logic in route handlers**: extract to service modules if complex
- **No hardcoded URLs or secrets**: use `config.ts` exports
- **Redirects**: for form submissions, use `c.redirect(url)`. For API calls, return JSON.

## Step 5: Restart and verify

Run `/restart-servers` for the Hono backend. Verify the new endpoint returns the expected response before building the frontend that consumes it.
