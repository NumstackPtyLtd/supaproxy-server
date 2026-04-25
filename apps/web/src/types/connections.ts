export type McpTransport = 'http' | 'stdio';

export interface McpFormData {
  name: string;
  transport: McpTransport;
  url: string;
  command: string;
  args: string;
}

export interface McpTestResult {
  ok: boolean;
  tools?: number;
  toolNames?: string[];
  error?: string;
}

export type ConnectionFlowState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'test-passed'; result: McpTestResult }
  | { status: 'test-failed'; error: string }
  | { status: 'saving' }
  | { status: 'saved'; result: McpTestResult }
  | { status: 'error'; message: string };
