# 项目整体方案

## 模块命名约定

- **web-recorder**：前端录制模块
- **core-service**：Spring Boot 业务中枢
- **ai-service**：Python AI 分析服务

---

## 1. 需求描述

### 核心需求

通过浏览器摄像头实时录制用户活动（编程、手工、教学等任何场景），AI自动生成连贯的文字记录。

### 关键特征

- **通用性**：不限于特定场景
- **连贯性**：AI理解上下文，生成连贯描述而非碎片
- **准确性**：优先保证质量，可接受半实时延迟（30秒-2分钟）
- **完整性**：不遗漏关键信息
- **可配置**：AI模型、分析模式、存储策略均可选择
- **可扩展**：架构支持后续功能迭代

### 用户可选配置项

#### 1. AI模型选择
- **Qwen API**（通义千问）
- **Gemini API**（Google）
- 预留扩展点支持更多模型（Claude、GPT-4V等）

#### 2. 分析模式
- **整体分析模式**：录制完成后一次性分析全部内容
- **半实时分析模式**：滑动窗口分段处理，边录边分析
- **实时截图分析模式**：定时截图+OCR（规划中，暂不实现）

#### 3. 视频存储策略
- **默认：分析后删除**（节省存储成本）
- **可选：永久保留**（便于回溯和二次分析）
- 确保分析完成后才执行清理操作

---

## 2. 整体架构

```
┌───────────────┐
│ web-recorder  │  浏览器录制
└───────┬───────┘
        │ HTTP上传WebM视频
        ↓
┌───────────────────────────────────────────┐
│ core-service（业务中枢）                   │
│ - 接收前端上传                             │
│ - 调用ai-service处理视频（切片）            │
│ - 上传处理后的视频到存储服务                │
│ - 生成公网URL                              │
│ - 调用ai-service分析（传URL）              │
│ - 接收流式结果 → 保存数据库 → WebSocket推送│
│ - 视频清理                                 │
└───┬───────────────────┬───────────────────┘
    │                   │
    │ gRPC调用          │ 上传切片后的视频
    │ ProcessVideo      │
    │ AnalyzeVideo      ↓
    ↓            ┌──────────────────┐
┌───────────┐   │ 存储服务 (3选1)   │
│ai-service │   │ - MinIO (自建)   │
│- FFmpeg切片│   │ - OSS (阿里云)   │ 提供公网URL
│- 调用AI API│   │ - COS (腾讯云)   │
└─────┬─────┘   └──────┬───────────┘
      │                │
      │ API调用        │ qwen/gemini
      │                │ 通过URL下载视频
      ↓                ↓
┌──────────────────────┐
│  qwen / gemini       │ 云端AI API
│ (DashScope/GenAI)    │
└──────────────────────┘

数据持久化:
┌───────────────┐
│  PostgreSQL   │
│ - sessions    │
│ - video_chunks│
│ - records     │
│ - configs     │
└───────────────┘
```

### 核心说明

**web-recorder**：
- MediaRecorder API录制WebM
- HTTP上传到core-service

**core-service**（调度中枢）：
- 接收前端视频上传
- 半实时模式：调用ai-service切片 → 上传切片到存储服务 → 生成URL
- 整体模式：直接上传原始视频到存储服务 → 生成URL
- 调用ai-service分析，传URL
- 接收流式结果 → 保存PostgreSQL → WebSocket推送前端
- 根据keep_video配置删除存储服务中的文件

**ai-service**（视频处理+AI调用）：
- ProcessVideo: FFmpeg切片，返回切片路径
- AnalyzeVideo: 接收URL，调用DashScope/Gemini API，流式返回结果
- **不直接操作存储服务**

**存储服务**（3选1）：
- **MinIO**: 自建对象存储，适合开发测试，需配置公网访问
- **OSS**: 阿里云对象存储，配合Qwen使用效果好
- **COS**: 腾讯云对象存储，推荐国内部署使用
- 作用：qwen/gemini需要公网URL访问视频
- 功能：存储切片后的视频或原始视频，生成公网访问URL

