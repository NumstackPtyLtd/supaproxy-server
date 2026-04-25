/**
 * SupaProxy API client — typed SDK for all API interactions.
 *
 * @alpha This SDK is in early development. No retry, rate limiting, or
 * error recovery. API surface may change without notice.
 *
 * Usage:
 *   const client = new SupaProxyClient('http://localhost:3001');
 *   const workspaces = await client.workspaces.list();
 *   const conv = await client.conversations.get(wsId, convId);
 */

import type {
  HealthResponse, SessionResponse, SignupRequest, SignupResponse,
  OrgResponse, OrgSettingsResponse, OrgUsersResponse, ModelsResponse,
  WorkspaceListResponse, WorkspaceSummaryResponse, WorkspaceDetailResponse,
  ConnectionsResponse, McpTestResponse, SaveConnectionResponse,
  ConsumersResponse, KnowledgeResponse, ComplianceResponse,
  ConversationListResponse, ConversationDetailResponse, CloseConversationResponse,
  DashboardResponse, QueryRequest, QueryResponse, QueuesResponse,
  StatusResponse, ErrorResponse,
} from '@supaproxy/shared';

export interface ClientOptions {
  baseUrl: string;
  credentials?: RequestCredentials;
  headers?: Record<string, string>;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export class SupaProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'SupaProxyError';
  }
}

export class SupaProxyClient {
  private baseUrl: string;
  private credentials: RequestCredentials;
  private headers: Record<string, string>;

  public auth: AuthAPI;
  public org: OrgAPI;
  public workspaces: WorkspacesAPI;
  public connections: ConnectionsAPI;
  public conversations: ConversationsAPI;
  public connectors: ConnectorsAPI;
  public queues: QueuesAPI;

  constructor(options: ClientOptions | string) {
    const opts = typeof options === 'string' ? { baseUrl: options } : options;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.credentials = opts.credentials ?? 'include';
    this.headers = opts.headers ?? {};

    this.auth = new AuthAPI(this);
    this.org = new OrgAPI(this);
    this.workspaces = new WorkspacesAPI(this);
    this.connections = new ConnectionsAPI(this);
    this.conversations = new ConversationsAPI(this);
    this.connectors = new ConnectorsAPI(this);
    this.queues = new QueuesAPI(this);
  }

  async request<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      credentials: this.credentials,
      headers: {
        ...this.headers,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options?.signal ? { signal: options.signal } : {}),
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const err = await res.json() as ErrorResponse;
        message = err.error || message;
      } catch {}
      throw new SupaProxyError(res.status, message);
    }

    if (res.status === 204) return {} as T;
    return res.json() as Promise<T>;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> { return this.request<T>('GET', path, undefined, options); }
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> { return this.request<T>('POST', path, body, options); }
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> { return this.request<T>('PUT', path, body, options); }
  delete<T>(path: string, options?: RequestOptions): Promise<T> { return this.request<T>('DELETE', path, undefined, options); }

  async health(options?: RequestOptions): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health', options);
  }
}

// ── Auth ──

class AuthAPI {
  constructor(private client: SupaProxyClient) {}

  session(): Promise<SessionResponse> {
    return this.client.get('/api/auth/session');
  }

  signup(data: SignupRequest): Promise<SignupResponse> {
    return this.client.post('/api/signup', data);
  }

  logoutUrl(): string {
    return `${(this.client as any).baseUrl}/api/auth/logout`;
  }
}

// ── Organisation ──

class OrgAPI {
  constructor(private client: SupaProxyClient) {}

  get(options?: RequestOptions): Promise<OrgResponse> {
    return this.client.get('/api/org', options);
  }

  update(name: string): Promise<StatusResponse> {
    return this.client.put('/api/org', { name });
  }

  settings(options?: RequestOptions): Promise<OrgSettingsResponse> {
    return this.client.get('/api/org/settings', options);
  }

  updateSetting(key: string, value: string): Promise<StatusResponse> {
    return this.client.put(`/api/org/settings/${key}`, { value });
  }

  testSlack(botToken: string): Promise<{ bot_name: string; team: string } | ErrorResponse> {
    return this.client.post('/api/org/integrations/slack/test', { bot_token: botToken });
  }

  users(options?: RequestOptions): Promise<OrgUsersResponse> {
    return this.client.get('/api/org/users', options);
  }

  models(options?: RequestOptions): Promise<ModelsResponse> {
    return this.client.get('/api/models', options);
  }
}

// ── Workspaces ──

class WorkspacesAPI {
  constructor(private client: SupaProxyClient) {}

  list(): Promise<WorkspaceListResponse> {
    return this.client.get('/api/workspaces');
  }

