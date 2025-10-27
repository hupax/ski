# 性能优化与系统扩展

## 概述

本文档描述系统的性能优化方向和扩展性设计，用于指导未来的优化和扩展工作。

**核心原则**：
- 避免过早优化
- 先实现功能，再优化性能
- 基于实际瓶颈优化，不是基于假设

---

## 1. IO优化

### 1.1 当前IO路径分析

#### 半实时模式的完整IO路径

```
1. 网络IO：web → core（5MB）                     必需，无法优化
2. 磁盘IO：core写 /tmp/skiuo/chunk_0.webm（5MB）  可优化
3. 磁盘IO：ai读 chunk_0.webm（5MB）              可优化
4. 磁盘IO：ai写 3个窗口（5MB总计）               可优化
5. 磁盘IO：core读 3个窗口（5MB）                 可优化
6. 网络IO：core上传3个窗口到MinIO（5MB）        必需，无法优化
7. 网络IO：qwen从MinIO下载（5MB）               必需，无法优化

磁盘IO总计：约20MB/次
网络IO总计：约15MB/次
处理延迟：磁盘IO约50ms，AI分析约30秒
```

#### 瓶颈分析

```
整体耗时分解：
├─ 网络上传：1秒（5MB @ 40Mbps）
├─ 磁盘IO：0.05秒（20MB @ 500MB/s SSD）
├─ AI分析：30秒（主要瓶颈）
└─ 总计：约31秒

结论：AI分析占97%时间，磁盘IO仅占0.16%
```

**核心结论**：磁盘IO不是瓶颈，优化收益极小。

---

### 1.2 优化方案对比

#### 方案A：tmpfs（内存文件系统）

**实现**：
```bash
# 挂载1GB内存文件系统
sudo mount -t tmpfs -o size=1G tmpfs /tmp/skiuo

# 或在/etc/fstab中永久配置
tmpfs /tmp/skiuo tmpfs size=1G,mode=1777 0 0
```

**优点**：
- ✅ 代码零改动（只是改挂载点）
- ✅ 文件API不变，FFmpeg无需修改
- ✅ 自动清理（重启清空）
- ✅ 读写速度快（内存速度）

**缺点**：
- ⚠️ 占用内存（但可限制大小）
- ⚠️ 重启数据丢失（临时文件无所谓）

**适用场景**：
- 高并发（100+用户同时录制）
- 磁盘IO成为瓶颈时
- 机械硬盘环境

**性能提升**：
- 理论提升：磁盘50ms → 内存5ms（提升10倍）
- 实际提升：总耗时31s → 30.95s（提升0.16%）

**结论**：收益极小，当前不需要。

---

#### 方案B：全内存流传递

**架构**：
```
web → core接收到内存（ByteArrayOutputStream）
  ↓
gRPC stream传字节流给ai-service（不落盘）
  ↓
ai-service在内存中切片（FFmpeg pipe模式）
  ↓
gRPC stream返回3个切片字节流（不落盘）
  ↓
core直接从内存上传到MinIO（不落盘）
```

**实现复杂度**：

```java
// core-service
public List<String> processVideoInMemory(byte[] videoData) {
    // gRPC传输字节流
    StreamObserver<VideoChunk> requestObserver =
        aiServiceStub.processVideoStream(responseObserver);

    // 分块发送
    for (int i = 0; i < videoData.length; i += CHUNK_SIZE) {
        requestObserver.onNext(
            VideoChunk.newBuilder()
                .setData(ByteString.copyFrom(videoData, i, CHUNK_SIZE))
                .build()
        );
    }
}
```

```python
# ai-service
async def process_video_stream(request_iterator):
    # 接收字节流到内存
    video_data = bytearray()
    async for chunk in request_iterator:
        video_data.extend(chunk.data)

    # FFmpeg pipe模式切片
    process = subprocess.Popen([
        'ffmpeg',
        '-i', 'pipe:0',        # 从stdin读取
        '-ss', '0', '-t', '15',
        '-f', 'webm',
        'pipe:1'               # 输出到stdout
    ], stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    window_data, _ = process.communicate(input=bytes(video_data))
    return window_data
```

**优点**：
- ✅ 完全避免磁盘IO

**缺点**：
- ❌ 代码复杂度显著提升
- ❌ FFmpeg pipe模式容易出错
- ❌ 内存占用大（30MB同时在内存）
- ❌ 错误重试困难（内存数据易丢失）
- ❌ 调试困难（无中间文件）

**结论**：不建议实施，复杂度高但收益极小。

---

#### 方案C：检查/tmp是否已是tmpfs

大多数Linux发行版默认将`/tmp`挂载为tmpfs：

```bash
# 检查
df -h | grep /tmp

# 如果显示tmpfs，说明已经是内存文件系统
tmpfs           7.8G  1.2M  7.8G   1% /tmp
```

**结论**：如果/tmp已是tmpfs，当前实现已经是最优，无需任何改动。

