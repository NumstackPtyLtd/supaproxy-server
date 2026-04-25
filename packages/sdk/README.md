# @supaproxy/sdk

> **Alpha** — This SDK is in early development. API surface may change without notice.

TypeScript client for the SupaProxy API.

## Limitations

- No automatic retry or exponential backoff
- No rate limit handling (429 responses)
- No request timeout configuration
- No response caching

## Usage

```typescript
import { SupaProxyClient } from '@supaproxy/sdk';

const client = new SupaProxyClient('http://localhost:3001');

const { workspaces } = await client.workspaces.list();
const detail = await client.workspaces.detail('ws-my-workspace');
const result = await client.workspaces.query('ws-my-workspace', { query: 'Hello' });
```

## License

MIT — see [LICENSE](../../LICENSE).
