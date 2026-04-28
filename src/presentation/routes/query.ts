import { Hono } from 'hono'
import { z } from 'zod'
import type { ExecuteQueryUseCase } from '../../application/query/ExecuteQueryUseCase.js'
import { parseBody } from '../middleware/validate.js'
import type { AuthUser, AuthEnv } from '../middleware/auth.js'
import { NotFoundError } from '../../domain/shared/errors.js'

const queryBodySchema = z.object({
  query: z.string().min(1, 'Query is required').max(10000),
  session_id: z.string().max(255).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(100).optional(),
})

interface QueryRouteDeps {
  executeQueryUseCase: ExecuteQueryUseCase
  requireAuth: (c: import('hono').Context, next: import('hono').Next) => Promise<Response | void>
}

export function createQueryRoutes(deps: QueryRouteDeps) {
  const query = new Hono<AuthEnv>()

  query.use('/api/workspaces/*/query', deps.requireAuth)

  query.post('/api/workspaces/:id/query', async (c) => {
    const parsed = await parseBody(c, queryBodySchema)
    if (!parsed.success) return parsed.response

    const user = c.get('user') as AuthUser
    const wsId = c.req.param('id')

    try {
      const result = await deps.executeQueryUseCase.execute(wsId, parsed.data.query, {
        consumerType: 'api',
        userId: user?.id,
        userName: user?.name,
        sessionId: parsed.data.session_id,
      })

      return c.json({
        answer: result.answer,
        tools_called: result.toolsCalled,
        connections_hit: result.connectionsHit,
        tokens: { input: result.tokensInput, output: result.tokensOutput },
        cost_usd: result.costUsd,
        duration_ms: result.durationMs,
        error: result.error,
        conversation_id: result.conversationId,
        session_id: result.sessionId,
      })
    } catch (err) {
      if (err instanceof NotFoundError) return c.json({ error: 'Workspace not found' }, 404)
      throw err
    }
  })

  return query
}
