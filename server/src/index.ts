// 加载环境变量配置
import "dotenv/config";

// MCP服务器启动函数（将在MCP客户端初始化后调用）
let mcpServerStarted = false;
async function startMCPServer(): Promise<void> {
  if (mcpServerStarted) return;

  try {
    // 动态导入并启动MCP服务器
    await import("./mcp-server.js");
    mcpServerStarted = true;
    console.log("MCP服务器启动成功!");
  } catch (error) {
    console.error("MCP服务器启动失败:", (error as Error).message);
  }
}

// LangChain MCP适配器集成示例
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { OAuthClientProvider } from "mcp-remote-oauth-client-provider";
import { OpenAIEmbeddings } from "@langchain/openai";

// 向量搜索功能
import VectorSearch from "./vector_search.js";

// 基础的Node.js应用入口文件
console.log("Hello, Node.js!");
console.log("欢迎使用你的新Node.js项目!");

// 类型定义
export interface EmbeddingConfig {
  openAIApiKey: string;
  model: string;
  dimensions: number;
  configuration: {
    baseURL: string;
  };
}

export interface MCPServerConfig {
  [serverName: string]: {
    command?: string;
    args?: string[];
    env?: { [key: string]: string };
    url?: string;
    authProvider?: any;
    headers?: { [key: string]: string };
  };
}

export interface MCPServerRow {
  server_name: string;
  server_type: "stdio" | "http" | "sse";
  command?: string;
  args?: string;
  env?: string;
  url?: string;
  headers?: string;
}

// 简单的示例函数
function greet(name: string): string {
  return `你好, ${name}! 欢迎来到Node.js世界!`;
}

// 使用doubao embedding model进行字符串向量化的函数
async function vectorizeString(text: string): Promise<number[]> {
  try {
    // 从环境变量获取配置，参数优先级更高
    const config: EmbeddingConfig = {
      openAIApiKey: process.env.EMBEDDING_API_KEY!,
      model: process.env.EMBEDDING_MODEL_NAME || "doubao-embedding-text-240715",
      dimensions: parseInt(
        process.env.EMBEDDING_VECTOR_DIMENSION || "1024",
        10,
      ),
      configuration: {
        baseURL:
          process.env.EMBEDDING_BASE_URL ||
          "https://ark.cn-beijing.volces.com/api/v3",
      },
    };

    if (!config.openAIApiKey) {
      throw new Error(
        "API密钥未设置。请在.env文件中设置EMBEDDING_API_KEY或作为参数传入。",
      );
    }

    // 配置doubao embedding model
    const embeddings = new OpenAIEmbeddings(config);

    // 对字符串进行向量化
    const vectors = await embeddings.embedQuery(text);

    console.log(
      `字符串 "${text}" 向量化成功，维度: ${vectors.length} (使用模型: ${config.model})`,
    );
    return vectors;
  } catch (error) {
    console.error("向量化失败:", (error as Error).message);
    throw error;
  }
}

// 批量向量化多个字符串的函数
async function vectorizeMultipleStrings(texts: string[]): Promise<number[][]> {
  try {
    // 从环境变量获取配置，参数优先级更高
    const config: EmbeddingConfig = {
      openAIApiKey: process.env.EMBEDDING_API_KEY!,
      model: process.env.EMBEDDING_MODEL_NAME || "doubao-embedding-text-240715",
      dimensions: parseInt(
        process.env.EMBEDDING_VECTOR_DIMENSION || "1024",
        10,
      ),
      configuration: {
        baseURL:
          process.env.EMBEDDING_BASE_URL ||
          "https://ark.cn-beijing.volces.com/api/v3",
      },
    };

    if (!config.openAIApiKey) {
      throw new Error(
        "API密钥未设置。请在.env文件中设置EMBEDDING_API_KEY或作为参数传入。",
      );
    }

    // 配置doubao embedding model
    const embeddings = new OpenAIEmbeddings(config);

    // 对多个字符串进行批量向量化
    const vectors = await embeddings.embedDocuments(texts);

    console.log(
      `成功向量化 ${texts.length} 个字符串，每个向量维度: ${vectors[0]?.length || 0} (使用模型: ${config.model})`,
    );
    return vectors;
  } catch (error) {
    console.error("批量向量化失败:", (error as Error).message);
    throw error;
  }
}

// 全局MCP客户端变量
let globalMCPClient: MultiServerMCPClient | null = null;