**部署**：
- 单台服务器部署（当前阶段）
- 预留分布式扩展性

---

## 3. 技术栈

### web-recorder（前端）

- **MediaRecorder API**：浏览器原生视频录制
- **WebM格式**：浏览器原生支持，无需转码
- **HTTP上传**：Multipart/form-data
- **WebSocket**：接收实时分析结果

### core-service（Spring Boot）

- **Spring Boot 3.5.7** + **Java 17**
- **Maven**（构建工具）
- **Spring WebFlux**（响应式编程）
- **Spring Data JPA**（数据持久化）
- **内置任务队列**（CompletableFuture + ThreadPoolExecutor）
- **WebSocket**（推送结果）
- **gRPC Client 1.68.1**（调用ai-service）
- **存储服务SDK**：
  - MinIO Java SDK 8.5.7（自建存储）
  - Aliyun OSS SDK 3.17.4（阿里云）
  - Tencent COS SDK 5.6.229（腾讯云）

### ai-service（Python）

- **Python 3.12**
- **gRPC Server 1.68.1**（与core-service通信）
- **FFmpeg**（视频切片，半实时模式必需）
- **多模型支持**：
  - **DashScope SDK**（Qwen原生SDK，支持视频URL分析）
  - **Google GenAI SDK 1.0+**（Gemini统一SDK）
- **不需要存储服务SDK**（只接收URL字符串，不直接操作对象存储）

### 基础设施

- **存储服务**（3选1）：
  - MinIO（自建对象存储，开发测试）
  - Aliyun OSS（阿里云对象存储）
  - Tencent COS（腾讯云对象存储，推荐）
- **PostgreSQL 15+**：业务数据存储
- **Caddy**：反向代理和HTTPS（可选）
- **Docker Compose**（推荐）：容器化部署

---

## 4. 核心流程

### 4.1 整体分析模式

```
web-recorder:
  录制完成(如10分钟) → 上传完整视频

core-service:
  接收视频 → 上传存储服务 → 生成公网URL
  → gRPC调用ai-service(video_url, mode="full")
  → 接收流式结果 → 保存数据库 → WebSocket推送前端
  → keep_video=false: 删除存储服务中的文件
  → keep_video=true: 保留存储服务中的文件

ai-service:
  接收video_url → 调用DashScope/Gemini API
  → dashscope.MultiModalConversation.call(video_url, ...)
  → 流式返回结果token
```

**优点**：分析连贯，理解更完整
**缺点**：等待时间长，用户需等录制完成

### 4.2 半实时分析模式（滑动窗口）

```
web-recorder:
  每30秒上传一个视频片段

core-service:
  接收chunk_0.webm → 保存临时文件
    ↓
  【第1步：处理视频】
  gRPC调用: ai-service.ProcessVideo(video_path, mode=sliding_window)
    ↓
  ai-service:
    FFmpeg切片 → 返回3个窗口文件路径:
      - /tmp/skiuo/.../chunk_0_w0.mp4 (0-15s)
      - /tmp/skiuo/.../chunk_0_w1.mp4 (10-25s)
      - /tmp/skiuo/.../chunk_0_w2.mp4 (20-30s)
    ↓
  【第2步：上传存储服务】
  core-service上传3个窗口到存储服务(COS/OSS/MinIO) → 生成3个公网URL
    ↓
  【第3步：逐窗口分析】
  gRPC调用: ai-service.AnalyzeVideo(url_w0, context="")
    → ai-service调用DashScope API:
       dashscope.MultiModalConversation.call(video=url_w0, ...)
    → 流式返回result_0 → core保存+推送前端

  gRPC调用: ai-service.AnalyzeVideo(url_w1, context=result_0)
    → ai-service调用DashScope API (prompt含context)
    → 流式返回result_1 → core保存+推送前端

  gRPC调用: ai-service.AnalyzeVideo(url_w2, context=result_1)
    → ai-service调用DashScope API (prompt含context)
    → 流式返回result_2 → core保存+推送前端
    ↓
  【第4步：清理】
  删除临时文件
  keep_video=false → 删除存储服务中的3个窗口文件
  keep_video=true → 保留存储服务中的文件

  同时并行处理chunk_1, chunk_2...
```

