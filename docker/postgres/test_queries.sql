-- ==================== SKI Database Test Queries ====================
-- 这个文件包含一些有用的查询，用于测试和调试数据库

-- ==================== 基础查询 ====================

-- 1. 查看最近的5个会话
SELECT * FROM session_summary ORDER BY created_at DESC LIMIT 5;

-- 2. 查看特定会话的所有分析记录
SELECT * FROM analysis_timeline WHERE session_id = 1;

-- 3. 获取会话的完整转录文本
SELECT get_session_transcript(1);

-- 4. 查看正在进行的会话
SELECT * FROM sessions WHERE status = 'ANALYZING' OR status = 'RECORDING';

-- 5. 查看失败的会话
SELECT * FROM sessions WHERE status = 'FAILED' ORDER BY created_at DESC;

-- ==================== 统计查询 ====================

-- 6. 每个用户的会话统计
SELECT
    user_id,
    COUNT(*) AS total_sessions,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_sessions,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_sessions,
    AVG(current_video_length) AS avg_video_length,
    SUM(current_video_length) AS total_video_length
FROM sessions
GROUP BY user_id;

-- 7. 不同AI模型的使用统计
SELECT
    ai_model,
    analysis_mode,
    COUNT(*) AS usage_count,
    AVG(current_video_length) AS avg_video_length,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS success_count,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failure_count
FROM sessions
WHERE ai_model IS NOT NULL
GROUP BY ai_model, analysis_mode;

-- 8. 存储服务使用统计
SELECT
    storage_type,
    COUNT(*) AS session_count,
    AVG(current_video_length) AS avg_video_length
FROM sessions
GROUP BY storage_type;

-- ==================== 滑动窗口分析查询 ====================

-- 9. 查看特定会话的窗口覆盖情况
SELECT
    session_id,
    window_index,
    start_time_offset,
    end_time_offset,
    (end_time_offset - start_time_offset) AS window_duration,
    LEFT(content, 50) AS preview
FROM analysis_records
WHERE session_id = 1 AND window_index IS NOT NULL
ORDER BY window_index;

-- 10. 检查窗口重叠和间隙
WITH window_gaps AS (
    SELECT
        session_id,
        window_index,
        start_time_offset,
        end_time_offset,
        LAG(end_time_offset) OVER (PARTITION BY session_id ORDER BY window_index) AS prev_end_time,
        (start_time_offset - LAG(end_time_offset) OVER (PARTITION BY session_id ORDER BY window_index)) AS gap,
        (LAG(end_time_offset) OVER (PARTITION BY session_id ORDER BY window_index) - start_time_offset) AS overlap
    FROM analysis_records
    WHERE window_index IS NOT NULL
)
SELECT * FROM window_gaps WHERE session_id = 1;

-- ==================== 性能和调试查询 ====================

-- 11. 查看chunk上传速度
SELECT
    session_id,
    chunk_index,
    duration,
    uploaded_at,
    LAG(uploaded_at) OVER (PARTITION BY session_id ORDER BY chunk_index) AS prev_upload_time,
    EXTRACT(EPOCH FROM (uploaded_at - LAG(uploaded_at) OVER (PARTITION BY session_id ORDER BY chunk_index))) AS upload_interval_seconds
FROM video_chunks
WHERE session_id = 1
ORDER BY chunk_index;

-- 12. 查看分析速度 (分析记录创建时间间隔)
SELECT
    session_id,
    window_index,
    created_at,
    LAG(created_at) OVER (PARTITION BY session_id ORDER BY window_index) AS prev_created_at,
    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY session_id ORDER BY window_index))) AS analysis_interval_seconds,
    (end_time_offset - start_time_offset) AS window_duration
FROM analysis_records
WHERE session_id = 1 AND window_index IS NOT NULL
ORDER BY window_index;

-- 13. 检查主视频增长情况 (需要session历史记录)
SELECT
    id AS session_id,
    current_video_length,
    last_window_start_time,
    (current_video_length - last_window_start_time - 15.0) AS remaining_unanalyzed_seconds,
    updated_at
FROM sessions
WHERE id = 1;

-- ==================== 数据完整性检查 ====================

-- 14. 查找没有分析记录的已完成会话
SELECT s.*
FROM sessions s
LEFT JOIN analysis_records ar ON s.id = ar.session_id
WHERE s.status = 'COMPLETED' AND ar.id IS NULL;

-- 15. 查找chunk数量异常的会话
SELECT
    session_id,
    COUNT(*) AS chunk_count,
    MAX(duration) AS max_chunk_duration,
    MIN(duration) AS min_chunk_duration,
    AVG(duration) AS avg_chunk_duration
FROM video_chunks
GROUP BY session_id
HAVING COUNT(*) > 100 OR COUNT(*) = 1;

-- 16. 查找分析内容异常短的记录
SELECT
    id,
    session_id,
    window_index,
    LENGTH(content) AS content_length,
    content
FROM analysis_records
WHERE LENGTH(content) < 10
ORDER BY session_id, window_index;

-- ==================== 清理查询 ====================

-- 17. 删除超过30天的已完成会话 (谨慎使用!)
-- DELETE FROM sessions WHERE status = 'COMPLETED' AND created_at < NOW() - INTERVAL '30 days';

-- 18. 删除失败的会话 (谨慎使用!)
-- DELETE FROM sessions WHERE status = 'FAILED' AND created_at < NOW() - INTERVAL '7 days';

-- 19. 清理孤立的video_chunks (没有对应session)
-- DELETE FROM video_chunks WHERE session_id NOT IN (SELECT id FROM sessions);

-- ==================== 有用的快捷查询 ====================

-- 20. 快速查看最新会话的状态
SELECT
    id,
    user_id,
    status,
    ai_model,
    analysis_mode,
    current_video_length,
    (SELECT COUNT(*) FROM analysis_records WHERE session_id = s.id) AS analysis_count,
    created_at,
    updated_at
FROM sessions s
ORDER BY id DESC
LIMIT 10;

-- 21. 查看今天的会话统计
SELECT
    COUNT(*) AS total_sessions,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed,
    COUNT(CASE WHEN status = 'ANALYZING' THEN 1 END) AS analyzing,
    COUNT(CASE WHEN status = 'RECORDING' THEN 1 END) AS recording,
    SUM(current_video_length) AS total_video_seconds,
    AVG(current_video_length) AS avg_video_seconds
FROM sessions
WHERE DATE(created_at) = CURRENT_DATE;

-- 22. 查看特定用户的配置
SELECT * FROM user_configs WHERE user_id = 1;

-- ==================== 调试滑动窗口触发逻辑 ====================

-- 23. 模拟检查窗口触发条件
WITH params AS (
    SELECT
        id AS session_id,
        current_video_length,
        last_window_start_time,
        15.0 AS window_size,
        10.0 AS window_step
    FROM sessions
    WHERE id = 1
)
SELECT
    session_id,
    current_video_length,
    last_window_start_time,
    (last_window_start_time + window_step) AS next_window_start,
    (last_window_start_time + window_step + window_size) AS next_window_end,
    CASE
        WHEN current_video_length >= (last_window_start_time + window_step + window_size)
        THEN '✓ 触发条件满足'
        ELSE '✗ 未满足触发条件'
    END AS trigger_status,
    (current_video_length - (last_window_start_time + window_step + window_size)) AS remaining_seconds_until_trigger
FROM params;
