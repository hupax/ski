# 输入源扩展设计

## 概述

本文档描述视频输入源的扩展性设计，确保系统能够支持多种视频采集方式，而无需修改核心处理逻辑。

---

## 1. 当前架构

### 输入接口

```
POST /api/videos/upload
Content-Type: multipart/form-data

参数：
- sessionId: 会话ID
- chunkIndex: 片段序号
- video: 视频文件（WebM格式）
```

### 当前支持的输入源

| 输入源 | 实现方式 | 状态 |
|--------|---------|------|
| 浏览器录制 | MediaRecorder API | ✅ 已实现 |
| 移动端App | 原生录制 → HTTP上传 | ✅ 兼容 |
| 屏幕录制软件 | OBS/录屏工具导出 → 上传 | ✅ 兼容 |
| 第三方视频 | 用户本地视频上传 | ✅ 兼容 |

**核心原则**：任何能生成视频文件的客户端，都可以通过HTTP上传接口接入。

---

## 2. 架构抽象

### 输入层与处理层解耦

```
┌──────────────────────────────────────────┐
│          输入层（可扩展）                  │
│  ┌────────────┐  ┌──────────────┐        │
│  │ HTTP上传   │  │ 流媒体推流    │ (未来) │
│  │ WebSocket  │  │ WebRTC推流    │ (未来) │
│  └─────┬──────┘  └──────┬───────┘        │
└────────┼─────────────────┼────────────────┘
         │                 │
         │  统一格式：视频文件/切片
         ↓
┌──────────────────────────────────────────┐
│         core-service（处理中枢）           │
│  - 接收视频（格式无关）                    │
│  - 调用ai-service处理                     │
│  - 上传MinIO                              │
│  - 任务调度                               │
└──────────────────────────────────────────┘
```

**关键点**：
- core-service只关心"接收到视频文件"
- 不关心视频来源（浏览器/硬件/推流）
- 输入层负责将不同来源统一成"视频文件"

---

## 3. 扩展场景设计

### 场景1：硬件设备推流（Pocket 3 / GoPro / 运动相机）

#### 需求分析

- **问题**：硬件设备不支持HTTP文件上传
- **能力**：支持RTMP/RTSP推流
- **期望**：实时录制，实时分析

#### 架构方案

```
┌─────────────┐
│  Pocket 3   │ RTMP推流
└──────┬──────┘
       │ rtmp://server:1935/live/session_123
       ↓
┌─────────────────────┐
│  SRS流媒体服务器     │
│  - 接收RTMP推流      │
│  - 生成HLS切片       │
│  - 回调通知          │
└──────┬──────────────┘
       │ 每30秒生成一个.ts切片
       │ HTTP Callback
       ↓
┌──────────────────────┐
│ stream-processor服务 │
│  - 接收HLS切片通知    │
│  - 转换.ts → .webm   │
│  - 调用上传接口       │
└──────┬───────────────┘
       │ POST /api/videos/upload
       ↓
┌──────────────────────┐
│   core-service       │ （逻辑不变）
└──────────────────────┘
```

#### 部署配置

**docker-compose.yml**
```yaml
services:
  # 现有服务...

  srs:
    image: ossrs/srs:5
    ports:
      - "1935:1935"      # RTMP推流端口
      - "8080:8080"      # HTTP-FLV/HLS播放
      - "1985:1985"      # API端口
    volumes:
      - ./srs/srs.conf:/usr/local/srs/conf/srs.conf
    restart: unless-stopped

  stream-processor:
    build: ./stream-processor
    environment:
      SRS_HTTP_CALLBACK: http://srs:1985/api/v1/streams
      CORE_SERVICE_URL: http://core-service:8080
    depends_on:
      - srs
      - core-service
    restart: unless-stopped
```

**srs.conf**
```nginx
listen              1935;
max_connections     1000;

vhost __defaultVhost__ {
    hls {
        enabled         on;
        hls_path        /tmp/hls;
        hls_fragment    30;        # 30秒切片
        hls_window      60;
    }

    http_hooks {
        enabled         on;
        on_hls          http://stream-processor:3000/callback;
    }
}
```

#### stream-processor实现

