import type { ConsumerPosterRegistry, ColdMessageTarget } from '../../application/ports/ConsumerPoster.js'
import pino from 'pino'

const log = pino({ name: 'consumer-poster' })

export class ConsumerPosterRegistryImpl implements ConsumerPosterRegistry {
  private readonly posters = new Map<string, (target: ColdMessageTarget, text: string) => Promise<void>>()

  register(consumerType: string, poster: (target: ColdMessageTarget, text: string) => Promise<void>): void {
    this.posters.set(consumerType, poster)
    log.info({ consumerType }, 'Consumer poster registered')
  }

  async post(target: ColdMessageTarget, text: string): Promise<boolean> {
    const poster = this.posters.get(target.consumerType)
    if (!poster) {
      log.warn({ consumerType: target.consumerType }, 'No poster registered for consumer type')
      return false
    }
    await poster(target, text)
    return true
  }
}