**优点**：边录边分析，用户实时看到结果
**缺点**：需要管理上下文，token消耗大

**核心要点**：
- ai-service负责切片，返回本地路径
- core-service负责上传存储服务和生成URL
- ai-service不需要存储服务SDK，只接收URL进行分析

### 4.3 详细流程图（半实时模式）

```
┌─────────────────────────────────────────────────────┐
│ 1. web-recorder 录制                                 │
│    getUserMedia → MediaRecorder.start()              │
│    30秒后 → ondataavailable → Blob                   │
│    HTTP POST /api/videos/upload                      │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. core-service 接收                                 │
│    接收视频 → 保存临时文件(/tmp/skiuo/xxx.webm)      │
│    查询用户配置(AI模型、分析模式、keep_video)         │
│    放入任务队列 → 返回202 Accepted                   │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. core-service Worker - 处理视频                   │
│    gRPC调用: ai-service.ProcessVideo(video_path)     │
│      参数: 本地文件路径, 窗口大小, 步长              │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. ai-service FFmpeg切片                             │
│    读取本地视频文件                                   │
│    FFmpeg切片:                                       │
│      - chunk_0_w0.mp4 (0-15s)                        │
│      - chunk_0_w1.mp4 (10-25s)                       │
│      - chunk_0_w2.mp4 (20-30s)                       │
│    返回3个本地文件路径                                │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 5. core-service 上传存储服务                         │
│    上传3个窗口文件到存储服务(COS/OSS/MinIO)          │
│    生成3个公网访问URL                                │
│    保存数据库记录                                     │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 6. core-service 逐窗口分析                           │
│    for window in [w0, w1, w2]:                       │
│      gRPC调用: ai-service.AnalyzeVideo(              │
│        video_url=window_url,                         │
│        context=previous_result                       │
│      )                                               │
│      接收流式响应 → 保存数据库 → WebSocket推送       │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 7. ai-service 调用AI                                 │
│    接收video_url(存储服务公网URL)                    │
│    调用DashScope/Gemini API:                         │
│      dashscope.MultiModalConversation.call(          │
│        video=video_url, prompt=f"前文:{context}"     │
│      )                                               │
│    AI从URL下载视频并分析                             │
│    流式yield结果 → gRPC stream返回                   │
└───────────────────┬─────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 8. core-service 清理                                 │
│    所有窗口分析完成                                   │
│    删除本地临时文件(/tmp/skiuo/...)                  │
│    检查keep_video配置:                               │
│      false: 删除存储服务中的窗口文件                 │
│      true:  保留存储服务中的文件                     │
│    更新任务状态 → 完成                               │
└─────────────────────────────────────────────────────┘
```

---

## 5. 滑动窗口策略（半实时模式）

### 目的

保证动作完整性和上下文连贯性

### 实现方式（FFmpeg物理切片）

```
ai-service接收ProcessVideo请求
  ↓
参数: video_path, window_size=15, window_step=10
  ↓
读取本地视频文件
  ↓
FFmpeg切片（同一台服务器，本地操作）：
  ffmpeg -i /tmp/skiuo/chunk_0.webm -ss 0 -t 15 chunk_0_w0.mp4
  ffmpeg -i /tmp/skiuo/chunk_0.webm -ss 10 -t 15 chunk_0_w1.mp4
  ffmpeg -i /tmp/skiuo/chunk_0.webm -ss 20 -t 10 chunk_0_w2.mp4
  ↓
返回3个切片文件路径:
  ["/tmp/skiuo/chunk_0_w0.mp4",
   "/tmp/skiuo/chunk_0_w1.mp4",
   "/tmp/skiuo/chunk_0_w2.mp4"]
  ↓
core-service接收路径列表
  ↓
上传3个切片到存储服务 → 生成3个公网URL
  ↓
逐个调用ai-service.AnalyzeVideo(url_w0)
                            AnalyzeVideo(url_w1, context=result_0)
                            AnalyzeVideo(url_w2, context=result_1)
  ↓
ai-service调用DashScope API → AI从URL下载并分析
```