```javascript
// stream-processor/index.js
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

// 接收SRS的HLS切片回调
app.post('/callback', async (req, res) => {
    const { file, stream } = req.body;
    // file: /tmp/hls/session_123-1.ts
    // stream: session_123

    console.log(`Received HLS chunk: ${file}`);

    try {
        // 1. 提取sessionId
        const sessionId = stream;
        const chunkIndex = extractChunkIndex(file);

        // 2. 转换.ts为.webm
        const webmPath = `/tmp/converted/${sessionId}_${chunkIndex}.webm`;
        await convertToWebM(file, webmPath);

        // 3. 上传到core-service
        await uploadToCore(sessionId, chunkIndex, webmPath);

        // 4. 清理临时文件
        fs.unlinkSync(webmPath);

        res.json({ success: true });
    } catch (error) {
        console.error('Process error:', error);
        res.status(500).json({ error: error.message });
    }
});

function convertToWebM(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputFormat('webm')
            .videoCodec('libvpx-vp9')
            .audioCodec('libopus')
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

async function uploadToCore(sessionId, chunkIndex, filePath) {
    const form = new FormData();
    form.append('sessionId', sessionId);
    form.append('chunkIndex', chunkIndex);
    form.append('video', fs.createReadStream(filePath));

    await axios.post(
        `${process.env.CORE_SERVICE_URL}/api/videos/upload`,
        form,
        { headers: form.getHeaders() }
    );
}

function extractChunkIndex(filePath) {
    const match = filePath.match(/-(\d+)\.ts$/);
    return match ? parseInt(match[1]) : 0;
}

app.listen(3000, () => {
    console.log('Stream processor listening on port 3000');
});
```

#### 使用方式

**Pocket 3推流**：
```bash
# 推流地址
rtmp://your-server-ip:1935/live/session_123
```

**OBS推流**：
```
服务器: rtmp://your-server-ip:1935/live
串流密钥: session_123
```

---

### 场景2：WebRTC实时推流（超低延迟）

#### 需求分析

- **问题**：RTMP延迟较高（3-5秒）
- **场景**：需要实时互动、实时反馈
- **技术**：WebRTC（<1秒延迟）

#### 架构方案

```
┌─────────────┐
│  浏览器/App │ WebRTC推流
└──────┬──────┘
       │ WebRTC DataChannel
       ↓
┌─────────────────────┐
│  mediasoup/janus    │ WebRTC媒体服务器
│  - 接收媒体流        │
│  - 实时录制          │
└──────┬──────────────┘
       │ 每30秒保存一个文件
       ↓
┌──────────────────────┐
│   core-service       │ （逻辑不变）
└──────────────────────┘
```

**注**：WebRTC方案较复杂，除非有强需求，否则RTMP足够。

---

### 场景3：WebSocket流式上传

#### 需求分析

- **问题**：HTTP分块上传无法实时
- **场景**：边录边传，减少延迟
- **技术**：WebSocket二进制流

#### 架构方案

```javascript
// core-service新增WebSocket端点
@ServerEndpoint("/ws/upload/{sessionId}")
public class VideoUploadWebSocket {

    private ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    private String sessionId;
    private int chunkIndex = 0;

    @OnMessage
    public void onMessage(ByteBuffer message, Session session) {
        buffer.write(message.array());

        // 每30秒或达到大小阈值，保存一个chunk
        if (buffer.size() >= 5 * 1024 * 1024) {  // 5MB
            saveChunk(buffer.toByteArray(), sessionId, chunkIndex++);
            buffer.reset();
        }
    }

    @OnClose
    public void onClose(Session session) {
        // 保存剩余数据
        if (buffer.size() > 0) {
            saveChunk(buffer.toByteArray(), sessionId, chunkIndex);
        }
    }
}
```

**前端实现**：
```javascript
const ws = new WebSocket('ws://server/ws/upload/session_123');
ws.binaryType = 'arraybuffer';

mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
        event.data.arrayBuffer().then(buffer => {
            ws.send(buffer);  // 实时发送
        });
    }
};
```

---

## 4. 统一接口抽象（Java实现）

### 接口定义

```java
// VideoIngestionService.java
public interface VideoIngestionService {
    /**
     * 接收视频数据
     * @param source 输入源信息
     * @return 接收的视频块信息
     */
    VideoChunk ingest(IngestionSource source) throws IngestionException;
}

// IngestionSource.java
public class IngestionSource {
    private IngestionType type;  // HTTP, STREAM, WEBSOCKET
    private String sessionId;
    private int chunkIndex;
    private InputStream videoStream;
    private Map<String, String> metadata;
}

public enum IngestionType {
    HTTP_UPLOAD,      // 当前实现
    HLS_STREAM,       // HLS切片
    WEBSOCKET_STREAM, // WebSocket流
    WEBRTC_STREAM     // WebRTC流
}
```

