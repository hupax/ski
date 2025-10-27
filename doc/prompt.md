你是一位专业的软件开发实施专家，专注于高效实现和代码质量。工作原则：功能实现优先，本质需求导向，简洁高效。

---

## 项目概述

这是一个视频AI分析系统，通过浏览器录制视频，后端调用AI模型（qwen/gemini）生成文字记录。

**核心架构**：
```
web-recorder(前端) → core-service(Spring Boot) → ai-service(Python) → qwen/gemini API
                            ↓
                         MinIO + PostgreSQL
```

**三个模块**：
- `web-recorder`: 前端录制模块（浏览器MediaRecorder）
- `core-service`: Spring Boot业务中枢（任务调度、MinIO操作、数据库）
- `ai-service`: Python AI服务（FFmpeg切片、调用AI API）

**详细设计**：参考 `doc/dev3.md`

---

## 技术栈

### core-service
- Spring Boot 3.x + Maven
- Spring WebFlux（响应式）
- Spring Data JPA + PostgreSQL
- gRPC Client
- MinIO Java SDK
- WebSocket

### ai-service
- Python 3.12
- gRPC Server
- FFmpeg（视频切片）
- qwen SDK / gemini SDK

### 基础设施
- MinIO（对象存储，必需）
- PostgreSQL（业务数据）
- Caddy（反向代理）

---

## 环境变量配置

### .env 文件结构

```bash
# ==================== 数据库配置 ====================
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=skiuo
POSTGRES_USER=skiuo_user
POSTGRES_PASSWORD=your_postgres_password

# ==================== MinIO配置 ====================
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=your_minio_access_key
MINIO_SECRET_KEY=your_minio_secret_key
MINIO_BUCKET_NAME=skiuo-videos
MINIO_PRESIGNED_URL_EXPIRY=3600

# ==================== AI API配置 ====================
# Qwen API（通义千问）
QWEN_API_KEY=your_qwen_api_key
QWEN_API_ENDPOINT=https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation

# Gemini API（Google）
GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_ENDPOINT=https://generativelanguage.googleapis.com/v1beta

# ==================== gRPC配置 ====================
GRPC_AI_SERVICE_HOST=localhost
GRPC_AI_SERVICE_PORT=50051

# ==================== 应用配置 ====================
# core-service
CORE_SERVICE_PORT=8080
SPRING_PROFILES_ACTIVE=dev

# ai-service
AI_SERVICE_PORT=50051
AI_SERVICE_WORKERS=4

# ==================== 视频处理配置 ====================
# 滑动窗口参数
VIDEO_WINDOW_SIZE=15
VIDEO_WINDOW_STEP=10

# 临时文件路径
TEMP_VIDEO_PATH=/tmp/skiuo

# ==================== 其他配置 ====================
# 日志级别
LOG_LEVEL=INFO

# 是否开启调试模式
DEBUG_MODE=false
```

### core-service 使用方式

```yaml
# application.yml
spring:
  datasource:
    url: jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
    username: ${POSTGRES_USER}
    password: ${POSTGRES_PASSWORD}

minio:
  endpoint: ${MINIO_ENDPOINT}
  access-key: ${MINIO_ACCESS_KEY}
  secret-key: ${MINIO_SECRET_KEY}
  bucket-name: ${MINIO_BUCKET_NAME}
  presigned-url-expiry: ${MINIO_PRESIGNED_URL_EXPIRY}

grpc:
  client:
    ai-service:
      address: static://${GRPC_AI_SERVICE_HOST}:${GRPC_AI_SERVICE_PORT}
      negotiationType: PLAINTEXT
```

### ai-service 使用方式

```python
# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # AI API
    QWEN_API_KEY = os.getenv('QWEN_API_KEY')
    QWEN_API_ENDPOINT = os.getenv('QWEN_API_ENDPOINT')
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    GEMINI_API_ENDPOINT = os.getenv('GEMINI_API_ENDPOINT')

    # gRPC
    GRPC_PORT = int(os.getenv('AI_SERVICE_PORT', 50051))
    GRPC_WORKERS = int(os.getenv('AI_SERVICE_WORKERS', 4))

    # 视频处理
    WINDOW_SIZE = int(os.getenv('VIDEO_WINDOW_SIZE', 15))
    WINDOW_STEP = int(os.getenv('VIDEO_WINDOW_STEP', 10))
    TEMP_PATH = os.getenv('TEMP_VIDEO_PATH', '/tmp/skiuo')
```

---

## 开发规范

### 通用原则
1. **功能实现优先**：先实现核心功能，再优化
2. **简洁高效**：代码清晰，避免过度设计
3. **错误处理完善**：所有外部调用（AI API、MinIO、数据库）都要有错误处理
4. **日志规范**：关键操作记录日志，便于排查问题

### 命名规范
- **Java**: 驼峰命名 `VideoUploadService`, `analyzeVideo()`
- **Python**: 蛇形命名 `video_analyzer.py`, `process_video()`
- **数据库**: 蛇形命名 `video_chunks`, `session_id`
- **环境变量**: 大写+下划线 `MINIO_ACCESS_KEY`

### 目录结构

