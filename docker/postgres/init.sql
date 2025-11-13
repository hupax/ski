-- ==================== Users Table (用户表) ====================
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
COMMENT ON COLUMN users.password IS 'BCrypt加密的密码，OAuth用户可为NULL';
COMMENT ON COLUMN users.provider IS '注册方式: email/google/github/wechat';

-- ==================== User Roles Table (用户角色表) ====================
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
    access_token TEXT,
    refresh_token TEXT,
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

-- ==================== Email Verification Tokens Table ====================
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

COMMENT ON TABLE email_verification_tokens IS '邮箱验证令牌表';

-- ==================== Password Reset Tokens Table ====================
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

COMMENT ON TABLE password_reset_tokens IS '密码重置令牌表';

-- ==================== Sessions Table ====================
CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECORDING',
    ai_model VARCHAR(50),
    analysis_mode VARCHAR(20),
    keep_video BOOLEAN DEFAULT false,
    storage_type VARCHAR(20) DEFAULT 'cos',
    master_video_path VARCHAR(500),
    last_window_start_time DOUBLE PRECISION,
    current_video_length DOUBLE PRECISION DEFAULT 0.0,
    title VARCHAR(50),
    video_duration DOUBLE PRECISION,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

COMMENT ON TABLE sessions IS 'Recording sessions';
COMMENT ON COLUMN sessions.status IS 'RECORDING/ANALYZING/COMPLETED/FAILED';
COMMENT ON COLUMN sessions.ai_model IS 'qwen/gemini';
COMMENT ON COLUMN sessions.analysis_mode IS 'FULL/SLIDING_WINDOW';
COMMENT ON COLUMN sessions.storage_type IS 'minio/oss/cos - storage service type';
COMMENT ON COLUMN sessions.master_video_path IS 'Local path to the master video file that grows with each chunk';
COMMENT ON COLUMN sessions.last_window_start_time IS 'Start time (seconds) of the last analyzed window, initial: -windowStep';
COMMENT ON COLUMN sessions.current_video_length IS 'Current total length (seconds) of master video';
COMMENT ON COLUMN sessions.title IS 'AI-generated session title (<=10 chars)';
COMMENT ON COLUMN sessions.video_duration IS 'Total video duration from FFmpeg (seconds)';

