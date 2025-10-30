# AI-Service

Python gRPC 服务 - 视频处理和 AI 分析

## 功能概述

- FFmpeg 视频切片（滑动窗口策略）
- 多 AI 模型支持（Qwen DashScope SDK、Gemini GenAI SDK）
- gRPC 流式响应
- 不使用存储服务SDK（只接收URL进行分析）

## 关键特性

- **DashScope SDK**: Qwen使用原生DashScope SDK，支持视频URL分析
- **存储服务无关**: 不操作MinIO/OSS/COS，只接收公网URL
- **流式返回**: 实时流式返回AI分析结果
- **滑动窗口**: 智能切片保证动作完整性

## 环境要求

- Python 3.12+
- FFmpeg（系统已安装）
- 至少一个 AI API Key（Qwen 或 Gemini）

## 安装步骤

### 1. 创建虚拟环境

```bash
cd ai-service
python3.12 -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate  # Windows
```

### 2. 安装依赖

```bash
pip3.12 install -r requirements.txt
```

**主要依赖**:
- `grpcio` 1.68.1 - gRPC服务端
- `dashscope` - Qwen DashScope原生SDK（重要！）
- `google-genai` 1.0+ - Gemini统一SDK
- `ffmpeg-python` 0.2.0 - FFmpeg视频处理

### 3. 生成 gRPC 代码

**重要**：确保在激活虚拟环境后执行以下步骤。

```bash
# 确保已激活虚拟环境
source .venv/bin/activate

# 生成 proto 文件
python3.12 -m grpc_tools.protoc \
  -I../proto \
  --python_out=./proto \
  --grpc_python_out=./proto \
  ../proto/video_analysis.proto
```

这会在 `proto/` 目录生成：
- `video_analysis_pb2.py`
- `video_analysis_pb2_grpc.py`

**修复导入问题**：生成后需要手动修复导入语句

```bash
# 修复 video_analysis_pb2_grpc.py 中的导入
sed -i '' 's/^import video_analysis_pb2 as video__analysis__pb2/from . import video_analysis_pb2 as video__analysis__pb2/' proto/video_analysis_pb2_grpc.py
```

或手动编辑 `proto/video_analysis_pb2_grpc.py`，将：
```python
import video_analysis_pb2 as video__analysis__pb2
```
改为：
```python
from . import video_analysis_pb2 as video__analysis__pb2
```

### 4. 配置环境变量

确保项目根目录的 `.env` 文件包含以下配置：

```bash
# Qwen API（通义千问）- 使用DashScope原生SDK
QWEN_API_KEY=your_qwen_api_key
QWEN_API_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-max  # qwen-vl-max / qwen-vl-plus

# Gemini API（Google）
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-pro  # gemini-2.5-pro / gemini-1.5-pro

# gRPC 配置
AI_SERVICE_PORT=50051
AI_SERVICE_WORKERS=4

# 视频处理配置
VIDEO_WINDOW_SIZE=15  # 窗口大小（秒）
VIDEO_WINDOW_STEP=10  # 步长（秒）
TEMP_VIDEO_PATH=/tmp/skiuo  # 临时文件路径

# 日志配置
LOG_LEVEL=INFO
DEBUG_MODE=false
```

**重要配置说明**：
- **QWEN_API_KEY**: Qwen必须使用DashScope SDK才能分析COS/OSS的视频URL
- **至少配置一个AI API Key**: Qwen或Gemini
- **不需要存储服务配置**: ai-service不操作MinIO/OSS/COS

## 运行服务

```bash
# 确保已激活虚拟环境
source .venv/bin/activate

# 启动 gRPC 服务
python3.12 grpc_server.py
```

服务将启动在端口 `50051`（默认）。

**预期输出**：
```
Loading environment variables from .env file
✓ Loaded .env file: /Users/xxx/ski/.env
==================================================
AI Service Configuration
==================================================
...
Server started on port 50051
Waiting for requests...
```

## 架构说明

### gRPC 服务接口

#### 1. ProcessVideo - 视频切片
```protobuf
rpc ProcessVideo(ProcessRequest) returns (ProcessResponse);
```

**功能**：使用 FFmpeg 将视频切片为滑动窗口

**输入**：
- `video_path`: 本地视频文件路径
- `analysis_mode`: "full" 或 "sliding_window"
- `window_size`: 窗口大小（秒）
- `window_step`: 步长（秒）

