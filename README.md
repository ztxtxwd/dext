# Dext

**Dext** (Dynamic Extension Tool) is an advanced MCP tool retrieval and vector indexing system built on top of the MCP Inspector architecture. It combines powerful tool management capabilities with AI-powered semantic search to help you discover and utilize the right tools for your tasks.

## Key Features

- **🔍 Semantic Tool Search**: Vector-based similarity search using embeddings (powered by sqlite-vec)
- **🤖 Intelligent Tool Recommendations**: AI-powered tool suggestions based on natural language queries
- **📦 Multi-Server Management**: Manage multiple MCP servers (STDIO, SSE, Streamable HTTP)
- **💾 Persistent Vector Index**: SQLite-backed vector database for fast tool retrieval
- **🎯 Session-Aware**: Tracks tool usage to avoid duplicate recommendations
- **🌐 Web Interface**: Modern React-based UI for server and tool management
- **🔌 MCP Server**: Exposes tool retrieval capabilities as an MCP server

## Architecture Overview

Dext extends the MCP Inspector architecture with advanced tool indexing and retrieval:

- **Dext Client**: React-based web UI for managing MCP servers and browsing tools
- **Dext Server**:
  - Connects to multiple MCP servers via various transports (stdio, SSE, streamable-http)
  - Vector database for tool embeddings and semantic search
  - MCP server exposing tool retrieval capabilities
  - RESTful API for server and tool management
- **Vector Search Engine**: sqlite-vec powered similarity search for intelligent tool discovery

## Quick Start

### Requirements

- Node.js: ^22.7.5
- An embedding API key (for vector search functionality)

### Installation

Install Dext globally via npm:

```bash
npm install -g @ztxtxwd/dext
```

Or run directly with npx:

```bash
npx @ztxtxwd/dext
```

The server will start up and the UI will be accessible at `http://localhost:6274`.

### Configuration

Dext requires an embedding model for vector-based tool search. Configure your embedding provider via environment variables:

```bash
# Required: API key for embedding service
EMBEDDING_API_KEY=your-api-key-here

# Optional: Embedding model configuration
EMBEDDING_MODEL_NAME=doubao-embedding-text-240715
EMBEDDING_VECTOR_DIMENSION=1024
EMBEDDING_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

You can also create a `.env` file in your project directory with these settings.

## Usage

### Managing MCP Servers

Dext provides a web interface at `http://localhost:6274` where you can:

1. **Add MCP Servers**: Configure servers using STDIO, SSE, or Streamable HTTP transports
2. **Enable/Disable Servers**: Toggle servers on/off without removing their configuration
3. **View Tools**: Browse all tools available from connected servers
4. **Search Tools**: Use semantic search to find relevant tools by natural language description

### Adding an MCP Server

Through the web UI, click "Add Server" and provide:

- **Server Name**: Unique identifier for the server
- **Server Type**: Choose from STDIO, SSE, or Streamable HTTP
- **Configuration**: Provide connection details based on server type
  - **STDIO**: Command and arguments to start the server
  - **SSE**: Server URL
  - **Streamable HTTP**: Server URL and optional headers

### Tool Retrieval via MCP

Dext itself runs as an MCP server, exposing tool retrieval capabilities. You can connect to it as an MCP server to get intelligent tool recommendations:

```bash
# Connect to Dext's MCP server (default port 3000)
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

Available MCP tools:

- `retrieve_tools`: Get relevant tools based on natural language queries
- `list_tools`: List all indexed tools from all servers
- `get_server_tools`: Get tools from a specific server

## How Vector Search Works

Dext uses embeddings to enable semantic search across all your MCP tools:

1. **Automatic Indexing**: When you add MCP servers, Dext automatically indexes their tools by generating vector embeddings from tool names and descriptions
2. **Semantic Search**: Query tools using natural language (e.g., "find tools for image processing")
3. **Similarity Ranking**: Tools are ranked by semantic similarity to your query
4. **Session Awareness**: Dext tracks which tools you've already retrieved to avoid duplicate suggestions

The vector database uses sqlite-vec for efficient similarity search and supports multiple embedding models.

## API Reference

Dext exposes a RESTful API for programmatic access:

### Server Management

- `GET /api/mcp-servers` - List all MCP servers
- `POST /api/mcp-servers` - Add a new MCP server
- `PUT /api/mcp-servers/:id` - Update server configuration
- `DELETE /api/mcp-servers/:id` - Remove a server
- `PATCH /api/mcp-servers/:id/toggle` - Enable/disable a server

### Tool Retrieval

- `POST /api/retrieve-tools` - Retrieve tools based on queries with session tracking
- `GET /api/tools` - List all indexed tools
- `GET /api/tools/:serverName` - Get tools from a specific server

### MCP Server Export

Dext provides convenient buttons to export server launch configurations for use in clients such as Cursor, Claude Code, or the MCP Inspector CLI. The file is usually called `mcp.json`.

- **Server Entry** - Copies a single server configuration entry to your clipboard. This can be added to your `mcp.json` file inside the `mcpServers` object with your preferred server name.

  **STDIO transport example:**

  ```json
  {
    "command": "node",
    "args": ["build/index.js", "--debug"],
    "env": {
      "API_KEY": "your-api-key",
      "DEBUG": "true"
    }
  }
  ```

  **SSE transport example:**

  ```json
  {
    "type": "sse",
    "url": "http://localhost:3000/events",
    "note": "For SSE connections, add this URL directly in Client"
  }
  ```

  **Streamable HTTP transport example:**

  ```json
  {
    "type": "streamable-http",
    "url": "http://localhost:3000/mcp",
    "note": "For Streamable HTTP connections, add this URL directly in your MCP Client"
  }
  ```

- **Servers File** - Copies a complete MCP configuration file structure to your clipboard, with your current server configuration added as `default-server`. This can be saved directly as `mcp.json`.

  **STDIO transport example:**

  ```json
  {
    "mcpServers": {
      "default-server": {
        "command": "node",
        "args": ["build/index.js", "--debug"],
        "env": {
          "API_KEY": "your-api-key",
          "DEBUG": "true"
        }
      }
    }
  }
  ```

  **SSE transport example:**

  ```json
  {
    "mcpServers": {
      "default-server": {
        "type": "sse",
        "url": "http://localhost:3000/events",
        "note": "For SSE connections, add this URL directly in Client"
      }
    }
  }
  ```

  **Streamable HTTP transport example:**

  ```json
  {
    "mcpServers": {
      "default-server": {
        "type": "streamable-http",
        "url": "http://localhost:3000/mcp",
        "note": "For Streamable HTTP connections, add this URL directly in your MCP Client"
      }
    }
  }
  ```

These buttons appear in the Dext UI after you've configured your server settings, making it easy to save and reuse your configurations.

For SSE and Streamable HTTP transport connections, Dext provides similar functionality for both buttons. The "Server Entry" button copies the configuration that can be added to your existing configuration file, while the "Servers File" button creates a complete configuration file containing the URL for direct use in clients.

You can paste the Server Entry into your existing `mcp.json` file under your chosen server name, or use the complete Servers File payload to create a new configuration file.

### Authentication

Dext supports bearer token authentication for SSE connections. Enter your token in the UI when connecting to an MCP server, and it will be sent in the Authorization header. You can override the header name using the input field in the sidebar.

## Security Considerations

Dext includes a server component that can run and communicate with local MCP processes. The server should not be exposed to untrusted networks as it has permissions to spawn local processes and can connect to any specified MCP server.

#### Authentication

Dext server requires authentication by default. When starting the server, a random session token is generated and printed to the console:

```
🔑 Session token: 3a1c267fad21f7150b7d624c160b7f09b0b8c4f623c7107bbf13378f051538d4

🔗 Open Dext with token pre-filled:
   http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=3a1c267fad21f7150b7d624c160b7f09b0b8c4f623c7107bbf13378f051538d4