---

### 1.3 IO优化决策树

```
是否遇到性能瓶颈？
├─ 否 → 不优化
└─ 是 → 分析瓶颈在哪？
       ├─ AI分析慢（30秒+） → 优化AI调用
       │   ├─ 换更快的模型
       │   ├─ 并行处理多个窗口
       │   └─ 调整窗口参数
       │
       ├─ 网络传输慢 → 优化网络
       │   ├─ 增加带宽
       │   ├─ 启用压缩
       │   └─ CDN加速
       │
       └─ 磁盘IO慢（SSD<100MB/s） → 优化IO
           ├─ 第1步：检查/tmp是否tmpfs
           ├─ 第2步：挂载tmpfs
           └─ 第3步：考虑SSD升级
```

---

### 1.4 高并发场景优化

#### 触发条件
- 同时100+用户录制
- 磁盘IOPS饱和
- 临时文件清理不及时

#### 优化方案

**1. tmpfs + 自动清理**

```bash
# 1GB内存文件系统 + 定期清理
tmpfs /tmp/skiuo tmpfs size=1G,mode=1777 0 0

# 定时任务清理超过1小时的文件
*/10 * * * * find /tmp/skiuo -type f -mmin +60 -delete
```

**2. 分片存储**

```java
// 按sessionId哈希分散到不同目录，减少单目录压力
String subDir = String.valueOf(sessionId.hashCode() % 10);
Path tempPath = Paths.get("/tmp/skiuo", subDir, filename);
```

**3. 异步清理**

```java
@Scheduled(fixedRate = 60000)  // 每分钟清理一次
public void cleanupTempFiles() {
    Files.walk(Paths.get("/tmp/skiuo"))
        .filter(p -> isExpired(p))
        .forEach(p -> {
            try {
                Files.delete(p);
            } catch (IOException e) {
                log.warn("Failed to delete: {}", p);
            }
        });
}
```

---

## 2. 分布式部署扩展

### 2.1 当前架构（单机）

```
┌────────────────────────────────────┐
│        单台服务器                   │
│  ┌──────────────┐                 │
│  │ core-service │                 │
│  │ ai-service   │                 │
│  │ MinIO        │                 │
│  │ PostgreSQL   │                 │
│  └──────────────┘                 │
└────────────────────────────────────┘
```

**优点**：
- 简单
- 无网络延迟
- 共享文件系统

**限制**：
- 单点故障
- 扩展受限于单机性能

---

### 2.2 分布式架构（多机）

#### 架构方案

```
┌─────────────────────────────────────────────────┐
│                  负载均衡器                       │
│                 Caddy/Nginx                      │
└────────┬────────────────────────┬────────────────┘
         │                        │
    ┌────┴────┐              ┌────┴────┐
    │ core-1  │              │ core-2  │
    └────┬────┘              └────┬────┘
         │                        │
         └────────┬───────────────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────┴────┐      ┌────┴────┐
    │  ai-1   │      │  ai-2   │
    └─────────┘      └─────────┘
         │                │
         └────────┬───────┘
                  │
         ┌────────┴────────┐
         │                 │
    ┌────┴────┐      ┌────┴────┐
    │  MinIO  │      │PostgreSQL│
    │ (cluster)│      │ (主从)   │
    └─────────┘      └──────────┘
```

#### 关键变更

**1. 共享文件系统问题**

**问题**：core-service和ai-service不在同一台机器，无法共享本地文件。

**解决方案A：NFS共享存储**
```yaml
# 所有服务挂载同一NFS
volumes:
  - nfs-share:/tmp/skiuo

# NFS配置
nfs-server:/export/skiuo /tmp/skiuo nfs defaults 0 0
```

**解决方案B：对象存储直传**
```
core-service上传原始视频到MinIO
  ↓
传MinIO URL给ai-service（不传本地路径）
  ↓
ai-service从MinIO下载 → 切片 → 上传切片到MinIO
  ↓
传切片URL给core-service
```

但这样ai-service又需要MinIO SDK了，失去了"少一个依赖"的优势。

**解决方案C：gRPC流式传输（推荐）**
```
core-service接收视频到内存
  ↓
gRPC stream传输给ai-service（二进制流）
  ↓
ai-service保存到本地 → 切片 → 返回切片路径
  ↓
core-service通过gRPC stream接收切片二进制流
  ↓
core-service上传到MinIO
```

**2. gRPC接口调整**

```protobuf
// 新增：流式传输视频文件
rpc ProcessVideoStream(stream VideoChunk) returns (ProcessResponse);
rpc GetWindowStream(WindowRequest) returns (stream VideoChunk);

message VideoChunk {
  bytes data = 1;
  int32 chunk_index = 2;
  bool is_final = 3;
}
```

**3. 负载均衡配置**

