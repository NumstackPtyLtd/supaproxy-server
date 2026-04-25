# Deploy to Production

Moving SupaProxy from a development environment to a shared production setup. This guide covers containerised deployment -- orchestrators and cloud hosting follow the same principles.

## What needs to run

| Service | Port | Purpose |
|---|---|---|
| Backend API | 3001 | API, auth, agent loop, workspace registry |
| Frontend dashboard | 4322 | Dashboard, docs, login |
| Database | 3306 | Users, sessions, audit logs |

In production, the frontend builds to static + SSR and runs as a Node process. The backend runs as a standalone Node process.

## Environment variables

```bash
# Backend
PORT=3001
DB_HOST=reclaim-db
DB_PORT=3306
DB_USER=reclaim
DB_PASSWORD=strong-password-here
DB_NAME=reclaim
JWT_SECRET=generate-a-long-random-string
AI_PROVIDER_KEY=your-ai-provider-api-key

# Frontend
SUPAPROXY_API_URL=https://api.example.com
```

## Container deployment (staging)

```yaml
services:
  database:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: strong-password
      MYSQL_DATABASE: reclaim
    volumes:
      - db-data:/var/lib/mysql

  backend:
    image: reclaim-backend:latest
    ports: ["3001:3001"]
    environment:
      DB_HOST: database
      DB_PORT: 3306
      JWT_SECRET: your-jwt-secret
      AI_PROVIDER_KEY: your-ai-provider-key
    depends_on: [database]

  frontend:
    image: reclaim-frontend:latest
    ports: ["4322:4322"]
    environment:
      SUPAPROXY_API_URL: http://backend:3001

volumes:
  db-data:
```

## Security checklist

- **JWT_SECRET**: must be a long random string in production. Generate with `openssl rand -base64 64`
- **DB_PASSWORD**: not the dev default. Use a strong, unique password
- **AI_PROVIDER_KEY**: set a spend limit on the provider's dashboard
- **HTTPS**: put a reverse proxy (nginx, Caddy, or cloud LB) in front of both services
- **Cookie security**: set `secure: true` on the session cookie (requires HTTPS)
- **CORS**: restrict to your actual domain (remove localhost)

## MCP server access in production

In development, MCP servers run as subprocesses on the same machine. In production, this may not be feasible -- the SupaProxy container may not have access to other containers.

Options:

- **HTTP transport**: deploy the MCP server as a standalone HTTP endpoint. SupaProxy connects over the network. This is the recommended production pattern.
- **Sidecar**: run the MCP server as a sidecar container alongside SupaProxy. Communication via localhost stdio.
- **REST fallback**: if the service team doesn't have an MCP server, define tools as REST API calls in the workspace config.

## Monitoring

In production, ship audit logs to your observability stack:

- **Grafana Loki**: JSONL logs via a log shipper
- **ELK**: JSONL logs via Filebeat or similar
- **Datadog**: structured logs via the Datadog agent

The audit log format is stable JSON -- any log aggregator that handles JSON works.

## Scaling

For most teams, a single instance of each service is sufficient. SupaProxy's bottleneck is the AI provider API (external, rate-limited), not the backend itself.

If you need horizontal scaling:

- **Backend**: stateless (JWT auth, no server-side sessions). Run multiple instances behind a load balancer.
- **Frontend**: SSR is stateless. Same approach.
- **Thread context**: currently in-memory. For multi-instance, move to a shared cache or the database.
