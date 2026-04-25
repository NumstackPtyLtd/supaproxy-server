import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import { logError } from '../lib/logger';
import type { FetchState, MutationState } from '../types/state';

const SUCCESS_CLOSE_DELAY_MS = 1200;

interface UseAddConsumerResult {
  /** Whether the Slack bot token is configured at org level */
  slackEnabled: FetchState<boolean>;
  /** Save mutation state */
  saveMutation: MutationState;
  /** Success message from the server */
  successMessage: string;
  /** Error message */
  errorMessage: string;
  /** Set a local validation error */
  setError: (msg: string) => void;
  /** Clear error state */
  clearError: () => void;
  /** Save a Slack channel binding */
  saveSlackChannel: (params: {
    channelId: string;
    channelName: string;
  }) => Promise<void>;
}

export function useAddConsumer(
  workspaceId: string,
  onSaved: () => void,
  onClose: () => void,
): UseAddConsumerResult {
  const [slackEnabled, setSlackEnabled] = useState<FetchState<boolean>>({ status: 'loading' });
  const [saveMutation, setSaveMutation] = useState<MutationState>({ status: 'idle' });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load org settings to check Slack bot configuration
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    api.org.settings({ signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) {
          setSlackEnabled({ status: 'success', data: !!data.configured?.slack_bot_token });
        }
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        logError('Failed to load org settings:', err);
        setSlackEnabled({ status: 'success', data: false });
      });

    return () => {
      controller.abort();
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const setError = useCallback((msg: string) => {
    setErrorMessage(msg);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage('');
  }, []);

  const saveSlackChannel = useCallback(async (params: {
    channelId: string;
    channelName: string;
  }) => {
    if (!params.channelId) {
      setErrorMessage('Channel ID is required.');
      return;
    }

    setSaveMutation({ status: 'submitting' });
    setErrorMessage('');

    try {
      await api.connectors.addSlackChannel({
        workspace_id: workspaceId,
        channel_id: params.channelId,
        channel_name: params.channelName || `#${params.channelId}`,
      });

      setSaveMutation({ status: 'success' });
      setSuccessMessage('Consumer added.');

      closeTimerRef.current = setTimeout(() => {
        onSaved();
        onClose();
      }, SUCCESS_CLOSE_DELAY_MS);
    } catch (err) {
      logError('Failed to save Slack channel:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach the server.';
      setSaveMutation({ status: 'error', message: msg });
      setErrorMessage(msg);
    }
  }, [workspaceId, onSaved, onClose]);

  return {
    slackEnabled,
    saveMutation,
    successMessage,
    errorMessage,
    setError,
    clearError,
    saveSlackChannel,
  };
}