```caddyfile
# Caddyfile
skiuo.yourdomain.com {
    # core-service负载均衡
    reverse_proxy /api/* {
        to core-service-1:8080
        to core-service-2:8080
        lb_policy round_robin
        health_uri /actuator/health
        health_interval 10s
    }
}
```

---

### 2.3 高可用部署

#### PostgreSQL主从复制

```yaml
services:
  postgres-master:
    image: postgres:15
    environment:
      POSTGRES_REPLICATION_MODE: master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: ${REPL_PASSWORD}

  postgres-slave:
    image: postgres:15
    environment:
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: postgres-master
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: ${REPL_PASSWORD}
```

#### MinIO集群模式

```bash
# 至少4节点
docker run -d \
  --name minio1 \
  minio/minio server \
  http://minio{1...4}/data{1...2}
```

---

## 3. AI服务扩展

### 3.1 多模型并发调用

#### 场景
用户选择同时用qwen和gemini分析，取更好的结果。

#### 实现

```python
# ai-service
async def analyze_with_multiple_models(video_url, models):
    tasks = []
    for model in models:
        analyzer = get_analyzer(model)  # qwen/gemini
        tasks.append(analyzer.analyze(video_url))

    # 并发调用
    results = await asyncio.gather(*tasks)

    # 返回所有结果或选择最佳
    return merge_results(results)
```

**配置**：
```yaml
# application.yml
skiuo:
  ai:
    concurrent-models: true
    models:
      - qwen
      - gemini
    merge-strategy: best  # all/best/vote
```

---

### 3.2 AI模型本地部署

#### 场景
不使用云端API，本地部署qwen模型。

#### 架构变更

```
ai-service → 本地qwen模型（GPU推理）
  而不是 → 云端qwen API
```

**依赖变更**：
```python
# requirements.txt
# 删除：qwen-api-client

# 添加：
torch>=2.0.0
transformers>=4.30.0
qwen-vl-chat  # 本地模型
```

**代码变更**：
```python
# ai-service/models/qwen_local.py
from transformers import AutoModelForCausalLM, AutoTokenizer

class QwenLocalAnalyzer(VideoAnalyzer):
    def __init__(self):
        self.model = AutoModelForCausalLM.from_pretrained(
            "Qwen/Qwen-VL-Chat",
            device_map="auto",
            trust_remote_code=True
        )
        self.tokenizer = AutoTokenizer.from_pretrained(
            "Qwen/Qwen-VL-Chat",
            trust_remote_code=True
        )

    async def analyze_video(self, video_path, context=""):
        # 本地推理
        response = self.model.chat(
            self.tokenizer,
            query=f"分析这段视频: {video_path}",
            history=[]
        )
        yield response
```

**优点**：
- 不依赖网络
- 无API费用
- 数据隐私

**缺点**：
- 需要GPU（成本高）
- 推理速度可能更慢
- 需要下载大模型（几十GB）

---

### 3.3 模型热切换

#### 场景
运行时动态切换AI模型，无需重启。

#### 实现

```java
// core-service
@RestController
public class ModelController {

    @Autowired
    private ModelRegistry modelRegistry;

    @PostMapping("/api/models/switch")
    public ResponseEntity<?> switchModel(@RequestParam String model) {
        modelRegistry.setActiveModel(model);
        return ResponseEntity.ok("Switched to: " + model);
    }

    @GetMapping("/api/models/available")
    public List<String> getAvailableModels() {
        return modelRegistry.listModels();
    }
}
```

---

## 4. 视频处理优化

### 4.1 视频格式兼容性

#### 当前限制
只支持WebM格式（浏览器MediaRecorder输出）。

#### 扩展方案

```java
// core-service: 自动格式检测和转换
public String normalizeVideoFormat(String inputPath) {
    String format = detectFormat(inputPath);

    if ("webm".equals(format)) {
        return inputPath;  // 无需转换
    }

    // FFmpeg转换
    String outputPath = inputPath.replace(
        "." + format, ".webm"
    );

    ProcessBuilder pb = new ProcessBuilder(
        "ffmpeg", "-i", inputPath,
        "-c:v", "libvpx-vp9",
        "-c:a", "libopus",
        outputPath
    );
    pb.start().waitFor();

    return outputPath;
}
```

**支持格式**：
- MP4
- AVI
- MOV
- MKV
- FLV

---

### 4.2 视频预处理

#### 场景
用户上传的视频质量参差不齐，需要预处理。

#### 优化项

**1. 分辨率标准化**
```bash
# 统一到720p
ffmpeg -i input.mp4 -vf scale=1280:720 output.webm
```

**2. 帧率标准化**
```bash
# 统一到30fps
ffmpeg -i input.mp4 -r 30 output.webm
```

**3. 压缩**
```bash
# 降低码率节省存储和传输
ffmpeg -i input.mp4 -b:v 1M output.webm
```