-- ==================== Video Chunks Table ====================
CREATE TABLE IF NOT EXISTS video_chunks (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    minio_path VARCHAR(500) NOT NULL,
    duration DOUBLE PRECISION,
    status VARCHAR(20) DEFAULT 'UPLOADED',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_chunks_session_id ON video_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_status ON video_chunks(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_chunks_session_chunk ON video_chunks(session_id, chunk_index);

COMMENT ON TABLE video_chunks IS 'Video chunks uploaded by users (less important after master video approach)';
COMMENT ON COLUMN video_chunks.status IS 'UPLOADED/ANALYZING/ANALYZED/DELETED';
COMMENT ON COLUMN video_chunks.duration IS 'Video chunk duration in seconds (floating point)';

-- ==================== Analysis Records Table ====================
CREATE TABLE IF NOT EXISTS analysis_records (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    chunk_id BIGINT,
    window_index INT,
    raw_content TEXT,
    refined_content TEXT NOT NULL,
    start_time_offset DOUBLE PRECISION,
    end_time_offset DOUBLE PRECISION,
    video_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES video_chunks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_records_session_id ON analysis_records(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_chunk_id ON analysis_records(chunk_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_window_index ON analysis_records(window_index);
CREATE INDEX IF NOT EXISTS idx_analysis_records_created_at ON analysis_records(created_at);

COMMENT ON TABLE analysis_records IS 'AI analysis results per window';
COMMENT ON COLUMN analysis_records.window_index IS 'Global window index (0, 1, 2...), NULL for full analysis mode';
COMMENT ON COLUMN analysis_records.raw_content IS 'AI raw analysis result (for debugging)';
COMMENT ON COLUMN analysis_records.refined_content IS 'AI refined analysis result (displayed to frontend)';
COMMENT ON COLUMN analysis_records.start_time_offset IS 'Start time offset relative to session start (seconds, floating point)';
COMMENT ON COLUMN analysis_records.end_time_offset IS 'End time offset relative to session start (seconds, floating point)';
COMMENT ON COLUMN analysis_records.video_path IS 'Storage path of the analyzed window video file';

-- ==================== User Configs Table ====================
CREATE TABLE IF NOT EXISTS user_configs (
    user_id BIGINT PRIMARY KEY,
    default_ai_model VARCHAR(50) DEFAULT 'qwen',
    default_analysis_mode VARCHAR(20) DEFAULT 'SLIDING_WINDOW',
    default_keep_video BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

COMMENT ON TABLE user_configs IS 'User configuration preferences';
COMMENT ON COLUMN user_configs.default_ai_model IS 'qwen/gemini';
COMMENT ON COLUMN user_configs.default_analysis_mode IS 'FULL/SLIDING_WINDOW (enum value)';

-- ==================== User Memory Table ====================
CREATE TABLE IF NOT EXISTS user_memory (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    memory_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);

COMMENT ON TABLE user_memory IS 'User memory: habits, knowledge, behavior patterns';
COMMENT ON COLUMN user_memory.memory_data IS 'JSONB format: {habits: {}, knowledge: {}, behavior_patterns: {}}';

-- ==================== Triggers for auto-update timestamp ====================
-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to sessions table
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_configs table
CREATE TRIGGER update_user_configs_updated_at
    BEFORE UPDATE ON user_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to oauth_connections table
CREATE TRIGGER update_oauth_connections_updated_at
    BEFORE UPDATE ON oauth_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to user_memory table
CREATE TRIGGER update_user_memory_updated_at
    BEFORE UPDATE ON user_memory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================== Useful Views ====================
-- View: Session summary with chunk and analysis counts
CREATE OR REPLACE VIEW session_summary AS
SELECT
    s.id,
    s.user_id,
    s.status,
    s.ai_model,
    s.analysis_mode,
    s.storage_type,
    s.current_video_length,
    s.start_time,
    s.end_time,
    s.created_at,
    COUNT(DISTINCT vc.id) AS chunk_count,
    COUNT(DISTINCT ar.id) AS analysis_count,
    MAX(ar.window_index) AS max_window_index,
    EXTRACT(EPOCH FROM (COALESCE(s.end_time, CURRENT_TIMESTAMP) - s.start_time)) AS session_duration_seconds
FROM sessions s
LEFT JOIN video_chunks vc ON s.id = vc.session_id
LEFT JOIN analysis_records ar ON s.id = ar.session_id
GROUP BY s.id;

COMMENT ON VIEW session_summary IS 'Session overview with aggregated chunk and analysis counts';

-- View: Analysis timeline for easy browsing
CREATE OR REPLACE VIEW analysis_timeline AS
SELECT
    ar.id,
    ar.session_id,
    s.user_id,
    s.ai_model,
    s.analysis_mode,
    ar.window_index,
    ar.start_time_offset,
    ar.end_time_offset,
    (ar.end_time_offset - ar.start_time_offset) AS window_duration,
    LEFT(ar.refined_content, 100) AS content_preview,
    LENGTH(ar.refined_content) AS content_length,
    ar.video_path,
    ar.created_at
FROM analysis_records ar
JOIN sessions s ON ar.session_id = s.id
ORDER BY ar.session_id, ar.window_index NULLS LAST;

COMMENT ON VIEW analysis_timeline IS 'Analysis records with session context and content preview';

-- ==================== Helper Functions ====================
-- Function: Get full transcript for a session (concatenate all analysis records)
CREATE OR REPLACE FUNCTION get_session_transcript(p_session_id BIGINT)
RETURNS TEXT AS $$
DECLARE
    v_transcript TEXT;
BEGIN
    SELECT STRING_AGG(
        CASE
            WHEN window_index IS NOT NULL THEN
                FORMAT('[窗口 %s | %ss-%ss] %s', window_index, start_time_offset, end_time_offset, refined_content)
            ELSE
                refined_content
        END,
        E'\n\n'
        ORDER BY COALESCE(window_index, 0), created_at
    )
    INTO v_transcript
    FROM analysis_records
    WHERE session_id = p_session_id;

    RETURN COALESCE(v_transcript, '无分析结果');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_session_transcript(BIGINT) IS 'Get concatenated transcript for a session with window markers';

-- ==================== Sample Data (Optional) ====================
-- 创建默认管理员用户 (密码: admin123)
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

-- 为管理员创建默认配置
INSERT INTO user_configs (user_id, default_ai_model, default_analysis_mode, default_keep_video)
SELECT id, 'qwen', 'SLIDING_WINDOW', false FROM users WHERE email = 'admin@skiuo.com'
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON SCHEMA public IS 'SKI Video AI Analysis System - Database Schema';

-- ==================== Database Info ====================
-- Display schema version and creation info
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SKI Database Schema Initialized';
    RAISE NOTICE 'Version: 4.0 (Auth + Master Video + AI Pipeline + User Memory)';
    RAISE NOTICE 'Date: 2025-11-13';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Auth Tables:';
    RAISE NOTICE '  - users (用户表)';
    RAISE NOTICE '  - user_roles (用户角色表)';
    RAISE NOTICE '  - oauth_connections (OAuth绑定表)';
    RAISE NOTICE '  - email_verification_tokens';
    RAISE NOTICE '  - password_reset_tokens';
    RAISE NOTICE 'Business Tables:';
    RAISE NOTICE '  - sessions (with title + video_duration)';
    RAISE NOTICE '  - video_chunks';
    RAISE NOTICE '  - analysis_records (raw + refined content)';
    RAISE NOTICE '  - user_configs';
    RAISE NOTICE '  - user_memory (JSONB: habits/knowledge/behavior_patterns)';
    RAISE NOTICE 'Views Created:';
    RAISE NOTICE '  - session_summary';
    RAISE NOTICE '  - analysis_timeline';
    RAISE NOTICE 'Functions Created:';
    RAISE NOTICE '  - get_session_transcript(session_id)';
    RAISE NOTICE 'Default Admin Created:';
    RAISE NOTICE '  - Email: admin@skiuo.com';
    RAISE NOTICE '  - Password: admin123 (请修改!)';
    RAISE NOTICE '==========================================';
END $$;
