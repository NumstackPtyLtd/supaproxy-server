# Connections

A connection is a data source the workspace uses to answer queries. Each connection exposes tools that the AI can invoke with typed arguments and structured responses.

## How connections work with the agent

When a user sends a query, SupaProxy's agent engine runs a tool-use loop. The flow is:

1. SupaProxy connects to every connection configured on the workspace
2. Each connection advertises its tools (name, description, input schema)
3. These tools are passed to the language model as available functions
4. The model decides which tools to call based on the user's query
5. SupaProxy executes the tool call against the connection and returns the result
6. The model processes the result and either calls more tools or returns a final answer

This is a standard LLM tool-use loop. SupaProxy's role is to manage the connections, discover tools, and execute calls on the model's behalf.

### What the model sees

Each tool from a connection is converted into a model tool definition. For example, an MCP server that exposes a `get_order_status` tool becomes:

```json
{
  "name": "get_order_status",
  "description": "Look up the current status of a customer order by order number",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_number": {
        "type": "string",
        "description": "The order number to look up, e.g. ORD-2026-001"
      }
    },
    "required": ["order_number"]
  }
}
```

The model sees all tools from all connections in the workspace. It picks the right tool based on the query. If the workspace has two MCP servers (e.g. orders and payments), the model sees tools from both and can call across them in a single conversation.

## Connection types

### MCP servers

The primary integration type. [MCP (Model Context Protocol)](https://modelcontextprotocol.io/introduction) servers advertise their tools automatically via `tools/list`. No manual tool definitions needed.

SupaProxy uses the MCP client SDK to connect, discover tools, and execute calls.

**STDIO transport** -- SupaProxy spawns the MCP server as a child process. Best for local development and same-machine deployments.

When you add an MCP connection via the dashboard, you provide:

```
Name:      order-service
Command:   node
Arguments: /opt/services/order-mcp/index.js
```

The connection is stored with a transport type, command, and arguments. On the first query, the agent spawns the process, runs `initialize` + `tools/list`, and caches the discovered tools.

**HTTP transport (planned)** -- SupaProxy connects to a remote MCP server over HTTPS. For production, cross-network access, and services you do not run locally.

### REST APIs (planned)

For services without an MCP server. You define tools manually: the endpoint URL, method, headers, and argument mapping. SupaProxy converts these into model tool definitions and executes HTTP calls on tool invocation.

### Databases (planned)

Direct read-only SQL queries against a database. The AI generates queries within a schema whitelist -- it cannot touch tables or columns not explicitly allowed.

## Tool discovery

| Connection type | How tools are discovered | Status |
|---|---|---|
| MCP server | Automatic via `tools/list` on connect | Live |
| REST API | Defined manually (name, method, path, args) | Planned |
| GraphQL | Schema introspection | Planned |
| Database | Defined manually (allowed tables, query templates) | Planned |

## Agent loop in detail

The agent loop follows the standard LLM tool-use pattern:

1. Connect to MCP servers, discover tools
2. Send the user's query along with all available tools to the language model
3. If the model returns tool-use blocks, execute each one against the appropriate MCP server
4. Feed the results back to the model as tool-result messages
5. Repeat until the model returns a text response (no more tool calls)

The loop runs up to `max_tool_rounds` times (default: 10). Each round, the model can call one or more tools. The agent tracks tokens, cost, duration, and tools called for the audit log.

## Channel uniqueness

A Slack channel can only be bound to one workspace. If you try to bind a channel that is already assigned, the API rejects it with an error naming the workspace that owns it. This prevents query pollution across workspaces.

## Connection health

Connections start with status `disconnected`. On the first query, the agent connects and updates the status. If a connection fails during a query, the error is logged and the AI includes a warning in its response.

| Status | Meaning |
|---|---|
| `connected` | Successfully connected and tools discovered |
| `disconnected` | Not yet connected (awaiting first query) |
| `error` | Connection failed -- check config |
| `idle` | Connected but no recent queries |