**实现**：
```python
# ai-service
def preprocess_video(input_path):
    output_path = input_path.replace('.webm', '_processed.webm')

    subprocess.run([
        'ffmpeg',
        '-i', input_path,
        '-vf', 'scale=1280:720',  # 标准化分辨率
        '-r', '30',                # 标准化帧率
        '-b:v', '1M',              # 压缩码率
        output_path
    ])

    return output_path
```

---

### 4.3 智能切片优化

#### 当前问题
固定15秒窗口可能在动作中间切断。

#### 优化方案：场景检测切片

```python
# ai-service: 基于场景检测的智能切片
import scenedetect

def smart_slice(video_path):
    video_manager = VideoManager([video_path])
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector())

    # 检测场景变化
    video_manager.set_downscale_factor()
    video_manager.start()
    scene_manager.detect_scenes(frame_source=video_manager)

    # 在场景变化处切片
    scene_list = scene_manager.get_scene_list()

    windows = []
    for i, scene in enumerate(scene_list):
        start = scene[0].get_seconds()
        end = scene[1].get_seconds()

        # 每个场景作为一个窗口
        windows.append((start, end))

    return windows
```

**优点**：
- 避免在动作中间切断
- 更符合语义

**缺点**：
- 增加计算开销
- 可能产生不均匀的窗口

---

## 5. 跨chunk窗口优化（Cross-Chunk Windows）

### 5.1 问题背景

#### 窗口断层问题

在滑动窗口模式下，视频被分成多个chunk（如35秒一个），每个chunk独立切片和分析。这导致在chunk边界处出现**窗口断层**：

```
chunk 0 (0-35s) → windows: [0-15, 10-25, 20-35]
chunk 1 (35-70s) → windows: [35-50, 45-60, 55-70]
                              ↑
                在35秒边界处缺少跨chunk的窗口
                无法分析 [25-40, 30-45] 等跨界窗口
```

**影响**：
- ❌ chunk边界处的动作可能被截断
- ❌ 重叠策略在边界处失效
- ❌ 可能丢失关键帧（恰好发生在边界）

#### 方案对比

针对这个问题，有4种不同的解决方案：

| 方案 | 描述 | 复杂度 | 效果 | 推荐度 |
|------|------|--------|------|--------|
| **方案1** | 不解决，依赖上下文传递 | 低 | 语义连续但视觉断层 | ⭐⭐ |
| **方案2** | 后端保存chunk尾部并拼接 | 中 | 完全无缝 | ⭐⭐⭐⭐⭐ |
| **方案3** | 全局窗口计算 | 高 | 完全无缝 | ⭐⭐⭐ |
| **方案4** | 前端overlap录制 | 中高 | 部分无缝 | ⭐⭐ |

**实施方案**：选择**方案2**（后端tail保存拼接），原因：
- ✅ 无需改动前端，零侵入
- ✅ 后端实现相对简单
- ✅ 完全解决断层问题
- ✅ 对用户透明

---

### 5.2 方案2实现：Tail Preservation

#### 核心思路

```
chunk 0 处理完成后：
  1. 提取最后N秒作为"tail"（N = windowSize - windowStep）
  2. 上传tail到存储（MinIO/OSS/COS）
  3. 保存tail路径到Session实体

chunk 1 处理时：
  1. 下载上一个chunk的tail
  2. 拼接：[tail + chunk1] → 新视频
  3. 对拼接后的视频进行窗口切片
  4. 时间偏移调整：baseOffset -= tailDuration
```

**示例**（windowSize=15s, windowStep=10s）：

```
chunk 0 (0-35s):
  处理 → windows: [0-15, 10-25, 20-35]
  提取 tail: [30-35s] (5秒 = 15-10)
  保存: sessions/123/tail_0.webm

chunk 1 (35-70s):
  下载 tail_0.webm
  拼接: [tail_0(30-35) + chunk_1(35-70)] → 新视频(30-70s, 40秒)
  切片: [30-45, 40-55, 50-65, 60-70]
         ↑           ↑
      跨chunk窗口   完美覆盖35秒边界
  时间调整: baseOffset = 35 - 5 = 30s
```

**效果**：
- ✅ 在35秒边界处生成了 [30-45] 窗口，覆盖了断层区域
- ✅ 时间轴连续，所有窗口的时间戳准确
- ✅ 用户无感知，前端零改动

---

### 5.3 技术实现

#### 架构改动

**1. gRPC接口扩展**

新增两个RPC方法：

```protobuf
// proto/video_analysis.proto
service VideoAnalysisService {
  // ... 现有方法

  // 提取视频尾部（最后N秒）
  rpc ExtractTail(ExtractTailRequest) returns (ExtractTailResponse);

  // 拼接多个视频
  rpc ConcatVideos(ConcatVideosRequest) returns (ConcatVideosResponse);
}

message ExtractTailRequest {
  string video_path = 1;
  string output_path = 2;
  int32 duration = 3;
}

message ConcatVideosRequest {
  repeated string video_paths = 1;
  string output_path = 2;
}
```

**2. Python实现（ai-service）**

