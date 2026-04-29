import type { WorkspaceRepository } from '../../domain/workspace/repository.js'
import type { OrganisationRepository } from '../../domain/organisation/repository.js'
import type { AuditLogRepository, AuditLogData } from '../../domain/audit/repository.js'
import type { AIProvider, AIToolSpec, AIMessage, AIContentBlock } from '../ports/AIProvider.js'
import type { McpClientFactory, McpConnection } from '../ports/McpClient.js'
import type { ManageConversationUseCase } from '../conversation/ManageConversationUseCase.js'
import { generateId } from '../../domain/shared/EntityId.js'
import { NotFoundError, ConfigurationError } from '../../domain/shared/errors.js'
import pino from 'pino'

const log = pino({ name: 'execute-query' })

/** Per-million-token pricing for known models. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude 4 / Opus
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-opus-4-0': { input: 15, output: 75 },
  // Claude 3.5 / Sonnet
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-sonnet-4-0': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-sonnet-latest': { input: 3, output: 15 },
  // Claude 3 Haiku
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4 },
  'claude-3-5-haiku-latest': { input: 0.80, output: 4 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  // Claude 3 Opus (legacy)
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'claude-3-opus-latest': { input: 15, output: 75 },
  // Claude 3 Sonnet (legacy)
  'claude-3-sonnet-20240229': { input: 3, output: 15 },
  // GPT-4o (OpenAI-compatible providers)
  'gpt-4o': { input: 2.50, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
}

/** Fallback: match model string prefix to find pricing. */
function findPricing(model: string): { input: number; output: number } {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]
  // Try prefix matching (e.g. "claude-3-5-sonnet-20241022" matches "claude-3-5-sonnet")
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key.replace(/-\d{8}$/, '').replace(/-latest$/, ''))) return pricing
  }
  // Default to Sonnet pricing as a reasonable middle ground
  log.warn({ model }, 'Unknown model for cost calculation, using default pricing')
  return { input: 3, output: 15 }
}

/** Calculate cost in USD from token counts and model. */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = findPricing(model)
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
}

interface McpServerConfig {
  transport?: string
  url?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
}

interface ToolEntry {
  name: string
  connection: string
  spec: AIToolSpec
  callFn: (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text?: string }>; isError: boolean }>
}

interface ToolCallRecord {
  name: string
  connection: string
  args: Record<string, unknown>
  duration_ms: number
}

interface QueryResult {
  answer: string
  toolsCalled: string[]
  connectionsHit: string[]
  tokensInput: number
  tokensOutput: number
  costUsd: number
  durationMs: number
  error: string | null
  conversationId: string
  sessionId: string
}

interface QueryMeta {
  consumerType: string
  channel?: string
  userId?: string
  userName?: string
  conversationId?: string
  sessionId?: string
}

export class ExecuteQueryUseCase {
  constructor(
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly orgRepo: OrganisationRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly aiProvider: AIProvider,
    private readonly mcpFactory: McpClientFactory,
    private readonly conversationUseCase: ManageConversationUseCase,
  ) {}

