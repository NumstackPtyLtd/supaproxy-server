import { useState, useCallback } from 'react';
import { api } from '../lib/config';
import { SupaProxyError } from '@supaproxy/sdk';
import { logError } from '../lib/logger';
import type { MutationState } from '../types/state';

const REDIRECT_DELAY_MS = 1500;

interface SetupFormData {
  orgName: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  wsName: string;
  wsTeam: string;
}

interface SetupFormSetters {
  setOrgName: (v: string) => void;
  setAdminName: (v: string) => void;
  setAdminEmail: (v: string) => void;
  setAdminPassword: (v: string) => void;
  setWsName: (v: string) => void;
  setWsTeam: (v: string) => void;
}

interface SignupResponse {
  workspace_id: string;
}

interface SignupErrorResponse {
  error?: string;
}

interface UseSetupReturn {
  step: number;
  form: SetupFormData;
  setters: SetupFormSetters;
  submitState: MutationState;
  validationError: string;
  next: () => void;
  finish: () => Promise<void>;
}

export function useSetup(): UseSetupReturn {
  const [step, setStep] = useState(0);
  const [submitState, setSubmitState] = useState<MutationState>({ status: 'idle' });
  const [validationError, setValidationError] = useState('');

  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [wsName, setWsName] = useState('');
  const [wsTeam, setWsTeam] = useState('');

  const validate = useCallback((s: number): boolean => {
    setValidationError('');
    if (s === 0 && !orgName) { setValidationError('Enter an organisation name.'); return false; }
    if (s === 1) {
      if (!adminName || !adminEmail || !adminPassword) { setValidationError('All fields are required.'); return false; }
      if (adminPassword.length < 8) { setValidationError('Password must be at least 8 characters.'); return false; }
    }
    if (s === 2 && (!wsName || !wsTeam)) { setValidationError('Workspace name and team are required.'); return false; }
    return true;
  }, [orgName, adminName, adminEmail, adminPassword, wsName, wsTeam]);

  const next = useCallback(() => {
    if (validate(step)) setStep(step + 1);
  }, [validate, step]);

  const finish = useCallback(async () => {
    if (!validate(2)) return;
    setSubmitState({ status: 'submitting' });
    setValidationError('');

    try {
      const data = await api.auth.signup({
        org_name: orgName,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        workspace_name: wsName,
        team_name: wsTeam,
      });
      setSubmitState({ status: 'success' });
      setStep(3);
      setTimeout(() => { window.location.href = `/workspaces/${data.workspace_id}`; }, REDIRECT_DELAY_MS);
    } catch (err) {
      logError('Setup wizard failed:', err);
      const msg = err instanceof SupaProxyError ? err.message : 'Could not reach the server.';
      setValidationError(msg);
      setSubmitState({ status: 'error', message: msg });
    }
  }, [orgName, adminName, adminEmail, adminPassword, wsName, wsTeam, validate]);

  return {
    step,
    form: { orgName, adminName, adminEmail, adminPassword, wsName, wsTeam },
    setters: { setOrgName, setAdminName, setAdminEmail, setAdminPassword, setWsName, setWsTeam },
    submitState,
    validationError,
    next,
    finish,
  };
}
