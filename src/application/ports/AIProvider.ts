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

export interface AIResponse {
  content: AIContentBlock[]
  usage: { input_tokens: number; output_tokens: number }
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
