#!/usr/bin/env node

// MCP服务器配置迁移脚本
// 从配置文件迁移到数据库

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import VectorDatabase from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 类型定义
interface MCPServerConfig {
  [serverName: string]: {
    command?: string;
    args?: string[];
    env?: { [key: string]: string };
    url?: string;
    headers?: { [key: string]: string };
    description?: string;
  };
}

interface MCPConfigFile {
  servers: MCPServerConfig;
}

async function migrateMcpServers(): Promise<void> {
  console.log("🚀 开始从JSON文件迁移MCP服务器配置到数据库...");
  console.log("ℹ️ 注意：该功能仅用于从旧的mcp-servers.json文件迁移配置");
  console.log("ℹ️ 现在推荐直接使用数据库API管理服务器配置");

  try {
    // 1. 读取配置文件
    const configPath = path.join(process.cwd(), "mcp-servers.json");
    let mcpConfig: MCPConfigFile;

    try {
      const configData = fs.readFileSync(configPath, "utf8");
      mcpConfig = JSON.parse(configData);
      console.log(`📁 成功读取配置文件: ${configPath}`);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log("ℹ️ 配置文件不存在，无需迁移");
        console.log("💡 如需添加MCP服务器，请使用API接口：");
        console.log("   POST /api/mcp-servers");
        return;
      }
      throw new Error(`读取配置文件失败: ${error.message}`);
    }

    if (!mcpConfig.servers || Object.keys(mcpConfig.servers).length === 0) {
      console.log("ℹ️ 配置文件中没有服务器配置，无需迁移");
      console.log("💡 如需添加MCP服务器，请使用API接口：");
      console.log("   POST /api/mcp-servers");
      return;
    }

    // 2. 初始化数据库
    console.log("🗄️ 初始化数据库...");
    const vectorDatabase = new VectorDatabase();
    await vectorDatabase.initialize();
    const db = vectorDatabase.db!;

    // 3. 迁移每个服务器配置
    const servers = mcpConfig.servers;
    let migratedCount = 0;
    let skippedCount = 0;

    for (const [serverName, serverConfig] of Object.entries(servers)) {
      try {
        // 检查服务器是否已存在
        const existing = db
          .prepare("SELECT id FROM mcp_servers WHERE server_name = ?")
          .get(serverName);

        if (existing) {
          console.log(`⚠️ 服务器 ${serverName} 已存在于数据库中，跳过迁移`);
          skippedCount++;
          continue;
        }

        // 确定服务器类型
        let serverType: string,
          url: string | null,
          command: string | null,
          args: string | null;

        if (serverConfig.url) {
          serverType = "http";
          url = serverConfig.url;
          command = null;
          args = null;
        } else if (serverConfig.command && serverConfig.args) {
          serverType = "stdio";
          command = serverConfig.command;
          args = JSON.stringify(serverConfig.args);
          url = null;
        } else {
          console.log(`❌ 服务器 ${serverName} 配置无效，跳过迁移`);
          skippedCount++;
          continue;
        }

        // 准备其他字段
        const headers = serverConfig.headers
          ? JSON.stringify(serverConfig.headers)
          : null;
        const env = serverConfig.env ? JSON.stringify(serverConfig.env) : null;
        const description = serverConfig.description || null;
        const enabled = 1; // 默认启用

        // 插入数据库
        const stmt = db.prepare(`
                    INSERT INTO mcp_servers (
                        server_name, server_type, url, command, args,
                        headers, env, description, enabled
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);

        const result = stmt.run(
          serverName,
          serverType,
          url,
          command,
          args,
          headers,
          env,
          description,
          enabled,
        );

        console.log(
          `✅ 迁移服务器: ${serverName} (ID: ${result.lastInsertRowid}, 类型: ${serverType})`,
        );
        migratedCount++;
      } catch (error: any) {
        console.error(`❌ 迁移服务器 ${serverName} 失败:`, error.message);
        skippedCount++;
      }
    }

    // 4. 创建备份
    if (migratedCount > 0) {
      const backupPath = path.join(process.cwd(), "mcp-servers.json.backup");
      fs.copyFileSync(configPath, backupPath);
      console.log(`💾 配置文件已备份到: ${backupPath}`);

      // 提示用户可以删除原配置文件
      console.log("\n📝 迁移完成提示:");
      console.log("   - 配置已成功迁移到数据库");
      console.log("   - 原配置文件已备份");
      console.log("   - 确认迁移无误后，可以删除原配置文件");
      console.log(`   - 建议的删除命令: rm ${configPath}`);
    }

    console.log(`\n🎉 迁移完成! 成功: ${migratedCount}, 跳过: ${skippedCount}`);

    // 5. 清理
    vectorDatabase.close();
  } catch (error: any) {
    console.error("❌ 迁移失败:", error.message);
    process.exit(1);
  }
}

// 显示使用说明
function showUsage(): void {
  console.log(`
📖 MCP服务器配置迁移工具 (已弃用)

⚠️  注意：此工具仅用于从旧的mcp-servers.json文件迁移配置
💡 推荐使用API接口直接管理MCP服务器配置：
     GET    /api/mcp-servers     - 获取服务器列表
     POST   /api/mcp-servers     - 创建新服务器
     GET    /api/mcp-servers/:id - 获取特定服务器
     PUT    /api/mcp-servers/:id - 更新服务器
     DELETE /api/mcp-servers/:id - 删除服务器

用法 (仅迁移旧配置时使用):
  node migrate-mcp-servers.js

功能:
  - 从 mcp-servers.json 文件读取配置 (已弃用)
  - 将配置迁移到数据库 mcp_servers 表
  - 自动跳过已存在的服务器
  - 创建原配置文件的备份

注意:
  - 仅用于从旧配置文件迁移
  - 新项目请直接使用API接口管理配置
  - 迁移前请确保数据库已正确初始化
`);
}

// 检查命令行参数
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  showUsage();
  process.exit(0);
}

// 执行迁移
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateMcpServers().catch(console.error);
}

export { migrateMcpServers };
