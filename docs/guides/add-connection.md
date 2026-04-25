# Add a Connection

Connections are data sources that give the workspace tools to call. Without connections, the AI has no way to answer domain-specific questions.

## MCP server

[MCP (Model Context Protocol)](https://modelcontextprotocol.io/introduction) is the primary connection type. An MCP server exposes tools that SupaProxy discovers automatically -- no manual tool definitions needed.

### Adding via the dashboard

1. Open your workspace and go to the **Connections** tab
2. Click **Add connection** and select **MCP server**
3. Choose a transport:
   - **HTTP** -- paste the server URL. The standard option for cloud and managed services
   - **STDIO** -- for self-hosted enterprise deployments where the MCP server runs on your own infrastructure
4. Give the connection a name (e.g. `order-service`, `crm`, `inventory`)
5. Click **Save connection**

### What happens next

The connection is saved with status `disconnected`. On the first query to this workspace, SupaProxy:

1. Connects to the MCP server (via HTTP or by spawning the STDIO process)
2. Sends `initialize` to establish the session
3. Calls `tools/list` to discover all available tools
4. Passes the discovered tools to the language model alongside the user's query

From that point, the model can call any tool from any connection in the workspace.

### Tool discovery is automatic

You do not need to define tools manually. When your MCP server adds a new tool, SupaProxy discovers it on the next query. The model sees the tool's name, description, and input schema, and decides when to call it.

### Multiple connections per workspace

A workspace can have several connections. For example, a support workspace might connect to an order service, a payments service, and a CRM. The model sees tools from all three and can call across them in a single conversation.

## REST API (planned)

For services that do not have an MCP server. You define tools manually: endpoint URL, HTTP method, headers, and argument mapping. SupaProxy converts these into model-compatible tool definitions and makes HTTP calls when the AI invokes them.

## Database (planned)

Direct read-only SQL access. You define allowed tables and columns. The AI generates queries within the whitelist.

## MCP vs REST: when to use which

| Factor | MCP server | REST API |
|---|---|---|
| Tool discovery | Automatic | Manual definition |
| Setup effort | Point SupaProxy at the server URL | Define each tool individually |
| Best for | Services you own or that support MCP | Third-party APIs, existing endpoints |
| Maintenance | Add tools on the server, SupaProxy discovers them | Update tool definitions when the API changes |