```

This token must be included as a Bearer token in the Authorization header for all requests to the server. Dext will automatically open your browser with the token pre-filled in the URL.

**Automatic browser opening** - Dext automatically opens your browser with the token pre-filled in the URL when authentication is enabled.

**Alternative: Manual configuration** - If you already have Dext open:

1. Click the "Configuration" button in the sidebar
2. Find "Proxy Session Token" and enter the token displayed in the console
3. Click "Save" to apply the configuration

The token will be saved in your browser's local storage for future use.

If you need to disable authentication (NOT RECOMMENDED), you can set the `DANGEROUSLY_OMIT_AUTH` environment variable:

```bash
DANGEROUSLY_OMIT_AUTH=true npm start
```

---

**🚨 WARNING 🚨**

Disabling authentication with `DANGEROUSLY_OMIT_AUTH` is incredibly dangerous! Disabling auth leaves your machine open to attack not just when exposed to the public internet, but also **via your web browser**. Meaning, visiting a malicious website OR viewing a malicious advertizement could allow an attacker to remotely compromise your computer. Do not disable this feature unless you truly understand the risks.

Read more about the risks of this vulnerability on Oligo's blog: [Critical RCE Vulnerability in Anthropic MCP Inspector - CVE-2025-49596](https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596)

---

You can also set the token via the `MCP_PROXY_AUTH_TOKEN` environment variable when starting the server:

```bash
MCP_PROXY_AUTH_TOKEN=$(openssl rand -hex 32) npm start
```

#### Local-only Binding

By default, both the Dext server and client bind only to `localhost` to prevent network access. This ensures they are not accessible from other devices on the network. If you need to bind to all interfaces for development purposes, you can override this with the `HOST` environment variable:

```bash
HOST=0.0.0.0 npm start
```

**Warning:** Only bind to all interfaces in trusted network environments, as this exposes the server's ability to execute local processes and both services to network access.

#### DNS Rebinding Protection

To prevent DNS rebinding attacks, Dext validates the `Origin` header on incoming requests. By default, only requests from the client origin are allowed (respects `CLIENT_PORT` if set, defaulting to port 6274). You can configure additional allowed origins by setting the `ALLOWED_ORIGINS` environment variable (comma-separated list):

```bash
ALLOWED_ORIGINS=http://localhost:6274,http://localhost:8000 npm start
```

## Configuration

Dext supports the following configuration settings. To change them, click on the `Configuration` button in the Dext UI:

| Setting                                 | Description                                                                                                                                    | Default |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `MCP_SERVER_REQUEST_TIMEOUT`            | Client-side timeout (ms) - Dext will cancel the request if no response is received within this time. Note: servers may have their own timeouts | 300000  |
| `MCP_REQUEST_TIMEOUT_RESET_ON_PROGRESS` | Reset timeout on progress notifications                                                                                                        | true    |
| `MCP_REQUEST_MAX_TOTAL_TIMEOUT`         | Maximum total timeout for requests sent to the MCP server (ms) (Use with progress notifications)                                               | 60000   |
| `MCP_PROXY_FULL_ADDRESS`                | Set this if you are running the Dext server on a non-default address. Example: http://10.1.1.22:5577                                           | ""      |
| `MCP_AUTO_OPEN_ENABLED`                 | Enable automatic browser opening when Dext starts (works with authentication enabled). Only as environment var, not configurable in browser.   | true    |

**Note on Timeouts:** The timeout settings above control when Dext (as an MCP client) will cancel requests. These are independent of any server-side timeouts. For example, if a server tool has a 10-minute timeout but Dext's timeout is set to 30 seconds, Dext will cancel the request after 30 seconds. Conversely, if Dext's timeout is 10 minutes but the server times out after 30 seconds, you'll receive the server's timeout error. For tools that require user interaction (like elicitation) or long-running operations, ensure Dext's timeout is set appropriately.

These settings can be adjusted in real-time through the UI and will persist across sessions.

Dext also supports configuration files to store settings for different MCP servers. This is useful when working with multiple servers or complex configurations:

```bash
npx @ztxtxwd/dext --config path/to/config.json --server everything
```

Example server configuration file:

```json
{
  "mcpServers": {
    "everything": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything"],
      "env": {
        "hello": "Hello MCP!"
      }
    },
    "my-server": {
      "command": "node",
      "args": ["build/index.js", "arg1", "arg2"],
      "env": {
        "key": "value",
        "key2": "value2"
      }
    }
  }
}
```

#### Transport Types in Config Files

Dext automatically detects the transport type from your config file. You can specify different transport types:

**STDIO (default):**

```json
{
  "mcpServers": {
    "my-stdio-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything"]
    }
  }
}
```

**SSE (Server-Sent Events):**

```json
{
  "mcpServers": {
    "my-sse-server": {
      "type": "sse",
      "url": "http://localhost:3000/sse"
    }
  }
}
```

**Streamable HTTP:**

```json
{
  "mcpServers": {
    "my-http-server": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

#### Default Server Selection

You can launch Dext without specifying a server name if your config has:

1. **A single server** - automatically selected:

```bash
# Automatically uses "my-server" if it's the only one
npx @ztxtxwd/dext --config mcp.json
```

2. **A server named "default-server"** - automatically selected:

```json
{
  "mcpServers": {
    "default-server": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-everything"]
    },
    "other-server": {
      "command": "node",
      "args": ["other.js"]
    }
  }
}
```

> **Tip:** You can easily generate this configuration format using the **Server Entry** and **Servers File** buttons in the Dext UI, as described in the MCP Server Export section above.

You can also set the initial `transport` type, `serverUrl`, `serverCommand`, and `serverArgs` via query params, for example:

```
http://localhost:6274/?transport=sse&serverUrl=http://localhost:8787/sse
http://localhost:6274/?transport=streamable-http&serverUrl=http://localhost:8787/mcp
http://localhost:6274/?transport=stdio&serverCommand=npx&serverArgs=arg1%20arg2
```

You can also set initial config settings via query params, for example:

```
http://localhost:6274/?MCP_SERVER_REQUEST_TIMEOUT=60000&MCP_REQUEST_TIMEOUT_RESET_ON_PROGRESS=false&MCP_PROXY_FULL_ADDRESS=http://10.1.1.22:5577
```

Note that if both the query param and the corresponding localStorage item are set, the query param will take precedence.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Build Commands

- Build all: `npm run build`
- Build client: `npm run build-client`
- Build server: `npm run build-server`
- Development mode: `npm run dev` (use `npm run dev:windows` on Windows)
- Format code: `npm run prettier-fix`
- Run tests: `npm test`

## Acknowledgments

Dext is built on top of the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) project by Anthropic. We extend the Inspector's capabilities with advanced vector-based tool indexing and semantic search features.

## License

This project is licensed under the MIT License—see the [LICENSE](LICENSE) file for details.

Dext is based on the MCP Inspector project, which is also licensed under the MIT License.
Copyright (c) 2024 Anthropic, PBC
