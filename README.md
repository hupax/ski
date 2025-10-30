# SKI - 视频AI分析系统

通过浏览器录制视频，调用 AI 模型（Qwen/Gemini）自动生成连贯的文字记录。

## 系统架构

```
┌─────────────┐
│web-recorder │  React前端 - 浏览器录制视频
└──────┬──────┘
       │ HTTP上传视频
       ↓
┌─────────────────────────────────────────────┐
│ core-service (业务中枢)                      │
│ - 接收视频上传                               │
│ - 选择存储服务 (MinIO/OSS/COS)               │
│ - 调用ai-service处理和分析                   │
│ - WebSocket推送实时结果                      │
└────┬──────────────────┬─────────────────────┘
     │                  │
     │ gRPC            │ 上传视频
     ↓                  ↓
┌────────────┐   ┌──────────────────┐
│ai-service  │   │存储服务 (3选1)   │
│- FFmpeg切片│   │- MinIO (自建)    │
│- AI分析    │   │- OSS (阿里云)    │
└────────────┘   │- COS (腾讯云)    │
                 └──────────────────┘
                          ↓
                 AI模型通过公网URL
                 下载视频并分析
```

## 三大模块

### 1. web-recorder (前端)
- **技术栈**: React 19 + TypeScript + Vite
- **功能**: 视频录制、测试模式上传、WebSocket实时结果推送
- **特性**:
  - 支持暂停/恢复录制
  - 动态 chunk 时长（从服务器获取）
  - 并发竞态条件防护（等待最后chunk上传完成）
  - 测试模式（上传本地chunk文件）

[详细文档 →](web-recorder/README.md)

### 2. core-service (业务中枢)
- **技术栈**: Spring Boot 3.5 + Java 17 + PostgreSQL
- **功能**: 视频上传、多存储服务管理、gRPC调用、WebSocket推送
- **特性**:
  - 多存储服务支持（MinIO/OSS/COS，工厂模式）
  - 异步任务追踪（防止finishSession竞态条件）
  - 滑动窗口策略（智能分析，避免重复）
  - dotenv-java 自动加载配置

[详细文档 →](core-service/README.md)

### 3. ai-service (AI分析)
- **技术栈**: Python 3.12 + gRPC + FFmpeg
- **功能**: 视频切片、AI模型调用（DashScope/Gemini）
- **特性**:
  - Qwen 使用 DashScope 原生SDK（支持视频URL）
  - 滑动窗口FFmpeg切片（保证动作完整性）
  - 流式返回AI分析结果
  - 存储服务无关（只接收URL）

[详细文档 →](ai-service/README.md)

## 快速开始

### 前置要求

- Java 17+
- Python 3.12+
- PostgreSQL 15+
- FFmpeg
- Node.js 18+
- **存储服务**（三选一）：MinIO / Aliyun OSS / Tencent COS
- **AI API Key**（至少一个）：Qwen / Gemini

### 1. 配置环境变量

在项目根目录创建 `.env` 文件（参考 `.env.example`）：

```bash
# 数据库
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=skiuo
POSTGRES_USER=skiuo
POSTGRES_PASSWORD=your_password

# 存储服务（3选1）
STORAGE_TYPE=cos  # minio | oss | cos

# COS (推荐)
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_REGION=ap-guangzhou
COS_BUCKET_NAME=your_bucket_name

# OSS
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY_ID=your_oss_key_id
OSS_ACCESS_KEY_SECRET=your_oss_key_secret
OSS_BUCKET_NAME=your_bucket_name

# MinIO (本地开发)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=skiuo-videos

# AI API
QWEN_API_KEY=your_qwen_api_key
QWEN_MODEL=qwen-vl-max
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-pro

# gRPC
GRPC_AI_SERVICE_HOST=localhost
GRPC_AI_SERVICE_PORT=50051

# 视频处理
TEMP_VIDEO_PATH=/tmp/skiuo
VIDEO_WINDOW_SIZE=15
VIDEO_WINDOW_STEP=10
```

### 2. 启动 PostgreSQL

