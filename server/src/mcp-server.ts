import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { z } from "zod";
import VectorSearch from "./vector_search.js";
import VectorDatabase, { MCPServerConfig } from "./database.js";
import { initializeMCPClient, getMCPClient } from "./index.js";
import crypto from "crypto";

// 类型定义
export interface MCPToolsInfo {
  serverName: string;
  tools: any[];
}

export interface ToolInfo {
  name?: string;
  description?: string;
  schema?: any;
  outputSchema?: any;
}

export interface RetrieverResult {
  session_id: string;
  new_tools: Array<{
    query_index: number;
    query: string;
    tools: Array<{
      rank: number;
      tool_name: string;
      md5: string;
      description?: string;
      similarity?: number;
      input_schema?: string;
      output_schema?: any;
    }>;
  }>;
  known_tools: Array<{
    query_index: number;
    query: string;
    tools: Array<{
      rank: number;
      tool_name: string;
      md5: string;
    }>;
  }>;
  summary: {
    new_tools_count: number;
    known_tools_count: number;
    session_history_count: number;
  };
  server_description?: string;
}

export interface FormattedMcpServerRow {
  id: number;
  server_name: string;
  server_type: string;
  url?: string;
  command?: string;
  args?: string[] | null;
  headers?: { [key: string]: string } | null;
  env?: { [key: string]: string } | null;
  description?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// 从数据库读取服务器信息并生成增强描述
async function getEnhancedServerDescription(): Promise<string> {
  try {
    const serverDescriptions: string[] = [];

    // 确保 MCP 客户端已准备就绪
    try {
      const mcpClient = await ensureMCPClientReady();
      const tools: ToolInfo[] = await mcpClient.getTools();

      // 按服务器分组工具
      const toolsByServer: { [serverName: string]: string[] } = {};
      tools.forEach((tool) => {
        // 从工具名称中提取服务器名称（格式：serverName__toolName）
        const parts = (tool.name || "").split("__");
        const serverName = parts[0] || "unknown";
        const toolName = parts.slice(1).join("__") || tool.name;

        if (!toolsByServer[serverName]) {
          toolsByServer[serverName] = [];
        }
        toolsByServer[serverName].push(toolName || "");
      });

      // 从数据库获取服务器配置
      await ensureVectorDatabaseReady();
      const db = vectorDatabase.db!;
      const stmt = db.prepare(
        "SELECT * FROM mcp_servers WHERE enabled = 1 ORDER BY server_name",
      );
      const mcpServers = stmt.all() as MCPServerConfig[];

      for (const serverRow of mcpServers) {
        let description = serverRow.server_name;

        if (serverRow.description) {
          description += `(${serverRow.description})`;
        }

        // 添加工具名称列表
        const serverTools = toolsByServer[serverRow.server_name];
        if (serverTools && serverTools.length > 0) {
          description += ` - 工具: ${serverTools.join(", ")}`;
        }

        serverDescriptions.push(description);
      }
    } catch (error) {
      console.error("获取MCP工具信息失败:", (error as Error).message);
      // 如果获取工具信息失败，仍然返回基本的服务器描述
      try {
        await ensureVectorDatabaseReady();
        const db = vectorDatabase.db!;
        const stmt = db.prepare(
          "SELECT server_name, description FROM mcp_servers WHERE enabled = 1 ORDER BY server_name",
        );
        const mcpServers = stmt.all() as MCPServerConfig[];

        for (const serverRow of mcpServers) {
          if (serverRow.description) {
            serverDescriptions.push(
              `${serverRow.server_name}(${serverRow.description})`,
            );
          } else {
            serverDescriptions.push(serverRow.server_name);
          }
        }
      } catch (dbError) {
        console.error(
          "从数据库读取服务器配置失败:",
          (dbError as Error).message,
        );
      }
    }

    if (serverDescriptions.length > 0) {
      return `当前可以使用的服务器：${serverDescriptions.join("、")}，务必不要直接使用它们，只可以使用它们用来检索！`;
    }

    return "";
  } catch (error) {
    console.error("获取增强服务器描述失败:", (error as Error).message);
    return "";
  }
}

// 获取动态服务器名称
const mcpToolsInfo = ((global as any).mcpToolsInfo as MCPToolsInfo) || {
  serverName: "dext",
  tools: [],
};
const dynamicServerName = mcpToolsInfo.serverName || "dext";

// Create an MCP server with dynamic name
const server = new McpServer({
  name: dynamicServerName,
  version: "1.0.0",
});

console.log(`创建MCP服务器: ${dynamicServerName}`);

const vectorSearch = new VectorSearch();
const vectorDatabase = new VectorDatabase();
let vectorSearchInitPromise: Promise<void> | null = null;
let vectorDatabaseInitPromise: Promise<void> | null = null;
let mcpClient: any = null;
let mcpClientInitPromise: Promise<any> | null = null;

async function ensureVectorSearchReady(): Promise<void> {
  if (vectorSearchInitPromise) {
    await vectorSearchInitPromise;
    return;
  }

  vectorSearchInitPromise = (async () => {
    await vectorSearch.initialize();
  })();

  try {
    await vectorSearchInitPromise;
  } catch (error) {
    vectorSearchInitPromise = null;
    throw error;
  }
}

async function ensureVectorDatabaseReady(): Promise<void> {
  if (vectorDatabaseInitPromise) {
    await vectorDatabaseInitPromise;
    return;
  }

  vectorDatabaseInitPromise = (async () => {
    await vectorDatabase.initialize();
  })();

  try {
    await vectorDatabaseInitPromise;
  } catch (error) {
    vectorDatabaseInitPromise = null;
    throw error;
  }
}

async function ensureMCPClientReady(): Promise<any> {
  // 首先尝试获取已初始化的客户端
  const existingClient = getMCPClient();
  if (existingClient) {
    return existingClient;
  }

  if (mcpClientInitPromise) {
    return await mcpClientInitPromise;
  }

  mcpClientInitPromise = (async () => {
    try {
      mcpClient = await initializeMCPClient();
      if (mcpClient) {
        console.log("✅ MCP客户端初始化成功");
      } else {
        console.log("⚠️ MCP客户端初始化失败，使用空客户端");
        mcpClient = {
          async getTools() {
            return [];
          },
        };
      }
      return mcpClient;
    } catch (error) {
      console.error("❌ MCP客户端初始化失败:", (error as Error).message);
      mcpClient = {
        async getTools() {
          return [];
        },
      };
      return mcpClient;
    }
  })();

  return await mcpClientInitPromise;
}

server.registerTool(
  "retriever",
  {
    title: "工具检索",
    description:
      "通过自然语言描述来智能检索相关工具，返回语义最匹配的工具列表及完整信息。",
    inputSchema: {
      descriptions: z
        .array(
          z
            .string()
            .min(1, "query不能为空")
            .describe(
              "对假想的工具进行详细描述，即你认为这个工具应该是什么样的。对一个目标工具的描述都写在一个描述中，不要写好几个描述都是描述同一个目标工具的。",
            ),
        )
        .describe(
          "鼓励一次性检索多个目标工具，把你的需求一次性说出来。例如：" +
            `用户想要在飞书文档中插入一个时间轴块。首先我需要获取文档内容，然后根据内容在合适的位置插入时间轴块。

如果你需要：

先获取文档内容，了解文档的结构和主题
分析文档内容，确定在哪里插入时间轴块最合适
创建时间轴内容
在合适的位置插入时间轴块，你就一次性提出对两个工具的检索：获取飞书文档内容的工具、创建时间轴块的工具`,
        ),
      sessionId: z.string().describe("会话ID，6位字母数字组合"),
      serverNames: z
        .array(z.string())
        .optional()
        .describe(
          "可选：指定服务器名称列表来限制检索范围，如 ['feishu', 'linear']",
        ),
    },
  },
  async ({ descriptions, sessionId, serverNames }) => {
    // 处理sessionId：如果用户传入的sessionId没有历史记录，则重新生成
    let finalSessionId: string = sessionId || "";

    try {
      await ensureVectorSearchReady();
      await ensureVectorDatabaseReady();
      const mcpClient = await ensureMCPClientReady();

      // 获取增强的服务器描述
      const enhancedServerDescription = await getEnhancedServerDescription();

      let needToGenerateNewSession = false;
      let isFirstTimeSession = false;

      if (finalSessionId) {
        // 检查传入的sessionId是否有历史记录
        const sessionHistory = vectorDatabase.getSessionHistory(finalSessionId);
        if (!sessionHistory || sessionHistory.length === 0) {
          console.log(
            `⚠️ 传入的sessionId ${finalSessionId} 没有历史记录，将重新生成`,
          );
          needToGenerateNewSession = true;
        }
      } else {
        needToGenerateNewSession = true;
      }

      if (needToGenerateNewSession) {
        finalSessionId = Math.random().toString(36).substring(2, 8);
        console.log(`🆕 生成新的sessionId: ${finalSessionId}`);
        isFirstTimeSession = true;
      }

      // 获取该session的历史检索记录
      const sessionHistory = vectorDatabase.getSessionHistory(finalSessionId);
      const knownToolMD5s = new Set(
        sessionHistory.map((item) => item.tool_md5),
      );
      console.log(
        `📋 Session ${finalSessionId} 已检索过的工具数量: ${knownToolMD5s.size}`,
      );

      const modelName =
        process.env.EMBEDDING_MODEL_NAME || "doubao-embedding-text-240715";
      const topK = parseInt(process.env.TOOL_RETRIEVER_TOP_K || "5", 10);
      const threshold = Number(process.env.TOOL_RETRIEVER_THRESHOLD || "0.1");

      // 处理多个描述，为每个描述检索工具
      const newTools: any[] = []; // 新检索到的工具（完整信息）
      const knownTools: any[] = []; // 已知工具（只返回基本信息）

      for (let i = 0; i < descriptions.length; i++) {
        const description = descriptions[i];

        // 使用recommendTools方法来获取完整的MCP工具信息
        const recommendations = await vectorSearch.recommendTools(
          description,
          mcpClient,
          modelName,
          { topK, threshold, includeDetails: true, serverNames },
        );

        const topResult = recommendations || [];

        // 分离新工具和已知工具
        const newToolsForQuery: any[] = [];
        const knownToolsForQuery: any[] = [];

        topResult.forEach((rec, index) => {
          const toolInfo = {
            rank: index + 1,
            tool_name: rec.tool_name,
            md5: rec.tool_md5,
          };

          if (knownToolMD5s.has(rec.tool_md5)) {
            // 已知工具，只返回基本信息
            knownToolsForQuery.push(toolInfo);
          } else {
            // 新工具，返回完整信息
            const fullToolInfo = {
              ...toolInfo,
              description: rec.description ?? null,
              similarity: Number(
                rec.similarity?.toFixed(4) ?? rec.similarity ?? 0,
              ),
              input_schema: JSON.stringify(rec.mcp_tool?.schema) ?? null,
              output_schema: rec.mcp_tool?.outputSchema ?? null,
            };
            newToolsForQuery.push(fullToolInfo);
          }
        });

        // 添加到结果数组
        if (newToolsForQuery.length > 0) {
          newTools.push({
            query_index: i,
            query: description,
            tools: newToolsForQuery,
          });
        }

        if (knownToolsForQuery.length > 0) {
          knownTools.push({
            query_index: i,
            query: description,
            tools: knownToolsForQuery,
          });
        }
      }

      // 批量记录新检索的工具到session历史
      if (newTools.length > 0) {
        const newToolsToRecord: { toolMD5: string; toolName: string }[] = [];
        newTools.forEach((queryResult) => {
          queryResult.tools.forEach(
            (tool: { md5: string; tool_name: string }) => {
              newToolsToRecord.push({
                toolMD5: tool.md5,
                toolName: tool.tool_name,
              });
            },
          );
        });

        if (newToolsToRecord.length > 0) {
          vectorDatabase.recordSessionToolRetrievalBatch(
            finalSessionId,
            newToolsToRecord,
          );
        }
      }

      // 构建返回结果
      const result: RetrieverResult = {
        session_id: finalSessionId,
        new_tools: newTools,
        known_tools: knownTools,
        summary: {
          new_tools_count: newTools.reduce(
            (sum, item) => sum + item.tools.length,
            0,
          ),
          known_tools_count: knownTools.reduce(
            (sum, item) => sum + item.tools.length,
            0,
          ),
          session_history_count:
            knownToolMD5s.size +
            newTools.reduce((sum, item) => sum + item.tools.length, 0),
        },
      };

      // 只在第一次使用该 session 时才返回服务器描述
      if (isFirstTimeSession) {
        result.server_description = enhancedServerDescription;
      }

      console.log(
        `✅ 检索完成 - 新工具: ${result.summary.new_tools_count}, 已知工具: ${result.summary.known_tools_count}`,
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(result) },
          {
            type: "text",
            text: `📋 Session ID: ${finalSessionId} (请保存此ID用于后续检索)`,
          },
        ],
      };
    } catch (error) {
      const message = `工具检索失败: ${(error as Error).message}`;
      console.error("❌ Retriever工具执行失败:", error);

      return {
        content: [
          { type: "text", text: message },
          {
            type: "text",
            text: `📋 Session ID: ${finalSessionId || sessionId || "unknown"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Add executor tool for proxy MCP tool calls
server.registerTool(
  "executor",
  {
    title: "MCP工具执行器",
    description: "代理执行具体的MCP工具调用",
    inputSchema: {
      md5: z.string().min(1, "工具md5不能为空").describe("工具md5"),
      parameters: z.record(z.unknown()).describe("工具参数"),
    },
  },
  async ({ md5, parameters }) => {
    try {
      await ensureMCPClientReady();
      const mcpClient = await ensureMCPClientReady();

      // 获取可用工具列表
      const tools = await mcpClient.getTools();
      // 根据md5查找工具
      const tool = tools.find(
        (t: ToolInfo) =>
          crypto
            .createHash("md5")
            .update(`${t.name}${t.description}`.trim(), "utf8")
            .digest("hex") === md5,
      );
      if (!tool) {
        return {
          content: [{ type: "text", text: `未找到md5为${md5}的工具` }],
          isError: true,
        };
      }

      // 执行工具调用
      const result = await (tool as any).invoke(parameters);

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      console.log(error);
      const errorMessage = `工具执行失败: ${(error as Error).message}`;
      return {
        content: [{ type: "text", text: errorMessage }],
        isError: true,
      };
    }
  },
);

// Add a dynamic greeting resource
server.registerResource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  {
    title: "Greeting Resource", // Display name for UI
    description: "Dynamic greeting generator",
  },
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  }),
);

// Set up Express and HTTP transport
const app = express();

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, you might want to restrict this to specific domains
    // For now, allowing all origins for development
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "mcp-protocol-version",
  ],
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests for the /mcp endpoint
app.options("/mcp", cors(corsOptions));

// Health check endpoint
app.get("/health", cors(corsOptions), (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    server: "dext MCP server",
    version: "1.0.0",
  });
});

// MCP Servers CRUD API

// Input validation schemas
const createMcpServerSchema = z.object({
  server_name: z.string().min(1, "服务器名称不能为空"),
  server_type: z.enum(["http", "stdio", "sse"], {
    errorMap: () => ({ message: "服务器类型必须是 http、stdio 或 sse" }),
  }),
  url: z.string().url("URL格式不正确").optional().or(z.literal("")),
  command: z.string().min(1, "命令不能为空").optional().or(z.literal("")),
  args: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
});

const updateMcpServerSchema = z.object({
  server_name: z.string().min(1, "服务器名称不能为空").optional(),
  server_type: z.enum(["http", "stdio", "sse"]).optional(),
  url: z.string().url("URL格式不正确").optional().or(z.literal("")),
  command: z.string().min(1, "命令不能为空").optional().or(z.literal("")),
  args: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  env: z.record(z.string()).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
});

// Validation middleware
const validateCreateMcpServer = (req: Request, res: Response, next: any) => {
  try {
    const validated = createMcpServerSchema.parse(req.body);
    (req as any).validatedBody = validated;

    // Type-specific validation
    if (
      (validated.server_type === "http" || validated.server_type === "sse") &&
      !validated.url
    ) {
      const serverTypeText = validated.server_type === "sse" ? "SSE" : "HTTP";
      return res
        .status(400)
        .json({ error: `${serverTypeText}类型的服务器必须提供URL` });
    }
    if (validated.server_type === "stdio" && !validated.command) {
      return res.status(400).json({ error: "STDIO类型的服务器必须提供命令" });
    }

    next();
  } catch (error) {
    return res.status(400).json({
      error: "输入验证失败",
      details:
        (error as any).errors?.map((e: any) => e.message) ||
        (error as Error).message,
    });
  }
};

// Helper function to convert database row to API response
function formatMcpServerRow(row: any): FormattedMcpServerRow | null {
  if (!row) return null;

  return {
    id: row.id,
    server_name: row.server_name,
    server_type: row.server_type,
    url: row.url,
    command: row.command,
    args: row.args ? JSON.parse(row.args) : null,
    headers: row.headers ? JSON.parse(row.headers) : null,
    env: row.env ? JSON.parse(row.env) : null,
    description: row.description,
    enabled: Boolean(row.enabled),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/mcp-servers - 获取所有MCP服务器
app.get(
  "/api/mcp-servers",
  cors(corsOptions),
  async (req: Request, res: Response) => {
    try {
      await ensureVectorDatabaseReady();
      const db = vectorDatabase.db!;

      const {
        enabled,
        server_type,
        page = "1",
        limit = "50",
        include_tools = "false",
      } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const includeTools = include_tools === "true";

      let whereClause = "";
      const params: any[] = [];

      if (enabled !== undefined) {
        whereClause += " WHERE enabled = ?";
        params.push(enabled === "true" ? 1 : 0);
      }

      if (server_type) {
        whereClause += whereClause
          ? " AND server_type = ?"
          : " WHERE server_type = ?";
        params.push(server_type);
      }

      // 获取总数
      const countSql = `SELECT COUNT(*) as total FROM mcp_servers${whereClause}`;
      const countResult = db.prepare(countSql).get(...params) as {
        total: number;
      };
      const total = countResult.total;

      // 获取分页数据
      const dataSql = `
            SELECT * FROM mcp_servers${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
      const dataParams = [...params, parseInt(limit as string), offset];
      const rows = db.prepare(dataSql).all(...dataParams);

      let servers: (FormattedMcpServerRow | null)[] =
        rows.map(formatMcpServerRow);

      // 如果需要包含工具列表，则为每个服务器查询对应的工具
      if (includeTools && servers.length > 0) {
        servers = await Promise.all(
          servers.map(async (server: FormattedMcpServerRow | null) => {
            if (!server) return server;

            try {
              // 查询该服务器对应的工具
              const toolsSql = `
                SELECT
                  tool_md5,
                  tool_name,
                  description,
                  created_at
                FROM tool_vectors
                WHERE tool_name LIKE ?
                ORDER BY tool_name
              `;
              const tools = db
                .prepare(toolsSql)
                .all(`${server.server_name}__%`) as Array<{
                tool_md5: string;
                tool_name: string;
                description: string | null;
                created_at: string;
              }>;

              // 格式化工具名称，去除服务器前缀
              const formattedTools = tools.map((tool) => ({
                tool_name: tool.tool_name,
                display_name: tool.tool_name.replace(
                  `${server.server_name}__`,
                  "",
                ),
                tool_md5: tool.tool_md5,
                description: tool.description,
                created_at: tool.created_at,
              }));

              return {
                ...server,
                tools: formattedTools,
              } as FormattedMcpServerRow & { tools: typeof formattedTools };
            } catch (error) {
              console.error(
                `获取服务器 ${server.server_name} 的工具失败:`,
                error,
              );
              return {
                ...server,
                tools: [],
              } as FormattedMcpServerRow & { tools: [] };
            }
          }),
        );
      }

      res.json({
        data: servers,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error("获取MCP服务器列表失败:", error);
      res.status(500).json({
        error: "获取服务器列表失败",
        details: (error as Error).message,
      });
    }
  },
);

// GET /api/mcp-servers/:id - 根据ID获取MCP服务器
app.get(
  "/api/mcp-servers/:id",
  cors(corsOptions),
  async (req: Request, res: Response) => {
    try {
      await ensureVectorDatabaseReady();
      const db = vectorDatabase.db!;

      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "无效的服务器ID" });
      }

      const row = db
        .prepare("SELECT * FROM mcp_servers WHERE id = ?")
        .get(parseInt(id));

      if (!row) {
        return res.status(404).json({ error: "服务器不存在" });
      }

      const server = formatMcpServerRow(row);
      res.json({ data: server });
    } catch (error) {
      console.error("获取MCP服务器失败:", error);
      res
        .status(500)
        .json({ error: "获取服务器失败", details: (error as Error).message });
    }
  },
);

// POST /api/mcp-servers - 创建MCP服务器
app.post(
  "/api/mcp-servers",
  cors(corsOptions),
  validateCreateMcpServer,
  async (req: Request, res: Response) => {
    try {
      await ensureVectorDatabaseReady();
      const db = vectorDatabase.db!;

      const data = (req as any).validatedBody;

      // 检查服务器名称是否已存在
      const existing = db
        .prepare("SELECT id FROM mcp_servers WHERE server_name = ?")
        .get(data.server_name);
      if (existing) {
        return res.status(409).json({ error: "服务器名称已存在" });
      }

      // 准备插入数据
      const insertData = {
        server_name: data.server_name,
        server_type: data.server_type,
        url:
          data.server_type === "http" || data.server_type === "sse"
            ? data.url || null
            : null,
        command: data.server_type === "stdio" ? data.command || null : null,
        args:
          data.args && data.args.length > 0 ? JSON.stringify(data.args) : null,
        headers:
          data.headers && Object.keys(data.headers).length > 0
            ? JSON.stringify(data.headers)
            : null,
        env:
          data.env && Object.keys(data.env).length > 0
            ? JSON.stringify(data.env)
            : null,
        description: data.description || null,
        enabled: data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
      };

      const stmt = db.prepare(`
            INSERT INTO mcp_servers (server_name, server_type, url, command, args, headers, env, description, enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

      const result = stmt.run(
        insertData.server_name,
        insertData.server_type,
        insertData.url,
        insertData.command,
        insertData.args,
        insertData.headers,
        insertData.env,
        insertData.description,
        insertData.enabled,
      );

      // 获取创建的服务器数据
      const newRow = db
        .prepare("SELECT * FROM mcp_servers WHERE id = ?")
        .get(result.lastInsertRowid as number);
      const server = formatMcpServerRow(newRow);

      console.log(
        `✅ 创建MCP服务器: ${data.server_name} (ID: ${result.lastInsertRowid})`,
      );

      res.status(201).json({
        message: "服务器创建成功",
        data: server,
      });
    } catch (error) {
      console.error("创建MCP服务器失败:", error);
      res
        .status(500)
        .json({ error: "创建服务器失败", details: (error as Error).message });
    }
  },
);

// PUT /api/mcp-servers/:id - 更新MCP服务器
app.put(
  "/api/mcp-servers/:id",
  cors(corsOptions),
  async (req: Request, res: Response) => {
    try {
      await ensureVectorDatabaseReady();
      const db = vectorDatabase.db!;

      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "无效的服务器ID" });
      }

      // 获取现有服务器数据
      const existingRow = db
        .prepare("SELECT * FROM mcp_servers WHERE id = ?")
        .get(parseInt(id)) as any;
      if (!existingRow) {
        return res.status(404).json({ error: "服务器不存在" });
      }

      (req as any).existingServer = existingRow;

      // 验证输入数据
      try {
        const validated = updateMcpServerSchema.parse(req.body);
        (req as any).validatedBody = validated;

        // Type-specific validation if both type and respective fields are provided
        if (
          (validated.server_type === "http" ||
            validated.server_type === "sse") &&
          !validated.url &&
          !(req as any).existingServer?.url
        ) {
          const serverTypeText =
            validated.server_type === "sse" ? "SSE" : "HTTP";
          return res
            .status(400)
            .json({ error: `${serverTypeText}类型的服务器必须提供URL` });
        }
        if (
          validated.server_type === "stdio" &&
          !validated.command &&
          !(req as any).existingServer?.command
        ) {
          return res
            .status(400)
            .json({ error: "STDIO类型的服务器必须提供命令" });
        }
      } catch (error) {
        return res.status(400).json({
          error: "输入验证失败",
          details:
            (error as any).errors?.map((e: any) => e.message) ||
            (error as Error).message,
        });
      }

      const data = (req as any).validatedBody;

      // 检查服务器名称是否已被其他服务器使用
      if (data.server_name && data.server_name !== existingRow.server_name) {
        const nameExists = db
          .prepare(
            "SELECT id FROM mcp_servers WHERE server_name = ? AND id != ?",
          )
          .get(data.server_name, parseInt(id));
        if (nameExists) {
          return res.status(409).json({ error: "服务器名称已存在" });
        }
      }

      // 构建更新字段
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (data.server_name !== undefined) {
        updateFields.push("server_name = ?");
        updateValues.push(data.server_name);
      }
      if (data.server_type !== undefined) {
        updateFields.push("server_type = ?");
        updateValues.push(data.server_type);
      }
      if (data.url !== undefined) {
        updateFields.push("url = ?");
        updateValues.push(data.url || null);
      }
      if (data.command !== undefined) {
        updateFields.push("command = ?");
        updateValues.push(data.command || null);
      }
      if (data.args !== undefined) {
        updateFields.push("args = ?");
        updateValues.push(
          data.args && data.args.length > 0 ? JSON.stringify(data.args) : null,
        );
      }
      if (data.headers !== undefined) {
        updateFields.push("headers = ?");
        updateValues.push(
          data.headers && Object.keys(data.headers).length > 0
            ? JSON.stringify(data.headers)
            : null,
        );
      }
      if (data.env !== undefined) {
        updateFields.push("env = ?");
        updateValues.push(
          data.env && Object.keys(data.env).length > 0
            ? JSON.stringify(data.env)
            : null,
        );
      }
      if (data.description !== undefined) {
        updateFields.push("description = ?");
        updateValues.push(data.description);
      }
      if (data.enabled !== undefined) {
        updateFields.push("enabled = ?");
        updateValues.push(data.enabled ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: "没有提供要更新的字段" });
      }

      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateValues.push(parseInt(id));

      const stmt = db.prepare(
        `UPDATE mcp_servers SET ${updateFields.join(", ")} WHERE id = ?`,
      );
      const result = stmt.run(...updateValues);

      if (result.changes === 0) {
        return res.status(500).json({ error: "更新失败，可能没有数据被修改" });
      }

      // 获取更新后的服务器数据
      const updatedRow = db
        .prepare("SELECT * FROM mcp_servers WHERE id = ?")
        .get(parseInt(id));
      const server = formatMcpServerRow(updatedRow);

      console.log(`✅ 更新MCP服务器: ${server!.server_name} (ID: ${id})`);

      res.json({
        message: "服务器更新成功",
        data: server,
      });
    } catch (error) {
      console.error("更新MCP服务器失败:", error);
      res
        .status(500)
        .json({ error: "更新服务器失败", details: (error as Error).message });
    }
  },
);

// DELETE /api/mcp-servers/:id - 删除MCP服务器
app.delete(
  "/api/mcp-servers/:id",
  cors(corsOptions),
  async (req: Request, res: Response) => {
    try {
      await ensureVectorDatabaseReady();
      const db = vectorDatabase.db!;

      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "无效的服务器ID" });
      }

      // 检查服务器是否存在
      const existingRow = db
        .prepare("SELECT server_name FROM mcp_servers WHERE id = ?")
        .get(parseInt(id)) as { server_name: string };
      if (!existingRow) {
        return res.status(404).json({ error: "服务器不存在" });
      }

      // 删除服务器
      const stmt = db.prepare("DELETE FROM mcp_servers WHERE id = ?");
      const result = stmt.run(parseInt(id));

      if (result.changes === 0) {
        return res.status(500).json({ error: "删除失败，可能没有数据被删除" });
      }

      console.log(`✅ 删除MCP服务器: ${existingRow.server_name} (ID: ${id})`);

      res.json({
        message: "服务器删除成功",
        deleted_id: parseInt(id),
        deleted_server_name: existingRow.server_name,
      });
    } catch (error) {
      console.error("删除MCP服务器失败:", error);
      res
        .status(500)
        .json({ error: "删除服务器失败", details: (error as Error).message });
    }
  },
);

app.post("/mcp", cors(corsOptions), async (req: Request, res: Response) => {
  // Create a new transport for each request to prevent request ID collisions
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.MCP_SERVER_PORT || "3000");
app
  .listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
  })
  .on("error", (error: Error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
