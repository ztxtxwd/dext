// 向量搜索和工具推荐模块 (使用sqlite-vec)
import VectorDatabase, { SearchResult, ToolData } from "./database.js";
import { vectorizeString } from "./index.js";

// 类型定义
export interface SimilarTool {
  tool_md5: string;
  tool_name: string;
  description: string | null;
  similarity: number;
  distance: number;
  model_name: string;
  created_at: string;
}

export interface MatchedTool {
  similarity: number;
  distance: number;
  tool_md5: string;
  mcp_tool: any; // MCP工具的原始类型
  tool_name: string;
  description: string;
}

export interface RecommendationResult {
  rank: number;
  tool_name: string;
  similarity: number;
  distance: number;
  tool_md5: string;
  description?: string;
  mcp_tool?: any;
}

export interface SearchOptions {
  topK?: number;
  threshold?: number;
  includeDetails?: boolean;
  serverNames?: string[];
  modelName?: string;
}

export interface SearchStats {
  isInitialized: boolean;
  database: any; // DatabaseStats from database.ts
  engine: string;
}

export interface ToolToVectorize {
  toolName: string;
  description: string;
  vector?: number[];
  originalTool?: any;
}

export interface MCPToolInfo {
  name?: string;
  tool_name?: string;
  description?: string;
  schema?: any;
  outputSchema?: any;
}

export interface ClearIndexOptions {
  modelName?: string;
}

export interface MCPClient {
  getTools(): Promise<MCPToolInfo[]>;
}

class VectorSearch {
  public db: VectorDatabase;
  public isInitialized: boolean;

  constructor() {
    this.db = new VectorDatabase();
    this.isInitialized = false;
  }

