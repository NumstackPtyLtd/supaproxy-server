import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import { logError } from '../lib/logger';
import type { FetchState, MutationState } from '../types/state';

// ─── Constants ──────────────────────────────────────────────────────────────────

const QUEUE_REFRESH_MS = 5000;

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface OrgData {
  id: string;
  name: string;
  slug: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  org_role: string;
  created_at: string;
}

export interface OrgSettingsData {
  slack_bot_token: string;
  slack_app_token: string;
  ai_api_key: string;
  anthropic_api_key?: string;
}

export interface SettingsFormState {
  orgName: string;
  slackBotToken: string;
  slackAppToken: string;
  aiProviderKey: string;
}

export interface QueueInfo {
  name: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface FailedJob {
  id: string | number;
  failedReason: string;
  attemptsMade: number;
  data?: { conversationId?: string };
}

interface SlackTestSuccess {
  bot_name?: string;
  team?: string;
}

interface SlackTestError {
  error?: string;
}

interface RetryAllResponse {
  retried: number;
}

// ─── Hook return types ──────────────────────────────────────────────────────────

export interface UseOrgSettingsReturn {
  /** Initial data load state */
  fetchState: FetchState<{ org: OrgData; users: OrgUser[] }>;
  /** Form state for settings fields */
  settings: SettingsFormState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsFormState>>;
  /** Mutation state for save/test actions */
  mutation: MutationState;
  /** Message to display after actions */
  message: string;
  clearMessage: () => void;
  /** Actions */
  saveGeneral: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;
  testSlack: () => Promise<void>;
}

export interface UseOrgQueuesReturn {
  queues: QueueInfo[];
  failedJobs: Record<string, FailedJob[]>;
  actionMsg: string;
  loadFailed: (name: string) => void;
  retryAll: (name: string) => Promise<void>;
  drain: (name: string) => Promise<void>;
}

// ─── useOrgSettings ─────────────────────────────────────────────────────────────

export function useOrgSettings(): UseOrgSettingsReturn {
  const [fetchState, setFetchState] = useState<FetchState<{ org: OrgData; users: OrgUser[] }>>({ status: 'loading' });
  const [settings, setSettings] = useState<SettingsFormState>({
    orgName: '',
    slackBotToken: '',
    slackAppToken: '',
    aiProviderKey: '',
  });
  const [mutation, setMutation] = useState<MutationState>({ status: 'idle' });
  const [message, setMessage] = useState('');

  const clearMessage = useCallback(() => setMessage(''), []);

  // Initial data load
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      api.org.get({ signal: controller.signal }),
      api.org.settings({ signal: controller.signal }),
      api.org.users({ signal: controller.signal }),
    ])
      .then(([orgData, settingsData, usersData]) => {
        if (controller.signal.aborted) return;
        const org = orgData.org;
        const users = usersData.users || [];
        setSettings({
          orgName: org?.name || '',
          slackBotToken: settingsData.settings?.slack_bot_token || '',
          slackAppToken: settingsData.settings?.slack_app_token || '',
          aiProviderKey: settingsData.settings?.ai_api_key || settingsData.settings?.anthropic_api_key || '',
        });
        setFetchState({ status: 'success', data: { org, users } });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        logError('Failed to load org settings:', err);
        setFetchState({ status: 'error', error: errorMsg });
      });

    return () => controller.abort();
  }, []);

  const saveGeneral = useCallback(async () => {
    setMutation({ status: 'submitting' });
    setMessage('');
    try {
      await api.org.update(settings.orgName);
      setMutation({ status: 'success' });
      setMessage('Saved.');
    } catch (err: unknown) {
      logError('Failed to save general settings:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach server.';
      setMutation({ status: 'error', message: msg });
      setMessage(msg);
    }
  }, [settings.orgName]);

  const saveSetting = useCallback(async (key: string, value: string) => {
    setMutation({ status: 'submitting' });
    setMessage('');
    try {
      await api.org.updateSetting(key, value);
      setMutation({ status: 'success' });
      setMessage(`${key.replace(/_/g, ' ')} saved.`);
    } catch (err: unknown) {
      logError(`Failed to save setting ${key}:`, err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach server.';
      setMutation({ status: 'error', message: msg });
      setMessage(msg);
    }
  }, []);

  const testSlack = useCallback(async () => {
    setMutation({ status: 'submitting' });
    setMessage('');
    try {
      const data = await api.org.testSlack(settings.slackBotToken);
      if ('error' in data && data.error) {
        setMutation({ status: 'error', message: data.error });
        setMessage(data.error);
        return;
      }
      const success = data as { bot_name: string; team: string };
      setMutation({ status: 'success' });
      setMessage(`Connected as ${success.bot_name} in ${success.team}`);
    } catch (err: unknown) {
      logError('Failed to test Slack connection:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach server.';
      setMutation({ status: 'error', message: msg });
      setMessage(msg);
    }
  }, [settings.slackBotToken]);

  return {
    fetchState,
    settings,
    setSettings,
    mutation,
    message,
    clearMessage,
    saveGeneral,
    saveSetting,
    testSlack,
  };
}

// ─── useOrgQueues ───────────────────────────────────────────────────────────────

export function useOrgQueues(): UseOrgQueuesReturn {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [failedJobs, setFailedJobs] = useState<Record<string, FailedJob[]>>({});
  const [actionMsg, setActionMsg] = useState('');

  const loadQueues = useCallback(() => {
    api.queues.list()
      .then(d => setQueues(d.queues || []))
      .catch((err: unknown) => logError('Failed to fetch queues:', err));
  }, []);

  useEffect(() => {
    loadQueues();
    const iv = setInterval(loadQueues, QUEUE_REFRESH_MS);
    return () => clearInterval(iv);
  }, [loadQueues]);

  const loadFailed = useCallback((name: string) => {
    api.queues.failed(name)
      .then(d => setFailedJobs(prev => ({ ...prev, [name]: d.jobs || [] })))
      .catch((err: unknown) => logError('Failed to fetch failed jobs:', err));
  }, []);

  const retryAll = useCallback(async (name: string) => {
    setActionMsg('');
    try {
      const d = await api.queues.retryAll(name);
      setActionMsg(`Retried ${d.retried} jobs`);
      loadQueues();
      loadFailed(name);
    } catch (err: unknown) {
      logError('Failed to retry jobs:', err);
      setActionMsg(err instanceof SupaProxyError ? err.message : 'Could not reach server.');
    }
  }, [loadQueues, loadFailed]);

  const drain = useCallback(async (name: string) => {
    setActionMsg('');
    try {
      await api.queues.drain(name);
      setActionMsg(`Queue ${name} drained`);
      loadQueues();
    } catch (err: unknown) {
      logError('Failed to drain queue:', err);
      setActionMsg(err instanceof SupaProxyError ? err.message : 'Could not reach server.');
    }
  }, [loadQueues]);

  return {
    queues,
    failedJobs,
    actionMsg,
    loadFailed,
    retryAll,
    drain,
  };
}