```python
# ai-service/grpc_server.py
class VideoAnalysisServicer:
    def ExtractTail(self, request, context):
        """提取视频最后N秒"""
        result_path = self.video_processor.extract_tail(
            video_path=request.video_path,
            output_path=request.output_path,
            duration=request.duration
        )
        return ExtractTailResponse(output_path=result_path, error="")

    def ConcatVideos(self, request, context):
        """拼接多个视频"""
        result_path = self.video_processor.concat_videos(
            video_paths=list(request.video_paths),
            output_path=request.output_path
        )
        return ConcatVideosResponse(output_path=result_path, error="")
```

```python
# ai-service/video_processor.py
def extract_tail(self, video_path: str, output_path: str, duration: int) -> str:
    """使用FFmpeg提取最后N秒"""
    video_duration = self._get_video_duration(video_path)
    start_time = max(0, video_duration - duration)

    cmd = [
        'ffmpeg', '-y',
        '-ss', str(start_time),
        '-i', video_path,
        '-t', str(duration),
        '-c', 'copy',
        output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path

def concat_videos(self, video_paths: List[str], output_path: str) -> str:
    """使用FFmpeg concat demuxer拼接视频"""
    concat_list_path = output_path + '.txt'

    # 创建concat列表文件
    with open(concat_list_path, 'w') as f:
        for path in video_paths:
            f.write(f"file '{os.path.abspath(path)}'\n")

    cmd = [
        'ffmpeg', '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concat_list_path,
        '-c', 'copy',
        output_path
    ]
    subprocess.run(cmd, check=True)
    os.remove(concat_list_path)
    return output_path
```

**3. Java实现（core-service）**

**Session实体扩展**：

```java
// core-service/.../entity/Session.java
@Entity
public class Session {
    // ... 现有字段

    // 用于跨chunk窗口支持
    @Column(name = "last_chunk_tail_path", length = 500)
    private String lastChunkTailPath;  // 上一个chunk的tail存储路径

    @Column(name = "last_chunk_tail_duration")
    private Integer lastChunkTailDuration;  // tail时长（秒）
}
```

**GrpcClientService扩展**：

```java
// core-service/.../service/GrpcClientService.java
public class GrpcClientService {
    // ... 现有方法

    public String extractTail(String videoPath, String outputPath, int duration) {
        ExtractTailRequest request = ExtractTailRequest.newBuilder()
                .setVideoPath(videoPath)
                .setOutputPath(outputPath)
                .setDuration(duration)
                .build();

        ExtractTailResponse response = blockingStub.extractTail(request);

        if (!response.getError().isEmpty()) {
            throw new GrpcException("ExtractTail failed: " + response.getError());
        }

        return response.getOutputPath();
    }

    public String concatVideos(List<String> videoPaths, String outputPath) {
        ConcatVideosRequest request = ConcatVideosRequest.newBuilder()
                .addAllVideoPaths(videoPaths)
                .setOutputPath(outputPath)
                .build();

        ConcatVideosResponse response = blockingStub.concatVideos(request);

        if (!response.getError().isEmpty()) {
            throw new GrpcException("ConcatVideos failed: " + response.getError());
        }

        return response.getOutputPath();
    }
}
```

**VideoProcessingService改造**：