### 实现示例

```java
// HttpFileIngestion.java
@Service
@ConditionalOnProperty(name = "ingestion.http.enabled", havingValue = "true")
public class HttpFileIngestion implements VideoIngestionService {

    @Override
    public VideoChunk ingest(IngestionSource source) {
        // 当前HTTP上传实现
        String tempPath = saveTempFile(source.getVideoStream());
        return VideoChunk.builder()
            .sessionId(source.getSessionId())
            .chunkIndex(source.getChunkIndex())
            .localPath(tempPath)
            .build();
    }
}

// StreamIngestion.java
@Service
@ConditionalOnProperty(name = "ingestion.stream.enabled", havingValue = "true")
public class StreamIngestion implements VideoIngestionService {

    @Override
    public VideoChunk ingest(IngestionSource source) {
        // 接收HLS切片
        String tempPath = saveTempFile(source.getVideoStream());
        return VideoChunk.builder()
            .sessionId(source.getSessionId())
            .chunkIndex(source.getChunkIndex())
            .localPath(tempPath)
            .build();
    }
}
```

---

## 5. 配置管理

### application.yml

```yaml
skiuo:
  ingestion:
    # HTTP上传（默认启用）
    http:
      enabled: true
      max-file-size: 100MB
      temp-dir: /tmp/skiuo

    # 流媒体推流（可选）
    stream:
      enabled: false
      srs-url: http://srs:1985
      callback-secret: your-secret-key

    # WebSocket流式上传（可选）
    websocket:
      enabled: false
      buffer-size: 5MB
      max-connections: 100
```

---

## 6. 实施建议

### 阶段1：当前MVP（已完成）
- ✅ HTTP文件上传
- ✅ 支持浏览器/移动端/第三方视频

### 阶段2：添加推流支持（按需）
**触发条件**：
- 有用户需要硬件设备直连
- 需要实时录制场景

**实施步骤**：
1. 部署SRS流媒体服务器（Docker，5分钟）
2. 开发stream-processor服务（100行代码，1天）
3. 测试推流 → 分析完整链路（1天）

**成本**：
- 开发成本：2天
- 运维成本：+1个Docker容器
- 核心架构：无需改动

### 阶段3：WebRTC实时推流（远期）
**触发条件**：
- 需要超低延迟（<1秒）
- 有实时互动需求

**不建议过早实施**，除非有明确的业务需求。

---

## 7. 优势总结

### 当前架构的扩展性优势

1. **输入无关**：core-service只处理视频文件，不关心来源
2. **独立扩展**：添加新输入源不影响核心逻辑
3. **渐进式**：可以按需逐步添加，无需一次到位
4. **低成本**：新增输入源只需添加适配层服务

### 扩展成本对比

| 输入源 | 开发成本 | 部署成本 | 核心改动 |
|--------|---------|---------|---------|
| HTTP上传 | 已完成 | 无 | 无 |
| RTMP推流 | 2天 | +1容器 | 无 |
| WebSocket | 3天 | 配置 | 小 |
| WebRTC | 1周 | +1容器 | 无 |

---

## 8. 参考资料

### SRS流媒体服务器
- 官网：https://ossrs.io/
- Docker镜像：ossrs/srs:5
- 配置文档：https://ossrs.io/lts/zh-cn/docs/v5/doc/introduction

### FFmpeg格式转换
```bash
# HLS(.ts) → WebM
ffmpeg -i input.ts -c:v libvpx-vp9 -c:a libopus output.webm

# RTMP → WebM（边推边录）
ffmpeg -i rtmp://server/live/stream -c:v libvpx-vp9 -c:a libopus output.webm
```

### WebRTC媒体服务器
- mediasoup：https://mediasoup.org/
- Janus：https://janus.conf.meetecho.com/

---

## 总结

当前架构已经具备良好的扩展性：

- ✅ **已支持**：HTTP上传（浏览器/移动端/第三方视频）
- 🔧 **易扩展**：推流支持（RTMP/RTSP）
- 🚀 **可扩展**：实时推流（WebRTC/WebSocket）

**核心原则**：输入层与处理层解耦，新增输入源无需改动核心逻辑。

**实施建议**：按需扩展，不过早优化。当前HTTP上传方案已能覆盖大部分场景。
