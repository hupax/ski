# PostgreSQL 数据库设计文档

## 概述

SKI视频AI分析系统的PostgreSQL数据库schema，支持主视频(master video)策略和滑动窗口分析。

## 版本信息

- **Schema版本**: 2.0
- **更新日期**: 2025-11-08
- **主要特性**: Master Video + Sliding Window支持

## 数据库表结构

### 1. sessions (会话表)

记录视频录制会话的核心信息。

**关键字段**:
- `master_video_path`: 主视频文件的本地路径，随着chunk上传不断拼接增长
- `last_window_start_time`: 最后一个已分析窗口的开始时间(秒)
- `current_video_length`: 主视频当前总长度(秒)，通过FFmpeg实际测量
- `storage_type`: 存储服务类型 (minio/oss/cos)

**状态流转**:
```
RECORDING → ANALYZING → COMPLETED
                    ↓
                  FAILED
```

### 2. video_chunks (视频块表)

记录上传的视频块信息。

**注意**: 在master video策略下，此表的重要性降低，主要用于追踪上传历史。

**关键字段**:
- `duration`: 视频块时长(秒)，使用DOUBLE PRECISION以支持精确的浮点数
- `status`: UPLOADED/ANALYZING/ANALYZED/DELETED

### 3. analysis_records (分析记录表)

存储AI分析的结果，每个窗口一条记录。

**关键字段**:
- `window_index`: 全局窗口索引 (0, 1, 2...)，full模式下为NULL
- `start_time_offset`: 窗口开始时间相对于会话开始的偏移(秒)
- `end_time_offset`: 窗口结束时间相对于会话开始的偏移(秒)
- `video_path`: 分析的窗口视频在存储服务中的路径
- `content`: AI分析的文本内容

**滑动窗口示例**:
```
Window 0: [0.0s - 15.0s]   -> window_index=0, start_time_offset=0.0, end_time_offset=15.0
Window 1: [10.0s - 25.0s]  -> window_index=1, start_time_offset=10.0, end_time_offset=25.0
Window 2: [20.0s - 35.0s]  -> window_index=2, start_time_offset=20.0, end_time_offset=35.0
```

### 4. user_configs (用户配置表)

存储用户的默认设置。

**默认值**:
- `default_ai_model`: 'qwen'
- `default_analysis_mode`: 'SLIDING_WINDOW'
- `default_keep_video`: false

## 视图 (Views)

### session_summary

会话汇总视图，提供会话的统计信息。

**包含字段**:
- 基本会话信息
- `chunk_count`: chunk数量
- `analysis_count`: 分析记录数量
- `max_window_index`: 最大窗口索引
- `session_duration_seconds`: 会话持续时长

**使用示例**:
```sql
SELECT * FROM session_summary WHERE user_id = 1 ORDER BY created_at DESC LIMIT 10;
```

### analysis_timeline

分析记录时间线视图，便于浏览分析结果。

**包含字段**:
- 会话上下文信息
- 窗口时间范围
- `content_preview`: 内容预览(前100字符)
- `content_length`: 内容长度

**使用示例**:
```sql
SELECT * FROM analysis_timeline WHERE session_id = 1;
```

## 函数 (Functions)

### get_session_transcript(session_id)

获取会话的完整转录文本，自动拼接所有分析记录。

**功能**:
- 按窗口顺序拼接所有分析内容
- 滑动窗口模式：添加时间标记 `[窗口 X | Xs-Ys] 内容`
- Full模式：直接返回内容

**使用示例**:
```sql
SELECT get_session_transcript(1);
```

**输出示例**:
```
[窗口 0 | 0.0s-15.0s] 用户打开了浏览器，开始访问网站...

[窗口 1 | 10.0s-25.0s] 用户在导航栏中输入搜索关键词...

[窗口 2 | 20.0s-35.0s] 搜索结果显示，用户点击了第一个链接...
```

## 触发器 (Triggers)

### update_updated_at_column()

自动更新 `updated_at` 字段的触发器函数。

**应用于**:
- `sessions` 表
- `user_configs` 表

## 初始化说明

### 1. 使用Docker初始化

```bash
docker run -d \
  --name skiuo-postgres \
  -e POSTGRES_DB=skiuo \
  -e POSTGRES_USER=skiuo \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -v $(pwd)/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql \
  postgres:15
```

### 2. 手动初始化

```bash
psql -h localhost -U skiuo -d skiuo -f docker/postgres/init.sql
```

### 3. 验证初始化

```bash
psql -h localhost -U skiuo -d skiuo

# 在psql中执行
\dt              -- 查看所有表
\dv              -- 查看所有视图
\df              -- 查看所有函数
SELECT * FROM session_summary LIMIT 1;
```

## 测试查询

参考 `test_queries.sql` 文件，包含23个测试和调试查询：

1. **基础查询** (1-5): 查看会话、分析记录、转录文本等
2. **统计查询** (6-8): 用户统计、AI模型使用统计、存储统计
3. **滑动窗口分析** (9-10): 窗口覆盖情况、重叠和间隙检查
4. **性能调试** (11-13): 上传速度、分析速度、视频增长情况
5. **数据完整性** (14-16): 检查异常数据
6. **清理查询** (17-19): 删除旧数据 (谨慎使用)
7. **快捷查询** (20-23): 常用查询和调试

