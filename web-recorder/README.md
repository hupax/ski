# Web Recorder - Skiuo AI 视频录制前端

浏览器端视频录制模块，配合 core-service 和 ai-service 实现 AI 视频分析。

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **MediaRecorder API** - 浏览器原生视频录制
- **STOMP over WebSocket** - 实时消息推送
- **SockJS** - WebSocket 降级支持

## 核心功能

### 1. 视频录制
- 获取浏览器摄像头权限
- MediaRecorder API 录制 WebM 格式视频
- 动态 chunk 时长（从服务器获取推荐配置）
- 支持暂停/恢复，精确跟踪录制时长
- 停止录制后等待最后一个chunk上传完成，再通知后端

### 2. 测试模式
- 上传本地预切分的chunk文件
- 模拟真实录制流程（按时间间隔上传）
- 支持暂停/继续/停止
- 适合开发测试和演示

### 3. API 对接
- HTTP 上传视频到 core-service
- 实时获取会话状态
- 查询历史分析记录
- 完成会话通知（`finishSession`）

### 4. WebSocket 实时推送
- STOMP 协议连接
- 订阅 session topic
- 实时接收 AI 分析流式结果

### 5. 用户配置
- AI 模型选择（Qwen / Gemini）
- 分析模式选择（完整分析 / 滑动窗口）
- 视频保留策略（删除 / 保留）
- 存储服务选择（MinIO / OSS / COS）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=http://localhost:8080
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 4. 构建生产版本

```bash
npm run build
```

构建输出在 `dist/` 目录。

### 5. 预览生产构建

```bash
npm run preview
```

## 项目结构

```
web-recorder/
├── src/
│   ├── components/           # React 组件
│   │   ├── AnalysisDisplay.tsx    # AI 分析结果显示
│   │   ├── ConfigPanel.tsx        # 配置面板
│   │   ├── StatusIndicator.tsx    # 状态指示器
│   │   ├── VideoRecorder.tsx      # 视频录制组件
│   │   └── TestUploader.tsx       # 测试模式上传组件
│   ├── hooks/                # 自定义 Hooks
│   │   ├── useMediaRecorder.ts    # MediaRecorder 管理
│   │   └── useWebSocket.ts        # WebSocket 连接管理
│   ├── services/             # 服务层
│   │   ├── apiClient.ts           # HTTP API 客户端
│   │   ├── mediaRecorder.ts       # MediaRecorder 封装
│   │   └── websocketClient.ts     # STOMP WebSocket 客户端
│   ├── types/                # TypeScript 类型定义
│   │   └── index.ts
│   ├── config/               # 配置文件
│   │   └── constants.ts
│   ├── App.tsx               # 主应用组件
│   ├── main.tsx              # 应用入口
│   └── index.css             # 全局样式（Tailwind）
├── .env                      # 环境变量（不提交到 git）
├── .env.example              # 环境变量模板
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## API 接口

### HTTP API

#### 上传视频 chunk
```http
POST /api/videos/upload
Content-Type: multipart/form-data

参数:
- file: Blob (WebM 视频)
- userId: number
- chunkIndex: number (从 0 开始)
- sessionId: number (可选，首次上传为空)
- aiModel: "qwen" | "gemini"
- analysisMode: "FULL" | "SLIDING_WINDOW"
- keepVideo: boolean
- duration: number (可选，秒数)

返回:
{
  "sessionId": 123,
  "chunkId": 456,
  "status": "ACCEPTED",
  "message": "Video upload accepted, processing started"
}
```

#### 获取会话状态
```http
GET /api/videos/sessions/{sessionId}

返回:
{
  "id": 123,
  "userId": 1,
  "status": "RECORDING" | "ANALYZING" | "COMPLETED" | "FAILED",
  "aiModel": "qwen",
  "analysisMode": "SLIDING_WINDOW",
  "keepVideo": false,
  "startTime": "2025-01-25T10:00:00",
  "totalChunks": 5,
  "analyzedChunks": 3
}
```

#### 完成会话
```http
POST /api/videos/sessions/{sessionId}/finish

返回:
{
  "sessionId": 123,
  "status": "COMPLETED",
  "message": "Session finished successfully"
}
```

**重要**：前端停止录制后必须调用此接口，等待最后一个chunk上传完成后调用。

#### 获取服务器配置
```http
GET /api/config

