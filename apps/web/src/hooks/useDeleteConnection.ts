import { useState, useCallback } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import { logError } from '../lib/logger';
import type { MutationState } from '../types/state';

interface UseDeleteConnectionReturn {
  deleteState: MutationState;
  deleteConnection: (connectionId: string) => Promise<boolean>;
}

export function useDeleteConnection(onSuccess: () => void): UseDeleteConnectionReturn {
  const [deleteState, setDeleteState] = useState<MutationState>({ status: 'idle' });

  const deleteConnection = useCallback(async (connectionId: string): Promise<boolean> => {
    setDeleteState({ status: 'submitting' });
    try {
      await api.connections.delete(connectionId);
      setDeleteState({ status: 'success' });
      onSuccess();
      return true;
    } catch (err) {
      logError('Failed to delete connection:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach the server.';
      setDeleteState({ status: 'error', message: msg });
      return false;
    }
  }, [onSuccess]);

  const reset = useCallback(() => {
    setDeleteState({ status: 'idle' });
  }, []);

  return { deleteState, deleteConnection };
}
