import { useState, useCallback } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import type { McpFormData, McpTestResult, ConnectionFlowState } from '../types/connections';

interface QueryResponse {
  answer: string;
}

interface UseMcpConnectionResult {
  form: McpFormData;
  updateForm: (updates: Partial<McpFormData>) => void;
  flowState: ConnectionFlowState;
  test: () => Promise<void>;
  save: (workspaceId: string) => Promise<void>;
  tryQuery: string;
  setTryQuery: (q: string) => void;
  tryAnswer: string;
  tryLoading: boolean;
  tryIt: (workspaceId: string) => Promise<void>;
}

const INITIAL_FORM: McpFormData = {
  name: '',
  transport: 'http',
  url: '',
  command: '',
  args: '',
};

function buildPayload(form: McpFormData): Record<string, unknown> {
  if (form.transport === 'http') {
    return {
      name: form.name,
      transport: form.transport,
      url: form.url,
    };
  }

  return {
    name: form.name,
    transport: form.transport,
    command: form.command,
    args: form.args
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function validateForm(form: McpFormData): string | null {
  if (!form.name.trim()) {
    return 'Name is required';
  }

  if (form.transport === 'http' && !form.url.trim()) {
    return 'URL is required for HTTP transport';
  }

  if (form.transport === 'stdio' && !form.command.trim()) {
    return 'Command is required for stdio transport';
  }

  return null;
}

export function useMcpConnection(): UseMcpConnectionResult {
  const [form, setForm] = useState<McpFormData>(INITIAL_FORM);
  const [flowState, setFlowState] = useState<ConnectionFlowState>({ status: 'idle' });
  const [tryQuery, setTryQuery] = useState('');
  const [tryAnswer, setTryAnswer] = useState('');
  const [tryLoading, setTryLoading] = useState(false);

  const updateForm = useCallback((updates: Partial<McpFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  const test = useCallback(async () => {
    const error = validateForm(form);
    if (error) {
      setFlowState({ status: 'test-failed', error });
      return;
    }

    setFlowState({ status: 'testing' });

    try {
      const payload = buildPayload(form);
      const result = await api.connectors.testMcp(payload as { transport: string; url?: string; command?: string; args?: string[] }) as unknown as McpTestResult;

      if (result.ok) {
        setFlowState({ status: 'test-passed', result });
      } else {
        setFlowState({
          status: 'test-failed',
          error: result.error ?? 'Test failed',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof SupaProxyError ? err.message : err instanceof Error ? err.message : 'Connection test failed';
      setFlowState({ status: 'test-failed', error: message });
    }
  }, [form]);

  const save = useCallback(
    async (workspaceId: string) => {
      const error = validateForm(form);
      if (error) {
        setFlowState({ status: 'error', message: error });
        return;
      }

      setFlowState({ status: 'saving' });

      try {
        const payload = buildPayload(form);
        const result = await api.connectors.addMcp({
          ...payload as { name: string; transport: string; url?: string; command?: string; args?: string[] },
          workspace_id: workspaceId,
        }) as unknown as McpTestResult;
        setFlowState({ status: 'saved', result });
      } catch (err: unknown) {
        const message = err instanceof SupaProxyError ? err.message : err instanceof Error ? err.message : 'Failed to save connection';
        setFlowState({ status: 'error', message });
      }
    },
    [form],
  );

  const tryIt = useCallback(
    async (workspaceId: string) => {
      if (!tryQuery.trim()) return;

      setTryLoading(true);
      setTryAnswer('');

      try {
        const data = await api.workspaces.query(workspaceId, { query: tryQuery });
        setTryAnswer(data.answer || '');
      } catch (err: unknown) {
        const message = err instanceof SupaProxyError ? err.message : err instanceof Error ? err.message : 'Query failed';
        setTryAnswer(`Error: ${message}`);
      } finally {
        setTryLoading(false);
      }
    },
    [tryQuery],
  );

  return {
    form,
    updateForm,
    flowState,
    test,
    save,
    tryQuery,
    setTryQuery,
    tryAnswer,
    tryLoading,
    tryIt,
  };
}
