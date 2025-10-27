-- ==================== Sessions Table ====================
CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECORDING',
    ai_model VARCHAR(50),
    analysis_mode VARCHAR(20),
    keep_video BOOLEAN DEFAULT false,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

COMMENT ON TABLE sessions IS 'Recording sessions';
COMMENT ON COLUMN sessions.status IS 'RECORDING/ANALYZING/COMPLETED/FAILED';
COMMENT ON COLUMN sessions.ai_model IS 'qwen/gemini';
COMMENT ON COLUMN sessions.analysis_mode IS 'full/sliding_window';

-- ==================== Video Chunks Table ====================
CREATE TABLE IF NOT EXISTS video_chunks (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    minio_path VARCHAR(500) NOT NULL,
    duration INT,
    status VARCHAR(20) DEFAULT 'UPLOADED',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_chunks_session_id ON video_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_status ON video_chunks(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_chunks_session_chunk ON video_chunks(session_id, chunk_index);

COMMENT ON TABLE video_chunks IS 'Video chunks uploaded by users';
COMMENT ON COLUMN video_chunks.status IS 'UPLOADED/ANALYZING/ANALYZED/DELETED';
COMMENT ON COLUMN video_chunks.duration IS 'Video duration in seconds';

-- ==================== Analysis Records Table ====================
CREATE TABLE IF NOT EXISTS analysis_records (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL,
    chunk_id BIGINT,
    window_index INT,
    content TEXT NOT NULL,
    start_time_offset INT,
    end_time_offset INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (chunk_id) REFERENCES video_chunks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_records_session_id ON analysis_records(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_chunk_id ON analysis_records(chunk_id);
CREATE INDEX IF NOT EXISTS idx_analysis_records_created_at ON analysis_records(created_at);

COMMENT ON TABLE analysis_records IS 'AI analysis results';
COMMENT ON COLUMN analysis_records.window_index IS 'Sliding window index (NULL for full analysis)';
COMMENT ON COLUMN analysis_records.start_time_offset IS 'Start time offset relative to session start (seconds)';
COMMENT ON COLUMN analysis_records.end_time_offset IS 'End time offset relative to session start (seconds)';

-- ==================== User Configs Table ====================
CREATE TABLE IF NOT EXISTS user_configs (
    user_id BIGINT PRIMARY KEY,
    default_ai_model VARCHAR(50) DEFAULT 'qwen',
    default_analysis_mode VARCHAR(20) DEFAULT 'sliding_window',
    default_keep_video BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_configs IS 'User configuration preferences';
COMMENT ON COLUMN user_configs.default_ai_model IS 'qwen/gemini';
COMMENT ON COLUMN user_configs.default_analysis_mode IS 'full/sliding_window';