// 解析环境变量占位符
function parseEnvVariable(value: any): any {
  if (typeof value !== "string") {
    return value;
  }

  // 递归替换字符串中的所有环境变量占位符
  const replaced = value.replace(
    /\$\{([^:}]+)(?::([^}]*))?\}/g,
    (_match, variableName, defaultValue) => {
      const envValue = process.env[variableName];
      return envValue !== undefined ? envValue : defaultValue || "";
    },
  );

  return replaced;
}

// MCP客户端配置和初始化
async function initializeMCPClient(): Promise<MultiServerMCPClient | null> {
  try {
    // 从数据库读取MCP服务器配置
    const VectorDatabase = (await import("./database.js")).default;
    const vectorDatabase = new VectorDatabase();
    await vectorDatabase.initialize();

    let mcpServers: MCPServerRow[];
    try {
      const stmt = vectorDatabase.db!.prepare(
        "SELECT * FROM mcp_servers WHERE enabled = 1 ORDER BY server_name",
      );
      mcpServers = stmt.all() as MCPServerRow[];
      console.log(`从数据库加载了 ${mcpServers.length} 个启用的MCP服务器`);
    } catch (error) {
      console.error("从数据库读取MCP服务器配置失败:", (error as Error).message);
      return null;
    } finally {
      vectorDatabase.close();
    }

    // 解析OAuth配置
    const callbackPort = process.env.MCP_CALLBACK_PORT || "12334";
    const host = "localhost";
    const clientName = "Dext";

    // 创建OAuth认证提供者映射
    const authProviders: { [serverName: string]: any } = {};

    // 为所有配置了URL的服务器创建AuthProvider
    for (const serverRow of mcpServers) {
      if (serverRow.url) {
        authProviders[serverRow.server_name] =
          OAuthClientProvider.createWithAutoAuth({
            serverUrl: serverRow.url,
            callbackPort: parseInt(callbackPort),
            host,
            clientName,
          });
        console.log(`为 ${serverRow.server_name} 创建了OAuth认证提供者`);
      }
    }

    // 构建MCP服务器配置
    const mcpServersConfig: MCPServerConfig = {};

    for (const serverRow of mcpServers) {
      const serverConfigForClient: any = {};

      // 检查服务器类型：stdio、HTTP URL 或 SSE
      if (serverRow.server_type === "stdio" && serverRow.command) {
        // stdio类型的MCP服务器
        serverConfigForClient.command = serverRow.command;

        // 解析args JSON
        if (serverRow.args) {
          try {
            serverConfigForClient.args = JSON.parse(serverRow.args);
          } catch (error) {
            console.error(
              `解析 ${serverRow.server_name} 的args失败:`,
              (error as Error).message,
            );
            continue;
          }
        }

        // 可选的环境变量
        if (serverRow.env) {
          try {
            const envVars = JSON.parse(serverRow.env);
            serverConfigForClient.env = {};
            for (const [envName, envValue] of Object.entries(envVars)) {
              serverConfigForClient.env[envName] = parseEnvVariable(envValue);
            }
          } catch (error) {
            console.error(
              `解析 ${serverRow.server_name} 的env失败:`,
              (error as Error).message,
            );
          }
        }

        console.log(
          `配置stdio服务器: ${serverRow.server_name} (${serverRow.command} ${serverConfigForClient.args?.join(" ") || ""})`,
        );
      } else if (
        (serverRow.server_type === "http" || serverRow.server_type === "sse") &&
        serverRow.url
      ) {
        // HTTP 或 SSE URL类型的MCP服务器
        serverConfigForClient.url = serverRow.url;

        // 添加认证提供者（所有配置了URL的服务器）
        if (authProviders[serverRow.server_name]) {
          serverConfigForClient.authProvider =
            authProviders[serverRow.server_name];
        }

        // 添加自定义头部（如果配置了headers）
        if (serverRow.headers) {
          try {
            const headers = JSON.parse(serverRow.headers);
            serverConfigForClient.headers = {};
            for (const [headerName, headerValue] of Object.entries(headers)) {
              serverConfigForClient.headers[headerName] =
                parseEnvVariable(headerValue);
            }
          } catch (error) {
            console.error(
              `解析 ${serverRow.server_name} 的headers失败:`,
              (error as Error).message,
            );
          }
        }

        const serverTypeText = serverRow.server_type === "sse" ? "SSE" : "HTTP";
        console.log(
          `配置${serverTypeText}服务器: ${serverRow.server_name} (${serverRow.url})`,
        );
      } else {
        console.warn(
          `⚠️ 服务器 ${serverRow.server_name} 配置无效：既没有command（stdio）也没有url（HTTP/SSE）`,
        );
        continue;
      }

      mcpServersConfig[serverRow.server_name] = serverConfigForClient;
    }

    // Create client and connect to server
    const client = new MultiServerMCPClient({
      // Global tool configuration options
      // Whether to throw on errors if a tool fails to load (optional, default: true)
      throwOnLoadError: false,
      // Whether to prefix tool names with the server name (optional, default: false)
      prefixToolNameWithServerName: true,
      // Optional additional prefix for tool names (optional, default: "")
      additionalToolNamePrefix: "",

      // Use standardized content block format in tool outputs
      useStandardContentBlocks: true,

      // Server configuration
      // @ts-ignore
      mcpServers: mcpServersConfig,
    });

    const tools = await client.getTools();
    console.log("MCP客户端初始化成功!");
    console.log(
      "可用工具:",
      tools.map((tool: any) => tool.name),
    );
    globalMCPClient = client;
    return client;
  } catch (error) {
    console.error("MCP客户端初始化失败:", (error as Error).message);
    globalMCPClient = null;
    return null;
  }
}

