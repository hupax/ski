# 数据库Schema变更日志

## [2.0] - 2025-11-08

### 新增 (Added)

**Sessions表新字段**:
- `storage_type` - 存储服务类型 (minio/oss/cos)，默认'cos'
- `master_video_path` - 主视频文件本地路径
- `last_window_start_time` - 最后分析窗口的起始时间(秒)
- `current_video_length` - 主视频当前总长度(秒)，默认0.0

**Analysis Records表新字段**:
- `video_path` - 窗口视频在存储服务中的路径
- 新增索引: `idx_analysis_records_window_index`

**触发器**:
- `update_sessions_updated_at` - 自动更新sessions.updated_at
- `update_user_configs_updated_at` - 自动更新user_configs.updated_at

**视图**:
- `session_summary` - 会话汇总(包含chunk数量、分析数量等统计)
- `analysis_timeline` - 分析时间线(包含内容预览)

**函数**:
- `get_session_transcript(session_id)` - 获取会话完整转录文本

**文档**:
- `README.md` - 完整的数据库设计文档
- `test_queries.sql` - 23个测试和调试查询
- `CHANGELOG.md` - 本文件

### 修改 (Changed)

**数据类型更改** (INT → DOUBLE PRECISION):
- `video_chunks.duration` - 支持浮点数精度的视频时长
- `analysis_records.start_time_offset` - 精确的时间偏移
- `analysis_records.end_time_offset` - 精确的时间偏移

**默认值更新**:
- `user_configs.default_analysis_mode`: 'sliding_window' → 'SLIDING_WINDOW' (大写)

**注释更新**:
- 所有枚举值注释改为大写 (FULL/SLIDING_WINDOW)
- 添加master video相关字段的详细说明
- 更新video_chunks表注释，说明在master video策略下重要性降低

### 架构变化说明

#### 1. Master Video策略

**之前**:
- 每个chunk独立存储
- 分析时从各个chunk中提取窗口
- 跨chunk窗口需要复杂的拼接逻辑

**现在**:
- 维护一个持续增长的master video
- 每次上传chunk时通过FFmpeg concat追加到master video
- 从master video直接提取任意时间范围的窗口
- 简化了窗口提取逻辑，支持精确的时间控制

#### 2. 滑动窗口追踪

**新增字段用途**:
- `last_window_start_time`: 记录已分析窗口的进度
- `current_video_length`: 实时记录master video的实际长度(通过FFmpeg获取)

**触发逻辑**:
```
next_window_start = last_window_start_time + window_step
next_window_end = next_window_start + window_size

if current_video_length >= next_window_end:
    analyze_window(next_window_start, next_window_end)
    last_window_start_time = next_window_start
```

#### 3. 时间精度提升

所有时间相关字段从 `INT` 升级为 `DOUBLE PRECISION`:

**原因**:
- 视频时长可能是 35.234 秒，而非整数
- FFmpeg返回的时长是浮点数
- 窗口边界需要精确对齐，避免累计误差

**影响范围**:
- `video_chunks.duration`
- `analysis_records.start_time_offset`
- `analysis_records.end_time_offset`
- `sessions.current_video_length`
- `sessions.last_window_start_time`

## [1.0] - 2025-10-29 (原始版本)

### 初始Schema

**表结构**:
- `sessions` - 会话表
- `video_chunks` - 视频块表
- `analysis_records` - 分析记录表
- `user_configs` - 用户配置表

**关键特性**:
- 基本的会话管理
- Chunk上传追踪
- AI分析结果存储
- 用户配置管理

**已有功能**:
- 外键约束和级联删除
- 基础索引(user_id, status, created_at)
- 唯一索引(session_id + chunk_index)

## 迁移说明

### 从v1.0升级到v2.0

如果你的数据库是v1.0版本，执行以下迁移SQL:

```sql
-- 1. 添加新字段到sessions表
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'cos',
ADD COLUMN IF NOT EXISTS master_video_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS last_window_start_time DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS current_video_length DOUBLE PRECISION DEFAULT 0.0;

-- 2. 修改video_chunks.duration类型
ALTER TABLE video_chunks
ALTER COLUMN duration TYPE DOUBLE PRECISION;

-- 3. 修改analysis_records字段类型和添加新字段
ALTER TABLE analysis_records
ALTER COLUMN start_time_offset TYPE DOUBLE PRECISION,
ALTER COLUMN end_time_offset TYPE DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS video_path VARCHAR(500);

-- 4. 添加新索引
CREATE INDEX IF NOT EXISTS idx_analysis_records_window_index
ON analysis_records(window_index);

-- 5. 更新user_configs的默认值
UPDATE user_configs
SET default_analysis_mode = 'SLIDING_WINDOW'
WHERE default_analysis_mode IN ('sliding_window', 'SLIDING_WINDOW');

ALTER TABLE user_configs
ALTER COLUMN default_analysis_mode SET DEFAULT 'SLIDING_WINDOW';

-- 6. 创建触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_configs_updated_at
    BEFORE UPDATE ON user_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 创建视图
-- (参考 init.sql 中的 session_summary 和 analysis_timeline)

-- 8. 创建函数
-- (参考 init.sql 中的 get_session_transcript)

-- 9. 验证迁移
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('sessions', 'video_chunks', 'analysis_records')
ORDER BY table_name, ordinal_position;
```

### 数据兼容性

**向后兼容**:
- v2.0完全兼容v1.0的数据
- 新字段允许NULL或有默认值
- 不影响现有查询

**建议**:
- 迁移前备份数据: `pg_dump -h localhost -U skiuo -d skiuo > backup.sql`
- 在测试环境先验证迁移脚本
- 检查应用代码是否需要更新以使用新字段

## 性能影响

### v2.0 vs v1.0

**改进**:
- 添加 `window_index` 索引，加速窗口查询
- 视图预计算统计信息，减少重复聚合查询
- 触发器自动更新时间戳，减少应用层逻辑

**注意**:
- 浮点数类型占用空间略大于INT (8字节 vs 4字节)
- 视图查询可能比直接表查询稍慢(但提供了便利性)
- 触发器会在UPDATE时增加微小开销(通常可忽略)

**优化建议**:
- 定期VACUUM ANALYZE清理和更新统计信息
- 监控慢查询日志
- 考虑对大表(>100万行)进行分区

## 未来规划

### v3.0 (计划中)

可能包含的改进:
- [ ] 添加 `sessions.error_message` 字段，记录失败原因
- [ ] 支持多语言提示词配置 (`prompt_configs` 表)
- [ ] 添加 `analysis_records.ai_model_version` 字段
- [ ] 性能指标表 (`performance_metrics`)，记录处理时长
- [ ] 用户统计视图 (`user_statistics`)
- [ ] 分区策略(按月分区sessions表)

### 长期目标

- 支持多租户(tenant_id)
- 审计日志(audit_log表)
- 全文搜索索引(PostgreSQL FTS)
- 时序数据优化(TimescaleDB扩展)

## 反馈

如有问题或建议，请在项目中提issue或联系开发团队。

---

**维护者**: SKI Development Team
**最后更新**: 2025-11-08
**Schema版本**: 2.0
