export interface QueueJobCounts {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export interface FailedJob {
  id: string | undefined
  data: Record<string, unknown>
  failedReason: string | undefined
  timestamp: number | undefined
  attemptsMade: number
}

export interface QueueService {
  addColdMessage(data: { conversationId: string; consumerType: string; channel: string; externalThreadId: string }): Promise<void>
  addStatsJob(conversationId: string): Promise<void>
  getJobCounts(queueName: string): Promise<QueueJobCounts>
  getFailedJobs(queueName: string, limit: number): Promise<FailedJob[]>
  retryAllFailed(queueName: string): Promise<number>
  drainQueue(queueName: string): Promise<void>
  listQueueNames(): string[]
}
