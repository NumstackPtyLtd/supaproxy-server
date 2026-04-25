---
name: debug-mcp
description: >
  Diagnose and fix MCP connection issues. Covers: stale Docker ports,
  missing headers, tools returning 0, agent runtime failures, and
  MCP server route/DI issues. Run when connections show [UNKNOWN] or
  "No tools available".
---

# Debug MCP Connections

Diagnose why MCP connections fail to discover tools or why the agent can't use them at runtime.

## Step 1: Check the MCP server is reachable

```bash
# Get the connection URL from DB
docker exec supaproxy-mysql mysql -u root -psupaproxy2026 supaproxy -N -e "SELECT name, config FROM connections;" 2>&1 | grep -v Warning

# Test the URL directly with a tools/list call
URL="<url from above>"
curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "x-moo-request-id: debug-$(date +%s)" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' | python3 -m json.tool
```

### Common failures:

**"No routes found for /mcp"** — The MCP server doesn't have the HTTP route registered.
- For Symfony apps: check `config/routes/mcp.yaml` exists with correct controller path
- Controller must extend `AbstractController` for Symfony DI to inject dependencies
- Run `docker exec <container> php bin/console cache:clear` after adding routes

**"idempotency header not set"** — Server requires custom headers (e.g., `x-moo-request-id`).
- SupaProxy sends `x-moo-request-id` automatically on all MCP calls (agent.ts + connectors.ts)
- If the server needs other headers, add them to the connection config: `cfg.headers`

**Connection refused / timeout** — Docker port changed.
- Docker ephemeral ports change on every container restart
- Check current port: `docker ps --format '{{.Names}}\t{{.Ports}}' | grep <name>`
- Update the connection URL in the SupaProxy UI or DB

**"Too few arguments to function"** — Symfony DI not resolving dependencies.
- Controller must extend `AbstractController` (not plain class)
- Or explicitly register it in `config/services.yaml`
- Run `docker exec <container> php bin/console debug:container <ClassName>` to verify registration

## Step 2: Check tools are registered in DB

```bash
docker exec supaproxy-mysql mysql -u root -psupaproxy2026 supaproxy -e "
  SELECT c.name, c.status, COUNT(t.id) as tools
  FROM connections c
  LEFT JOIN connection_tools t ON c.id = t.connection_id
  GROUP BY c.id;" 2>&1 | grep -v Warning
```

If status is `connected` but tools = 0, the test/save succeeded but tool discovery returned empty. Re-test the connection in the UI.

## Step 3: Check agent runtime MCP calls

If the UI shows tools but querying says "No tools available":

```bash
# Check server logs for MCP connection errors
strings /tmp/supaproxy-server.log | grep -i "mcp\|tools\|connection" | tail -20
```

The agent (agent.ts) connects to MCP fresh on every query. Common issues:
- **Missing headers at runtime** — agent.ts must send the same headers as connectors.ts
- **MCP server crashed** between test and query — check Docker container is still running
- **Port changed** — Docker ephemeral port rotated since the connection was saved

## Step 4: Force re-discover tools

If tools are stale or missing, delete and re-add the connection in the UI, or:

```bash
CONN_ID="<connection_id>"
docker exec supaproxy-mysql mysql -u root -psupaproxy2026 supaproxy -e "
  DELETE FROM connection_tools WHERE connection_id = '${CONN_ID}';
  UPDATE connections SET status = 'disconnected' WHERE id = '${CONN_ID}';" 2>&1 | grep -v Warning
```

Then re-test in the UI.

## Step 5: Restart insurance MCP (specific to this project)

```bash
cd /Users/Elvis/workspace/insurance
git checkout MIM-519--slack-mcp-assistant-demo
rm -rf var/cache/*
docker compose up -d insurance nginx
sleep 5
PORT=$(docker ps --format '{{.Ports}}' --filter name=insurance-nginx | grep -o '0.0.0.0:[0-9]*' | cut -d: -f2)
docker exec insurance php bin/console cache:clear
echo "MCP URL: http://localhost:${PORT}/mcp"
```

Then update the connection URL in SupaProxy to the new port.
