import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/config';
import { logError } from '../lib/logger';
import type { ConversationData, ConversationMessage } from '../types/conversations';
import type { ConversationDetailResponse } from '@supaproxy/sdk';
import type { FetchState, MutationState } from '../types/state';
import { usePolling } from './usePolling';

const POLL_INTERVAL_MS = 3000;
const CLOSE_ANIMATION_MS = 200;

/** Map SDK stats to frontend ConversationStats */
function mapStats(s: ConversationDetailResponse['stats']): ConversationData['stats'] {
  if (!s) return null;
  return {
    conversation_id: s.conversation_id,
    stats_status: s.stats_status === 'failed' ? 'error' : s.stats_status,
    summary: s.summary,
    category: s.category,
    sentiment_score: s.sentiment_score ?? 0,
    resolution_status: s.resolution_status,
    duration_seconds: s.duration_seconds,
    total_cost_usd: String(s.total_cost_usd),
    total_tokens_input: s.total_tokens_input,
    total_tokens_output: s.total_tokens_output,
    tools_used: JSON.stringify(s.tools_used ?? []),
    compliance_violations: JSON.stringify(s.compliance_violations ?? []),
    knowledge_gaps: JSON.stringify(s.knowledge_gaps ?? []),
    fraud_indicators: JSON.stringify(s.fraud_indicators ?? []),
  };
}

/** Map SDK response to frontend ConversationData */
function mapConversationResponse(resp: ConversationDetailResponse): ConversationData {
  return {
    conversation: resp.conversation,
    messages: resp.messages.map((m): ConversationMessage => ({
      id: m.id,
      conversation_id: m.conversation_id,
      role: m.role,
      content: m.content,
      tools_called: m.tools_called ?? '',
      connections_hit: m.connections_hit ?? '',
      tokens_input: m.tokens_input ?? 0,
      tokens_output: m.tokens_output ?? 0,
      cost_usd: m.cost_usd != null ? String(m.cost_usd) : '0',
      duration_ms: m.duration_ms ?? 0,
      query_error: m.query_error,
      created_at: m.created_at,
    })),
    stats: mapStats(resp.stats),
  };
}

interface UseConversationDetailResult {
  /** Conversation fetch state */
  fetchState: FetchState<ConversationData>;
  /** Close-conversation mutation state */
  closeMutation: MutationState;
  /** Human-readable close status message for the banner */
  closeMessage: string;
  /** Trigger close + analyse on the conversation */
  closeConversation: () => Promise<void>;
  /** Slide-out animation duration constant */
  closeAnimationMs: typeof CLOSE_ANIMATION_MS;
}

export function useConversationDetail(
  workspaceId: string,
  conversationId: string,
): UseConversationDetailResult {
  const [fetchState, setFetchState] = useState<FetchState<ConversationData>>({ status: 'loading' });
  const [closeMutation, setCloseMutation] = useState<MutationState>({ status: 'idle' });
  const [closeMessage, setCloseMessage] = useState('');
  const [polling, setPolling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Initial fetch
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    setFetchState({ status: 'loading' });

    api.conversations.get(workspaceId, conversationId, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) {
          setFetchState({ status: 'success', data: mapConversationResponse(data) });
        }
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Failed to load conversation';
        setFetchState({ status: 'error', error: message });
      });

    return () => {
      controller.abort();
    };
  }, [workspaceId, conversationId]);

  // Poll for stats completion after closing
  usePolling(
    async () => {
      try {
        const fresh = mapConversationResponse(await api.conversations.get(workspaceId, conversationId));

        setFetchState({ status: 'success', data: fresh });

        if (fresh.stats?.stats_status === 'complete') {
          setCloseMessage('Analysis complete');
          setPolling(false);
          return true;
        }

        if (fresh.stats?.stats_status === 'error') {
          setCloseMessage('Analysis failed');
          setPolling(false);
          return true;
        }

        return false;
      } catch (err) {
        logError('Polling failed:', err);
        setCloseMessage('Failed to check status');
        setPolling(false);
        return true;
      }
    },
    POLL_INTERVAL_MS,
    polling,
  );

  const closeConversation = useCallback(async () => {
    setCloseMutation({ status: 'submitting' });
    setCloseMessage('');

    try {
      await api.conversations.close(workspaceId, conversationId);

      // Optimistically update local state to show closed status
      setFetchState(prev => {
        if (prev.status === 'success') {
          return {
            status: 'success',
            data: {
              ...prev.data,
              conversation: { ...prev.data.conversation, status: 'closed' },
            },
          };
        }
        return prev;
      });

      setCloseMutation({ status: 'success' });
      setCloseMessage('Closed — analysing conversation...');
      setPolling(true);
    } catch (err) {
      logError('Failed to close conversation:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to close';
      setCloseMutation({ status: 'error', message: errorMsg });
      setCloseMessage(errorMsg);
    }
  }, [workspaceId, conversationId]);

  return {
    fetchState,
    closeMutation,
    closeMessage,
    closeConversation,
    closeAnimationMs: CLOSE_ANIMATION_MS,
  };
}
