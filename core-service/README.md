# Core-Service

Spring Boot 业务中枢 - 视频AI分析系统

## 功能概述

- 接收前端视频上传
- 协调视频处理流程（完整分析 / 滑动窗口）
- **多存储服务支持**（MinIO / Aliyun OSS / Tencent COS）
- gRPC 调用 ai-service
- PostgreSQL 数据持久化
- WebSocket 实时结果推送
- **异步任务追踪**（防止并发竞态条件）

## 编译和运行

### 前置要求

- Java 17+
- Maven 3.6+
- PostgreSQL (运行中)
- **存储服务**（以下三选一）：
  - MinIO (自建，适合开发测试)
  - Aliyun OSS (阿里云对象存储)
  - Tencent COS (腾讯云对象存储，推荐)
- ai-service (运行中的 gRPC 服务)

### 1. 生成 gRPC 代码

```bash
cd core-service
mvn clean compile
```

这会自动从 `../proto/video_analysis.proto` 生成 Java gRPC 代码到 `target/generated-sources/protobuf`。

### 2. 配置环境变量

**重要**：core-service 使用 **dotenv-java** 自动加载项目根目录的 `.env` 文件。

确保 `/Users/xxx/ski/.env` 文件包含以下配置：

```bash
# 数据库
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=skiuo
POSTGRES_USER=skiuo
POSTGRES_PASSWORD=your_password

# 存储服务（3选1）
STORAGE_TYPE=cos  # minio | oss | cos

# COS (推荐国内部署)
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_REGION=ap-guangzhou
COS_BUCKET_NAME=your_bucket_name

# OSS (阿里云)
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY_ID=your_oss_key_id
OSS_ACCESS_KEY_SECRET=your_oss_key_secret
OSS_BUCKET_NAME=your_bucket_name
OSS_REGION=cn-hangzhou

# MinIO (本地开发)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=skiuo-videos

# gRPC
GRPC_AI_SERVICE_HOST=localhost
GRPC_AI_SERVICE_PORT=50051

# 视频处理
TEMP_VIDEO_PATH=/tmp/skiuo
VIDEO_WINDOW_SIZE=15  # 窗口大小（秒）
VIDEO_WINDOW_STEP=10  # 步长（秒）
```

**注意**：
- `.env` 文件应放在项目根目录 `ski/`，不是 `core-service/`
- `DotenvConfig` 类在应用启动时自动加载
- 无需手动设置系统环境变量

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
- storageType: String (可选，"minio" | "oss" | "cos"，默认 "cos")
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

### 5. 完成会话

**重要**：前端停止录制后必须调用此接口，通知后端完成最终分析。

```http
POST /api/videos/sessions/{sessionId}/finish

Response: 200 OK
{
  "sessionId": 1,
  "status": "COMPLETED",
  "message": "Session finished successfully"
}
```

**功能**：
- 等待所有异步 chunk 处理任务完成（防止竞态条件）
- FULL模式：分析完整视频
- SLIDING_WINDOW模式：分析剩余未覆盖的窗口

### 6. 获取服务器配置

```http
GET /api/config

Response: 200 OK
{
  "windowSize": 15,
  "windowStep": 10,
  "recommendedChunkDuration": 35
}
```

前端根据此配置调整 chunk 时长，确保与后端窗口参数匹配。

### 7. 健康检查

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
- **VideoProcessingService**: 协调两种分析模式的处理流程，**异步任务追踪**
- **存储服务层** (工厂模式):
  - `StorageService` 接口
  - `MinioService` / `OssService` / `CosService` 实现
  - `StorageServiceFactory` 根据配置选择
- **GrpcClientService**: 调用 ai-service 的 gRPC 接口
- **AnalysisService**: 保存分析结果、WebSocket 推送
- **CleanupService**: 清理临时文件和存储服务对象

### 异步处理与并发控制

**异步视频处理**：
- 使用 `@Async` 注解和 `ThreadPoolTaskExecutor`
- 上传接口立即返回 202 ACCEPTED
- 视频处理在后台异步执行

**并发竞态条件防护**：
- 问题：前端上传最后一个chunk后立即调用`finishSession`，但后端可能还在异步处理
- 解决：`VideoProcessingService` 追踪所有异步任务
  ```java
  // 注册异步任务
  CompletableFuture<Void> task = processVideoChunk(...);
  registerTask(sessionId, task);

  // finishSession 等待所有任务完成
  awaitSessionTasks(sessionId);  // 最多等待5分钟
  ```
- 确保 `finishSession` 读取到最新的 session 数据

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

### 存储服务连接失败
- **MinIO**: 确认运行在 `localhost:9000`，bucket已创建
- **OSS**: 检查 endpoint、accessKey、bucket配置
- **COS**: 检查 secretId、secretKey、region、bucket配置
- 查看启动日志中的存储服务初始化信息
- 确认 `.env` 文件中 `STORAGE_TYPE` 正确

### 数据库连接失败
- 确认 PostgreSQL 运行中
- 检查数据库名称、用户名、密码
- 查看数据库日志

### 文件上传失败
- 检查 `/tmp/skiuo` 目录权限
- 确认磁盘空间充足
- 查看 `spring.servlet.multipart.max-file-size` 配置

## 开发注意事项

1. **使用 dotenv-java**: `.env` 文件自动加载，放在项目根目录
2. **多存储服务**: 通过 `STORAGE_TYPE` 切换，工厂模式实现
3. **错误处理完善**: 所有外部调用都有 try-catch
4. **日志记录**: 关键操作都有日志
5. **事务管理**: 数据库操作使用 `@Transactional`
6. **异步任务追踪**: 防止 finishSession 并发竞态条件
7. **资源清理**: 临时文件和存储对象按配置清理
8. **重复分析防护**: `analyzeFinalWindows` 检查窗口覆盖情况

## 相关文档

- 核心架构: `../doc/dev3.md`
- 项目说明: `../CLAUDE.md`
- AI 提示词: `../doc/prompt.md`