### 参数配置

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 窗口大小 | 15秒 | 太小(<10s)动作不完整，太大(>30s)处理慢 |
| 步长 | 10秒 | 33%重叠率，平衡完整性和效率 |
| 重叠区域 | 5秒 | 确保跨窗口的动作不被截断 |

### 职责分离

- **ai-service**: 只负责FFmpeg切片和AI调用，不操作存储服务
- **core-service**: 负责上传存储服务、生成URL、删除文件
- **存储服务**: 提供公网URL供AI访问
- **DashScope/Gemini**: 从URL下载视频并分析

---

## 6. 上下文管理

### 问题

每个窗口独立分析，如何保证连贯性？

### 方案

**短期记忆（滑动窗口内）**：

```python
# 第1个窗口
prompt_1 = """
分析这段视频(0-15秒)，描述用户在做什么。
输出格式：简洁的动作描述
"""

# 第2个窗口
prompt_2 = f"""
分析这段视频(10-25秒)。
前置上下文(0-15秒)：{result_1}
重点描述10-25秒新增的动作，避免重复已描述的内容。
"""

# 第N个窗口
prompt_n = f"""
分析这段视频({start}-{end}秒)。
前置摘要：{compressed_history}
上一窗口({prev_start}-{prev_end}秒)：{prev_result}
描述当前窗口的新动作。
"""
```

**长期记忆（跨片段）**：

- 每个30秒片段分析完成后，生成摘要
- 下一个片段分析时携带历史摘要
- 定期压缩历史(如每5分钟)，避免token超限

---

## 7. 数据模型

### 核心表结构

#### sessions（会话表）