**使用方式**:
```bash
psql -h localhost -U skiuo -d skiuo -f docker/postgres/test_queries.sql
```

## 数据库设计要点

### 1. Master Video策略

- 每个session有一个不断增长的master video文件
- 通过FFmpeg `concat` 将新chunk追加到master video
- 使用FFmpeg `extract segment` 从master video中提取窗口
- 优点：简化了窗口提取逻辑，支持精确的时间范围

### 2. 滑动窗口追踪

- `last_window_start_time`: 记录最后分析窗口的起始时间
- `current_video_length`: 通过FFmpeg实时获取，确保精确
- 触发条件: `current_video_length >= last_window_start_time + window_step + window_size`

### 3. 浮点数精度

所有时间相关字段使用 `DOUBLE PRECISION`:
- `duration`
- `start_time_offset`
- `end_time_offset`
- `current_video_length`
- `last_window_start_time`

原因：视频时长需要亚秒级精度(如 35.234秒)

### 4. 外键约束

- `video_chunks.session_id` → `sessions.id` (CASCADE DELETE)
- `analysis_records.session_id` → `sessions.id` (CASCADE DELETE)
- `analysis_records.chunk_id` → `video_chunks.id` (SET NULL)

当session被删除时，相关的chunks和analysis records会自动删除。

### 5. 索引优化

**高频查询索引**:
- `sessions(user_id)`: 查询用户的所有会话
- `sessions(status)`: 查询特定状态的会话
- `sessions(created_at DESC)`: 按时间倒序查询
- `analysis_records(session_id)`: 查询会话的所有分析记录
- `analysis_records(window_index)`: 按窗口索引排序

**唯一索引**:
- `video_chunks(session_id, chunk_index)`: 确保同一session的chunk_index唯一

## 迁移指南

### 从旧schema迁移到v2.0

如果你有旧数据需要迁移，执行以下SQL:

```sql
-- 添加新字段
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS storage_type VARCHAR(20) DEFAULT 'cos';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS master_video_path VARCHAR(500);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_window_start_time DOUBLE PRECISION;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_video_length DOUBLE PRECISION DEFAULT 0.0;

-- 修改字段类型
ALTER TABLE video_chunks ALTER COLUMN duration TYPE DOUBLE PRECISION;
ALTER TABLE analysis_records ALTER COLUMN start_time_offset TYPE DOUBLE PRECISION;
ALTER TABLE analysis_records ALTER COLUMN end_time_offset TYPE DOUBLE PRECISION;
ALTER TABLE analysis_records ADD COLUMN IF NOT EXISTS video_path VARCHAR(500);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_analysis_records_window_index ON analysis_records(window_index);

-- 更新user_configs默认值
UPDATE user_configs SET default_analysis_mode = 'SLIDING_WINDOW'
WHERE default_analysis_mode = 'sliding_window';
```

## 备份与恢复

### 备份数据库

```bash
pg_dump -h localhost -U skiuo -d skiuo > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复数据库

```bash
psql -h localhost -U skiuo -d skiuo < backup_20251108_123456.sql
```

### 仅备份schema

```bash
pg_dump -h localhost -U skiuo -d skiuo --schema-only > schema.sql
```

### 仅备份数据

```bash
pg_dump -h localhost -U skiuo -d skiuo --data-only > data.sql
```

## 性能建议

1. **定期VACUUM**:
   ```sql
   VACUUM ANALYZE sessions;
   VACUUM ANALYZE analysis_records;
   ```

2. **监控慢查询**:
   ```sql
   -- 启用慢查询日志
   ALTER SYSTEM SET log_min_duration_statement = 1000; -- 1秒
   SELECT pg_reload_conf();
   ```

3. **分析查询计划**:
   ```sql
   EXPLAIN ANALYZE SELECT * FROM session_summary WHERE user_id = 1;
   ```

4. **考虑分区** (当数据量很大时):
   ```sql
   -- 按月分区sessions表
   CREATE TABLE sessions_2025_01 PARTITION OF sessions
   FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
   ```

## 常见问题

### Q: 为什么video_chunks还保留?

A: 虽然master video策略降低了chunk表的重要性，但保留chunk表用于:
- 追踪上传历史
- 调试上传问题
- 计算上传速度统计

### Q: window_index和chunk_id的关系?

A: 在master video策略下，它们几乎没有关系。window_index是基于master video的时间切分，与chunk无关。

### Q: 为什么需要video_path字段?

A: 记录分析的窗口视频在存储服务中的路径，便于:
- 用户回看特定窗口的视频
- 调试AI分析问题
- 实现`keepVideo`功能

### Q: 如何清理测试数据?

A:
```sql
TRUNCATE sessions CASCADE; -- 会自动清理video_chunks和analysis_records
```

## 联系与支持

如有数据库相关问题，请参考:
- 项目文档: `CLAUDE.md`
- 测试查询: `docker/postgres/test_queries.sql`
- 架构文档: `doc/dev3.md`
