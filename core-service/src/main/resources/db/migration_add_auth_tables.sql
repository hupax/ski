-- ==================== 用户认证系统数据库迁移 ====================
-- 执行时间: 添加用户认证功能时
-- 说明: 创建用户表、角色表、OAuth绑定表、邮箱验证表、密码重置表

-- ==================== Users Table (核心用户表) ====================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255),  -- BCrypt加密，OAuth用户可为NULL
    avatar_url VARCHAR(500),
    provider VARCHAR(20) NOT NULL DEFAULT 'email',  -- email/google/github/wechat
    provider_id VARCHAR(100),  -- 第三方平台用户ID
    email_verified BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    CONSTRAINT chk_provider CHECK (provider IN ('email', 'google', 'github', 'wechat')),
    CONSTRAINT uq_provider_id UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.email IS '邮箱地址（唯一）';
COMMENT ON COLUMN users.username IS '用户名（唯一）';
COMMENT ON COLUMN users.password IS 'BCrypt加密的密码，OAuth用户可为NULL';
COMMENT ON COLUMN users.provider IS '注册方式: email/google/github/wechat';
COMMENT ON COLUMN users.provider_id IS '第三方平台用户ID';
COMMENT ON COLUMN users.email_verified IS '邮箱是否已验证';
COMMENT ON COLUMN users.enabled IS '账户是否启用';
COMMENT ON COLUMN users.locked IS '账户是否锁定';

-- ==================== User Roles Table (用户角色关联表) ====================
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_role CHECK (role IN ('ROLE_USER', 'ROLE_ADMIN', 'ROLE_VIP'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

COMMENT ON TABLE user_roles IS '用户角色关联表';
COMMENT ON COLUMN user_roles.role IS '角色: ROLE_USER, ROLE_ADMIN, ROLE_VIP';

-- ==================== OAuth Connections Table (OAuth绑定表) ====================
CREATE TABLE IF NOT EXISTS oauth_connections (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    provider_user_id VARCHAR(100) NOT NULL,
    access_token TEXT,  -- 可选：存储OAuth access token（需加密）
    refresh_token TEXT,  -- 可选：存储refresh token（需加密）
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_oauth_provider_user UNIQUE (provider, provider_user_id),
    CONSTRAINT chk_oauth_provider CHECK (provider IN ('google', 'github', 'wechat'))
);

CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider ON oauth_connections(provider);

COMMENT ON TABLE oauth_connections IS 'OAuth第三方账号绑定表';
COMMENT ON COLUMN oauth_connections.provider IS 'OAuth提供商: google/github/wechat';
COMMENT ON COLUMN oauth_connections.provider_user_id IS '第三方平台的用户ID';
COMMENT ON COLUMN oauth_connections.access_token IS 'OAuth access token（加密存储）';

-- ==================== Email Verification Tokens Table (邮箱验证令牌表) ====================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON email_verification_tokens(expires_at);

COMMENT ON TABLE email_verification_tokens IS '邮箱验证令牌表';
COMMENT ON COLUMN email_verification_tokens.token IS '验证令牌（UUID）';
COMMENT ON COLUMN email_verification_tokens.expires_at IS '过期时间（默认24小时）';

-- ==================== Password Reset Tokens Table (密码重置令牌表) ====================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires_at ON password_reset_tokens(expires_at);

COMMENT ON TABLE password_reset_tokens IS '密码重置令牌表';
COMMENT ON COLUMN password_reset_tokens.token IS '重置令牌（UUID）';
COMMENT ON COLUMN password_reset_tokens.expires_at IS '过期时间（默认1小时）';
COMMENT ON COLUMN password_reset_tokens.used IS '是否已使用';

-- ==================== 添加外键关联 ====================
-- 为现有的 sessions 表添加外键约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_sessions_user_id'
    ) THEN
        ALTER TABLE sessions
        ADD CONSTRAINT fk_sessions_user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 为现有的 user_configs 表添加外键约束（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_user_configs_user_id'
    ) THEN
        ALTER TABLE user_configs
        ADD CONSTRAINT fk_user_configs_user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- ==================== 添加触发器：自动更新 updated_at ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Users表更新触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- OAuth Connections表更新触发器
DROP TRIGGER IF EXISTS update_oauth_connections_updated_at ON oauth_connections;
CREATE TRIGGER update_oauth_connections_updated_at
    BEFORE UPDATE ON oauth_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== 初始化数据 ====================
-- 创建默认管理员用户（密码: admin123，需要在应用启动时修改）
-- 注意：实际生产环境中应该删除或修改此默认用户
INSERT INTO users (email, username, password, provider, email_verified, enabled)
VALUES (
    'admin@skiuo.com',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYCj4XqvQqO',  -- BCrypt(admin123)
    'email',
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- 为管理员添加角色
INSERT INTO user_roles (user_id, role)
SELECT id, 'ROLE_ADMIN' FROM users WHERE email = 'admin@skiuo.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'ROLE_USER' FROM users WHERE email = 'admin@skiuo.com'
ON CONFLICT (user_id, role) DO NOTHING;
