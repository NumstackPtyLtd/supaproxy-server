import Anthropic from '@anthropic-ai/sdk';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import pino from 'pino';
import { getPool } from '../db/pool.js';
import { randomBytes } from 'crypto';
import type { KeyValueRow } from '../db/types.js';

const log = pino({ name: 'agent' });

interface McpServerConfig {
  transport?: string;
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpJsonRpcResponse {
  jsonrpc: string;
  id: number;
  error?: { message?: string };
  result?: Record<string, unknown>;
}

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Anthropic.Tool['input_schema'];
}

interface McpToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

interface AnthropicToolSpec {
  name: string;
  description: string;
  input_schema: Anthropic.Tool['input_schema'];
}

interface ToolEntry {
  name: string;
  connection: string;
  anthropicTool: AnthropicToolSpec;
  callFn?: (args: Record<string, unknown>) => Promise<McpToolCallResult>;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error: boolean;
}

interface ToolCallRecord {
  name: string;
  connection: string;
  args: Record<string, unknown>;
  duration_ms: number;
}

interface AgentConfig {
  workspaceId: string;
  model: string;
  systemPrompt: string;
  maxToolRounds: number;
  mcpServers: Array<{
    name: string;
    type: string;
    config: McpServerConfig | string;
  }>;
}

interface AgentResult {
  answer: string;
  toolsCalled: ToolCallRecord[];
  connectionsHit: string[];
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  durationMs: number;
  error: string | null;
}

/**
 * Run a query through the agent loop.
 *
 * 1. Connect to workspace MCP servers
 * 2. Discover tools
 * 3. Send query + tools to the LLM
 * 4. Execute tool calls via MCP
 * 5. Loop until the LLM returns a text answer
 * 6. Log to audit_logs
 */