```
skiuo/
├── core-service/                # Spring Boot
│   ├── src/main/java/com/skiuo/
│   │   ├── controller/         # HTTP接口
│   │   ├── service/            # 业务逻辑
│   │   ├── repository/         # 数据库
│   │   ├── grpc/               # gRPC客户端
│   │   └── config/             # 配置
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── application-dev.yml
│   └── pom.xml
│
├── ai-service/                  # Python
│   ├── grpc_server.py          # gRPC服务入口
│   ├── video_processor.py      # 视频处理（FFmpeg切片）
│   ├── models/
│   │   ├── base.py             # 抽象接口
│   │   ├── qwen_analyzer.py    # Qwen实现
│   │   └── gemini_analyzer.py  # Gemini实现
│   ├── config.py               # 配置加载
│   ├── requirements.txt
│   └── proto/                  # gRPC定义
│
├── web-recorder/                # 前端
│   ├── src/
│   ├── package.json
│   └── ...
│
├── deployment/                  # 部署相关
│   ├── docker-compose.yml
│   └── Caddyfile
│
├── proto/                       # gRPC protobuf定义
│   └── video_analysis.proto
│
├── .env                         # 环境变量（不提交到git）
├── .env.example                 # 环境变量模板
└── doc/
    ├── dev3.md                 # 核心架构文档
    ├── input-extension.md      # 输入扩展
    └── optimization-and-scaling.md
```

---

## 关键实现要点

### 1. 视频处理流程（半实时模式）

```
core-service接收视频 → 保存临时文件
  ↓
gRPC调用: ai-service.ProcessVideo(本地路径)
  ↓
ai-service: FFmpeg切片 → 返回切片路径列表
  ↓
core-service: 上传切片到MinIO → 生成预签名URL
  ↓
core-service: 逐个调用 ai-service.AnalyzeVideo(url)
  ↓
ai-service: 调用qwen/gemini API → 流式返回结果
  ↓
core-service: 保存数据库 → WebSocket推送前端
  ↓
core-service: 清理临时文件 + 根据keep_video决定是否删除MinIO文件
```

### 2. MinIO的作用

**为什么必须用MinIO？**
- qwen/gemini是云端API，需要公网URL访问视频
- 不能传本地文件路径给AI
- MinIO提供预签名URL（临时、安全）

### 3. ai-service职责

- ✅ FFmpeg视频切片（返回本地路径）
- ✅ 调用qwen/gemini API（接收URL）
- ❌ 不操作MinIO（不需要MinIO SDK）
- ❌ 不操作数据库

### 4. 错误处理要求

```java
// core-service示例
try {
    minioClient.uploadObject(uploadRequest);
} catch (MinioException e) {
    log.error("MinIO upload failed: {}", e.getMessage());
    // 回滚数据库
    // 删除临时文件
    throw new StorageException("视频上传失败", e);
}
```

```python
# ai-service示例
try:
    response = qwen_client.call(video_url)
except APIError as e:
    logger.error(f"Qwen API error: {e}")
    yield AnalysisResponse(error=str(e))
    return
```

---

## 开发命令

### 启动开发环境

```bash
# 1. 启动基础设施
cd deployment
docker-compose up -d postgres minio

# 2. 启动core-service
cd core-service
mvn spring-boot:run

# 3. 启动ai-service
cd ai-service
python3.12 -m venv venv
source venv/bin/activate
pip3.12 install -r requirements.txt
python3.12 grpc_server.py

# 4. 启动前端
cd web-recorder
npm install
npm run dev
```

### 生成gRPC代码

```bash
# Java (core-service)
cd core-service
mvn clean compile

# Python (ai-service)
cd ai-service
python3.12 -m grpc_tools.protoc \
    -I../proto \
    --python_out=./proto \
    --grpc_python_out=./proto \
    ../proto/video_analysis.proto
```

---

## 注意事项

### 安全性
- ⚠️ .env文件包含敏感信息，**不要提交到git**
- ⚠️ MinIO预签名URL有过期时间（1小时）
- ⚠️ AI API Key要保密

### 性能
- 📊 AI分析是主要瓶颈（30秒），不是磁盘IO（50ms）
- 📊 不要过早优化，先实现功能
- 📊 参考 `doc/optimization-and-scaling.md`

### 部署
- 🚀 当前阶段：单台服务器部署
- 🚀 预留扩展性：支持分布式部署
- 🚀 部署配置参考 `doc/dev3.md` 第13章

---

## 常用命令

```bash
# Python命令统一用 python3.12
python3.12 -m venv venv
python3.12 grpc_server.py
python3.12 -m pip install ...

# Maven构建
mvn clean install
mvn spring-boot:run
mvn test

# Docker操作
docker-compose up -d
docker-compose logs -f core-service
docker-compose down
```

---

## 参考文档

- **核心架构**: `doc/dev3.md`
- **输入扩展**: `doc/input-extension.md`（Pocket 3推流等）
- **性能优化**: `doc/optimization-and-scaling.md`（IO优化、分布式部署）

---

## AI开发指导

当你作为AI辅助开发时，请：

1. **先阅读** `doc/dev3.md` 了解整体架构
2. **遵循技术栈**：Spring Boot + Maven / Python 3.12 / gRPC
3. **使用.env**：所有配置从环境变量读取
4. **关注职责分离**：
   - core-service: 调度、存储、数据库
   - ai-service: 视频处理、AI调用
5. **完善错误处理**：外部调用都要try-catch
6. **记录关键日志**：便于排查问题
7. **不过早优化**：先实现功能，再优化性能
8. **文档查阅**: 可以使用context7
