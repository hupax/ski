# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**SKI** - 视频AI分析系统，通过浏览器录制视频，调用AI模型（Qwen/Gemini）自动生成连贯的文字记录。

### 核心架构

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

### 三大模块

1. **web-recorder**: 前端录制模块
   - React 19 + TypeScript + Vite
   - MediaRecorder API录制WebM视频
   - 配置面板：AI模型、分析模式、存储服务、视频保留选项

2. **core-service**: Spring Boot业务中枢
   - 视频上传和存储管理
   - 多存储服务支持（MinIO/OSS/COS）
   - gRPC客户端调用AI服务
   - WebSocket推送分析结果
   - PostgreSQL数据持久化

3. **ai-service**: Python AI分析服务
   - gRPC服务端
   - FFmpeg视频切片（滑动窗口策略）
   - 多AI模型支持（Qwen DashScope SDK / Gemini SDK）
   - 流式返回分析结果

---

## 技术栈

### 前端 (web-recorder)
- **框架**: React 19.1.1
- **语言**: TypeScript 5.9
- **构建**: Vite 7.1.7
- **样式**: TailwindCSS 3.4.18
- **WebSocket**: STOMP.js 7.2.1

### 后端 (core-service)
- **框架**: Spring Boot 3.5.7
- **语言**: Java 17
- **构建**: Maven
- **配置管理**: Dotenv-Java 3.0.0 (自动加载.env文件)
- **数据库**: PostgreSQL (Spring Data JPA)
- **通信**: gRPC 1.68.1, WebSocket
- **存储服务**:
  - MinIO 8.5.7 (自建对象存储)
  - Aliyun OSS 3.17.4 (阿里云)
  - Tencent COS 5.6.229 (腾讯云)

### AI服务 (ai-service)
- **语言**: Python 3.12
- **通信**: gRPC 1.68.1
- **视频处理**: FFmpeg (通过 ffmpeg-python 0.2.0)
- **AI SDK**:
  - DashScope (Qwen原生SDK)
  - Google GenAI 1.0+ (Gemini统一SDK)

### 基础设施
- **数据库**: PostgreSQL 15+
- **存储**: MinIO / Aliyun OSS / Tencent COS (3选1)
- **反向代理**: Caddy (可选)

---

## 关键设计要点

### 1. 多存储服务抽象

**问题**: AI云服务API（Qwen/Gemini）无法访问私有存储（如MinIO）的视频

**解决方案**: 支持多种对象存储服务，通过公网URL提供视频访问

**实现**:
```java
// core-service/service/StorageService.java
public interface StorageService {
    String uploadFile(String localFilePath, String objectName);
    String generatePublicUrl(String objectName);
    void deleteObject(String objectName);
}

// 三种实现
- MinioService: 自建存储，适合开发测试
- OssService: 阿里云OSS，配合Qwen使用
- CosService: 腾讯云COS，推荐国内部署

// 工厂模式选择
StorageServiceFactory.getStorageService(storageType)
```

**配置**:
```yaml
# application.yml
storage:
  type: ${STORAGE_TYPE:cos}  # minio | oss | cos
```

### 2. Qwen使用DashScope SDK

**重要**: Qwen必须使用DashScope原生SDK才能分析COS/OSS的视频URL，OpenAI兼容接口无法读取视频！

**实现**:
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

**配置**:
```bash
# .env
QWEN_API_KEY=your_qwen_api_key
QWEN_API_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen-vl-max
```

### 3. gRPC通信协议

**职责分离**:
- `ProcessVideo`: ai-service读取本地文件，FFmpeg切片，返回本地路径
- `AnalyzeVideo`: ai-service接收URL，调用AI API，流式返回结果

**为什么ai-service不操作MinIO?**
- 减少依赖，ai-service只负责视频处理和AI调用
- core-service统一管理存储，支持多种存储服务

### 4. 滑动窗口策略

半实时分析模式使用滑动窗口，保证动作完整性：

```
视频35秒: 0----------------------------------35s
窗口1:     [0---------15s]
窗口2:            [10--------25s]
窗口3:                   [20--------35s]
```

