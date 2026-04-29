export interface AIMessage {
  role: 'user' | 'assistant'
  content: string | AIContentBlock[]
}

export interface AIContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export interface AIToolSpec {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface AIUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_tokens?: number
  cache_read_tokens?: number
  /** Cost in USD calculated by the provider using model-specific pricing. */
  cost_usd: number
}

export interface AIResponse {
  content: AIContentBlock[]
  usage: AIUsage
  stop_reason: string | null
}

export interface AIProvider {
  createMessage(params: {
    model: string
    maxTokens: number
    system: string
    tools: AIToolSpec[]
    messages: AIMessage[]
  }): Promise<AIResponse>

  createSimpleMessage(params: {
    apiKey: string
    model: string
    maxTokens: number
    prompt: string
  }): Promise<string>
}