  async execute(workspaceId: string, query: string, meta: QueryMeta): Promise<QueryResult> {
    const startTime = Date.now()

    const workspace = await this.workspaceRepo.findActiveById(workspaceId)
    if (!workspace) throw new NotFoundError('Workspace', workspaceId)

    const sessionId = meta.sessionId || `${meta.consumerType}:${meta.userId || 'anon'}:${workspaceId}:${Date.now()}`
    const conversationId = meta.conversationId || await this.conversationUseCase.findOrCreate(
      workspaceId, meta.consumerType, sessionId, meta.userName, meta.channel
    )
    const history = await this.conversationUseCase.getHistory(conversationId)

    const apiKey = await this.getApiKey()
    if (!apiKey) {
      return this.buildResult({
        answer: 'No AI provider connected. The proxy needs an LLM to route queries to. Go to Settings \u2192 Integrations and add your API key.',
        error: 'no_api_key',
        durationMs: Date.now() - startTime,
        conversationId,
        sessionId,
      })
    }

    const connections = await this.workspaceRepo.findConnectionConfigs(workspaceId)
    const { tools, mcpConnections } = await this.discoverTools(connections, workspaceId)

    try {
      if (tools.length === 0) {
        return this.buildResult({
          answer: 'No tools available. Check that the workspace connections are configured and reachable.',
          durationMs: Date.now() - startTime,
          conversationId,
          sessionId,
        })
      }

      if (!workspace.model) {
        throw new Error('No AI model configured for this workspace. Set a model in workspace settings.')
      }

      const result = await this.runAgentLoop(query, {
        model: workspace.model,
        systemPrompt: workspace.system_prompt || 'You are a helpful assistant.',
        maxToolRounds: workspace.max_tool_rounds || 10,
        tools,
        history,
        apiKey,
      })

      result.durationMs = Date.now() - startTime
      result.costUsd = calculateCost(workspace.model, result.tokensInput, result.tokensOutput)

      const auditLogId = generateId()
      await this.writeAuditLog(auditLogId, workspaceId, conversationId, query, result, meta)
      await this.recordMessages(conversationId, query, result.answer, auditLogId)

      log.info({
        workspace: workspaceId,
        tools: result.toolsCalled.length,
        tokens: result.tokensInput + result.tokensOutput,
        cost: result.costUsd.toFixed(4),
        ms: result.durationMs,
      }, 'Query complete')

      return {
        ...result,
        conversationId,
        sessionId,
        toolsCalled: result.toolsCalled.map(t => t.name),
      }
    } finally {
      for (const conn of mcpConnections) {
        try { await conn.close() } catch { /* ignore */ }
      }
    }
  }

  private async getApiKey(): Promise<string | null> {
    const settings = await this.orgRepo.getSettingValues(['ai_api_key', 'anthropic_api_key'])
    return settings['ai_api_key'] || settings['anthropic_api_key'] || null
  }

  private async discoverTools(
    connections: Array<{ name: string; type: string; config: string }>,
    workspaceId: string,
  ): Promise<{ tools: ToolEntry[]; mcpConnections: McpConnection[] }> {
    const tools: ToolEntry[] = []
    const mcpConnections: McpConnection[] = []

    for (const server of connections.filter(s => s.type === 'mcp')) {
      const cfg: McpServerConfig = typeof server.config === 'string' ? JSON.parse(server.config) : server.config

      try {
        if (cfg.transport === 'http' && cfg.url) {
          const conn = await this.mcpFactory.connectHttp(cfg.url, cfg.headers, `supaproxy-${workspaceId}`)
          mcpConnections.push(conn)
          for (const tool of conn.tools) {
            tools.push({
              name: tool.name,
              connection: server.name,
              spec: { name: tool.name, description: tool.description || '', input_schema: tool.inputSchema || { type: 'object', properties: {} } },
              callFn: (args) => conn.callTool(tool.name, args),
            })
          }
          log.info({ server: server.name, tools: conn.tools.length }, 'MCP connected (HTTP)')
        } else if (cfg.transport === 'stdio' && cfg.command) {
          const conn = await this.mcpFactory.connectStdio(cfg.command, cfg.args || [], cfg.env, `supaproxy-${workspaceId}`)
          mcpConnections.push(conn)
          for (const tool of conn.tools) {
            tools.push({
              name: tool.name,
              connection: server.name,
              spec: { name: tool.name, description: tool.description || '', input_schema: tool.inputSchema },
              callFn: (args) => conn.callTool(tool.name, args),
            })
          }
          log.info({ server: server.name, tools: conn.tools.length }, 'MCP connected (STDIO)')
        }
      } catch (err) {
        log.error({ server: server.name, error: (err as Error).message }, 'MCP connection failed')
      }
    }

    return { tools, mcpConnections }
  }

  private async runAgentLoop(query: string, config: {
    model: string
    systemPrompt: string
    maxToolRounds: number
    tools: ToolEntry[]
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    apiKey: string
  }): Promise<{ answer: string; toolsCalled: ToolCallRecord[]; connectionsHit: string[]; tokensInput: number; tokensOutput: number; costUsd: number; durationMs: number; error: string | null }> {
    const result = { answer: '', toolsCalled: [] as ToolCallRecord[], connectionsHit: [] as string[], tokensInput: 0, tokensOutput: 0, costUsd: 0, durationMs: 0, error: null as string | null }

    const messages: AIMessage[] = [
      ...config.history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: query },
    ]