```sql
CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL, -- RECORDING/ANALYZING/COMPLETED/FAILED
  ai_model VARCHAR(50), -- qwen/gemini
  analysis_mode VARCHAR(20), -- full/sliding_window
  keep_video BOOLEAN DEFAULT false,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### video_chunks（视频片段表）

```sql
CREATE TABLE video_chunks (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL,
  chunk_index INT NOT NULL, -- 片段序号
  minio_path VARCHAR(500) NOT NULL, -- MinIO存储路径
  duration INT, -- 视频时长(秒)
  status VARCHAR(20), -- UPLOADED/ANALYZING/ANALYZED/DELETED
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

#### analysis_records（分析记录表）

```sql
CREATE TABLE analysis_records (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL,
  chunk_id BIGINT, -- 属于哪个视频片段
  window_index INT, -- 滑动窗口序号(整体分析为NULL)
  content TEXT NOT NULL, -- AI分析结果
  start_time_offset INT, -- 相对会话开始的时间偏移(秒)
  end_time_offset INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (chunk_id) REFERENCES video_chunks(id)
);
```

#### user_configs（用户配置表）

```sql
CREATE TABLE user_configs (
  user_id BIGINT PRIMARY KEY,
  default_ai_model VARCHAR(50) DEFAULT 'qwen',
  default_analysis_mode VARCHAR(20) DEFAULT 'sliding_window',
  default_keep_video BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. 存储方案（多存储服务支持）

### 为什么需要对象存储服务

**AI云服务API无法访问私有存储的视频**
- Qwen/Gemini是云端API，需要公网URL访问视频
- ai-service不能传本地文件路径给AI
- 必须提供可公网访问的HTTP(S) URL
- 对象存储提供公网访问URL

### 存储服务选择（3选1）

#### 1. MinIO（自建对象存储）
**适用场景**: 开发测试、本地部署

**配置**:
```yaml
# application.yml
storage:
  type: minio

minio:
  endpoint: http://your-minio-server:9000  # 必须可公网访问
  access-key: ${MINIO_ACCESS_KEY}
  secret-key: ${MINIO_SECRET_KEY}
  bucket-name: skiuo-videos
  presigned-url-expiry: 3600  # 预签名URL有效期1小时
```

**优点**: 完全自主控制，无API调用限制
**缺点**: 需要配置公网访问，AI可能无法访问私有网络

#### 2. OSS（阿里云对象存储）
**适用场景**: 配合Qwen使用，阿里云生态

**配置**:
```yaml
# application.yml
storage:
  type: oss

oss:
  endpoint: ${OSS_ENDPOINT}
  access-key-id: ${OSS_ACCESS_KEY_ID}
  access-key-secret: ${OSS_ACCESS_KEY_SECRET}
  bucket-name: ${OSS_BUCKET_NAME}
  region: ${OSS_REGION}
```

**优点**: 与Qwen同属阿里云，访问稳定
**缺点**: 需要阿里云账号，有存储费用

#### 3. COS（腾讯云对象存储）
**适用场景**: 国内部署推荐，稳定可靠

**配置**:
```yaml
# application.yml
storage:
  type: cos

cos:
  secret-id: ${COS_SECRET_ID}
  secret-key: ${COS_SECRET_KEY}
  region: ${COS_REGION}
  bucket-name: ${COS_BUCKET_NAME}
```

**优点**: 国内访问速度快，稳定性高
**缺点**: 需要腾讯云账号，有存储费用

### 数据流

```
core-service上传流程：
  接收视频 → 选择存储服务(StorageServiceFactory)
  → 上传到存储服务(MinIO/OSS/COS)
  → 生成公网访问URL
  → 传URL给ai-service（不是传路径）

ai-service处理：
  接收video_url字符串
  → 传给DashScope/Gemini API
  → AI从URL下载视频并分析

清理流程：
  分析完成 → 检查keep_video
    - false: deleteObject(删除视频)
    - true: 保留文件
```

### 存储服务抽象

```java
// core-service/service/StorageService.java
public interface StorageService {
    String uploadFile(String localFilePath, String objectName);
    String generatePublicUrl(String objectName);
    void deleteObject(String objectName);
}

// 三种实现
- MinioService: MinIO SDK
- OssService: Aliyun OSS SDK
- CosService: Tencent COS SDK

// 工厂选择
StorageServiceFactory.getStorageService(storageType)
```

### 路径规范

```
Bucket/桶名: skiuo-videos (或自定义)
路径结构:
  sessions/{session_id}/chunks/{timestamp}_{chunk_index}.webm

示例:
  sessions/12345/chunks/20250125_143022_0.webm
  sessions/12345/chunks/20250125_143052_1.webm

公网URL示例:
  - MinIO: http://minio.example.com/skiuo-videos/sessions/12345/chunks/xxx.webm?X-Amz-Expires=3600
  - OSS: https://bucket.oss-cn-hangzhou.aliyuncs.com/sessions/12345/chunks/xxx.webm
  - COS: https://bucket-1234567890.cos.ap-guangzhou.myqcloud.com/sessions/12345/chunks/xxx.webm
```

### 清理策略

1. **默认行为**（keep_video=false）：
   - 分析完成 → 立即删除存储服务中的文件
   - 节省存储成本

2. **保留模式**（keep_video=true）：
   - 分析完成后保留
   - 可选：设置生命周期策略（7天后自动删除）

3. **异常处理**：
   - 分析失败 → 保留48小时供排查
   - 定时任务清理孤儿文件（无数据库记录的视频）

### 存储服务选择建议

| 场景 | 推荐存储 | 理由 |
|------|---------|------|
| 开发测试 | MinIO | 本地部署，快速 |
| 国内生产 | COS | 稳定可靠，速度快 |
| 配合Qwen | OSS | 阿里云生态，访问稳定 |
| 数据安全 | 自建MinIO | 完全自主控制 |

---

## 9. 通信协议

### 9.1 web-recorder ↔ core-service

#### 上传视频

```http
POST /api/videos/upload
Content-Type: multipart/form-data

sessionId: 12345
chunkIndex: 0
video: (binary WebM file)

Response 202:
{
  "chunkId": 67890,
  "status": "accepted"
}
```

#### WebSocket连接

```javascript
ws://host/ws/session/{sessionId}

// 接收消息格式
{
  "type": "analysis_result",
  "chunkIndex": 0,
  "windowIndex": 1,
  "content": "用户正在打开IDE...",
  "timestamp": "2025-01-25T14:30:45Z"
}
```

### 9.2 core-service ↔ ai-service

#### gRPC Service定义

```protobuf
service VideoAnalysis {
  // 步骤1：处理视频（FFmpeg切片）
  rpc ProcessVideo(ProcessRequest) returns (ProcessResponse);

  // 步骤2：分析视频（调用AI API）
  rpc AnalyzeVideo(AnalysisRequest) returns (stream AnalysisResponse);
}

// ========== 处理视频接口 ==========
message ProcessRequest {
  string session_id = 1;
  int64 chunk_id = 2;
  string video_path = 3;          // 本地文件路径（同一台服务器）
  string analysis_mode = 4;       // full/sliding_window
  int32 window_size = 5;          // 滑动窗口大小(秒), 默认15
  int32 window_step = 6;          // 滑动步长(秒), 默认10
}

message ProcessResponse {
  repeated string window_paths = 1;  // 切片后的本地文件路径列表
  string error = 2;                  // 错误信息(如果有)
}

// ========== 分析视频接口 ==========
message AnalysisRequest {
  string session_id = 1;
  int32 window_index = 2;         // 窗口序号（用于识别）
  string video_url = 3;           // MinIO预签名URL（核心）
  string ai_model = 4;            // qwen/gemini
  string context = 5;             // 上一窗口的结果摘要
}

message AnalysisResponse {
  string session_id = 1;
  int32 window_index = 2;         // 窗口序号
  string content = 3;             // 流式返回的token
  bool is_final = 4;              // 是否是最后一条
  string error = 5;               // 错误信息(如果有)
}
```

**调用流程**：

```
整体分析模式：
  core: 跳过ProcessVideo
  core: 直接上传原始视频到MinIO → 生成URL
  core: 调用AnalyzeVideo(url)

半实时模式：
  core: 调用ProcessVideo(video_path) → 返回[w0_path, w1_path, w2_path]
  core: 上传3个窗口到MinIO → 生成[url0, url1, url2]
  core: 调用AnalyzeVideo(url0, context="")
  core: 调用AnalyzeVideo(url1, context=result_0)
  core: 调用AnalyzeVideo(url2, context=result_1)
```

**核心要点**：
- `ProcessVideo`: ai-service读取本地文件，FFmpeg切片，返回本地路径
- `AnalyzeVideo`: ai-service接收URL，调用qwen/gemini API
- ai-service不需要MinIO SDK

---

## 10. AI模型扩展设计

### 接口抽象

```python
# ai-service/models/base.py
from abc import ABC, abstractmethod

class VideoAnalyzer(ABC):
    @abstractmethod
    async def analyze_video(
        self,
        video_url: str,  # 公网URL
        context: str = "",
        session_id: str = "",
        window_index: int = 0
    ) -> AsyncGenerator[str, None]:
        """流式分析视频，yield结果token"""
        pass

# ai-service/models/qwen_analyzer.py
class QwenAnalyzer(VideoAnalyzer):
    def __init__(self):
        dashscope.api_key = Config.QWEN_API_KEY
        self.model = Config.QWEN_MODEL

    async def analyze_video(self, video_url, context, session_id, window_index):
        # 使用DashScope SDK
        messages = [{
            'role': 'user',
            'content': [
                {'video': video_url},  # 视频URL
                {'text': self._build_prompt(context)}
            ]
        }]

        responses = dashscope.MultiModalConversation.call(
            model=self.model,
            messages=messages,
            stream=True
        )

        for response in responses:
            yield response.output.choices[0].message.content[0]['text']

# ai-service/models/gemini_analyzer.py
class GeminiAnalyzer(VideoAnalyzer):
    def __init__(self):
        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.model = Config.GEMINI_MODEL

    async def analyze_video(self, video_url, context, session_id, window_index):
        # 使用Google GenAI SDK
        response = self.client.models.generate_content_stream(
            model=self.model,
            contents=[
                {'file_uri': video_url},
                {'text': self._build_prompt(context)}
            ]
        )

        for chunk in response:
            yield chunk.text

# ai-service/models/factory.py
def get_analyzer(model_name: str) -> VideoAnalyzer:
    if model_name == "qwen":
        return QwenAnalyzer()
    elif model_name == "gemini":
        return GeminiAnalyzer()
    else:
        raise ValueError(f"Unknown model: {model_name}")
```

### 添加新模型步骤

1. 实现`VideoAnalyzer`接口
2. 在`factory.py`注册模型
3. 在`user_configs`表添加新选项
4. 前端下拉框添加新选项

---

## 11. 性能考虑

### 延迟预估

**整体分析模式**：
```
录制10分钟 → 上传(5秒) → 队列(<1秒)
→ AI分析(60-180秒) → 结果返回

总延迟：约11-13分钟
```

**半实时模式**：
```
录制30秒 → 上传(1秒) → 队列(<1秒)
→ FFmpeg切片(1秒) → AI分析(20-60秒/窗口，3窗口并行)
→ 首个窗口结果：约30秒

持续反馈：每10秒一条新结果
```

### 瓶颈分析

1. **AI API调用速度**：主要瓶颈（无法控制）
2. **MinIO下载速度**：取决于网络带宽
3. **队列积压**：多用户并发时可能排队

### 优化方向

- **并行处理**：多个worker并发处理不同chunk
- **缓存策略**：重复分析时复用结果
- **降级策略**：API失败时切换备用模型
- **速率限制**：防止API超限，平滑请求

---

## 12. 错误处理与容错

### 错误场景

1. **视频上传失败**
   - 重试3次
   - 前端提示重新录制该片段

2. **MinIO存储失败**
   - 回滚数据库记录
   - 返回503错误

3. **AI分析失败**
   - 标记任务为FAILED
   - 保留视频供人工排查
   - 自动重试1次(换个模型)

4. **WebSocket断开**
   - 前端自动重连
   - 重新订阅session
   - 拉取断线期间的结果

### 数据一致性

- 使用事务确保视频上传和数据库记录原子性
- 定时任务检查孤儿数据：
  - 有数据库记录但无MinIO文件
  - 有MinIO文件但无数据库记录
  - 状态长时间为ANALYZING的任务

---

## 13. 部署与运维

### 开发环境

```bash
# 启动基础设施（Docker Compose）
cd deployment
docker-compose up -d postgres minio

# 启动core-service
cd core-service
mvn spring-boot:run

# 启动ai-service
cd ai-service
python3.12 -m venv venv
source venv/bin/activate
pip3.12 install -r requirements.txt
python3.12 main.py

# 启动web-recorder
cd web-recorder
npm install
npm run dev
```

### 生产部署（Caddy反向代理）

#### Caddyfile配置

```caddyfile
# skiuo.yourdomain.com
skiuo.yourdomain.com {
    # 前端
    reverse_proxy /* web-recorder:3000

    # API接口
    reverse_proxy /api/* core-service:8080

    # WebSocket
    reverse_proxy /ws/* core-service:8080

    # MinIO（如果需要公网访问）
    reverse_proxy /minio/* minio:9000 {
        header_up Host {upstream_hostport}
    }

    # 自动HTTPS
    tls your-email@example.com
}
```

#### Docker Compose生产配置

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: skiuo
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data

  core-service:
    build: ./core-service
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/skiuo
      MINIO_ENDPOINT: http://minio:9000
    depends_on:
      - postgres
      - minio

  ai-service:
    build: ./ai-service
    environment:
      QWEN_API_KEY: ${QWEN_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}

  web-recorder:
    build: ./web-recorder
    environment:
      API_BASE_URL: https://skiuo.yourdomain.com

volumes:
  caddy_data:
  caddy_config:
  postgres_data:
  minio_data:
```

### 高可用建议

- **负载均衡**：Caddy自动负载均衡多个core-service实例
- **数据库**：PostgreSQL主从复制
- **MinIO**：集群模式（至少4节点）
- **监控**：Prometheus + Grafana
- **日志**：Loki集中收集

---

## 14. 核心原则

### 做什么

✅ 录制完整视频（WebM格式）
✅ MinIO对象存储提供公网URL
✅ 多AI模型可配置（qwen/gemini）
✅ 多分析模式（整体/半实时）
✅ 流式返回结果
✅ 灵活的视频保留策略
✅ 上下文连贯性管理

### 不做什么

❌ 提取关键帧（交给qwen/gemini决定）
❌ 手动视频编辑
❌ 复杂的预处理
❌ 实时截图分析（暂不实现）
❌ 视频本地存储（必须用MinIO提供URL）

### 架构原则

1. **职责分离**：
   - web-recorder: 只管录制
   - core-service: 调度+存储+清理
   - ai-service: 只管调用AI API
   - qwen/gemini: 只管分析

2. **依赖最小化**：
   - ai-service不依赖MinIO SDK
   - 只通过URL传递视频

3. **配置驱动**：
   - AI模型、分析模式可切换
   - 避免硬编码

4. **数据持久化**：
   - 所有状态存PostgreSQL
   - 视频临时存MinIO

---

## 15. 风险与限制

### 技术限制

- AI API有速率限制和token上限
- 视频文件大小受网络带宽限制
- 浏览器MediaRecorder兼容性（Safari较弱）
- MinIO存储容量需要监控

### 质量权衡

- 窗口越大越准确，但处理越慢
- 重叠越多越完整，但计算冗余
- 实时性和准确性的平衡需根据场景调优

### 成本考虑

- AI API调用费用（按token计费）
- MinIO存储费用（按容量计费）
- 服务器资源消耗

---

## 总结

基于**多存储服务**的视频AI分析系统，核心架构：

### 整体分析模式
```
web-recorder → core-service → 上传存储服务 → 生成URL → ai-service.AnalyzeVideo(url) → AI分析
```

### 半实时模式（滑动窗口）
```
web-recorder → core-service → ai-service.ProcessVideo(path) → FFmpeg切片 → 返回切片路径
           → core上传切片到存储服务 → 生成URL → ai-service.AnalyzeVideo(url) → AI分析
```

**架构核心**：
- **职责分离**：ai-service负责视频处理+AI调用，core-service负责存储+调度
- **存储服务抽象**：支持MinIO/OSS/COS，工厂模式选择
- **公网URL必需**：AI云服务需要公网URL访问视频
- **ai-service不依赖存储SDK**：只接收本地路径（切片）和URL（分析）
- **DashScope SDK**：Qwen必须使用DashScope原生SDK才能分析视频URL
- **单机部署**：当前阶段部署在同一台服务器，预留分布式扩展性

**技术栈**：
- core-service: Spring Boot 3.5.7 + Java 17 + 多存储SDK + gRPC Client + PostgreSQL
- ai-service: Python 3.12 + gRPC Server + FFmpeg + DashScope SDK + Google GenAI SDK
- web-recorder: React 19 + TypeScript + MediaRecorder API + WebSocket
- 基础设施: 存储服务(MinIO/OSS/COS 3选1) + PostgreSQL + Caddy

**可配置项**：
- **存储服务**: MinIO / OSS / COS（工厂模式选择）
- **AI模型**: Qwen (DashScope) / Gemini（易扩展）
- **分析模式**: 整体分析 / 半实时滑动窗口
- **视频保留**: 默认删除 / 可选保留
- **窗口参数**: 大小15秒 / 步长10秒（可调）

**关键更新（已实现）**：
1. **多存储服务支持**：添加OSS和COS，解决AI API无法访问私有存储的问题
2. **Qwen改用DashScope SDK**：支持视频URL分析，OpenAI兼容接口无法读取视频
3. **前端配置面板**：支持选择存储服务类型
4. **存储服务抽象层**：StorageService接口 + 工厂模式实现

