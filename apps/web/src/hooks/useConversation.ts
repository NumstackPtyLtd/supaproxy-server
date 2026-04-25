import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/config';
import { logError } from '../lib/logger';
import type { ConversationData, ConversationMessage } from '../types/conversations';
import type { ConversationDetailResponse } from '@supaproxy/sdk';
import type { FetchState } from '../types/state';
import { usePolling } from './usePolling';

const POLL_INTERVAL_MS = 3000;

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

interface UseConversationResult {
  state: FetchState<ConversationData>;
  wsName: string;
  reload: () => void;
  closeConversation: () => Promise<void>;
  closeStatus: string;
}

export function useConversation(
  workspaceId: string,
  conversationId: string,
): UseConversationResult {
  const [state, setState] = useState<FetchState<ConversationData>>({ status: 'idle' });
  const [wsName, setWsName] = useState('');
  const [closeStatus, setCloseStatus] = useState('');
  const [polling, setPolling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      setState({ status: 'loading' });

      try {
        const [conversationData, wsDetail] = await Promise.all([
          api.conversations.get(workspaceId, conversationId, { signal }).then(mapConversationResponse),
          api.workspaces.detail(workspaceId, { signal }),
        ]);

        if (signal?.aborted) return;

        setState({ status: 'success', data: conversationData });
        setWsName(wsDetail.workspace.name);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message = err instanceof Error ? err.message : 'Failed to load conversation';
        setState({ status: 'error', error: message });
      }
    },
    [workspaceId, conversationId],
  );

  // Initial fetch
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    fetchData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchData]);

  const reload = useCallback(() => {
    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    fetchData(controller.signal);
  }, [fetchData]);

  // Poll for stats completion after closing
  usePolling(
    async () => {
      try {
        const data = mapConversationResponse(await api.conversations.get(workspaceId, conversationId));

        setState({ status: 'success', data });

        if (data.stats?.stats_status === 'complete') {
          setCloseStatus('Analysis complete');
          setPolling(false);
          return true;
        }

        if (data.stats?.stats_status === 'error') {
          setCloseStatus('Failed');
          setPolling(false);
          return true;
        }

        return false;
      } catch (err) {
        logError('Poll conversation error:', err);
        setCloseStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setPolling(false);
        return true;
      }
    },
    POLL_INTERVAL_MS,
    polling,
  );

  const closeConversation = useCallback(async () => {
    await api.conversations.close(workspaceId, conversationId);
    setCloseStatus('Closed \u2014 analysing...');
    setPolling(true);
  }, [workspaceId, conversationId]);

  return { state, wsName, reload, closeConversation, closeStatus };
}