```java
// core-service/.../service/VideoProcessingService.java
private void processSlidingWindowMode(Session session, VideoChunk chunk, String localPath) {
    StorageService storageService = storageServiceFactory.getStorageService(session.getStorageType());

    // 计算基准时间偏移
    int baseOffset = calculateAccumulatedDuration(session, chunk);

    // Step 0: 检查并拼接前一个chunk的tail
    String videoToProcess = localPath;
    boolean hasTailConcat = false;

    if (session.getLastChunkTailPath() != null && chunk.getChunkIndex() > 0) {
        try {
            // 下载tail到本地
            String tailLocalPath = tempPath + "/tail_" + (chunk.getChunkIndex() - 1) + ".webm";
            downloadFromStorage(session.getLastChunkTailPath(), tailLocalPath, storageService);

            // 拼接：[tail + current_chunk]
            String concatPath = tempPath + "/concat_" + chunk.getChunkIndex() + ".webm";
            videoToProcess = grpcClientService.concatVideos(
                    List.of(tailLocalPath, localPath),
                    concatPath
            );

            // 调整时间偏移（减去tail时长，因为tail与上一个chunk重叠）
            baseOffset -= session.getLastChunkTailDuration();
            hasTailConcat = true;

            log.info("Concatenated tail + chunk: adjusted baseOffset={}s", baseOffset);

            cleanupService.deleteLocalFile(tailLocalPath);
        } catch (Exception e) {
            log.error("Failed to concatenate tail: {}", e.getMessage());
            videoToProcess = localPath;  // 降级：使用原始chunk
            baseOffset = calculateAccumulatedDuration(session, chunk);
        }
    }

    // Step 1: 切片视频
    List<String> windowPaths = grpcClientService.processVideo(..., videoToProcess, ...);

    // Step 2-3: 分析窗口（正常流程）
    for (int i = 0; i < windowPaths.size(); i++) {
        int startOffset = baseOffset + (i * windowStep);
        int endOffset = startOffset + windowSize;
        // ... 分析逻辑
    }

    // Step 4: 提取并保存新的tail
    try {
        int tailDuration = windowSize - windowStep;

        // 从**原始chunk**提取tail（不是拼接后的）
        String tailLocalPath = tempPath + "/tail_" + chunk.getChunkIndex() + ".webm";
        grpcClientService.extractTail(localPath, tailLocalPath, tailDuration);

        // 上传tail到存储
        String tailStoragePath = "sessions/" + session.getId() +
                "/tail_" + chunk.getChunkIndex() + "_" + System.currentTimeMillis() + ".webm";
        storageService.uploadFile(tailLocalPath, tailStoragePath);

        // 删除旧tail
        if (session.getLastChunkTailPath() != null) {
            storageService.deleteObject(session.getLastChunkTailPath());
        }

        // 更新Session
        session.setLastChunkTailPath(tailStoragePath);
        session.setLastChunkTailDuration(tailDuration);

        log.info("Saved chunk tail: duration={}s, path={}", tailDuration, tailStoragePath);

        cleanupService.deleteLocalFile(tailLocalPath);
    } catch (Exception e) {
        log.error("Failed to save tail: {}", e.getMessage());
        // 非关键错误，继续处理
    }

    // 清理拼接文件
    if (hasTailConcat && !videoToProcess.equals(localPath)) {
        cleanupService.deleteLocalFile(videoToProcess);
    }
}

private void downloadFromStorage(String storagePath, String localPath, StorageService storage) {
    String url = storage.generatePublicUrl(storagePath);
    HttpClient client = HttpClient.newHttpClient();
    HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .GET()
            .build();

    HttpResponse<byte[]> response = client.send(request,
            HttpResponse.BodyHandlers.ofByteArray());

    if (response.statusCode() != 200) {
        throw new VideoProcessingException("Download failed: HTTP " + response.statusCode());
    }

    Files.createDirectories(Paths.get(localPath).getParent());
    Files.write(Paths.get(localPath), response.body());
}
```

---

### 5.4 关键设计决策

#### 1. Tail时长计算

```
tailDuration = windowSize - windowStep
```

**理由**：这是窗口之间的重叠量。例如：
- windowSize=15秒, windowStep=10秒
- 重叠量 = 15-10 = 5秒
- 因此tail需要保存最后5秒

**示例**：
```
chunk 0 的最后一个窗口: [20-35s]
tail: [30-35s] (最后5秒)
chunk 1 的第一个窗口: [30-45s]
                      ↑
                  与tail的起点对齐
```

#### 2. 时间偏移调整

```java
baseOffset -= session.getLastChunkTailDuration();
```

**理由**：拼接后的视频包含了上一个chunk的最后N秒，这部分时间已经在前一个chunk中计算过，需要减去避免重复计算。

**示例**：
```
chunk 0: 0-35s, baseOffset=0
chunk 1: 35-70s, baseOffset=35

拼接后: [tail(30-35) + chunk1(35-70)] = 30-70s
调整: baseOffset = 35 - 5 = 30s  ✓ 正确

第一个窗口: [30-45s]
  startOffset = 30 + 0×10 = 30s  ✓
  endOffset = 30 + 15 = 45s      ✓
```

#### 3. 从原始chunk提取tail

```java
// 从localPath提取tail，而不是从videoToProcess
grpcClientService.extractTail(localPath, tailLocalPath, tailDuration);
```

**理由**：
- `videoToProcess` 可能是拼接后的视频，包含了上一个chunk的tail
- 我们需要的是**当前chunk**的尾部
- 因此必须从原始的 `localPath` 提取

#### 4. 错误处理策略

所有tail相关操作都使用**graceful degradation**：

```java
try {
    // tail处理
} catch (Exception e) {
    log.error("Tail processing failed: {}", e.getMessage());
    // 继续处理，不影响主流程
}
```

**理由**：
- Tail优化是一个**增强功能**，不是核心功能
- 如果tail处理失败，系统应该降级到原始模式（无跨chunk窗口）
- 保证系统稳定性优先于功能完整性

---

### 5.5 存储管理

#### Tail生命周期

```
chunk 0 完成 → 上传 tail_0 到存储
chunk 1 完成 → 上传 tail_1，删除 tail_0
chunk 2 完成 → 上传 tail_2，删除 tail_1
...
session结束 → 删除最后一个tail
```

**存储路径**：
```
sessions/{sessionId}/tail_{chunkIndex}_{timestamp}.webm
```

**清理策略**：
1. 每次保存新tail时，删除上一个tail
2. Session结束时，清理最后一个tail
3. 定期清理孤儿tail（超过24小时的）

