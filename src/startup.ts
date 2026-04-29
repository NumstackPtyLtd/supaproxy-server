/**
 * Startup routines — consumer boot, lifecycle workers.
 *
 * Separated from app creation so the cloud overlay can
 * hook into the startup sequence.
 */
import pino from 'pino'
import type { Container } from './container.js'
import type { IncomingMessage, Workspace } from '@supaproxy/consumers'

const log = pino({ name: 'startup' })

export async function startConsumers(container: Container): Promise<void> {
  try {
    const botToken = await container.orgRepo.getSettingValue('slack_bot_token')
    const appToken = await container.orgRepo.getSettingValue('slack_app_token')

    if (botToken && appToken && container.consumerRegistry.has('slack')) {
      const plugin = container.consumerRegistry.get('slack')
      await plugin.start({
        onMessage: async (msg: IncomingMessage) => {
          const result = await container.executeQueryUseCase.execute(msg.channel, msg.query, {
            consumerType: msg.consumerType,
            channel: msg.channel,
            userId: msg.userId,
            userName: msg.userName,
            sessionId: msg.threadId,
          })
          return { answer: result.answer, conversationId: result.conversationId || '' }
        },
        onError: (err: Error) => log.error({ error: err.message }, 'Consumer error'),
        logger: log,
        getWorkspaceForChannel: async (channelId: string): Promise<Workspace | null> => {
          const consumers = await container.workspaceRepo.findActiveSlackConsumers()
          for (const row of consumers) {
            const cfg = typeof row.config === 'string' ? JSON.parse(row.config) : row.config
            if ((cfg.channels || []).includes(channelId)) return { id: row.workspace_id, name: '' }
          }
          return null
        },
      }, { bot_token: botToken, app_token: appToken })

      container.posterRegistry.register('slack', async (target, text) => {
        const threadTs = target.externalThreadId?.split(':')[1]
        if (target.channel && threadTs) await plugin.sendMessage(target.channel, text, threadTs)
      })
      log.info('Slack consumer started via plugin')
    } else {
      log.info('Slack bot not configured — set tokens in Settings > Integrations')
    }
  } catch (err) {
    log.warn({ error: (err as Error).message }, 'Slack consumer failed — server continues without it')
  }
}

export async function startWorkers(container: Container): Promise<void> {
  await container.queueService.startWorkers(container.lifecycleUseCase)
}