- 窗口大小: 15秒 (可配置 VIDEO_WINDOW_SIZE)
- 步长: 10秒 (可配置 VIDEO_WINDOW_STEP)
- 重叠: 5秒 (windowSize - windowStep，避免动作被截断)
- Chunk时长: 35秒 (自动计算 = windowSize + 2×windowStep)

**配置同步**:
- 后端: 通过 .env 配置 VIDEO_WINDOW_SIZE 和 VIDEO_WINDOW_STEP
- 前端: 启动时从 /api/config 获取推荐的 chunk 时长
- 自动匹配: 前端 chunk 时长自动适配后端窗口参数

### 5. 录制时长跟踪（支持暂停/恢复）

前端精确跟踪实际录制时长，排除暂停时间：

```typescript
// 示例：用户操作序列
开始录制 (0s)
录制10秒
暂停 (累计10s)
暂停5秒
恢复录制 (累计仍为10s)
录制25秒
停止 (累计35s) → 上传chunk，duration=35秒
```

**关键特性**:
- 暂停时清除定时器，避免错误触发chunk上传
- 恢复时重新计算剩余时间，确保chunk时长准确
- 实际录制时长 = 累计活跃时间（不含暂停）

### 6. 上下文传递

```python
# 第1个窗口
analyze(url_0, context="")

# 第2个窗口（携带前文）
analyze(url_1, context=result_0)

# 第3个窗口
analyze(url_2, context=result_1)
```

### 7. AI提示词管理系统

**问题**: 提示词硬编码在模型类中，无法灵活配置，不符合项目需求（连贯性、完整性、准确性）

**解决方案**: 独立的提示词模块，支持多语言、多场景配置

**实现**:
```python
# ai-service/prompts/prompt_builder.py
class PromptBuilder:
    def __init__(self, language='zh', scenario='general'):
        self.language = language  # zh | en
        self.scenario = scenario  # general | programming | crafts | teaching

    def build_first_window_prompt(self, duration=15, include_scenario_hint=True):
        # 构建首个窗口提示词

    def build_subsequent_window_prompt(self, context, duration=15, overlap=5, ...):
        # 构建后续窗口提示词，包含前文上下文
```

**配置**:
```bash
# .env
PROMPT_LANGUAGE=zh                      # 中文（推荐）| en
PROMPT_SCENARIO=general                 # 通用 | programming | crafts | teaching
PROMPT_INCLUDE_SCENARIO_HINT=true       # 是否包含场景特定提示
```

**设计原则**（见 `doc/prompts.md`）:
- **连贯性**: 生成流畅描述，非碎片化句子
- **完整性**: 不遗漏关键信息和动作
- **准确性**: 客观描述用户行为，避免推测
- **时序性**: 按时间顺序描述事件
- **场景适应**: 根据场景关注不同重点

**场景示例**:
- `programming`: 关注代码、IDE、调试操作
- `crafts`: 关注工具、材料、制作步骤
- `teaching`: 关注教学内容、演示、互动
- `general`: 通用操作记录

---

## 开发环境配置

### 环境变量 (.env)

**重要**: 项目根目录创建 `.env` 文件，参考 `.env.example`

core-service 使用 **dotenv-java** 自动加载 .env 文件：
- `DotenvConfig` 类在应用启动时自动加载 .env
- 无需手动设置系统环境变量
- .env 文件应放在项目根目录 (ski/)，不是 core-service/ 目录

**配置示例**:

```bash
# 数据库
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=skiuo
POSTGRES_USER=skiuo
POSTGRES_PASSWORD=your_password

# 存储服务 (3选1配置)
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
OSS_REGION=cn-hangzhou

# MinIO
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=your_minio_key
MINIO_SECRET_KEY=your_minio_secret
MINIO_BUCKET_NAME=skiuo-videos

# AI API
QWEN_API_KEY=your_qwen_api_key
QWEN_MODEL=qwen-vl-max
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-pro

# gRPC
GRPC_AI_SERVICE_HOST=localhost
GRPC_AI_SERVICE_PORT=50051
```

### 必需依赖

**系统级**:
- Java 17+
- Python 3.12
- PostgreSQL 15+
- FFmpeg (ai-service需要)
- Maven 3.8+
- Node.js 18+ & npm