**输出**：
- `window_paths`: 切片后的本地文件路径列表

#### 2. AnalyzeVideo - AI 分析（流式）
```protobuf
rpc AnalyzeVideo(AnalysisRequest) returns (stream AnalysisResponse);
```

**功能**：调用 AI API 分析视频，流式返回结果

**输入**：
- `video_url`: 存储服务公网URL（COS/OSS/MinIO）
- `ai_model`: "qwen" 或 "gemini"
- `context`: 前一窗口的分析结果（用于上下文）

**输出**（流式）：
- `content`: 分析结果的 token（逐个流式返回）
- `is_final`: 是否为最后一条消息

**重要**:
- Qwen使用DashScope SDK的MultiModalConversation.call()方法
- video_url必须是公网可访问的URL
- AI服务从URL下载视频进行分析

### 模块说明

#### video_processor.py
- FFmpeg 视频切片
- 滑动窗口策略：窗口大小 15 秒，步长 10 秒，重叠 5 秒
- 返回本地切片文件路径

#### models/
- `base.py`: 抽象基类 `VideoAnalyzer`
- `qwen_analyzer.py`: **Qwen DashScope原生SDK实现**（重要！）
  - 使用 `dashscope.MultiModalConversation.call()`
  - 支持视频URL分析
  - 消息格式: `[{'video': url}, {'text': prompt}]`
- `gemini_analyzer.py`: Gemini GenAI SDK实现
  - 使用 `genai.Client.models.generate_content_stream()`
- `factory.py`: 工厂模式，根据名称创建 analyzer

#### grpc_server.py
- 实现 VideoAnalysisService
- 处理 ProcessVideo 和 AnalyzeVideo RPC
- 完善的错误处理
- 流式响应管理

#### config.py
- 从环境变量读取配置
- 配置验证
- AI API Key检查

## 关键设计

### ✅ 不使用存储服务SDK
- ai-service 只接收 URL 字符串
- 不直接操作MinIO/OSS/COS
- core-service 负责存储服务管理（工厂模式选择）

### ✅ Qwen使用DashScope SDK
- **重要**: Qwen必须使用DashScope原生SDK，OpenAI兼容接口无法读取视频
- 使用 `dashscope.MultiModalConversation.call()` 方法
- 支持传入视频URL进行分析
- 配置 `QWEN_API_KEY` 和 `QWEN_MODEL`

### ✅ 滑动窗口策略
```
视频: 0---------------------------------30s
窗口1:  0-----15s
窗口2:       10-----25s
窗口3:            20-----30s
```
- 窗口大小：15 秒
- 步长：10 秒
- 重叠：5 秒（保证动作完整性）

### ✅ 上下文传递
```python
# 第一个窗口
analyze(url_0, context="")

# 第二个窗口（传入前一个结果）
analyze(url_1, context=result_0)

# 第三个窗口
analyze(url_2, context=result_1)
```

### ✅ 流式返回
使用 gRPC streaming response，每个 token 立即返回给 core-service，实现实时推送。

## 测试

### 测试 FFmpeg 切片

```python
from video_processor import VideoProcessor

processor = VideoProcessor()
windows = processor.slice_video(
    video_path="/path/to/video.webm",
    session_id="test_session",
    chunk_id=0,
    window_size=15,
    window_step=10
)

print(f"Created {len(windows)} windows")
for path in windows:
    print(f"  - {path}")
```

### 测试 AI 模型

**测试Qwen (DashScope SDK)**:
```python
import asyncio
from models.factory import get_analyzer

async def test_qwen():
    analyzer = get_analyzer("qwen")

    # video_url 必须是公网可访问的URL (COS/OSS/MinIO)
    async for token in analyzer.analyze_video(
        video_url="https://your-cos-bucket.cos.ap-guangzhou.myqcloud.com/video.mp4",
        context="",
        session_id="test",
        window_index=0
    ):
        print(token, end="", flush=True)

asyncio.run(test_qwen())
```

**测试Gemini**:
```python
async def test_gemini():
    analyzer = get_analyzer("gemini")

    async for token in analyzer.analyze_video(
        video_url="https://your-storage-url.com/video.mp4",
        context="",
        session_id="test",
        window_index=0
    ):
        print(token, end="", flush=True)

asyncio.run(test_gemini())
```

### 使用 grpcurl 测试服务