#### 存储成本估算

```
假设：
- windowSize=15s, windowStep=10s → tail=5秒
- 视频码率: 1Mbps
- tail大小: 5秒 × 1Mbps = 625KB

每个session同时只保存1个tail，存储开销极小。
100个并发session: 100 × 625KB = 62.5MB
```

**结论**：存储成本可以忽略不计。

---

### 5.6 性能影响

#### 额外开销分析

**Per chunk额外操作**：
1. 下载tail (625KB): ~200ms
2. 拼接视频 (FFmpeg): ~500ms
3. 提取tail (FFmpeg): ~300ms
4. 上传tail (625KB): ~200ms

**总计**: ~1.2秒

**对比**：
- AI分析时间: 30-60秒/窗口
- 额外开销占比: 1.2 / 30 = **4%**

**结论**：性能影响很小，完全可接受。

#### FFmpeg优化

使用 `-c copy` 避免重新编码：

```bash
# 拼接（stream copy模式）
ffmpeg -f concat -safe 0 -i list.txt -c copy output.webm

# 提取（stream copy模式）
ffmpeg -ss 30 -i input.webm -t 5 -c copy tail.webm
```

**效果**：
- ✅ 无需重新编码，速度极快
- ✅ 无质量损失
- ✅ CPU使用率低

---

### 5.7 测试验证

#### 测试场景

**场景1：基本跨chunk窗口**

```
配置：windowSize=15s, windowStep=10s, chunk=35s

chunk 0 (0-35s):
  windows: [0-15, 10-25, 20-35]
  tail: [30-35s]

chunk 1 (35-70s):
  concat: [30-35 + 35-70] = [30-70s]
  windows: [30-45, 40-55, 50-65, 60-70]
           ↑
     跨chunk窗口

验证点：
✓ [30-45s] 窗口成功生成
✓ 时间戳准确（startOffset=30s）
✓ 覆盖了35秒边界
```

**场景2：多chunk连续**

```
chunk 0, 1, 2, 3 连续处理
验证点：
✓ 每个chunk边界都有跨chunk窗口
✓ 时间轴连续无断层
✓ 旧tail被正确清理
```

**场景3：Tail处理失败降级**

```
模拟tail下载失败

预期行为：
✓ 系统继续处理，不崩溃
✓ 使用原始chunk（无拼接）
✓ 日志记录错误但不影响主流程
```

---

### 5.8 未来优化方向

#### 方案3：全局窗口计算（长期）

如果需要更优的性能，可以考虑方案3：

```
前端持续上传chunks → 后端缓存
定期触发全局切片：
  concat(chunk_0 + chunk_1 + chunk_2 + ...) → 完整视频
  全局切片: [0-15, 10-25, 20-35, 30-45, ...]
```

**优点**：
- 完全无断层
- 可以实现任意窗口策略

**缺点**：
- 需要缓存所有chunks（内存/存储开销大）
- 延迟高（需要等待多个chunks）
- 实时性差

**适用场景**：
- 离线批处理模式
- 对实时性要求不高的场景

---

### 5.9 相关文档

- `doc/滑动窗口修复总结.md` - 窗口参数优化历史
- `proto/video_analysis.proto` - gRPC接口定义
- `ai-service/video_processor.py` - FFmpeg视频处理
- `core-service/.../VideoProcessingService.java` - 主处理流程

---

## 6. 监控与可观测性

### 6.1 关键指标

```yaml
指标体系：
  业务指标：
    - 录制会话数
    - 视频上传成功率
    - AI分析成功率
    - 平均分析时长

  性能指标：
    - API响应时间（P50/P95/P99）
    - 磁盘IO吞吐量
    - 网络带宽使用
    - CPU/内存使用率

  资源指标：
    - MinIO存储空间
    - PostgreSQL连接数
    - gRPC连接数
    - 队列积压数
```

### 6.2 监控实现

#### Prometheus + Grafana

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

#### Spring Boot Metrics

```java
// core-service
@Configuration
public class MetricsConfig {

    @Bean
    public MeterRegistry meterRegistry() {
        return new SimpleMeterRegistry();
    }

    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }
}

// 使用
@Timed(value = "video.upload", description = "Video upload time")
public void uploadVideo(MultipartFile file) {
    // ...
}
```

---

## 7. 成本优化

### 7.1 AI API成本

#### 当前成本模型
```
qwen API定价（示例）：
- 输入token: ¥0.01/1K tokens
- 输出token: ¥0.02/1K tokens

视频分析（30秒视频）：
- 输入: ~1000 tokens（视频+prompt）
- 输出: ~500 tokens（分析结果）
- 单次成本: ¥0.02

半实时模式（3个窗口）：
- 成本: ¥0.02 × 3 = ¥0.06/分钟视频

月成本估算（1000用户，每人10分钟/月）：
- ¥0.06 × 10 × 1000 = ¥600/月
```