**安装FFmpeg**:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg
```

---

## 核心开发命令

### 1. 启动基础设施 (PostgreSQL)

```bash
# 使用Docker
docker run -d \
  --name skiuo-postgres \
  -e POSTGRES_DB=skiuo \
  -e POSTGRES_USER=skiuo \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  postgres:15
```

### 2. 启动 core-service (Spring Boot)

```bash
cd core-service

# 首次启动需要生成gRPC代码
mvn clean compile

# 运行
mvn spring-boot:run

# 或使用IDE运行 CoreServiceApplication.java
```

**验证**:
- 服务地址: http://localhost:8080
- 健康检查: http://localhost:8080/actuator/health

### 3. 启动 ai-service (Python)

```bash
cd ai-service

# 创建虚拟环境
python3.12 -m venv .venv
source .venv/bin/activate

# 安装依赖
pip3.12 install -r requirements.txt

# 生成gRPC代码
python3.12 -m grpc_tools.protoc \
  -I../proto \
  --python_out=./proto \
  --grpc_python_out=./proto \
  ../proto/video_analysis.proto

# 运行服务
python3.12 grpc_server.py
```

**验证**:
- gRPC服务运行在 localhost:50051
- 查看日志确认启动成功

### 4. 启动 web-recorder (前端)

```bash
cd web-recorder

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 预览构建
npm run preview
```

**访问**: http://localhost:5173

### 5. 常用Maven命令 (core-service)

```bash
# 清理并编译
mvn clean compile

# 运行测试
mvn test

# 打包
mvn package

# 跳过测试打包
mvn package -DskipTests

# 查看依赖树
mvn dependency:tree
```

### 6. 常用Python命令 (ai-service)

```bash
# 始终使用 python3.12
python3.12 -m venv .venv
python3.12 grpc_server.py
pip3.12 install -r requirements.txt

# 测试特定模块
python3.12 -m pytest tests/

# 格式化代码
python3.12 -m black .
```

---

## 项目结构

```
ski/
├── core-service/              # Spring Boot后端
│   ├── src/main/java/com/skiuo/coreservice/
│   │   ├── controller/       # REST API控制器
│   │   ├── service/          # 业务逻辑
│   │   │   ├── StorageService.java          # 存储接口
│   │   │   ├── StorageServiceFactory.java   # 存储工厂
│   │   │   ├── MinioService.java
│   │   │   ├── OssService.java
│   │   │   ├── CosService.java
│   │   │   ├── GrpcClientService.java       # gRPC客户端
│   │   │   ├── VideoUploadService.java
│   │   │   └── VideoProcessingService.java
│   │   ├── entity/           # JPA实体
│   │   ├── repository/       # 数据访问
│   │   └── config/           # 配置类
│   │       ├── DotenvConfig.java           # .env文件加载
│   │       ├── MinioConfig.java
│   │       ├── OssConfig.java
│   │       ├── CosConfig.java
│   │       └── ...
│   ├── src/main/resources/
│   │   └── application.yml   # Spring配置
│   └── pom.xml               # Maven依赖
│
├── ai-service/                # Python AI服务
│   ├── grpc_server.py        # gRPC服务入口
│   ├── video_processor.py    # FFmpeg视频切片
│   ├── models/
│   │   ├── base.py           # VideoAnalyzer抽象类
│   │   ├── qwen_analyzer.py  # Qwen DashScope实现
│   │   ├── gemini_analyzer.py # Gemini实现
│   │   └── factory.py        # 模型工厂
│   ├── prompts/              # AI提示词管理模块
│   │   ├── __init__.py       # 模块初始化
│   │   ├── base_prompts.py   # 提示词模板（中英文）
│   │   └── prompt_builder.py # 提示词构建器
│   ├── config.py             # 配置加载
│   ├── requirements.txt      # Python依赖
│   └── proto/                # 生成的gRPC代码
│
├── web-recorder/              # React前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── VideoRecorder.tsx    # 视频录制
│   │   │   ├── ConfigPanel.tsx      # 配置面板
│   │   │   ├── AnalysisDisplay.tsx  # 结果展示
│   │   │   └── StatusIndicator.tsx
│   │   ├── hooks/
│   │   │   └── useMediaRecorder.ts  # 录制Hook
│   │   ├── services/
│   │   │   └── apiClient.ts         # API调用
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript类型
│   │   ├── config/
│   │   │   └── constants.ts         # 常量配置
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── proto/                     # gRPC协议定义
│   └── video_analysis.proto
│
├── doc/                       # 文档
│   ├── dev3.md               # 核心架构文档
│   ├── qwen.md               # Qwen使用说明
│   ├── prompts.md            # AI提示词系统说明
│   ├── optimization-and-scaling.md
│   └── prompt.md             # AI提示词（旧）
│
├── .env.example              # 环境变量模板
└── CLAUDE.md                 # 本文件
```

---

## 数据流详解

### 半实时分析模式完整流程

```
1. web-recorder录制35秒 → 上传chunk_0.webm (duration=35.2, isLastChunk=false)
   ↓