```bash
# 安装 grpcurl
# Mac: brew install grpcurl
# Linux: 下载二进制文件

# 测试 ProcessVideo
grpcurl -plaintext \
  -d '{
    "session_id": "test",
    "chunk_id": 1,
    "video_path": "/tmp/test.webm",
    "analysis_mode": "sliding_window",
    "window_size": 15,
    "window_step": 10
  }' \
  localhost:50051 \
  videoanalysis.VideoAnalysisService/ProcessVideo
```

## 故障排查

### Proto 导入错误
```
ERROR: Proto files not generated. Please run:
ERROR: No module named 'video_analysis_pb2'
```

**原因**：
1. proto 文件未生成
2. 在虚拟环境外执行了 protoc 命令
3. 生成后未修复导入语句

**解决步骤**：
```bash
# 1. 激活虚拟环境
source .venv/bin/activate

# 2. 确认使用虚拟环境的 python
which python3.12
# 应该显示：/Users/xxx/ski/ai-service/.venv/bin/python3.12

# 3. 生成 proto 文件
python3.12 -m grpc_tools.protoc \
  -I../proto \
  --python_out=./proto \
  --grpc_python_out=./proto \
  ../proto/video_analysis.proto

# 4. 修复导入语句
sed -i '' 's/^import video_analysis_pb2 as video__analysis__pb2/from . import video_analysis_pb2 as video__analysis__pb2/' proto/video_analysis_pb2_grpc.py

# 5. 重新启动服务
python3.12 grpc_server.py
```

**关键**：所有 Python 操作都必须在同一个虚拟环境内执行

### FFmpeg 未安装
```
FileNotFoundError: [Errno 2] No such file or directory: 'ffmpeg'
```
**解决**：
```bash
# Mac
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

### API Key 未配置
```
Configuration validation failed: At least one AI API key must be configured
```
**解决**：在 `.env` 文件中配置 QWEN_API_KEY 或 GEMINI_API_KEY

### Qwen无法读取视频
```
DashScope API error: video download failed
```
**可能原因**：
1. 使用了MinIO私有存储，AI无法访问
2. 使用了OpenAI兼容接口而非DashScope SDK

**解决**：
1. 切换到COS或OSS公有云存储（推荐COS）
2. 确认使用DashScope SDK (检查 models/qwen_analyzer.py)
3. 确认video_url可以公网访问

### gRPC 端口被占用
```
grpc._channel._InactiveRpcError: [...]  Address already in use
```
**解决**：
1. 修改 `.env` 中的 `AI_SERVICE_PORT`
2. 或停止占用端口的进程

## 日志

日志输出到控制台，格式：
```
2025-01-25 14:30:00 - grpc_server - INFO - ProcessVideo called: session=123, chunk=0, mode=sliding_window
```

日志级别：
- `DEBUG`: 详细调试信息
- `INFO`: 一般信息（默认）
- `WARNING`: 警告信息
- `ERROR`: 错误信息

修改日志级别：`.env` 中设置 `LOG_LEVEL=DEBUG`

## 性能优化

### gRPC Worker 数量
默认 4 个 worker，可根据并发需求调整：
```bash
AI_SERVICE_WORKERS=8
```

### 视频处理参数
根据实际需求调整窗口大小和步长：
```bash
VIDEO_WINDOW_SIZE=20  # 增大窗口
VIDEO_WINDOW_STEP=15  # 增大步长（减少重叠）
```

## 开发注意事项

1. **始终使用 python3.12**：项目要求 Python 3.12
2. **不依赖存储服务SDK**：只接收 URL 字符串，不操作MinIO/OSS/COS
3. **Qwen必须用DashScope SDK**：OpenAI兼容接口无法读取视频
4. **完善错误处理**：所有外部调用（AI API、FFmpeg）都有 try-except
5. **异步编程**：AI 模型使用 async/await
6. **流式响应**：使用 gRPC streaming 和 async generator
7. **视频URL必须公网可访问**：AI服务从URL下载视频分析

## 相关文档

- 核心架构: `../doc/dev3.md`
- 项目说明: `../CLAUDE.md`
- Qwen使用说明: `../doc/qwen.md`
- AI 提示词: `../doc/prompt.md`

## 更新日志

### 最新更新
- **DashScope SDK**: Qwen改用原生SDK，支持视频URL分析
- **存储服务抽象**: 支持MinIO/OSS/COS，ai-service不依赖存储SDK
- **依赖更新**: dashscope + google-genai 1.0+