#### 优化方向

**1. 批量调用折扣**
与AI服务商谈判批量折扣。

**2. 模型降级**
```yaml
# 非关键场景使用更便宜的模型
skiuo:
  ai:
    models:
      primary: qwen-vl-max    # 高质量，贵
      fallback: qwen-vl-plus  # 中等质量，便宜50%

    # 策略：工作日用primary，周末用fallback
    cost-optimization: true
```

**3. 缓存结果**
```java
// 相似视频直接返回缓存结果
@Cacheable(value = "videoAnalysis", key = "#videoHash")
public AnalysisResult analyze(String videoHash, String videoUrl) {
    // ...
}
```

**4. 智能采样**
```
不是所有窗口都需要分析：
- 静止画面跳过
- 重复场景跳过
- 只分析变化的部分
```

---

### 7.2 存储成本

#### MinIO存储成本

```
假设每个视频5MB，keep_video=false：
- 临时存储：最多1小时
- 成本：几乎为0（本地存储）

假设keep_video=true，保留7天：
- 每用户10分钟/天 × 7天 = 70分钟
- 70分钟 ÷ 30秒 = 140个片段
- 140 × 5MB × 3窗口 = 2.1GB/用户
- 1000用户 = 2.1TB
- MinIO本地存储成本：SSD约¥1000/TB，约¥2100
```

#### 优化方向

**1. 对象存储生命周期**
```yaml
# MinIO lifecycle规则
{
  "Rules": [{
    "ID": "DeleteAfter7Days",
    "Status": "Enabled",
    "Expiration": {
      "Days": 7
    }
  }]
}
```

**2. 冷热分离**
```
热数据（<7天）：本地SSD
冷数据（>7天）：云端OSS（更便宜）
```

**3. 压缩存储**
```bash
# 存储前压缩
gzip video.webm → video.webm.gz
# 节省50-70%空间
```

---

## 8. 实施优先级

### 优先级矩阵

| 优化项 | 收益 | 成本 | 优先级 | 触发条件 |
|--------|------|------|--------|----------|
| tmpfs | 低 | 极低 | P3 | 磁盘IOPS瓶颈 |
| 分布式部署 | 高 | 高 | P2 | 单机性能不足 |
| AI并发调用 | 中 | 低 | P2 | 需要多模型对比 |
| 本地AI模型 | 高 | 极高 | P3 | 成本/隐私需求 |
| 视频预处理 | 中 | 中 | P3 | 视频质量差 |
| 智能切片 | 中 | 高 | P4 | 分析质量不满意 |
| 监控系统 | 高 | 低 | P1 | 上线前必须 |
| 成本优化 | 中 | 低 | P2 | API费用超预算 |

### 实施路线图

```
阶段1（MVP上线前）：
├─ 基础监控（Prometheus + Grafana）
└─ 基本告警

阶段2（运行3个月后）：
├─ 分析实际瓶颈
├─ 基于数据决策优化方向
└─ 可能：tmpfs / 成本优化

阶段3（用户量增长）：
├─ 分布式部署
├─ 高可用改造
└─ 负载均衡

阶段4（长期）：
├─ 本地AI模型（如果成本高）
├─ 智能切片（如果质量不满意）
└─ 视频预处理（如果需要）
```

---

## 9. 决策指南

### 何时优化IO？

```
if 磁盘IOPS > 80% AND 磁盘延迟 > 100ms:
    检查/tmp是否tmpfs
    if not tmpfs:
        挂载tmpfs
    else:
        升级SSD
else:
    不优化
```

### 何时分布式部署？

```
if CPU使用率 > 80% OR 内存使用率 > 80%:
    if 可以垂直扩展（升级机器）:
        垂直扩展
    else:
        水平扩展（分布式）
else:
    单机够用
```

### 何时使用本地AI模型？

```
if API月成本 > GPU服务器月成本:
    考虑本地部署
else if 有严格的数据隐私要求:
    必须本地部署
else:
    继续用API（简单可靠）
```

---

## 总结

### 核心原则
1. **避免过早优化**：先实现功能，再优化性能
2. **基于数据决策**：监控先行，基于实际瓶颈优化
3. **渐进式改进**：小步快跑，每次优化一个点

### 优化顺序
```
1. 监控系统（P1）
   ↓
2. 发现瓶颈
   ↓
3. 针对性优化
   ├─ AI慢 → 并发/换模型
   ├─ 网络慢 → 带宽/压缩
   ├─ 磁盘慢 → tmpfs/SSD
   └─ 单机限制 → 分布式
```

### 不建议做的
- ❌ 现在就上全内存流传递（复杂度高，收益小）
- ❌ 现在就分布式部署（单机够用）
- ❌ 现在就本地AI模型（成本未知）

### 建议做的
- ✅ 先上线基础功能
- ✅ 部署监控系统
- ✅ 跑3个月收集数据
- ✅ 基于数据决策优化方向