// 获取已初始化的MCP客户端
function getMCPClient(): MultiServerMCPClient | null {
  return globalMCPClient;
}

// 向量化功能测试示例
async function testVectorization(): Promise<void> {
  // 检查环境变量配置
  if (!process.env.EMBEDDING_API_KEY) {
    console.log(
      "\n⚠️  提示：要测试向量化功能，请在.env文件中配置EMBEDDING_API_KEY",
    );
    console.log("配置示例:");
    console.log("EMBEDDING_API_KEY=your-embedding-api-key-here");
    console.log("EMBEDDING_BASE_URL=https://ark.cn-beijing.volces.com/api/v3");
    console.log("EMBEDDING_MODEL_NAME=doubao-embedding-text-240715");
    console.log("EMBEDDING_VECTOR_DIMENSION=1024");
    console.log("");
    console.log("使用示例:");
    console.log(
      'import { vectorizeString, vectorizeMultipleStrings } from "./index.js";',
    );
    console.log("");
    console.log("// 使用.env配置进行向量化（推荐）");
    console.log('const vector = await vectorizeString("你好世界");');
    console.log("");
    console.log("// 或者直接传入API密钥");
    console.log(
      'const vector = await vectorizeString("你好世界", "your-api-key");',
    );
    return;
  }

  try {
    console.log("\n🚀 开始测试向量化功能...");
    console.log(`📋 当前配置:`);
    console.log(
      `   - 模型: ${process.env.EMBEDDING_MODEL_NAME || "doubao-embedding-text-240715"}`,
    );
    console.log(
      `   - 端点: ${process.env.EMBEDDING_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3"}`,
    );
    console.log(
      `   - 预期维度: ${process.env.EMBEDDING_VECTOR_DIMENSION || "1024"}`,
    );

    // 测试单个字符串向量化（使用.env配置）
    const testText = "这是一个测试文本，用于验证doubao embedding模型的功能";
    const vector = await vectorizeString(testText);
    console.log(`✅ 单个字符串向量化成功，向量维度: ${vector.length}`);

    // 测试批量字符串向量化（使用.env配置）
    const testTexts = [
      "人工智能技术正在快速发展",
      "自然语言处理是AI的重要分支",
      "向量化是文本处理的关键步骤",
    ];
    const vectors = await vectorizeMultipleStrings(testTexts);
    console.log(`✅ 批量向量化成功，共处理 ${vectors.length} 个文本`);

    console.log("🎉 向量化功能测试完成！");
  } catch (error) {
    console.error("❌ 向量化测试失败:", (error as Error).message);
  }
}

