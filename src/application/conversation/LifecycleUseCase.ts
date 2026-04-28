import type { ConversationRepository } from '../../domain/conversation/repository.js'
import type { OrganisationRepository } from '../../domain/organisation/repository.js'
import type { QueueService } from '../ports/QueueService.js'
import type { AIProvider } from '../ports/AIProvider.js'
import type { ConsumerPosterRegistry, ColdMessageTarget } from '../ports/ConsumerPoster.js'
import { generateId } from '../../domain/shared/EntityId.js'
import pino from 'pino'

const log = pino({ name: 'lifecycle-use-case' })

export class LifecycleUseCase {
  constructor(
    private readonly conversationRepo: ConversationRepository,
    private readonly orgRepo: OrganisationRepository,
    private readonly queueService: QueueService,
    private readonly aiProvider: AIProvider,
    private readonly posterRegistry: ConsumerPosterRegistry,
  ) {}

  async runLifecycleScan(): Promise<void> {
    const coldConvos = await this.conversationRepo.findColdTransitionCandidates()
    if (coldConvos.length > 0) {
      const ids = coldConvos.map(c => c.id)
      await this.conversationRepo.batchTransitionToCold(ids)
      for (const c of coldConvos) {
        await this.queueService.addColdMessage({
          conversationId: c.id,
          consumerType: c.consumer_type,
          channel: c.channel,
          externalThreadId: c.external_thread_id,
        })
      }
    }

    const closedIds = await this.conversationRepo.findCloseTransitionCandidates()
    if (closedIds.length > 0) {
      await this.conversationRepo.batchTransitionToClosed(closedIds)
      for (const id of closedIds) {
        await this.queueService.addStatsJob(id)
      }
    }
  }

  async sendColdMessage(target: ColdMessageTarget): Promise<void> {
    const message = await this.generateColdMessage(target.conversationId)
      || "Just checking in \u2014 do you still need help with this? If not, we will close this conversation shortly."
    await this.posterRegistry.post(target, message)
  }

