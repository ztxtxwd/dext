// 工具推荐API模块
// 提供简单易用的工具推荐接口

import VectorSearch from "./vector_search.js";

// 类型定义
export interface RecommendationOptions {
  topK?: number;
  threshold?: number;
  includeDetails?: boolean;
  format?: "simple" | "detailed" | "raw";
}

export interface BatchRecommendationResult {
  query: string;
  recommendations: any[];
  success: boolean;
  error?: string;
}

export interface SimpleRecommendation {
  name: string;
  similarity: number;
}

export interface DetailedRecommendation {
  rank: number;
  name: string;
  description?: string;
  similarity: number;
  confidence: string;
}

export interface SystemStatus {
  isReady: boolean;
  modelName?: string;
  hasMCPClient?: boolean;
  database?: any;
  searchEngine?: {
    isInitialized: boolean;
  };
  error?: string;
}

export interface InitializationOptions {
  autoIndex?: boolean;
  modelName?: string;
}

class ToolRecommender {
  public vectorSearch: VectorSearch | null = null;
  public isReady: boolean = false;
  public mcpClient: any = null;
  public modelName: string = "";

  /**
   * 初始化工具推荐系统
   * @param mcpClient - MCP客户端实例
   * @param options - 初始化选项
   */
  async initialize(
    mcpClient: any,
    options: InitializationOptions = {},
  ): Promise<void> {
    try {
      console.log("🚀 初始化工具推荐系统...");

      this.mcpClient = mcpClient;
      this.vectorSearch = new VectorSearch();

      // 初始化向量搜索引擎
      await this.vectorSearch.initialize();

      // 选项配置
      const {
        autoIndex = true, // 是否自动建立索引
        modelName = null, // 模型名称
      } = options;

      this.modelName =
        modelName ||
        process.env.EMBEDDING_MODEL_NAME ||
        "doubao-embedding-text-240715";

      // 自动为MCP工具建立向量索引
      if (autoIndex && mcpClient) {
        console.log("📊 自动为MCP工具建立向量索引...");
        await this.vectorSearch.indexMCPTools(mcpClient, this.modelName);
      }

      this.isReady = true;
      console.log("✅ 工具推荐系统初始化完成");
    } catch (error: any) {
      console.error("❌ 工具推荐系统初始化失败:", error.message);
      throw error;
    }
  }

  /**
   * 推荐工具 - 主要API接口
   * @param query - 用户查询文本
   * @param options - 推荐选项
   * @returns 推荐工具列表
   */
  async recommend(
    query: string,
    options: RecommendationOptions = {},
  ): Promise<any[]> {
    try {
      if (!this.isReady) {
        throw new Error("工具推荐系统未初始化");
      }

      const {
        topK = 3, // 返回前K个结果
        threshold = 0.1, // 相似度阈值
        includeDetails = false, // 是否包含详细信息
        format = "simple", // 返回格式: simple, detailed, raw
      } = options;

      console.log(`🔍 推荐工具: "${query}"`);

      // 获取推荐结果
      const recommendations = await this.vectorSearch!.recommendTools(
        query,
        this.mcpClient,
        this.modelName,
        { topK, threshold, includeDetails: true },
      );

      // 根据格式要求返回结果
      return this.formatResults(recommendations, format, includeDetails);
    } catch (error: any) {
      console.error("❌ 工具推荐失败:", error.message);
      throw error;
    }
  }

  /**
   * 批量推荐工具
   * @param queries - 查询文本数组
   * @param options - 推荐选项
   * @returns 批量推荐结果
   */
  async batchRecommend(
    queries: string[],
    options: RecommendationOptions = {},
  ): Promise<BatchRecommendationResult[]> {
    try {
      console.log(`🔍 批量推荐工具: ${queries.length} 个查询`);

      const results: BatchRecommendationResult[] = [];

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`📋 处理查询 ${i + 1}/${queries.length}: "${query}"`);

        try {
          const recommendations = await this.recommend(query, options);
          results.push({
            query,
            recommendations,
            success: true,
          });
        } catch (error: any) {
          console.warn(`⚠️  查询失败 "${query}": ${error.message}`);
          results.push({
            query,
            recommendations: [],
            success: false,
            error: error.message,
          });
        }
      }