2. core-service接收 → 拼接到master video
   → 使用FFmpeg获取实际视频长度(GetVideoDuration gRPC)
   → 更新session.currentVideoLength = 35.2 (Double精度)
   ↓
3. checkAndAnalyzeWindows检查触发条件:
   - 正常触发: currentVideoLength >= nextWindowEnd (完整窗口)
   - 最后chunk触发: isLastChunk=true && remainingLength >= 5s
   ↓
4. 满足条件 → 调用 gRPC: ai-service.ProcessVideo(master_video_path)
   ↓
5. ai-service: FFmpeg切片 → 返回窗口本地路径
   [w0.mp4 (0-15s), w1.mp4 (10-25s), w2.mp4 (20-35s)]
   ↓
6. core-service: 上传窗口到存储服务(COS/OSS/MinIO)
   → 生成公网URL
   ↓
7. core-service: 逐个调用 gRPC: ai-service.AnalyzeVideo(url, context)
   ↓
8. ai-service: 调用 DashScope/Gemini API
   → AI从URL下载视频分析
   → 流式返回结果
   ↓
9. core-service: 接收流式结果
   → 保存PostgreSQL
   → WebSocket推送前端
   ↓
10. 继续录制 chunk_1, chunk_2...
    ↓
11. 停止录制 → 最后一个chunk标记 isLastChunk=true
    → checkAndAnalyzeWindows分析剩余窗口
    → 自动标记 session 为 COMPLETED
    ↓
12. core-service: 清理
    → 删除本地临时文件
    → 根据keepVideo决定是否删除存储服务中的视频
```

---

## 常见问题和调试

### 1. gRPC连接失败

**错误**: `UNAVAILABLE: io exception`

**排查**:
```bash
# 检查ai-service是否运行
lsof -i :50051

# 检查core-service配置
# application.yml中 grpc.ai-service.host 和 port
```

### 2. Qwen API无法读取视频

**错误**: Qwen返回视频下载失败

**原因**:
- 使用了MinIO私有存储，AI无法访问
- 或者使用了OpenAI兼容接口而非DashScope SDK

**解决**:
- 切换到COS或OSS公有云存储
- 确认使用DashScope SDK (检查 ai-service/models/qwen_analyzer.py)

### 3. FFmpeg未安装

**错误**: `FileNotFoundError: 'ffmpeg'`

**解决**:
```bash
# macOS
brew install ffmpeg

# 验证
ffmpeg -version
```

### 4. PostgreSQL连接失败

**排查**:
```bash
# 检查PostgreSQL运行状态
docker ps | grep postgres

# 检查连接
psql -h localhost -U skiuo -d skiuo

# 检查 application.yml 数据库配置
```

### 5. 前端无法连接后端

**排查**:
```typescript
// web-recorder/src/config/constants.ts
export const API_BASE_URL = 'http://localhost:8080';