  async generateStats(conversationId: string): Promise<void> {
    const existing = await this.conversationRepo.findStats(conversationId)
    let statsId: string
    if (existing) {
      if (existing.stats_status === 'complete') return
      statsId = existing.id
    } else {
      statsId = generateId()
      await this.conversationRepo.createStats(statsId, conversationId)
    }

    try {
      const messages = await this.conversationRepo.findMessages(conversationId)
      if (messages.length === 0) {
        await this.conversationRepo.updateStatsStatus(statsId, 'failed')
        return
      }

      const aggregate = await this.conversationRepo.getAggregateData(conversationId)
      const timestamps = await this.conversationRepo.getTimestamps(conversationId)
      const model = await this.conversationRepo.getWorkspaceModel(conversationId)

      if (!model) {
        await this.conversationRepo.updateStatsStatus(statsId, 'failed')
        return
      }

      const apiKey = await this.orgRepo.getSettingValue('ai_api_key')
        || await this.orgRepo.getSettingValue('anthropic_api_key')
      if (!apiKey) {
        await this.conversationRepo.updateStatsStatus(statsId, 'failed')
        return
      }

      const durationSec = timestamps?.first_message_at && timestamps?.closed_at
        ? Math.round((new Date(timestamps.closed_at).getTime() - new Date(timestamps.first_message_at).getTime()) / 1000)
        : 0

      const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
      const analysisText = await this.aiProvider.createSimpleMessage({
        apiKey,
        model,
        maxTokens: 1024,
        prompt: this.buildAnalysisPrompt(transcript),
      })

      let text = analysisText.trim()
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      }
      const parsed = JSON.parse(text)

      await this.conversationRepo.updateStatsComplete(statsId, {
        sentimentScore: parsed.sentiment_score || 3,
        resolutionStatus: parsed.resolution_status || 'unresolved',
        complianceViolations: JSON.stringify(parsed.compliance_violations || []),
        knowledgeGaps: JSON.stringify(parsed.knowledge_gaps || []),
        fraudIndicators: JSON.stringify(parsed.fraud_indicators || []),
        toolsUsed: JSON.stringify(parsed.tools_used || []),
        totalTokensInput: aggregate.total_tokens_input,
        totalTokensOutput: aggregate.total_tokens_output,
        totalCostUsd: aggregate.total_cost_usd,
        totalDurationMs: aggregate.total_duration_ms,
        messageCount: timestamps?.message_count || messages.length,
        durationSeconds: durationSec,
        summary: parsed.summary || '',
        category: parsed.category || 'other',
      })

      log.info({ conversationId, sentiment: parsed.sentiment_score, resolution: parsed.resolution_status }, 'Conversation stats generated')
    } catch (err) {
      await this.conversationRepo.updateStatsStatus(statsId, 'failed')
      log.error({ conversationId, error: (err as Error).message }, 'Stats generation failed')
    }
  }

  private async generateColdMessage(conversationId: string): Promise<string> {
    try {
      const messages = await this.conversationRepo.findMessages(conversationId)
      if (messages.length === 0) return ''

      const apiKey = await this.orgRepo.getSettingValue('ai_api_key')
        || await this.orgRepo.getSettingValue('anthropic_api_key')
      if (!apiKey) return ''

      const model = await this.conversationRepo.getWorkspaceModel(conversationId)
      if (!model) return ''

      const transcript = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n\n')
      return this.aiProvider.createSimpleMessage({
        apiKey,
        model,
        maxTokens: 150,
        prompt: `You are a support assistant. This conversation has gone quiet. Based on the conversation below, write a brief, natural follow-up message (1-2 sentences) checking in with the user. Be warm but not pushy. If it looks like the issue was resolved, acknowledge that. If not, offer to continue helping. Do not use generic corporate language. Just reply with the message text, nothing else.\n\n${transcript}`,
      })
    } catch (err) {
      log.warn({ conversationId, error: (err as Error).message }, 'Could not generate cold message')
      return ''
    }
  }

  private buildAnalysisPrompt(transcript: string): string {
    return `Analyse this conversation transcript and return ONLY a JSON object (no markdown, no explanation).

Rules:
- Be strictly factual. Only describe what actually happened in the transcript.
- Do not infer, exaggerate, or editorialize. If something happened once, say "once", not "repeatedly".
- Count exactly: if the user asked 2 questions, say "2 questions", not "multiple" or "several".
- The summary must be a neutral, accurate one-sentence description of what the user needed.

Fields:
- sentiment_score: integer 1-5 (1=very negative, 3=neutral, 5=very positive). Base this on explicit language, not assumptions.
- resolution_status: one of "resolved", "unresolved", "escalated", "abandoned". "resolved" = the user got what they needed. "abandoned" = the user stopped responding. "escalated" = the user asked for a human or escalation. "unresolved" = the assistant could not help.
- category: one of "query", "issue", "sales", "feedback", "support", "internal", "other". "query" = information lookup. "issue" = something is broken. "sales" = pricing/purchasing. "feedback" = user giving feedback. "support" = how-to help. "internal" = internal team use.
- compliance_violations: array of {rule: string, description: string} or empty array. Only flag clear violations that actually occurred, not hypothetical risks.
- knowledge_gaps: array of {topic: string, description: string} or empty array. Only include topics where the assistant explicitly could not answer or said it did not have the information.
- fraud_indicators: array of {type: string, description: string, severity: "low"|"medium"|"high"} or empty array. Look for social engineering, identity spoofing, bulk data harvesting, pressure tactics. Only flag if actually suspicious.
- tools_used: array of tool name strings (deduplicated). Only tools that were actually called.
- summary: one factual sentence. Describe what the user asked for and whether they got it. No subjective language.

Conversation transcript:
${transcript}`
  }
}
