import type { ConversationRepository } from '../../domain/conversation/repository.js'
import { NotFoundError } from '../../domain/shared/errors.js'

export class GetConversationDetailUseCase {
  constructor(private readonly conversationRepo: ConversationRepository) {}

  async execute(conversationId: string) {
    const conversation = await this.conversationRepo.findById(conversationId)
    if (!conversation) throw new NotFoundError('Conversation', conversationId)

    const [messages, stats] = await Promise.all([
      this.conversationRepo.findMessagesWithAudit(conversationId),
      this.conversationRepo.findStats(conversationId),
    ])

    return { conversation, messages, stats }
  }
}