返回:
{
  "windowSize": 15,
  "windowStep": 10,
  "recommendedChunkDuration": 35
}
```

前端启动时获取此配置，动态调整chunk时长以匹配后端窗口参数。

### WebSocket

#### 连接端点
```
ws://localhost:8080/ws
```

#### 订阅 Topic
```
/topic/session/{sessionId}
```

#### 消息格式
```json
{
  "type": "analysis_result",
  "sessionId": 123,
  "windowIndex": 0,
  "content": "用户正在...",
  "timestamp": 1706169600000
}
```

## 测试模式使用

### 准备测试文件

使用 ai-service 的 `test_video_splitter.py` 切分视频：

```bash
cd ai-service
python3.12 test_video_splitter.py /path/to/video.mp4 output_dir/ --chunk-duration 35
```

生成 `chunk_0.webm`, `chunk_1.webm`, ...

### 使用测试上传

1. 在前端界面切换到"测试模式"标签页
2. 点击"选择 chunk 文件"，多选生成的 chunk 文件
3. 配置 AI 模型、分析模式、存储服务等参数
4. 点击"开始测试"
5. 系统会按配置的时间间隔逐个上传chunk，模拟真实录制
6. 上传完成后自动调用 `finishSession`

**优势**：
- 无需摄像头，可重复测试
- 可使用任意视频文件
- 测试不同时长和场景

## 配置说明

### 录制配置 (src/config/constants.ts)

```typescript
export const RECORDING_CONFIG = {
  // Chunk 分段时长（毫秒） - 动态从服务器获取
  // 通过 /api/config 接口获取 recommendedChunkDuration
  CHUNK_DURATION: 35000,  // 默认35秒，实际由服务器配置决定

  // 视频约束
  VIDEO_CONSTRAINTS: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },

  // MediaRecorder 选项
  RECORDER_OPTIONS: {
    mimeType: 'video/webm;codecs=vp8,opus',
    videoBitsPerSecond: 2500000,  // 2.5 Mbps
  },
};
```

### 默认用户配置

```typescript
export const DEFAULT_CONFIG = {
  USER_ID: 1,                              // 固定用户 ID
  AI_MODEL: AIModel.QWEN,                  // 默认使用 Qwen
  ANALYSIS_MODE: AnalysisMode.SLIDING_WINDOW,  // 默认滑动窗口模式
  KEEP_VIDEO: false,                       // 默认不保留视频
  STORAGE_TYPE: StorageType.COS,           // 默认使用 COS
};
```

**重要说明**：
- **动态 chunk 时长**：前端启动时从 `/api/config` 获取后端配置的推荐值
- **存储服务**：可选 MinIO(本地)、OSS(阿里云)、COS(腾讯云)
- **chunk 时长计算**：`recommendedChunkDuration = windowSize + 2 × windowStep`

## 浏览器兼容性

### 必需 API
- **MediaRecorder API**: Chrome 47+, Firefox 25+, Safari 14.1+
- **getUserMedia**: Chrome 53+, Firefox 36+, Safari 11+
- **WebSocket**: 所有现代浏览器

### 注意事项
- Safari 对 MediaRecorder 支持有限，建议使用 Chrome/Firefox
- 需要 HTTPS 或 localhost 环境才能访问摄像头
- WebM 格式在 Safari 上可能需要转码

## 开发调试

### 启用 WebSocket 调试日志

编辑 `src/services/websocketClient.ts`:

```typescript
debug: (str) => {
  console.log('STOMP Debug:', str);  // 取消注释
},
```

### 查看 MediaRecorder 状态

```typescript
// 在浏览器控制台
console.log(recorder.getState());  // "inactive" | "recording" | "paused"
```

## 常见问题

### 1. 摄像头权限被拒绝
- 确保使用 HTTPS 或 localhost
- 检查浏览器权限设置
- 尝试刷新页面重新请求权限

### 2. WebSocket 连接失败
- 检查 core-service 是否启动
- 验证 `.env` 中的 `VITE_WS_BASE_URL` 配置
- 查看浏览器控制台的错误信息

### 3. 视频上传失败
- 检查网络连接
- 确认 core-service API 端点可访问
- 查看浏览器 Network 面板的请求详情

### 4. 收不到 AI 分析结果
- 确认 WebSocket 已连接（页面底部状态指示）
- 检查 sessionId 是否正确
- 查看 core-service 和 ai-service 日志

## 性能优化建议

1. **降低视频比特率**（节省带宽）
   ```typescript
   videoBitsPerSecond: 1500000  // 1.5 Mbps
   ```

2. **调整 chunk 时长**（减少上传频率）
   ```typescript
   CHUNK_DURATION: 60000  // 60秒
   ```

3. **降低视频分辨率**（提升性能）
   ```typescript
   VIDEO_CONSTRAINTS: {
     width: { ideal: 640 },
     height: { ideal: 480 },
   }
   ```

## License

MIT

## 相关链接

- [core-service](../core-service/README.md) - Spring Boot 业务中枢
- [ai-service](../ai-service/README.md) - Python AI 分析服务
- [项目架构文档](../doc/dev3.md) - 完整系统设计
