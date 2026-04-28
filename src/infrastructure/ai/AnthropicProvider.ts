import Anthropic from '@anthropic-ai/sdk'
import type { TextBlock } from '@anthropic-ai/sdk/resources/messages.js'
import type { AIProvider, AIMessage, AIToolSpec, AIResponse, AIContentBlock } from '../../application/ports/AIProvider.js'

export class AnthropicProvider implements AIProvider {
  private client: Anthropic | null = null
  private currentApiKey: string | null = null

  private getClient(apiKey: string): Anthropic {
    if (this.client && this.currentApiKey === apiKey) return this.client
    this.client = new Anthropic({ apiKey })
    this.currentApiKey = apiKey
    return this.client
  }

  async createMessage(params: {
    model: string
    maxTokens: number
    system: string
    tools: AIToolSpec[]
    messages: AIMessage[]
    apiKey?: string
  }): Promise<AIResponse> {
    const apiKey = params.apiKey || this.currentApiKey
    if (!apiKey) throw new Error('No API key configured')

    const client = this.getClient(apiKey)

    const anthropicMessages = params.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: Array.isArray(m.content)
        ? m.content.map(block => this.toAnthropicBlock(block))
        : m.content as string,
    }))

    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      tools: params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool['input_schema'],
      })),
      messages: anthropicMessages,
    })

    return {
      content: response.content.map(block => this.fromAnthropicBlock(block)),
      usage: response.usage,
      stop_reason: response.stop_reason,
    }
  }

  async createSimpleMessage(params: { apiKey: string; model: string; maxTokens: number; prompt: string }): Promise<string> {
    const client = this.getClient(params.apiKey)
    const response = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [{ role: 'user', content: params.prompt }],
    })
    return response.content
      .filter((b): b is TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  }

  setApiKey(apiKey: string): void {
    this.getClient(apiKey)
  }

  private toAnthropicBlock(block: AIContentBlock): Anthropic.ContentBlockParam {
    if (block.type === 'tool_result') {
      return { type: 'tool_result', tool_use_id: block.id!, content: block.text || '', is_error: false } as Anthropic.ToolResultBlockParam
    }
    if (block.type === 'tool_use') {
      return { type: 'tool_use', id: block.id!, name: block.name!, input: block.input || {} } as Anthropic.ToolUseBlockParam
    }
    return { type: 'text', text: block.text || '' } as Anthropic.TextBlockParam
  }

  private fromAnthropicBlock(block: Anthropic.ContentBlock): AIContentBlock {
    if (block.type === 'text') return { type: 'text', text: block.text }
    if (block.type === 'tool_use') return { type: 'tool_use', id: block.id, name: block.name, input: block.input as Record<string, unknown> }
    return { type: block.type }
  }
}