      console.log(`✅ 批量推荐完成: ${results.length} 个结果`);
      return results;
    } catch (error: any) {
      console.error("❌ 批量工具推荐失败:", error.message);
      throw error;
    }
  }

  /**
   * 获取最佳工具推荐 (返回相似度最高的单个工具)
   * @param query - 用户查询文本
   * @param threshold - 最低相似度阈值
   * @returns 最佳推荐工具或null
   */
  async getBestTool(
    query: string,
    threshold: number = 0.3,
  ): Promise<any | null> {
    try {
      const recommendations = await this.recommend(query, {
        topK: 1,
        threshold,
        format: "detailed",
      });

      return recommendations.length > 0 ? recommendations[0] : null;
    } catch (error: any) {
      console.error("❌ 获取最佳工具失败:", error.message);
      throw error;
    }
  }

  /**
   * 格式化推荐结果
   * @param recommendations - 原始推荐结果
   * @param format - 格式类型
   * @param includeDetails - 是否包含详细信息
   * @returns 格式化后的结果
   */
  formatResults(
    recommendations: any[],
    format: string,
    includeDetails: boolean,
  ): any[] {
    switch (format) {
      case "simple":
        return recommendations.map((tool) => ({
          name: tool.tool_name,
          similarity: parseFloat(tool.similarity.toFixed(4)),
        })) as SimpleRecommendation[];

      case "detailed":
        return recommendations.map((tool) => ({
          rank: tool.rank,
          name: tool.tool_name,
          description: tool.description,
          similarity: parseFloat(tool.similarity.toFixed(4)),
          confidence: this.getConfidenceLevel(tool.similarity),
        })) as DetailedRecommendation[];

      case "raw":
        return recommendations;

      default:
        return includeDetails
          ? this.formatResults(recommendations, "detailed", true)
          : this.formatResults(recommendations, "simple", false);
    }
  }

  /**
   * 根据相似度获取置信度等级
   * @param similarity - 相似度分数
   * @returns 置信度等级
   */
  getConfidenceLevel(similarity: number): string {
    if (similarity >= 0.8) return "very_high";
    if (similarity >= 0.6) return "high";
    if (similarity >= 0.4) return "medium";
    if (similarity >= 0.2) return "low";
    return "very_low";
  }

  /**
   * 重新索引MCP工具
   * @returns 索引结果
   */
  async reindex(): Promise<number[]> {
    try {
      if (!this.isReady) {
        throw new Error("工具推荐系统未初始化");
      }

      console.log("🔄 重新索引MCP工具...");
      const results = await this.vectorSearch!.indexMCPTools(
        this.mcpClient,
        this.modelName,
      );
      console.log("✅ 重新索引完成");

      return results;
    } catch (error: any) {
      console.error("❌ 重新索引失败:", error.message);
      throw error;
    }
  }

  /**
   * 获取系统状态和统计信息
   * @returns 系统状态
   */
  async getStatus(): Promise<SystemStatus> {
    try {
      const status: SystemStatus = {
        isReady: this.isReady,
        modelName: this.modelName,
        hasMCPClient: !!this.mcpClient,
      };

      if (this.vectorSearch) {
        const searchStats = await this.vectorSearch.getSearchStats();
        status.database = searchStats.database;
        status.searchEngine = {
          isInitialized: searchStats.isInitialized,
        };
      }

      return status;
    } catch (error: any) {
      console.error("❌ 获取状态失败:", error.message);
      return {
        isReady: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索相似工具 (不依赖MCP客户端)
   * @param query - 查询文本
   * @param options - 搜索选项
   * @returns 相似工具MD5列表
   */
  async searchSimilar(
    query: string,
    options: RecommendationOptions = {},
  ): Promise<any[]> {
    try {
      if (!this.isReady) {
        throw new Error("工具推荐系统未初始化");
      }

      const { topK = 5, threshold = 0.1 } = options;

      const results = await this.vectorSearch!.searchSimilarTools(
        query,
        this.modelName,
        topK,
        threshold,
      );

      return results;
    } catch (error: any) {
      console.error("❌ 搜索相似工具失败:", error.message);
      throw error;
    }
  }

  /**
   * 关闭工具推荐系统
   */
  async close(): Promise<void> {
    try {
      if (this.vectorSearch) {
        await this.vectorSearch.close();
      }

      this.isReady = false;
      console.log("✅ 工具推荐系统已关闭");
    } catch (error: any) {
      console.error("❌ 关闭工具推荐系统失败:", error.message);
      throw error;
    }
  }
}

// 创建全局实例
let globalRecommender: ToolRecommender | null = null;

/**
 * 获取全局工具推荐实例
 * @returns 工具推荐实例
 */
export function getRecommender(): ToolRecommender {
  if (!globalRecommender) {
    globalRecommender = new ToolRecommender();
  }
  return globalRecommender;
}

/**
 * 快速推荐工具 - 便捷函数
 * @param query - 查询文本
 * @param mcpClient - MCP客户端
 * @param options - 选项
 * @returns 推荐结果
 */
export async function recommendTools(
  query: string,
  mcpClient: any,
  options: RecommendationOptions = {},
): Promise<any[]> {
  const recommender = getRecommender();

  if (!recommender.isReady) {
    await recommender.initialize(mcpClient, { autoIndex: true });
  }

  return recommender.recommend(query, options);
}

export default ToolRecommender;