  summary(id: string, options?: RequestOptions): Promise<WorkspaceSummaryResponse> {
    return this.client.get(`/api/workspaces/${id}/summary`, options);
  }

  detail(id: string, options?: RequestOptions): Promise<WorkspaceDetailResponse> {
    return this.client.get(`/api/workspaces/${id}`, options);
  }

  create(data: { name: string; team_id?: string; team_name?: string; system_prompt?: string }): Promise<{ id: string; name: string }> {
    return this.client.post('/api/workspaces', data);
  }

  update(id: string, data: { name?: string; model?: string; system_prompt?: string; cold_timeout_minutes?: number; close_timeout_minutes?: number }): Promise<StatusResponse> {
    return this.client.put(`/api/workspaces/${id}`, data);
  }

  dashboard(id: string, options?: RequestOptions): Promise<DashboardResponse> {
    return this.client.get(`/api/workspaces/${id}/dashboard`, options);
  }

  connections(id: string, options?: RequestOptions): Promise<ConnectionsResponse> {
    return this.client.get(`/api/workspaces/${id}/connections`, options);
  }

  consumers(id: string, options?: RequestOptions): Promise<ConsumersResponse> {
    return this.client.get(`/api/workspaces/${id}/consumers`, options);
  }

  knowledge(id: string, options?: RequestOptions): Promise<KnowledgeResponse> {
    return this.client.get(`/api/workspaces/${id}/knowledge`, options);
  }

  compliance(id: string, options?: RequestOptions): Promise<ComplianceResponse> {
    return this.client.get(`/api/workspaces/${id}/compliance`, options);
  }

  query(id: string, data: QueryRequest): Promise<QueryResponse> {
    return this.client.post(`/api/workspaces/${id}/query`, data);
  }
}

// ── Connections ──

class ConnectionsAPI {
  constructor(private client: SupaProxyClient) {}

  delete(connectionId: string): Promise<StatusResponse> {
    return this.client.delete(`/api/connections/${connectionId}`);
  }
}

// ── Conversations ──

class ConversationsAPI {
  constructor(private client: SupaProxyClient) {}

  list(workspaceId: string, params?: { limit?: number; offset?: number; status?: string; category?: string; resolution?: string; consumer?: string }, options?: RequestOptions): Promise<ConversationListResponse> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.status) qs.set('status', params.status);
    if (params?.category) qs.set('category', params.category);
    if (params?.resolution) qs.set('resolution', params.resolution);
    if (params?.consumer) qs.set('consumer', params.consumer);
    const q = qs.toString();
    return this.client.get(`/api/workspaces/${workspaceId}/conversations${q ? `?${q}` : ''}`, options);
  }

  get(workspaceId: string, conversationId: string, options?: RequestOptions): Promise<ConversationDetailResponse> {
    return this.client.get(`/api/workspaces/${workspaceId}/conversations/${conversationId}`, options);
  }

  close(workspaceId: string, conversationId: string): Promise<CloseConversationResponse> {
    return this.client.post(`/api/workspaces/${workspaceId}/conversations/${conversationId}/close`);
  }
}

// ── Connectors ──

class ConnectorsAPI {
  constructor(private client: SupaProxyClient) {}

  testMcp(data: { transport: string; url?: string; command?: string; args?: string[] }): Promise<McpTestResponse> {
    return this.client.post('/api/connectors/mcp/test', data);
  }

  addMcp(data: { workspace_id: string; name: string; transport: string; url?: string; command?: string; args?: string[] }): Promise<SaveConnectionResponse> {
    return this.client.post('/api/connectors/mcp', data);
  }

  addSlackChannel(data: { workspace_id: string; channel_id: string; channel_name?: string }): Promise<StatusResponse> {
    return this.client.post('/api/connectors/slack-channel', data);
  }

  connectSlack(data: { workspace_id: string; bot_token: string; app_token: string; channel_id?: string }): Promise<StatusResponse> {
    return this.client.post('/api/connectors/slack', data);
  }
}

// ── Queues ──

class QueuesAPI {
  constructor(private client: SupaProxyClient) {}

  list(): Promise<QueuesResponse> {
    return this.client.get('/api/org/queues');
  }

  failed(name: string): Promise<{ jobs: Array<{ id: string | number; failedReason: string; attemptsMade: number; data?: { conversationId?: string } }> }> {
    return this.client.get(`/api/org/queues/${name}/failed`);
  }

  retryAll(name: string): Promise<StatusResponse & { retried?: number }> {
    return this.client.post(`/api/org/queues/${name}/retry-all`);
  }

  drain(name: string): Promise<StatusResponse> {
    return this.client.post(`/api/org/queues/${name}/drain`);
  }
}