// 向量搜索和工具推荐功能测试
async function testVectorSearch(
  mcpClient: MultiServerMCPClient | null,
): Promise<void> {
  try {
    console.log("\n🔍 开始测试向量搜索功能...");

    // 初始化向量搜索引擎
    const vectorSearch = new VectorSearch();
    await vectorSearch.initialize();

    // 获取MCP客户端
    if (!mcpClient) {
      console.log("⚠️  MCP客户端未初始化，跳过向量搜索测试");
      await vectorSearch.close();
      return;
    }

    // 为MCP工具建立向量索引
    console.log("\n📊 为MCP工具建立向量索引...");
    await vectorSearch.indexMCPTools(mcpClient);

    // 测试工具推荐
    console.log("\n🤖 测试工具推荐功能...");
    const testQueries = [
      `docx_block_create飞书-云文档-文档-块-创建块并插入到指定的位置

**最适合:** 文本、标题、列表、代码、引用、待办事项、高亮、表格、图片、附件、文件、视频、插件块（文本绘图、名词解释、时间轴、目录导航、信息收集、倒计时）等所有块类型的创建

**不推荐用于:** 在没有使用docx_image_or_video_or_file_create的情况下直接创建图片、附件、文件、视频块

**示例:** 在文档中创建一个文本块，内容为"Hello World"

**返回:** 新创建的块信息，包括块ID和富文本内容`,
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 查询: "${query}"`);
      const recommendations = await vectorSearch.recommendTools(
        query,
        mcpClient,
      );

      if (recommendations.length > 0) {
        console.log(`✅ 找到 ${recommendations.length} 个推荐工具:`);
        recommendations.forEach((tool, index) => {
          console.log(
            `   ${index + 1}. ${tool.tool_name} (相似度: ${tool.similarity.toFixed(4)})`,
          );
          if (tool.description) {
            console.log(
              `      描述: ${tool.description.substring(0, 100)}${tool.description.length > 100 ? "..." : ""}`,
            );
          }
        });
      } else {
        console.log("❌ 未找到相关工具");
      }
    }

    // 获取统计信息
    console.log("\n📊 获取向量搜索统计信息...");
    const stats = await vectorSearch.getSearchStats();
    console.log("统计信息:", stats);

    // 关闭向量搜索引擎
    await vectorSearch.close();

    console.log("🎉 向量搜索功能测试完成！");
  } catch (error) {
    console.error("❌ 向量搜索测试失败:", (error as Error).message);
  }
}

// 数据库初始化测试
async function testDatabaseInit(): Promise<void> {
  try {
    const vectorSearch = new VectorSearch();
    await vectorSearch.initialize();

    const stats = await vectorSearch.getSearchStats();
    console.log("✅ 数据库初始化成功，统计信息:", stats);

    await vectorSearch.close();
  } catch (error) {
    console.error("❌ 数据库初始化测试失败:", (error as Error).message);
  }
}

// 导出函数供其他模块使用
export {
  greet,
  initializeMCPClient,
  getMCPClient,
  vectorizeString,
  vectorizeMultipleStrings,
  VectorSearch,
};

async function main(): Promise<void> {
  // 主应用函数
  console.log(greet("开发者"));
  console.log("项目启动成功! 🚀");

  // 初始化MCP客户端
  console.log("\n正在初始化MCP客户端...");
  const mcpClient = await initializeMCPClient();

  if (mcpClient) {
    console.log("MCP客户端已准备就绪，可以使用各种工具服务!");

    // 获取所有工具名称并生成动态服务器名称
    const tools = await mcpClient.getTools();
    const toolNames = tools.map((tool: any) => tool.name);
    const dynamicServerName = `dext-with-${toolNames.join(", ")}`;

    console.log(`动态服务器名称: ${dynamicServerName}`);

    // 将工具信息存储到全局变量供MCP服务器使用
    (global as any).mcpToolsInfo = {
      serverName: dynamicServerName,
      tools: tools,
    };

    // 启动MCP服务器
    console.log("\n正在启动MCP服务器...");
    await startMCPServer();
  } else {
    console.log("MCP客户端初始化失败，但应用仍可正常运行。");
    // 即使MCP客户端初始化失败，也启动基础的MCP服务器
    (global as any).mcpToolsInfo = {
      serverName: "dext",
      tools: [],
    };
    await startMCPServer();
  }
  // 如果设置了API密钥，自动运行测试
  if (
    process.env.EMBEDDING_API_KEY &&
    process.env.EMBEDDING_API_KEY !== "your-doubao-api-key-here"
  ) {
    console.log("\n检测到API密钥配置，开始向量化测试...");
    testVectorization().then(() => {
      // 向量化测试完成后，运行向量搜索测试
      if (mcpClient) {
        console.log("\n🔍 开始向量搜索功能测试...");
        testVectorSearch(mcpClient);
      }
    });
  } else {
    // 即使没有API密钥，也可以测试数据库初始化
    console.log("\n🗄️  测试数据库初始化功能...");
    testDatabaseInit();
  }
}

// 如果直接运行此文件，执行示例代码
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
