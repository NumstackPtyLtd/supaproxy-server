import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'
import type { WorkspaceConfig } from '../shared/index.js'
import pino from 'pino'

const log = pino({ name: 'workspace-registry' })

export class Workspace {
  constructor(public readonly config: WorkspaceConfig['workspace']) {}

  get id() { return this.config.id }
  get name() { return this.config.name }
  get team() { return this.config.team }
  get status() { return this.config.status }
  get mcpServers() { return this.config.mcp_servers }
  get knowledge() { return this.config.knowledge }
  get consumers() { return this.config.consumers }
  get permissions() { return this.config.permissions }
  get guardrails() { return this.config.guardrails }
  get systemPrompt() { return this.config.system_prompt }
  get model() { return this.config.model }
  get maxToolRounds() { return this.config.max_tool_rounds }
  get maxThreadHistory() { return this.config.max_thread_history }

  /** Check if a channel is bound to this workspace for any consumer type */
  ownsChannel(channelId: string): boolean {
    return Object.values(this.consumers).some(
      (cfg) => cfg?.channels?.includes(channelId) ?? false
    )
  }

  /** Check if a tool name matches the allowed patterns for a role */
  isToolAllowed(toolName: string, userRole: string): boolean {
    const role = this.permissions.roles.find(r => r.role === userRole)
    if (!role) return false
    return role.tools.some(pattern => {
      if (pattern === '*') return true
      if (pattern.endsWith('*')) {
        return toolName.startsWith(pattern.slice(0, -1))
      }
      return toolName === pattern
    })
  }

  /** Check if a tool matches a write pattern (needs confirmation) */
  isWriteTool(toolName: string): boolean {
    if (!this.guardrails.write_confirmation) return false
    const patterns = this.guardrails.write_tool_patterns ?? []
    return patterns.some(pattern => {
      if (pattern.endsWith('*')) {
        return toolName.startsWith(pattern.slice(0, -1))
      }
      return toolName === pattern
    })
  }
}

export class WorkspaceRegistry {
  private workspaces = new Map<string, Workspace>()
  private channelIndex = new Map<string, string>() // channelId → workspaceId

  /** Load all workspace YAML files from a directory */
  loadFromDirectory(configDir: string): void {
    const files = readdirSync(configDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

    for (const file of files) {
      try {
        const raw = readFileSync(join(configDir, file), 'utf-8')
        const parsed = parse(raw) as WorkspaceConfig
        const ws = new Workspace(parsed.workspace)

        if (ws.status !== 'active') {
          log.info({ workspace: ws.id, status: ws.status }, 'Skipping inactive workspace')
          continue
        }

        this.workspaces.set(ws.id, ws)

        // Index Slack channels
        for (const ch of ws.consumers.slack?.channels ?? []) {
          if (this.channelIndex.has(ch)) {
            log.warn({ channel: ch, existing: this.channelIndex.get(ch), new: ws.id },
              'Channel already bound to another workspace — overwriting')
          }
          this.channelIndex.set(ch, ws.id)
        }

        const totalChannels = Object.values(ws.consumers).reduce((sum, cfg) => sum + (cfg?.channels?.length ?? 0), 0)
        log.info({ workspace: ws.id, name: ws.name, tools: ws.mcpServers.length, channels: totalChannels },
          'Workspace loaded')
      } catch (err) {
        log.error({ file, error: (err as Error).message }, 'Failed to load workspace config')
      }
    }

    log.info({ total: this.workspaces.size }, 'Workspace registry ready')
  }

  getById(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }

  getByChannel(channelId: string): Workspace | undefined {
    const wsId = this.channelIndex.get(channelId)
    return wsId ? this.workspaces.get(wsId) : undefined
  }

  listAll(): Workspace[] {
    return Array.from(this.workspaces.values())
  }

  /** Check if a channel is registered to any workspace */
  isChannelRegistered(channelId: string): boolean {
    return this.channelIndex.has(channelId)
  }
}

// Singleton
export const registry = new WorkspaceRegistry()
