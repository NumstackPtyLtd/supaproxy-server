import type { QueueService } from '../ports/QueueService.js'

export class ManageQueuesUseCase {
  constructor(private readonly queueService: QueueService) {}

  async listQueues() {
    const names = this.queueService.listQueueNames()
    const result = []
    for (const name of names) {
      const counts = await this.queueService.getJobCounts(name)
      result.push({ name, ...counts })
    }
    return result
  }

  async getFailedJobs(queueName: string) {
    return this.queueService.getFailedJobs(queueName, 20)
  }

  async retryAll(queueName: string) {
    return this.queueService.retryAllFailed(queueName)
  }

  async drain(queueName: string) {
    return this.queueService.drainQueue(queueName)
  }
}
