// 测试相似工具检测和删除功能
import VectorSearch from "./vector_search.js";
import { vectorizeString } from "./index.js";

async function testSimilarToolDetection(): Promise<void> {
  try {
    console.log("🧪 开始测试相似工具检测和删除功能...");

    // 初始化向量搜索引擎
    const vectorSearch = new VectorSearch();
    await vectorSearch.initialize();

    // 测试字符串相似度计算
    console.log("\n📊 测试字符串相似度计算:");
    const testCases: [string, string][] = [
      ["docx_block_create", "docx_block_create"],
      ["docx_block_create", "docx_block_update"],
      ["file_upload", "file_download"],
      ["completely_different", "totally_other"],
    ];

    for (const [str1, str2] of testCases) {
      const similarity = vectorSearch.calculateNameSimilarity(str1, str2);
      console.log(`   "${str1}" vs "${str2}": ${similarity.toFixed(4)}`);
    }

    // 测试相似工具识别
    console.log("\n🔍 测试相似工具识别:");

    // 创建一些测试工具数据
    const testTools = [
      {
        tool_md5: "abc123",
        tool_name: "existing_tool_v1",
        description: "这是一个现有的工具，用于文档处理",
        similarity: 0.98, // 高相似度
        distance: 0.02,
        model_name: "test-model",
        created_at: new Date().toISOString(),
      },
      {
        tool_md5: "def456",
        tool_name: "different_tool",
        description: "这是一个完全不同的工具",
        similarity: 0.5, // 低相似度
        distance: 0.5,
        model_name: "test-model",
        created_at: new Date().toISOString(),
      },
      {
        tool_md5: "ghi789",
        tool_name: "similar_tool",
        description: "这是一个类似的工具，用于文档处理功能",
        similarity: 0.96, // 接近阈值但未达到
        distance: 0.04,
        model_name: "test-model",
        created_at: new Date().toISOString(),
      },
    ];

    const toDelete = vectorSearch.identifySimilarToolsToDelete(
      "new_tool_v2",
      "这是一个新的工具，用于文档处理和编辑",
      testTools,
      0.97, // 阈值
    );

    console.log(`✅ 识别结果：需要删除 ${toDelete.length} 个工具`);
    toDelete.forEach((tool) => {
      console.log(`   - ${tool.tool_name} (相似度: ${tool.similarity})`);
    });

    // 获取统计信息
    console.log("\n📊 数据库统计信息:");
    const stats = await vectorSearch.getSearchStats();
    console.log(stats);

    await vectorSearch.close();
    console.log("\n🎉 测试完成！");
  } catch (error: any) {
    console.error("❌ 测试失败:", error.message);
    console.error(error.stack);
  }
}

// 运行测试
testSimilarToolDetection().catch(console.error);
