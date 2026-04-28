export interface ColdMessageTarget {
  conversationId: string
  consumerType: string
  channel: string
  externalThreadId: string
}

export interface ConsumerPosterRegistry {
  register(consumerType: string, poster: (target: ColdMessageTarget, text: string) => Promise<void>): void
  post(target: ColdMessageTarget, text: string): Promise<boolean>
}
