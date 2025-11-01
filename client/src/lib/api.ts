interface ToolInfo {
  tool_name: string;
  display_name: string;
  tool_md5: string;
  description?: string | null;
  created_at: string;
}

interface MCPServer {
  id: number;
  server_name: string;
  server_type: "http" | "stdio" | "sse";
  url?: string;
  command?: string;
  args?: string[] | null;
  headers?: Record<string, string> | null;
  env?: Record<string, string> | null;
  description?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  tools?: ToolInfo[];
}

interface MCPServersResponse {
  data: MCPServer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MCPServerCreateRequest {
  server_name: string;
  server_type: "http" | "stdio" | "sse";
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
  description?: string;
  enabled?: boolean;
}

const API_BASE_URL =
  process.env.NODE_ENV === "production" ? "/api" : "http://localhost:3398/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        throw new ApiError(
          0,
          "Network error: Unable to connect to the server. Please ensure the server is running.",
        );
      }
      throw new ApiError(0, error.message);
    }

    throw new ApiError(0, "Unknown error occurred");
  }
}

export const mcpServersApi = {
  // Get all MCP servers with optional filtering
  getServers: async (params?: {
    enabled?: boolean;
    server_type?: "http" | "stdio";
    page?: number;
    limit?: number;
    include_tools?: boolean;
  }): Promise<MCPServersResponse> => {
    const searchParams = new URLSearchParams();

    if (params?.enabled !== undefined) {
      searchParams.append("enabled", params.enabled.toString());
    }
    if (params?.server_type) {
      searchParams.append("server_type", params.server_type);
    }
    if (params?.page) {
      searchParams.append("page", params.page.toString());
    }
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString());
    }
    if (params?.include_tools !== undefined) {
      searchParams.append("include_tools", params.include_tools.toString());
    }

    const query = searchParams.toString();
    return apiRequest<MCPServersResponse>(
      `/mcp-servers${query ? `?${query}` : ""}`,
    );
  },

  // Get a specific MCP server by ID
  getServer: async (id: number): Promise<MCPServer> => {
    return apiRequest<MCPServer>(`/mcp-servers/${id}`);
  },

  // Create a new MCP server
  createServer: async (
    serverData: MCPServerCreateRequest,
  ): Promise<MCPServer> => {
    return apiRequest<MCPServer>("/mcp-servers", {
      method: "POST",
      body: JSON.stringify(serverData),
    });
  },

  // Update an existing MCP server
  updateServer: async (
    id: number,
    serverData: Partial<MCPServerCreateRequest>,
  ): Promise<MCPServer> => {
    return apiRequest<MCPServer>(`/mcp-servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(serverData),
    });
  },

  // Delete an MCP server
  deleteServer: async (id: number): Promise<void> => {
    return apiRequest<void>(`/mcp-servers/${id}`, {
      method: "DELETE",
    });
  },

  // Check server health
  checkHealth: async (): Promise<{ status: string }> => {
    return apiRequest<{ status: string }>("/health");
  },
};

export type { MCPServer, MCPServersResponse, MCPServerCreateRequest, ToolInfo };
export { ApiError };
