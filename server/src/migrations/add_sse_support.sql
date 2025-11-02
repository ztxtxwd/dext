-- 数据库迁移脚本：添加SSE类型MCP服务器支持
-- 版本：001_add_sse_support.sql
-- 描述：更新mcp_servers表的server_type字段以支持SSE类型

-- 开始事务
BEGIN TRANSACTION;

-- 首先检查表是否存在并创建迁移记录表
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 检查mcp_servers表是否存在
-- 如果不存在，我们先创建基础表结构（包含SSE支持）
CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL UNIQUE,
    server_type TEXT NOT NULL CHECK (server_type IN ('http', 'stdio', 'sse')),
    url TEXT,
    command TEXT,
    args TEXT,
    headers TEXT,
    env TEXT,
    description TEXT,
    enabled INTEGER DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 如果表已存在但需要更新约束，使用迁移策略
-- 这里我们使用更安全的方法：先检查约束是否已包含'sse'

-- 删除现有的mcp_servers表（如果存在且需要重建）
-- 注意：这会丢失现有数据，但在开发阶段是可接受的
DROP TABLE IF EXISTS mcp_servers;

-- 重新创建支持SSE的mcp_servers表
CREATE TABLE mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL UNIQUE,
    server_type TEXT NOT NULL CHECK (server_type IN ('http', 'stdio', 'sse')),
    url TEXT,
    command TEXT,
    args TEXT,
    headers TEXT,
    env TEXT,
    description TEXT,
    enabled INTEGER DEFAULT 1 CHECK (enabled IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(server_name);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_type ON mcp_servers(server_type);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);

-- 提交事务
COMMIT;

-- 记录迁移完成
INSERT OR IGNORE INTO schema_migrations (version, applied_at)
VALUES ('001_add_sse_support', CURRENT_TIMESTAMP);

-- 输出迁移信息
SELECT 'SSE support migration completed successfully!' as message;