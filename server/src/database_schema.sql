-- SQLite数据库表结构设计（使用sqlite-vec向量搜索版）
-- 用于存储工具的向量化数据，实现高效的向量相似性搜索

-- 工具向量表 (使用sqlite-vec)
CREATE TABLE IF NOT EXISTS tool_vectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_md5 TEXT NOT NULL,                         -- 工具名称+描述的MD5哈希值
    model_name TEXT NOT NULL,                       -- 向量化使用的模型名称
    tool_name TEXT NOT NULL,                        -- 工具名称（用于调试）
    description TEXT,                               -- 工具描述（用于调试）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建向量索引表 (sqlite-vec)
CREATE VIRTUAL TABLE IF NOT EXISTS vec_tool_embeddings USING vec0(
    tool_vector FLOAT[2560]                         -- 向量数据，假设使用2560维度
);

-- 工具元数据映射表
CREATE TABLE IF NOT EXISTS tool_mapping (
    rowid INTEGER PRIMARY KEY,                      -- 对应vec_tool_embeddings的rowid
    tool_id INTEGER NOT NULL,                       -- 对应tool_vectors的id
    FOREIGN KEY (tool_id) REFERENCES tool_vectors(id) ON DELETE CASCADE
);

-- MCP服务器配置表
CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_name TEXT NOT NULL UNIQUE,              -- 服务器名称（唯一键）
    server_type TEXT NOT NULL CHECK (server_type IN ('http', 'stdio', 'sse')), -- 服务器类型
    url TEXT,                                      -- HTTP/SSE服务器URL（仅http和sse类型）
    command TEXT,                                  -- 命令（仅stdio类型）
    args TEXT,                                     -- 命令参数（JSON格式，仅stdio类型）
    headers TEXT,                                  -- HTTP头部（JSON格式，仅http和sse类型）
    env TEXT,                                      -- 环境变量（JSON格式）
    description TEXT,                              -- 服务器描述
    enabled INTEGER DEFAULT 1 CHECK (enabled IN (0, 1)), -- 是否启用（0=禁用，1=启用）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Session工具检索历史表
CREATE TABLE IF NOT EXISTS session_tool_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,                      -- 会话ID
    tool_md5 TEXT NOT NULL,                        -- 工具MD5
    tool_name TEXT NOT NULL,                       -- 工具名称
    retrieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,-- 检索时间
    UNIQUE(session_id, tool_md5)                   -- 防止重复记录
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tool_vectors_md5 ON tool_vectors(tool_md5);
CREATE INDEX IF NOT EXISTS idx_tool_vectors_model ON tool_vectors(model_name);
CREATE INDEX IF NOT EXISTS idx_tool_vectors_name ON tool_vectors(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_mapping_tool_id ON tool_mapping(tool_id);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(server_name);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_type ON mcp_servers(server_type);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_tool_history(session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_tool_md5 ON session_tool_history(tool_md5);

-- 创建视图方便查询
CREATE VIEW IF NOT EXISTS v_tool_search AS
SELECT
    tv.id,
    tv.tool_md5,
    tv.model_name,
    tv.tool_name,
    tv.description,
    tv.created_at,
    tv.updated_at
FROM tool_vectors tv;

-- MCP服务器配置视图
CREATE VIEW IF NOT EXISTS v_mcp_servers AS
SELECT
    ms.id,
    ms.server_name,
    ms.server_type,
    ms.url,
    ms.command,
    ms.args,
    ms.headers,
    ms.env,
    ms.description,
    ms.enabled,
    ms.created_at,
    ms.updated_at
FROM mcp_servers ms;