```bash
docker run -d \
  --name skiuo-postgres \
  -e POSTGRES_DB=skiuo \
  -e POSTGRES_USER=skiuo \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15
```

### 3. 启动 ai-service

```bash
cd ai-service

# 创建虚拟环境
python3.12 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip3.12 install -r requirements.txt

# 生成 proto 代码
python3.12 -m grpc_tools.protoc \
  -I../proto \
  --python_out=./proto \
  --grpc_python_out=./proto \
  ../proto/video_analysis.proto

# 修复导入
sed -i '' 's/^import video_analysis_pb2 as video__analysis__pb2/from . import video_analysis_pb2 as video__analysis__pb2/' proto/video_analysis_pb2_grpc.py

# 启动服务
python3.12 grpc_server.py
```

### 4. 启动 core-service

```bash
cd core-service

# 编译生成 gRPC 代码
mvn clean compile

# 启动服务
mvn spring-boot:run
```

### 5. 启动 web-recorder

```bash
cd web-recorder

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 6. 访问应用

打开浏览器访问 http://localhost:5173

## 核心特性

### 滑动窗口策略

半实时分析模式使用滑动窗口，保证动作完整性：

```
视频35秒: 0----------------------------------35s
窗口1:     [0---------15s]
窗口2:            [10--------25s]
窗口3:                   [20--------35s]
```

- **窗口大小**: 15秒 (可配置 VIDEO_WINDOW_SIZE)
- **步长**: 10秒 (可配置 VIDEO_WINDOW_STEP)
- **重叠**: 5秒 (避免动作被截断)
- **Chunk时长**: 35秒 (自动计算 = windowSize + 2×windowStep)

### 并发竞态条件防护

**问题**：前端上传最后一个chunk后立即调用`finishSession`，但后端可能还在异步处理

**解决**：
- 前端：等待最后一个chunk上传完成，再调用`finishSession`
- 后端：追踪所有异步任务，`finishSession`等待任务完成后再处理

### 多存储服务支持

通过工厂模式支持三种存储服务：

- **MinIO**: 自建对象存储，适合开发测试
- **Aliyun OSS**: 阿里云对象存储，配合Qwen使用
- **Tencent COS**: 腾讯云对象存储，推荐国内部署

### Qwen DashScope SDK

**重要**：Qwen 必须使用 DashScope 原生SDK才能分析视频URL，OpenAI兼容接口无法读取视频。

```python
# ai-service/models/qwen_analyzer.py
import dashscope

messages = [{
    'role': 'user',
    'content': [
        {'video': video_url},  # 公网URL
        {'text': prompt}
    ]
}]

responses = dashscope.MultiModalConversation.call(
    model='qwen-vl-max',
    messages=messages,
    stream=True
)
```

## 数据流详解

### 半实时分析模式完整流程

```
1. web-recorder录制35秒 → 上传chunk_0.webm
   ↓
2. core-service接收 → 保存到 /tmp/skiuo/session_xxx/chunk_0.webm
   ↓
3. core-service调用 gRPC: ai-service.ProcessVideo(本地路径)
   ↓
4. ai-service: FFmpeg切片 → 返回3个窗口本地路径
   [w0.mp4, w1.mp4, w2.mp4]
   ↓
5. core-service: 上传3个窗口到存储服务(COS/OSS/MinIO)
   → 生成3个公网URL
   ↓
6. core-service: 逐个调用 gRPC: ai-service.AnalyzeVideo(url, context)
   ↓
7. ai-service: 调用 DashScope/Gemini API
   → AI从URL下载视频分析
   → 流式返回结果
   ↓
8. core-service: 接收流式结果
   → 保存PostgreSQL
   → WebSocket推送前端
   ↓
9. 前端: 停止录制
   → 等待最后chunk上传完成
   → 调用 finishSession()
   ↓
10. core-service: finishSession
   → 等待所有异步任务完成
   → 分析剩余未覆盖窗口
   → 设置会话状态为COMPLETED