    try {
      for (let round = 0; round < config.maxToolRounds; round++) {
        const response = await this.aiProvider.createMessage({
          model: config.model,
          maxTokens: 4096,
          system: config.systemPrompt,
          tools: config.tools.map(t => t.spec),
          messages,
        })

        result.tokensInput += response.usage.input_tokens
        result.tokensOutput += response.usage.output_tokens

        const textParts: string[] = []
        const toolUses: AIContentBlock[] = []

        for (const block of response.content) {
          if (block.type === 'text' && block.text) textParts.push(block.text)
          if (block.type === 'tool_use') toolUses.push(block)
        }

        if (toolUses.length === 0) {
          result.answer = textParts.join('\n') || '(no response)'
          break
        }

        messages.push({ role: 'assistant', content: response.content })
        const toolResults: AIContentBlock[] = []

        for (const tu of toolUses) {
          const toolDef = config.tools.find(t => t.name === tu.name)
          const connName = toolDef?.connection || 'unknown'
          const toolStart = Date.now()

          try {
            const callResult = await toolDef!.callFn(tu.input as Record<string, unknown>)
            const resultText = callResult.content
              .filter(c => c.type === 'text')
              .map(c => c.text || '')
              .join('\n')

            toolResults.push({ type: 'tool_result', id: tu.id, text: resultText })
            if (!result.connectionsHit.includes(connName)) result.connectionsHit.push(connName)
            result.toolsCalled.push({ name: tu.name!, connection: connName, args: tu.input as Record<string, unknown>, duration_ms: Date.now() - toolStart })
          } catch (err) {
            toolResults.push({ type: 'tool_result', id: tu.id, text: `Tool error: ${(err as Error).message}` })
          }
        }

        messages.push({ role: 'user', content: toolResults })
      }

      if (!result.answer) {
        result.answer = 'Ran out of tool-call rounds. Please simplify your question.'
      }
    } catch (err) {
      result.error = (err as Error).message
      result.answer = "I'm sorry, I wasn't able to process your request. Please try again or rephrase your question."
      log.error({ error: result.error }, 'Agent loop failed')
    }

    return result
  }

  private async writeAuditLog(
    auditLogId: string,
    workspaceId: string,
    conversationId: string,
    query: string,
    result: { toolsCalled: ToolCallRecord[]; connectionsHit: string[]; tokensInput: number; tokensOutput: number; costUsd: number; durationMs: number; error: string | null },
    meta: QueryMeta,
  ): Promise<void> {
    try {
      const data: AuditLogData = {
        id: auditLogId,
        workspace_id: workspaceId,
        conversation_id: conversationId,
        consumer_type: meta.consumerType,
        channel: meta.channel || null,
        user_id: meta.userId || null,
        user_name: meta.userName || null,
        query,
        tools_called: JSON.stringify(result.toolsCalled.map(t => t.name)),
        connections_hit: JSON.stringify(result.connectionsHit),
        tokens_input: result.tokensInput,
        tokens_output: result.tokensOutput,
        cost_usd: result.costUsd,
        duration_ms: result.durationMs,
        error: result.error,
      }
      await this.auditRepo.create(data)
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to write audit log')
    }
  }

  private async recordMessages(conversationId: string, query: string, answer: string, auditLogId: string): Promise<void> {
    try {
      await this.conversationUseCase.recordMessage(conversationId, 'user', query)
      await this.conversationUseCase.recordMessage(conversationId, 'assistant', answer, auditLogId)
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to record conversation messages')
    }
  }

  private buildResult(partial: Partial<QueryResult> & { answer: string; conversationId: string; sessionId: string }): QueryResult {
    return {
      toolsCalled: [],
      connectionsHit: [],
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      durationMs: 0,
      error: null,
      ...partial,
    }
  }
}
