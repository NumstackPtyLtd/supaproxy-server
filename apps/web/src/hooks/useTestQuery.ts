import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import { logError } from '../lib/logger';
import type { ChatMessage } from '../components/workspace/types';
import type { MutationState } from '../types/state';

const SCROLL_DELAY_MS = 100;

interface QueryResponse {
  answer?: string;
  error?: string;
  tools_called?: string[];
  connections_hit?: string[];
  tokens?: { input: number; output: number };
  cost_usd?: number;
  duration_ms?: number;
}

interface UseTestQueryReturn {
  conversation: ChatMessage[];
  queryInput: string;
  setQueryInput: (value: string) => void;
  clearConversation: () => void;
  sendQuery: () => Promise<void>;
  queryState: MutationState;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export function useTestQuery(workspaceId: string): UseTestQueryReturn {
  const [queryInput, setQueryInput] = useState('');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [queryState, setQueryState] = useState<MutationState>({ status: 'idle' });
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const clearConversation = useCallback(() => {
    setConversation([]);
  }, []);

  const sendQuery = useCallback(async () => {
    const q = queryInput.trim();
    if (!q || queryState.status === 'submitting') return;

    setQueryInput('');
    setConversation(prev => [...prev, { role: 'user', content: q }]);
    setQueryState({ status: 'submitting' });

    try {
      const d = await api.workspaces.query(workspaceId, { query: q });
      setConversation(prev => [...prev, {
        role: 'assistant',
        content: d.answer || d.error || 'No response.',
        meta: {
          tools: d.tools_called,
          connections: d.connections_hit,
          tokens: d.tokens,
          cost: d.cost_usd,
          duration: d.duration_ms,
        },
      }]);
      setQueryState({ status: 'success' });
    } catch (err) {
      logError('Query request failed:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach the server.';
      setConversation(prev => [...prev, { role: 'assistant', content: msg }]);
      setQueryState({ status: 'error', message: msg });
    }

    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), SCROLL_DELAY_MS);
  }, [queryInput, queryState.status, conversation, workspaceId]);

  return {
    conversation,
    queryInput,
    setQueryInput,
    clearConversation,
    sendQuery,
    queryState,
    chatEndRef,
  };
}