export async function runAgent(
  query: string,
  config: AgentConfig,
  conversationHistory: Anthropic.MessageParam[] = [],
  meta?: { consumerType?: string; channel?: string; userId?: string; userName?: string; conversationId?: string }
): Promise<AgentResult> {
  const startTime = Date.now();

  // Read AI config from org_settings
  let aiApiKey: string | undefined;
  let aiProvider: string = 'anthropic';
  try {
    const [rows] = await getPool().execute<KeyValueRow[]>(
      "SELECT key_name, value FROM org_settings WHERE key_name IN ('ai_api_key', 'ai_provider', 'anthropic_api_key')"
    );
    for (const r of rows) {
      if (r.key_name === 'ai_api_key') aiApiKey = r.value;
      if (r.key_name === 'ai_provider') aiProvider = r.value;
      // Backwards compat: fall back to anthropic_api_key if ai_api_key not set
      if (r.key_name === 'anthropic_api_key' && !aiApiKey) aiApiKey = r.value;
    }
  } catch (err) {
    log.warn('Could not read AI config from org_settings');
  }

  if (!aiApiKey) {
    return {
      answer: 'No AI provider connected. The proxy needs an LLM to route queries to. Go to Settings → Integrations and add your API key.',
      toolsCalled: [],
      connectionsHit: [],
      tokensInput: 0,
      tokensOutput: 0,
      costUsd: 0,
      durationMs: Date.now() - startTime,
      error: 'no_api_key',
    };
  }

  // Currently supports Anthropic — OpenAI/others can be added here
  const anthropic = new Anthropic({ apiKey: aiApiKey });
  const result: AgentResult = {
    answer: '',
    toolsCalled: [],
    connectionsHit: [],
    tokensInput: 0,
    tokensOutput: 0,
    costUsd: 0,
    durationMs: 0,
    error: null,
  };

  // Collect MCP clients to clean up
  const clients: Array<{ name: string; client: Client; transport: StdioClientTransport }> = [];
  const allTools: ToolEntry[] = [];

  try {
    // Connect to each MCP server and discover tools
    for (const server of config.mcpServers.filter(s => s.type === 'mcp')) {
      const cfg = typeof server.config === 'string' ? JSON.parse(server.config) : server.config;

      try {
        let client: Client;
        let transport: StdioClientTransport;

        if (cfg.transport === 'http' && cfg.url) {
          // HTTP transport — use fetch-based JSON-RPC calls
          const httpMcp = {
            url: cfg.url,
            async request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
              const reqId = `sp-${method.replace('/', '-')}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-moo-request-id': reqId,
                ...(cfg.headers || {}),
              };
              const res = await fetch(cfg.url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
                signal: AbortSignal.timeout(30000),
              });
              const data = await res.json() as McpJsonRpcResponse;
              if (data.error) throw new Error(`MCP error: ${data.error.message}`);
              return data.result || {};
            },
          };

          // Initialize
          await httpMcp.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: `supaproxy-${config.workspaceId}`, version: '1.0.0' },
          });

          const toolsResult = await httpMcp.request('tools/list') as { tools?: McpToolDefinition[] };
          const tools = toolsResult.tools || [];
          for (const tool of tools) {
            allTools.push({
              name: tool.name,
              connection: server.name,
              anthropicTool: { name: tool.name, description: tool.description || '', input_schema: tool.inputSchema || { type: 'object' as const, properties: {} } },
              callFn: async (args: Record<string, unknown>) => {
                const result = await httpMcp.request('tools/call', { name: tool.name, arguments: args });
                return result as unknown as McpToolCallResult;
              },
            });
          }

          log.info({ server: server.name, tools: tools.length }, 'MCP connected (HTTP)');
          continue;
        }

        if (cfg.transport !== 'stdio') {
          log.warn({ server: server.name, transport: cfg.transport }, 'Unsupported transport');
          continue;
        }

        transport = new StdioClientTransport({
          command: cfg.command,
          args: cfg.args || [],
          env: { ...process.env, ...(cfg.env || {}) },
        });

        client = new Client({ name: `supaproxy-${config.workspaceId}`, version: '1.0.0' });
        await client.connect(transport);

        const toolsResult = await client.listTools();
        for (const tool of toolsResult.tools) {
          allTools.push({
            name: tool.name,
            connection: server.name,
            anthropicTool: {
              name: tool.name,
              description: tool.description || '',
              input_schema: tool.inputSchema,
            },
          });
        }

        clients.push({ name: server.name, client, transport });
        if (!result.connectionsHit.includes(server.name)) {
          result.connectionsHit.push(server.name);
        }

        log.info({ server: server.name, tools: toolsResult.tools.length }, 'MCP connected');
      } catch (err) {
        log.error({ server: server.name, error: (err as Error).message }, 'MCP connection failed');
      }
    }

    if (allTools.length === 0) {
      result.answer = 'No tools available. Check that the workspace connections are configured and reachable.';
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Build messages
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: query },
    ];

    // Agent loop
    for (let round = 0; round < config.maxToolRounds; round++) {
      log.info({ round: round + 1, messages: messages.length, tools: allTools.length }, 'Agent round');

      const response = await anthropic.messages.create({
        model: config.model,
        max_tokens: 4096,
        system: config.systemPrompt,
        tools: allTools.map(t => t.anthropicTool),
        messages,
      });

      // Track tokens
      result.tokensInput += response.usage.input_tokens;
      result.tokensOutput += response.usage.output_tokens;

      // Collect text and tool calls
      const textParts: string[] = [];
      const toolUses: Anthropic.ToolUseBlock[] = [];

      for (const block of response.content) {
        if (block.type === 'text') textParts.push(block.text);
        if (block.type === 'tool_use') toolUses.push(block);
      }

      // No tool calls - we have the final answer
      if (toolUses.length === 0) {
        result.answer = textParts.join('\n') || '(no response)';
        messages.push({ role: 'assistant' as const, content: response.content });
        break;
      }

      // Execute tool calls
      messages.push({ role: 'assistant' as const, content: response.content });
      const toolResults: ToolResultBlock[] = [];

      for (const tu of toolUses) {
        const toolDef = allTools.find(t => t.name === tu.name);
        const connName = toolDef?.connection || 'unknown';
        const clientEntry = clients.find(c => c.name === connName);
        const toolStart = Date.now();

        // HTTP transport — use callFn directly
        if (toolDef?.callFn) {
          try {
            const callResult = await toolDef.callFn(tu.input as Record<string, unknown>);
            const resultText = (callResult.content || [])
              .filter((c) => c.type === 'text')
              .map((c) => c.text || '')
              .join('\n');

            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: resultText,
              is_error: Boolean(callResult.isError),
            });

            if (!result.connectionsHit.includes(connName)) result.connectionsHit.push(connName);
            result.toolsCalled.push({ name: tu.name, connection: connName, args: tu.input as Record<string, unknown>, duration_ms: Date.now() - toolStart });
            log.info({ tool: tu.name, connection: connName, ms: Date.now() - toolStart }, 'Tool called (HTTP)');
          } catch (err) {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Tool error: ${(err as Error).message}`, is_error: true });
          }
          continue;
        }

        if (!clientEntry) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `Tool error: connection "${connName}" not available`,
            is_error: true,
          });
          continue;
        }

        try {
          const callResult = await clientEntry.client.callTool({ name: tu.name, arguments: tu.input as Record<string, unknown> });
          const contentItems = callResult.content as McpToolCallResult['content'] || [];
          const resultText = contentItems
            .filter((c) => c.type === 'text')
            .map((c) => c.text || '')
            .join('\n');

          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: resultText,
            is_error: Boolean(callResult.isError),
          });

          result.toolsCalled.push({
            name: tu.name,
            connection: connName,
            args: tu.input as Record<string, unknown>,
            duration_ms: Date.now() - toolStart,
          });

          if (!result.connectionsHit.includes(connName)) {
            result.connectionsHit.push(connName);
          }

          log.info({ tool: tu.name, connection: connName, ms: Date.now() - toolStart }, 'Tool called');
        } catch (err) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: `Tool error: ${(err as Error).message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'user' as const, content: toolResults });
    }

    if (!result.answer) {
      result.answer = 'Ran out of tool-call rounds. Please simplify your question.';
    }
  } catch (err) {
    result.error = (err as Error).message;
    result.answer = `Error: ${result.error}`;
    log.error({ error: result.error }, 'Agent loop failed');
  } finally {
    // Clean up MCP clients
    for (const { name, client } of clients) {
      try {
        await client.close();
      } catch {
        log.warn({ server: name }, 'Failed to close MCP client');
      }
    }
  }

  // Calculate cost (Sonnet pricing: $3/M input, $15/M output)
  result.costUsd = (result.tokensInput * 3 + result.tokensOutput * 15) / 1_000_000;
  result.durationMs = Date.now() - startTime;

  // Write audit log
  const auditLogId = randomBytes(16).toString('hex');
  try {
    await getPool().execute(
      `INSERT INTO audit_logs (id, workspace_id, conversation_id, consumer_type, channel, user_id, user_name, query, tools_called, connections_hit, tokens_input, tokens_output, cost_usd, duration_ms, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditLogId,
        config.workspaceId,
        meta?.conversationId || null,
        meta?.consumerType || 'api',
        meta?.channel || null,
        meta?.userId || null,
        meta?.userName || null,
        query,
        JSON.stringify(result.toolsCalled.map(t => t.name)),
        JSON.stringify(result.connectionsHit),
        result.tokensInput,
        result.tokensOutput,
        result.costUsd,
        result.durationMs,
        result.error,
      ]
    );
  } catch (err) {
    log.error({ error: (err as Error).message }, 'Failed to write audit log');
  }

  // Record messages in conversation
  if (meta?.conversationId) {
    try {
      const { recordMessage } = await import('./conversation.js');
      await recordMessage(meta.conversationId, 'user', query);
      await recordMessage(meta.conversationId, 'assistant', result.answer, auditLogId);
    } catch (err) {
      log.error({ error: (err as Error).message }, 'Failed to record conversation messages');
    }
  }

  log.info({
    workspace: config.workspaceId,
    tools: result.toolsCalled.length,
    tokens: result.tokensInput + result.tokensOutput,
    cost: result.costUsd.toFixed(4),
    ms: result.durationMs,
  }, 'Query complete');

  return result;
}
