import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/config';
import { logError, logWarn } from '../lib/logger';
import type { FetchState } from '../types/state';
import type { ConversationWithStats } from '@supaproxy/sdk';
import type {
  Section,
  Workspace,
  Conversation as FEConversation,
  SetupStatus,
  ModelOption,
  SectionDataMap,
} from '../components/workspace/types';

/** Map SDK ConversationWithStats to frontend Conversation */
function mapConversations(convos: ConversationWithStats[]): FEConversation[] {
  return convos.map(c => ({
    id: c.id,
    status: c.status,
    consumer_type: c.consumer_type,
    user_name: c.user_name ?? undefined,
    summary: c.summary ?? undefined,
    message_count: c.message_count,
    category: c.category ?? undefined,
    sentiment_score: c.sentiment_score ?? undefined,
    total_cost_usd: c.total_cost_usd != null ? String(c.total_cost_usd) : undefined,
    last_activity_at: c.last_activity_at ?? undefined,
  }));
}

interface WorkspaceDataReturn {
  workspace: FetchState<Workspace>;
  models: FetchState<ModelOption[]>;
  setupStatus: SetupStatus | null;
  sectionState: FetchState<SectionDataMap[Section]>;
  availableFilters: Record<string, string[]>;
  refetchSection: () => void;
}

export function useWorkspaceData(
  workspaceId: string,
  section: Section,
  activityLimit: number,
  activeFilters: Record<string, string>,
): WorkspaceDataReturn {
  const [workspace, setWorkspace] = useState<FetchState<Workspace>>({ status: 'loading' });
  const [models, setModels] = useState<FetchState<ModelOption[]>>({ status: 'idle' });
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [sectionState, setSectionState] = useState<FetchState<SectionDataMap[Section]>>({ status: 'loading' });
  const [availableFilters, setAvailableFilters] = useState<Record<string, string[]>>({});

  const [refetchCount, setRefetchCount] = useState(0);
  const refetchSection = useCallback(() => setRefetchCount(c => c + 1), []);

  // Fetch models once
  useEffect(() => {
    const controller = new AbortController();
    setModels({ status: 'loading' });
    api.org.models({ signal: controller.signal })
      .then(d => setModels({ status: 'success', data: d.models || [] }))
      .catch(err => {
        if (!controller.signal.aborted) {
          logError('Failed to fetch models:', err);
          setModels({ status: 'error', error: String(err) });
        }
      });
    return () => controller.abort();
  }, []);

  // Check health / setup status once
  useEffect(() => {
    const controller = new AbortController();
    api.health({ signal: controller.signal })
      .then(d => setSetupStatus({ ai_configured: d.ai_configured, connections: d.connections }))
      .catch(err => {
        if (!controller.signal.aborted) {
          logWarn('Health check failed:', err);
        }
      });
    return () => controller.abort();
  }, []);

  // Load workspace summary
  useEffect(() => {
    const controller = new AbortController();
    setWorkspace({ status: 'loading' });
    api.workspaces.summary(workspaceId, { signal: controller.signal })
      .then(d => {
        const { system_prompt, team, ...rest } = d.workspace;
        const ws: Workspace = {
          ...rest,
          system_prompt: system_prompt ?? undefined,
          team: team ?? undefined,
        };
        setWorkspace({ status: 'success', data: ws });
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          logError('Failed to load workspace:', err);
          setWorkspace({ status: 'error', error: String(err) });
        }
      });
    return () => controller.abort();
  }, [workspaceId]);

  // Load section-specific data
  const activeFiltersRef = useRef(activeFilters);
  activeFiltersRef.current = activeFilters;

  useEffect(() => {
    const controller = new AbortController();
    setSectionState({ status: 'loading' });
    const opts = { signal: controller.signal };
    const filters = activeFiltersRef.current;

    const sectionFetchers: Record<Section, () => Promise<SectionDataMap[Section]>> = {
      overview: () => api.workspaces.dashboard(workspaceId, opts).then(d => ({
        ...d,
        recent_conversations: mapConversations(d.recent_conversations),
      })) as Promise<SectionDataMap['overview']>,
      connections: () => api.workspaces.connections(workspaceId, opts) as Promise<SectionDataMap['connections']>,
      consumers: () => api.workspaces.consumers(workspaceId, opts) as Promise<SectionDataMap['consumers']>,
      knowledge: () => api.workspaces.knowledge(workspaceId, opts) as Promise<SectionDataMap['knowledge']>,
      compliance: () => api.workspaces.compliance(workspaceId, opts) as Promise<SectionDataMap['compliance']>,
      observability: () => api.conversations.list(workspaceId, {
        limit: activityLimit,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      }, opts).then(d => ({
        ...d,
        conversations: mapConversations(d.conversations),
      })) as Promise<SectionDataMap['observability']>,
      settings: () => api.workspaces.summary(workspaceId, opts) as Promise<SectionDataMap['settings']>,
    };

    sectionFetchers[section]()
      .then(d => {
        setSectionState({ status: 'success', data: d });
        const maybeFilters = (d as Record<string, unknown>).filters;
        if (maybeFilters) {
          setAvailableFilters(maybeFilters as Record<string, string[]>);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          logError(`Failed to load ${section}:`, err);
          setSectionState({ status: 'error', error: String(err) });
        }
      });

    return () => controller.abort();
  }, [section, workspaceId, activityLimit, activeFilters, refetchCount]);

  return {
    workspace,
    models,
    setupStatus,
    sectionState,
    availableFilters,
    refetchSection,
  };
}
