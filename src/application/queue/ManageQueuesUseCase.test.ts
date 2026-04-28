import { describe, it, expect, vi } from 'vitest'
import { mockQueueService } from '../../__tests__/mocks.js'
import { ManageQueuesUseCase } from './ManageQueuesUseCase.js'

describe('ManageQueuesUseCase', () => {
  it('listQueues gets counts for all queues', async () => {
    const queue = mockQueueService()
    const counts = { waiting: 1, active: 2, completed: 10, failed: 0, delayed: 0 }

    vi.mocked(queue.listQueueNames).mockReturnValue(['lifecycle', 'cold-messages', 'conversation-stats'])
    vi.mocked(queue.getJobCounts).mockResolvedValue(counts)

    const uc = new ManageQueuesUseCase(queue)
    const result = await uc.listQueues()

    expect(queue.listQueueNames).toHaveBeenCalled()
    expect(queue.getJobCounts).toHaveBeenCalledTimes(3)
    expect(queue.getJobCounts).toHaveBeenCalledWith('lifecycle')
    expect(queue.getJobCounts).toHaveBeenCalledWith('cold-messages')
    expect(queue.getJobCounts).toHaveBeenCalledWith('conversation-stats')
    expect(result).toEqual([
      { name: 'lifecycle', ...counts },
      { name: 'cold-messages', ...counts },
      { name: 'conversation-stats', ...counts },
    ])
  })

  it('getFailedJobs delegates', async () => {
    const queue = mockQueueService()
    const jobs = [{ id: 'job-1', data: {}, failedReason: 'timeout' }]

    vi.mocked(queue.getFailedJobs).mockResolvedValue(jobs as never[])

    const uc = new ManageQueuesUseCase(queue)
    const result = await uc.getFailedJobs('lifecycle')

    expect(queue.getFailedJobs).toHaveBeenCalledWith('lifecycle', 20)
    expect(result).toEqual(jobs)
  })

  it('retryAll delegates', async () => {
    const queue = mockQueueService()

    vi.mocked(queue.retryAllFailed).mockResolvedValue(5)

    const uc = new ManageQueuesUseCase(queue)
    const result = await uc.retryAll('lifecycle')

    expect(queue.retryAllFailed).toHaveBeenCalledWith('lifecycle')
    expect(result).toBe(5)
  })

  it('drain delegates', async () => {
    const queue = mockQueueService()

    const uc = new ManageQueuesUseCase(queue)
    await uc.drain('lifecycle')

    expect(queue.drainQueue).toHaveBeenCalledWith('lifecycle')
  })
})
