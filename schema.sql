-- Sun-Panel D1 Database Schema

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT DEFAULT '',
    head_image TEXT DEFAULT '',
    status INTEGER DEFAULT 1,       -- 1:启用 2:停用 3:未激活
    role INTEGER DEFAULT 2,         -- 1:管理员 2:普通用户
    mail TEXT DEFAULT '',
    token TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 图标分组表
CREATE TABLE IF NOT EXISTS item_icon_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon TEXT DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    sort INTEGER DEFAULT 0,
    public_visible INTEGER DEFAULT 1,     -- 1:访客可见 0:访客不可见
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 图标表
CREATE TABLE IF NOT EXISTS item_icons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icon_json TEXT DEFAULT '',           -- JSON: {itemType, src, text, backgroundColor}
    title TEXT NOT NULL DEFAULT '',
    url TEXT DEFAULT '',
    description TEXT DEFAULT '',
    open_method INTEGER DEFAULT 0,       -- 打开方式
    sort INTEGER DEFAULT 0,
    item_icon_group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (item_icon_group_id) REFERENCES item_icon_groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 用户配置表
CREATE TABLE IF NOT EXISTS user_configs (
    user_id INTEGER PRIMARY KEY,
    panel_json TEXT DEFAULT '{}',         -- 面板样式 JSON
    search_engine_json TEXT DEFAULT '{}', -- 搜索引擎配置 JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_name TEXT NOT NULL UNIQUE,
    config_value TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_item_icons_group_id ON item_icons(item_icon_group_id);
CREATE INDEX IF NOT EXISTS idx_item_icons_user_id ON item_icons(user_id);
CREATE INDEX IF NOT EXISTS idx_item_icon_groups_user_id ON item_icon_groups(user_id);

-- 默认管理员 (密码: admin123)，仅在 users 表为空时插入
INSERT INTO users (id, username, password, name, role, status)
SELECT 1, 'admin@sun.com', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'Admin', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM users);