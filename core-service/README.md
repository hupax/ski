# Core-Service

Spring Boot 业务中枢 - 视频AI分析系统

## 功能概述

- 接收前端视频上传
- 协调视频处理流程（整体分析 / 半实时滑动窗口）
- MinIO 对象存储管理
- gRPC 调用 ai-service
- PostgreSQL 数据持久化
- WebSocket 实时结果推送

## 编译和运行

### 前置要求

- Java 17+
- Maven 3.6+
- PostgreSQL (运行中)
- MinIO (运行中)
- ai-service (运行中的 gRPC 服务)

### 1. 生成 gRPC 代码

```bash
cd core-service
mvn clean compile
```

这会自动从 `../proto/video_analysis.proto` 生成 Java gRPC 代码到 `target/generated-sources/protobuf`。

### 2. 配置环境变量

确保项目根目录的 `.env` 文件已正确配置，或者直接设置环境变量：

```bash
# 数据库
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=skiuo
export POSTGRES_USER=skiuo
export POSTGRES_PASSWORD=your_password

# MinIO
export MINIO_ENDPOINT=http://localhost:9000
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
export MINIO_BUCKET_NAME=skiuo-videos

# gRPC
export GRPC_AI_SERVICE_HOST=localhost
export GRPC_AI_SERVICE_PORT=50051

# 视频处理
export TEMP_VIDEO_PATH=/tmp/skiuo
export VIDEO_WINDOW_SIZE=15
export VIDEO_WINDOW_STEP=10
```

### 3. 运行应用

#### 开发模式

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

#### 生产模式

```bash
# 构建 JAR
mvn clean package -DskipTests

# 运行
java -jar target/core-service-0.0.1-SNAPSHOT.jar
```

默认端口：`8080`

## API 接口

### 1. 上传视频

```http
POST /api/videos/upload
Content-Type: multipart/form-data

Parameters:
- file: MultipartFile (视频文件)
- userId: Long (用户ID)
- chunkIndex: Integer (片段索引)
- sessionId: Long (可选，会话ID)
- aiModel: String (可选，默认 "qwen")
- analysisMode: String (可选，"FULL" 或 "SLIDING_WINDOW"，默认 "SLIDING_WINDOW")
- keepVideo: Boolean (可选，默认 false)
- duration: Integer (可选，视频时长秒数)

Response: 202 ACCEPTED
{
  "sessionId": 1,
  "chunkId": 1,
  "status": "ACCEPTED",
  "message": "Video upload accepted, processing started"
}
```

### 2. 查询会话状态

```http
GET /api/videos/sessions/{sessionId}

Response: 200 OK
{
  "id": 1,
  "userId": 1,
  "status": "ANALYZING",
  "aiModel": "qwen",
  "analysisMode": "SLIDING_WINDOW",
  "keepVideo": false,
  "startTime": "2025-01-25T14:30:00",
  "endTime": null,
  "totalChunks": 5,
  "analyzedChunks": 2
}
```

### 3. 获取分析结果

```http
GET /api/videos/sessions/{sessionId}/records

Response: 200 OK
[
  {
    "id": 1,
    "sessionId": 1,
    "chunkId": 1,
    "windowIndex": 0,
    "content": "用户正在打开IDE...",
    "startTimeOffset": 0,
    "endTimeOffset": 15,
    "createdAt": "2025-01-25T14:30:15"
  }
]
```

### 4. 查询用户会话列表

```http
GET /api/videos/users/{userId}/sessions

Response: 200 OK
[
  {
    "id": 1,
    "userId": 1,
    "status": "COMPLETED",
    ...
  }
]
```

### 5. 健康检查

```http
GET /api/videos/health

Response: 200 OK
"Video service is running"
```

## WebSocket 连接

前端可以连接 WebSocket 接收实时分析结果：

```javascript
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, function(frame) {
  // 订阅特定会话的分析结果
  stompClient.subscribe('/topic/session/1', function(message) {
    const data = JSON.parse(message.body);
    console.log('Received:', data.content);
  });
});
```

## 数据库表结构

项目启动时会自动执行 `src/main/resources/db/schema.sql` 创建表：

- `sessions` - 录制会话
- `video_chunks` - 视频片段
- `analysis_records` - AI 分析记录
- `user_configs` - 用户配置

## 架构说明

### 处理流程

#### 整体分析模式 (FULL)
```
上传视频 → MinIO → 生成 URL → 调用 AnalyzeVideo → 保存结果 → WebSocket 推送
```

#### 半实时模式 (SLIDING_WINDOW)
```
上传视频 → 调用 ProcessVideo 切片 → 上传切片到 MinIO
  → 逐窗口调用 AnalyzeVideo（传递上下文）
  → 保存结果 → WebSocket 推送
  → 清理临时文件
```

### 核心组件

- **VideoUploadService**: 处理文件上传和临时存储
- **VideoProcessingService**: 协调两种分析模式的处理流程
- **MinioService**: MinIO 操作封装（上传、URL 生成、删除）
- **GrpcClientService**: 调用 ai-service 的 gRPC 接口
- **AnalysisService**: 保存分析结果、WebSocket 推送
- **CleanupService**: 清理临时文件和 MinIO 对象

### 异步处理

使用 `@Async` 注解和 `ThreadPoolTaskExecutor` 实现异步视频处理，不阻塞上传接口响应。

### 定时任务

- **每小时**: 清理超过 2 小时的临时文件
- **每天凌晨 2 点**: 清理孤儿 MinIO 文件

## 日志

日志位置：控制台输出

日志级别配置：
- 开发环境: `DEBUG`
- 生产环境: `INFO`

## 故障排查

### gRPC 连接失败
- 检查 ai-service 是否运行在 `localhost:50051`
- 查看 `application.yml` 中的 gRPC 配置

### MinIO 连接失败
- 确认 MinIO 运行在 `localhost:9000`
- 检查访问密钥是否正确
- 确保 bucket `skiuo-videos` 存在

### 数据库连接失败
- 确认 PostgreSQL 运行中
- 检查数据库名称、用户名、密码
- 查看数据库日志

### 文件上传失败
- 检查 `/tmp/skiuo` 目录权限
- 确认磁盘空间充足
- 查看 `spring.servlet.multipart.max-file-size` 配置

## 开发注意事项

1. **环境变量优先**: 所有配置从环境变量读取
2. **错误处理完善**: 所有外部调用都有 try-catch
3. **日志记录**: 关键操作都有日志
4. **事务管理**: 数据库操作使用 `@Transactional`
5. **资源清理**: 临时文件和 MinIO 对象按配置清理

## 相关文档

- 核心架构: `../doc/dev3.md`
- 项目说明: `../CLAUDE.md`
- AI 提示词: `../doc/prompt.md`