// 确认core-service运行在8080端口
curl http://localhost:8080/actuator/health
```

### 6. 视频上传失败

**可能原因**:
- 文件大小超限 (检查 application.yml 的 max-file-size)
- 临时目录权限问题 (检查 /tmp/skiuo 或配置的 TEMP_VIDEO_PATH)
- 存储服务配置错误 (检查 .env 中对应存储服务的配置)

### 7. AI分析无响应

**排查步骤**:
1. 检查AI服务日志: ai-service是否收到AnalyzeVideo请求
2. 检查存储URL是否有效: 手动访问video_url是否能下载视频
3. 检查AI API Key: 是否配置且有效
4. 检查网络: AI服务能否访问云端API

### 8. .env文件未加载

**错误**: 应用启动时找不到环境变量，配置为空

**排查**:
```bash
# 确认.env文件位置（应在项目根目录）
ls -la /Users/hupax/ski/.env

# 检查core-service日志，应该看到
# "✓ Loaded .env file successfully"

# 如果看到警告
# "⚠ .env file not found"
# 说明DotenvConfig没找到.env文件
```

**解决**:
- 确保.env在项目根目录 (ski/)，不是core-service/
- 检查文件权限: `chmod 644 .env`
- 查看DotenvConfig日志输出

---

## 环境配置检查清单

开发前确认：

- [ ] Java 17已安装: `java -version`
- [ ] Python 3.12已安装: `python3.12 --version`
- [ ] FFmpeg已安装: `ffmpeg -version`
- [ ] PostgreSQL运行中
- [ ] **.env文件已创建**（项目根目录ski/.env，参考.env.example）
- [ ] .env中配置了数据库密码（POSTGRES_PASSWORD）
- [ ] .env中配置了至少一个存储服务（MinIO/OSS/COS）
- [ ] .env中配置了至少一个AI API Key（Qwen或Gemini）
- [ ] core-service可以连接PostgreSQL
- [ ] ai-service可以连接core-service (gRPC)
- [ ] 存储服务bucket已创建
- [ ] AI API Key有效

---

## 参考文档

- **核心架构**: `doc/dev3.md` - 详细的系统架构和数据流
- **性能优化**: `doc/optimization-and-scaling.md` - 扩展和优化方向
- **Qwen说明**: `doc/qwen.md` - Qwen API使用和DashScope配置
- **AI提示词系统**: `doc/prompts.md` - 提示词管理架构、配置和使用指南
- **AI提示词（旧）**: `doc/prompt.md` - 原始提示词设计参考

---

## 开发注意事项

1. **必须配置.env文件** - 项目根目录创建.env文件，参考.env.example，包含所有敏感配置
2. **始终使用python3.12命令** - 项目要求Python 3.12
3. **不要在ai-service中操作MinIO/OSS/COS** - 存储由core-service统一管理
4. **Qwen必须用DashScope SDK** - OpenAI兼容接口无法读取视频
5. **完善错误处理** - 所有外部调用（AI API、存储、数据库）都要try-catch
6. **日志记录** - 关键操作记录日志，便于调试
7. **存储服务选择**:
   - 开发测试: MinIO (本地)
   - 配合Qwen: OSS或COS (公有云)
   - 国内部署推荐: COS
8. **gRPC代码生成**: 修改proto后需要重新生成Java和Python代码
9. **数据库迁移**: application.yml中 `ddl-auto: update` 会自动更新表结构
10. **不要提交.env文件** - .env包含敏感信息，已在.gitignore中排除
11. **isLastChunk机制** - 前端停止录制时标记最后一个chunk，后端自动处理最后窗口和session完成
12. **Double类型精度** - 所有时间相关字段使用Double支持小数秒，避免累加截断误差

---

## 快速开始

```bash
# 1. 克隆项目
git clone <repo-url>
cd ski

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实配置

# 3. 启动PostgreSQL
docker run -d --name skiuo-postgres \
  -e POSTGRES_DB=skiuo \
  -e POSTGRES_USER=skiuo \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 postgres:15

# 4. 启动后端
cd core-service
mvn clean compile
mvn spring-boot:run &

# 5. 启动AI服务
cd ../ai-service
python3.12 -m venv .venv
source .venv/bin/activate
pip3.12 install -r requirements.txt
python3.12 grpc_server.py &

# 6. 启动前端
cd ../web-recorder
npm install
npm run dev

# 7. 浏览器访问
open http://localhost:5173
```

---

## 贡献指南

1. 功能实现优先，再考虑优化
2. 遵循现有代码风格
3. 完善单元测试
4. 更新相关文档
5. 提交前确保所有服务正常运行
