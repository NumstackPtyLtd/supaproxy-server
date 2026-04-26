import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'

const queues = new Hono<AuthEnv>()

queues.use('/api/org/queues/*', requireAuth)
queues.use('/api/org/queues', requireAuth)

queues.get('/api/org/queues', async (c) => {
  const { allQueues } = await import('../core/lifecycle.js')
  const result = []
  for (const [name, queue] of Object.entries(allQueues)) {
    const counts = await queue.getJobCounts()
    result.push({ name, ...counts })
  }
  return c.json({ queues: result })
})

queues.get('/api/org/queues/:name/failed', async (c) => {
  const { allQueues } = await import('../core/lifecycle.js')
  const queue = allQueues[c.req.param('name') as keyof typeof allQueues]
  if (!queue) return c.json({ error: 'Queue not found' }, 404)

  const failed = await queue.getFailed(0, 20)
  return c.json({
    jobs: failed.map(j => ({
      id: j.id,
      data: j.data,
      failedReason: j.failedReason,
      timestamp: j.timestamp,
      attemptsMade: j.attemptsMade,
    }))
  })
})

queues.post('/api/org/queues/:name/retry-all', async (c) => {
  const { allQueues } = await import('../core/lifecycle.js')
  const queue = allQueues[c.req.param('name') as keyof typeof allQueues]
  if (!queue) return c.json({ error: 'Queue not found' }, 404)

  const failed = await queue.getFailed(0, 100)
  let retried = 0
  for (const job of failed) {
    await job.retry()
    retried++
  }
  return c.json({ status: 'ok', retried })
})

queues.post('/api/org/queues/:name/drain', async (c) => {
  const { allQueues } = await import('../core/lifecycle.js')
  const queue = allQueues[c.req.param('name') as keyof typeof allQueues]
  if (!queue) return c.json({ error: 'Queue not found' }, 404)

  await queue.drain()
  return c.json({ status: 'ok' })
})

export default queues
