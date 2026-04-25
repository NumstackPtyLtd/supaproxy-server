import { useState, useCallback } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import { logError } from '../lib/logger';
import type { MutationState } from '../types/state';
import type { Workspace } from '../components/workspace/types';

interface SettingsForm {
  name: string;
  model: string;
  prompt: string;
  coldTimeout: number;
  closeTimeout: number;
}

interface SettingsFormSetters {
  setName: (v: string) => void;
  setModel: (v: string) => void;
  setPrompt: (v: string) => void;
  setColdTimeout: (v: number) => void;
  setCloseTimeout: (v: number) => void;
}

interface SaveErrorResponse {
  error?: string;
}

interface UseWorkspaceSettingsReturn {
  form: SettingsForm;
  setters: SettingsFormSetters;
  saveState: MutationState;
  message: string;
  saveSettings: () => Promise<void>;
}

export function useWorkspaceSettings(workspace: Workspace, workspaceId: string): UseWorkspaceSettingsReturn {
  const [name, setName] = useState(workspace.name);
  const [model, setModel] = useState(workspace.model);
  const [prompt, setPrompt] = useState(workspace.system_prompt || '');
  const [coldTimeout, setColdTimeout] = useState(workspace.cold_timeout_minutes || 30);
  const [closeTimeout, setCloseTimeout] = useState(workspace.close_timeout_minutes || 60);
  const [saveState, setSaveState] = useState<MutationState>({ status: 'idle' });
  const [message, setMessage] = useState('');

  const saveSettings = useCallback(async () => {
    setSaveState({ status: 'submitting' });
    setMessage('');

    try {
      await api.workspaces.update(workspaceId, {
        name,
        model,
        system_prompt: prompt,
        cold_timeout_minutes: coldTimeout,
        close_timeout_minutes: closeTimeout,
      });
      setMessage('Saved.');
      setSaveState({ status: 'success' });
    } catch (err) {
      logError('Failed to save settings:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach server.';
      setMessage(msg);
      setSaveState({ status: 'error', message: msg });
    }
  }, [workspaceId, name, model, prompt, coldTimeout, closeTimeout]);

  return {
    form: { name, model, prompt, coldTimeout, closeTimeout },
    setters: { setName, setModel, setPrompt, setColdTimeout, setCloseTimeout },
    saveState,
    message,
    saveSettings,
  };
}