  /**
   * 初始化向量搜索引擎
   */
  async initialize(): Promise<void> {
    try {
      await this.db.initialize();
      this.isInitialized = true;
      console.log(
        "🔍 向量搜索引擎初始化成功 (使用better-sqlite3 + sqlite-vec)",
      );
    } catch (error) {
      console.error("❌ 向量搜索引擎初始化失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 搜索最相似的工具 (使用sqlite-vec的高效搜索)
   * @param query - 用户查询文本
   * @param modelName - 使用的模型名称
   * @param topK - 返回最相似的K个结果
   * @param threshold - 相似度阈值 (0-1之间)
   * @param serverNames - 可选的服务器名称列表，用于过滤工具
   * @returns 相似工具列表
   */
  async searchSimilarTools(
    query: string,
    modelName: string,
    topK: number = 5,
    threshold: number = 0.1,
    serverNames: string[] | null = null,
  ): Promise<SimilarTool[]> {
    try {
      if (!this.isInitialized) {
        throw new Error("向量搜索引擎未初始化");
      }

      const serverInfo =
        serverNames && serverNames.length > 0
          ? ` (服务器过滤: ${serverNames.join(", ")})`
          : "";
      console.log(
        `🔍 开始搜索: "${query}" (模型: ${modelName}, topK: ${topK}${serverInfo})`,
      );

      // 1. 将查询文本向量化
      const queryVector = await vectorizeString(query);
      console.log(`📊 查询向量维度: ${queryVector.length}`);

      // 2. 使用sqlite-vec进行高效的向量相似性搜索
      const results: SearchResult[] = await this.db.searchSimilarVectors(
        queryVector,
        topK,
        threshold,
        serverNames,
      );

      if (results.length === 0) {
        console.log("⚠️  没有找到满足条件的相似工具");
        return [];
      }

      console.log(
        `✅ 搜索完成，找到 ${results.length} 个相似工具 (阈值: ${threshold})`,
      );

      // 输出详细结果
      results.forEach((result, index) => {
        console.log(
          `${index + 1}. ${result.tool_name} (相似度: ${result.similarity.toFixed(4)}, 距离: ${result.distance.toFixed(4)})`,
        );
      });

      return results.map((result) => ({
        tool_md5: result.tool_md5,
        tool_name: result.tool_name,
        description: result.description,
        similarity: result.similarity,
        distance: result.distance,
        model_name: result.model_name,
        created_at: result.created_at,
      }));
    } catch (error) {
      console.error("❌ 搜索相似工具失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 从MCP客户端中查找匹配的工具
   * @param similarTools - 相似工具列表
   * @param mcpClient - MCP客户端实例
   * @returns 匹配的MCP工具列表
   */
  async findMatchingMCPTools(
    similarTools: SimilarTool[],
    mcpClient: MCPClient,
  ): Promise<MatchedTool[]> {
    try {
      if (!mcpClient) {
        throw new Error("MCP客户端未提供");
      }

      console.log("🔄 从MCP客户端获取当前可用工具...");

      // 获取当前所有可用的MCP工具
      const availableTools: MCPToolInfo[] = await mcpClient.getTools();
      console.log(`📋 当前可用工具数量: ${availableTools.length}`);

      const matchedTools: MatchedTool[] = [];

      for (const similarTool of similarTools) {
        // 为每个相似工具的MD5，在当前MCP工具中查找匹配项
        for (const mcpTool of availableTools) {
          const toolName = mcpTool.name || mcpTool.tool_name || "";
          const description = mcpTool.description || "";
          const calculatedMD5 = this.db.generateToolMD5(toolName, description);

          if (calculatedMD5 === similarTool.tool_md5) {
            matchedTools.push({
              similarity: similarTool.similarity,
              distance: similarTool.distance,
              tool_md5: similarTool.tool_md5,
              mcp_tool: mcpTool,
              tool_name: toolName,
              description: description,
            });

            console.log(
              `✅ 找到匹配工具: ${toolName} (相似度: ${similarTool.similarity.toFixed(4)})`,
            );
            break;
          }
        }
      }

      console.log(`🎯 总共匹配到 ${matchedTools.length} 个可用工具`);
      return matchedTools;
    } catch (error) {
      console.error("❌ 查找匹配MCP工具失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 完整的工具推荐流程
   * @param query - 用户查询
   * @param mcpClient - MCP客户端实例
   * @param modelName - 模型名称
   * @param options - 搜索选项
   * @returns 推荐的工具列表
   */
  async recommendTools(
    query: string,
    mcpClient: MCPClient,
    modelName: string | null = null,
    options: SearchOptions = {},
  ): Promise<RecommendationResult[]> {
    try {
      // 使用默认模型名称
      const defaultModelName =
        modelName ||
        process.env.EMBEDDING_MODEL_NAME ||
        "doubao-embedding-text-240715";

      const {
        topK = 5,
        threshold = 0.1,
        includeDetails = true,
        serverNames = null,
      } = options;

      console.log(`🤖 开始工具推荐流程 (使用sqlite-vec)...`);
      console.log(`📝 查询: "${query}"`);
      console.log(`🔧 模型: ${defaultModelName}`);
      const serverInfo =
        serverNames && serverNames.length > 0
          ? `, 服务器过滤: ${serverNames.join(", ")}`
          : "";
      console.log(
        `⚙️  参数: topK=${topK}, threshold=${threshold}${serverInfo}`,
      );

      // 1. 搜索相似工具
      const similarTools: SimilarTool[] = await this.searchSimilarTools(
        query,
        defaultModelName,
        topK,
        threshold,
        serverNames,
      );

      if (similarTools.length === 0) {
        console.log("⚠️  未找到相似的工具");
        return [];
      }

      // 2. 在当前MCP工具中查找匹配项
      const matchedTools: MatchedTool[] = await this.findMatchingMCPTools(
        similarTools,
        mcpClient,
      );

      // 3. 格式化结果
      const recommendations: RecommendationResult[] = matchedTools.map(
        (tool, index) => {
          const result: RecommendationResult = {
            rank: index + 1,
            tool_name: tool.tool_name,
            similarity: tool.similarity,
            distance: tool.distance,
            tool_md5: tool.tool_md5,
          };

          if (includeDetails) {
            result.description = tool.description;
            result.mcp_tool = tool.mcp_tool;
          }

          return result;
        },
      );

      console.log(`🎉 工具推荐完成，返回 ${recommendations.length} 个推荐结果`);

      return recommendations;
    } catch (error) {
      console.error("❌ 工具推荐失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 为MCP工具批量生成和保存向量
   * @param mcpClient - MCP客户端实例
   * @param modelName - 模型名称
   * @returns 保存结果
   */
  async indexMCPTools(
    mcpClient: MCPClient,
    modelName: string | null = null,
  ): Promise<number[]> {
    try {
      const defaultModelName =
        modelName ||
        process.env.EMBEDDING_MODEL_NAME ||
        "doubao-embedding-text-240715";

      console.log("📊 开始为MCP工具建立向量索引 (使用sqlite-vec)...");
      console.log(`🔧 使用模型: ${defaultModelName}`);

      // 获取所有MCP工具
      const tools: MCPToolInfo[] = await mcpClient.getTools();
      console.log(`📋 获取到 ${tools.length} 个MCP工具`);

      const toolsToVectorize: ToolToVectorize[] = [];

      for (const tool of tools) {
        const toolName = tool.name || tool.tool_name || "";
        const description = tool.description || "";

        if (toolName) {
          // 检查是否已经存在
          const toolMD5 = this.db.generateToolMD5(toolName, description);
          const existing = await this.db.getToolByMD5(
            toolMD5,
            defaultModelName,
          );

          if (!existing) {
            toolsToVectorize.push({
              toolName,
              description,
              originalTool: tool,
            });
          } else {
            console.log(`⏭️  跳过已存在的工具: ${toolName}`);
          }
        }
      }

      if (toolsToVectorize.length === 0) {
        console.log("✅ 所有工具都已建立索引，无需重复处理");
        return [];
      }

      console.log(`🎯 准备向量化 ${toolsToVectorize.length} 个新工具`);

      // 向量化并检查相似工具
      const vectorizedTools: ToolToVectorize[] = [];
      const deletedToolsCount = { total: 0 };

      for (let i = 0; i < toolsToVectorize.length; i++) {
        const tool = toolsToVectorize[i];
        try {
          console.log(
            `📊 向量化进度: ${i + 1}/${toolsToVectorize.length} - ${tool.toolName}`,
          );

          // 1. 先向量化工具
          const vector = await vectorizeString(
            `${tool.toolName} ${tool.description}`.trim(),
          );

          // 2. 在保存前检查是否有相似工具需要删除
          console.log(`🔍 检查是否存在相似工具: ${tool.toolName}`);

          try {
            // 使用新工具的向量搜索相似工具
            const queryVector = vector;
            const similarTools: SearchResult[] =
              await this.db.searchSimilarVectors(queryVector, 10, 0.7);

            if (similarTools.length > 0) {
              console.log(`📊 找到 ${similarTools.length} 个候选相似工具`);

              // 判断是否需要删除相似工具（使用0.96的严格阈值）
              const toDelete = this.identifySimilarToolsToDelete(
                tool.toolName,
                tool.description,
                similarTools as any,
                0.96,
              );

              // 删除被判定为过时的相似工具
              for (const oldTool of toDelete) {
                try {
                  const deletedCount = await this.db.deleteToolVector(
                    oldTool.tool_md5,
                    defaultModelName,
                  );
                  if (deletedCount > 0) {
                    deletedToolsCount.total += deletedCount;
                    console.log(
                      `🗑️  已删除相似工具: ${oldTool.tool_name} (相似度: ${oldTool.similarity.toFixed(4)})`,
                    );
                  }
                } catch (deleteError) {
                  console.warn(
                    `⚠️  删除工具失败 "${oldTool.tool_name}": ${(deleteError as Error).message}`,
                  );
                }
              }

              if (toDelete.length > 0) {
                console.log(
                  `✅ 为新工具 "${tool.toolName}" 清理了 ${toDelete.length} 个相似的旧工具`,
                );
              }
            }
          } catch (searchError) {
            console.warn(
              `⚠️  搜索相似工具失败 "${tool.toolName}": ${(searchError as Error).message}`,
            );
          }

          // 3. 添加到待保存列表
          vectorizedTools.push({
            toolName: tool.toolName,
            description: tool.description,
            vector: vector,
          });
        } catch (error) {
          console.warn(
            `⚠️  跳过工具 "${tool.toolName}": ${(error as Error).message}`,
          );
        }
      }

      // 批量保存到数据库
      const saveResults: number[] = await this.db.saveToolVectorsBatch(
        vectorizedTools as ToolData[],
        defaultModelName,
      );

      console.log(`✅ 向量索引建立完成 (使用sqlite-vec):`);
      console.log(`   - 总工具数: ${tools.length}`);
      console.log(`   - 新增向量化: ${vectorizedTools.length}`);
      console.log(`   - 保存到数据库: ${saveResults.length}`);
      console.log(`   - 删除相似工具: ${deletedToolsCount.total}`);

      return saveResults;
    } catch (error) {
      console.error("❌ 建立MCP工具向量索引失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 计算两个字符串的相似度 (使用Levenshtein距离)
   * @param str1 - 第一个字符串
   * @param str2 - 第二个字符串
   * @returns 相似度分数 (0-1之间)
   */
  calculateNameSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    // 计算Levenshtein距离
    const matrix: number[][] = Array(len2 + 1)
      .fill(0)
      .map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i] + 1, // 删除
            matrix[j][i - 1] + 1, // 插入
            matrix[j - 1][i - 1] + 1, // 替换
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    return 1 - distance / maxLen;
  }

  /**
   * 识别需要删除的相似工具
   * @param newToolName - 新工具名称
   * @param newDescription - 新工具描述
   * @param similarTools - 相似工具列表
   * @param similarityThreshold - 相似度阈值 (默认0.96)
   * @returns 需要删除的工具列表
   */
  identifySimilarToolsToDelete(
    newToolName: string,
    newDescription: string,
    similarTools: SimilarTool[],
    similarityThreshold: number = 0.96,
  ): SimilarTool[] {
    const toDelete: SimilarTool[] = [];

    console.log(
      `🔍 检查 ${similarTools.length} 个相似工具是否需要删除 (阈值: ${similarityThreshold})`,
    );

    for (const similar of similarTools) {
      const vectorSimilarity = similar.similarity;
      const nameSimilarity = this.calculateNameSimilarity(
        newToolName,
        similar.tool_name,
      );

      console.log(`📊 工具 "${similar.tool_name}":`);
      console.log(`   - 向量相似度: ${vectorSimilarity.toFixed(4)}`);
      console.log(`   - 名称相似度: ${nameSimilarity.toFixed(4)}`);

      // 判断逻辑：向量相似度 >= 0.96 则认为是非常相似的工具
      if (vectorSimilarity >= similarityThreshold) {
        console.log(`🎯 判定为非常相似工具，将被删除: ${similar.tool_name}`);
        toDelete.push(similar);
      } else {
        console.log(`✅ 保留工具: ${similar.tool_name} (相似度未达到阈值)`);
      }
    }

    console.log(`🗑️  总共需要删除 ${toDelete.length} 个相似工具`);
    return toDelete;
  }

  /**
   * 直接搜索向量 (不依赖MCP客户端)
   * @param query - 查询文本
   * @param options - 搜索选项
   * @returns 相似工具MD5列表
   */
  async searchSimilar(
    query: string,
    options: SearchOptions = {},
  ): Promise<SimilarTool[]> {
    try {
      if (!this.isInitialized) {
        throw new Error("向量搜索引擎未初始化");
      }

      const {
        topK = 5,
        threshold = 0.1,
        modelName = process.env.EMBEDDING_MODEL_NAME ||
          "doubao-embedding-text-240715",
      } = options;

      const results = await this.searchSimilarTools(
        query,
        modelName,
        topK,
        threshold,
      );
      return results;
    } catch (error) {
      console.error("❌ 搜索相似工具失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 获取搜索引擎统计信息
   */
  async getSearchStats(): Promise<SearchStats> {
    try {
      const dbStats = await this.db.getStats();
      return {
        isInitialized: this.isInitialized,
        database: dbStats,
        engine: "sqlite-vec",
      };
    } catch (error) {
      console.error("❌ 获取搜索统计信息失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 清理索引
   * @param modelName - 模型名称
   * @returns 清理的记录数
   */
  async clearIndex(modelName: string | null = null): Promise<void> {
    try {
      const defaultModelName =
        modelName ||
        process.env.EMBEDDING_MODEL_NAME ||
        "doubao-embedding-text-240715";

      console.log(`🗑️  清理向量索引: ${defaultModelName}`);

      // 这里需要清理向量表中的数据
      // 由于sqlite-vec的限制，我们需要重新创建表
      this.db.db!.exec("DELETE FROM vec_tool_embeddings");
      this.db.db!.exec("DELETE FROM tool_mapping");
      this.db.db!.exec(
        `DELETE FROM tool_vectors WHERE model_name = '${defaultModelName}'`,
      );

      console.log("✅ 向量索引清理完成");
    } catch (error) {
      console.error("❌ 清理向量索引失败:", (error as Error).message);
      throw error;
    }
  }

  /**
   * 关闭向量搜索引擎
   */
  async close(): Promise<void> {
    try {
      await this.db.close();
      this.isInitialized = false;
      console.log("✅ 向量搜索引擎已关闭");
    } catch (error) {
      console.error("❌ 关闭向量搜索引擎失败:", (error as Error).message);
      throw error;
    }
  }
}

export default VectorSearch;
