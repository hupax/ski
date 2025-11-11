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
COMMENT ON COLUMN sessions.analysis_mode IS 'FULL/SLIDING_WINDOW';
COMMENT ON COLUMN sessions.storage_type IS 'minio/oss/cos - storage service type';
COMMENT ON COLUMN sessions.master_video_path IS 'Local path to the master video file that grows with each chunk';
COMMENT ON COLUMN sessions.last_window_start_time IS 'Start time (seconds) of the last analyzed window, initial: -windowStep';
COMMENT ON COLUMN sessions.current_video_length IS 'Current total length (seconds) of master video';

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
    content TEXT NOT NULL,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_configs IS 'User configuration preferences';
COMMENT ON COLUMN user_configs.default_ai_model IS 'qwen/gemini';
COMMENT ON COLUMN user_configs.default_analysis_mode IS 'FULL/SLIDING_WINDOW (enum value)';

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
    LEFT(ar.content, 100) AS content_preview,
    LENGTH(ar.content) AS content_length,
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
                FORMAT('[窗口 %s | %ss-%ss] %s', window_index, start_time_offset, end_time_offset, content)
            ELSE
                content
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
-- Insert a default user config for user_id = 1
INSERT INTO user_configs (user_id, default_ai_model, default_analysis_mode, default_keep_video)
VALUES (1, 'qwen', 'SLIDING_WINDOW', false)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON SCHEMA public IS 'SKI Video AI Analysis System - Database Schema';

-- ==================== Database Info ====================
-- Display schema version and creation info
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SKI Database Schema Initialized';
    RAISE NOTICE 'Version: 2.0 (Master Video + Sliding Window)';
    RAISE NOTICE 'Date: 2025-11-08';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Tables Created:';
    RAISE NOTICE '  - sessions (with master video support)';
    RAISE NOTICE '  - video_chunks';
    RAISE NOTICE '  - analysis_records (with video_path)';
    RAISE NOTICE '  - user_configs';
    RAISE NOTICE 'Views Created:';
    RAISE NOTICE '  - session_summary';
    RAISE NOTICE '  - analysis_timeline';
    RAISE NOTICE 'Functions Created:';
    RAISE NOTICE '  - get_session_transcript(session_id)';
    RAISE NOTICE '==========================================';
END $$;