```

## 开发调试

### 测试模式

无需摄像头，使用预切分的视频文件测试：

```bash
# 1. 准备测试视频
cd ai-service
python3.12 test_video_splitter.py /path/to/video.mp4 output_dir/ --chunk-duration 35

# 2. 在前端上传生成的 chunk 文件
# 切换到"测试模式"标签页，选择 chunk_*.webm 文件

# 3. 观察日志和结果
```

### 常用命令

```bash
# 查看 ai-service 日志
cd ai-service
tail -f logs/ai-service.log

# 查看 core-service 日志
cd core-service
mvn spring-boot:run

# 查看 PostgreSQL 数据
psql -h localhost -U skiuo -d skiuo
SELECT * FROM sessions ORDER BY created_at DESC LIMIT 5;
SELECT * FROM analysis_records WHERE session_id = 1;

# 测试 gRPC 连接
grpcurl -plaintext localhost:50051 list

# 检查存储服务
# MinIO: http://localhost:9000
# COS: 使用腾讯云控制台
# OSS: 使用阿里云控制台
```

## 故障排查

### 1. ai-service proto 导入错误

```
ERROR: No module named 'video_analysis_pb2'
```

**解决**：
```bash
cd ai-service
source .venv/bin/activate
python3.12 -m grpc_tools.protoc -I../proto --python_out=./proto --grpc_python_out=./proto ../proto/video_analysis.proto
sed -i '' 's/^import video_analysis_pb2 as video__analysis__pb2/from . import video_analysis_pb2 as video__analysis__pb2/' proto/video_analysis_pb2_grpc.py
```

### 2. core-service gRPC 连接失败

```
UNAVAILABLE: io exception
```

**检查**：
- ai-service 是否运行在 localhost:50051
- 查看 ai-service 日志

### 3. Qwen无法读取视频

```
DashScope API error: video download failed
```

**原因**：
- 使用了MinIO私有存储，AI无法访问
- 视频URL不是公网可访问

**解决**：
- 切换到COS或OSS：修改 `.env` 中的 `STORAGE_TYPE=cos`
- 确认bucket权限为公有读

### 4. .env 文件未加载

**症状**：应用启动时配置为空

**检查**：
- `.env` 文件位置：项目根目录 `/Users/xxx/ski/.env`
- 查看启动日志：应该看到 "✓ Loaded .env file successfully"
- core-service 使用 dotenv-java 自动加载

## 项目文档

- **核心架构**: [doc/dev3.md](doc/dev3.md) - 详细系统设计
- **Qwen使用说明**: [doc/qwen.md](doc/qwen.md) - DashScope SDK配置
- **AI提示词系统**: [doc/prompts.md](doc/prompts.md) - 提示词管理
- **项目说明**: [CLAUDE.md](CLAUDE.md) - 开发指南

## 技术栈总结

| 模块 | 技术栈 | 关键依赖 |
|------|--------|---------|
| web-recorder | React 19 + TypeScript + Vite | STOMP.js, MediaRecorder API |
| core-service | Spring Boot 3.5 + Java 17 | gRPC, PostgreSQL, dotenv-java, COS/OSS/MinIO SDK |
| ai-service | Python 3.12 + gRPC | DashScope, google-genai, ffmpeg-python |

## 开发注意事项

1. **不要创建shell脚本** - 用户明确要求不需要sh脚本
2. **ai-service 必须在虚拟环境内** - 所有Python操作都在 .venv 中
3. **proto 生成后需修复导入** - 将绝对导入改为相对导入
4. **.env 在项目根目录** - 不是各子模块目录
5. **Qwen 必须用 DashScope SDK** - 不能用OpenAI兼容接口
6. **存储服务选择**:
   - 开发: MinIO (本地)
   - 配合Qwen: OSS或COS (公有云)
   - 推荐: COS (国内速度快)
7. **并发防护** - 前端等待上传完成，后端等待任务完成

## License

MIT

## 贡献指南

1. 功能实现优先，再考虑优化
2. 遵循现有代码风格
3. 完善单元测试
4. 更新相关文档
5. 提交前确保所有服务正常运行

---

**作者**: Skiuo Team
**最后更新**: 2025-10-29
