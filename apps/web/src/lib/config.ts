import { SupaProxyClient } from '@supaproxy/sdk';

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Set it in .env or .env.local`);
  }
  return value;
}

export const API_URL = requireEnv('PUBLIC_SUPAPROXY_API_URL');

/**
 * Shared SDK client instance — use this for all API calls from React hooks.
 *
 * Usage:
 *   import { api } from '../lib/config';
 *   const data = await api.workspaces.list();
 */
export const api = new SupaProxyClient(API_URL);
