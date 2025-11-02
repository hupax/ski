# 未来功能扩展

本文档记录计划中但暂未实现的功能增强。

## 1. 时间节点信息传递（优先级：中）

### 需求描述

在半实时分析模式中，提示词应该告诉AI当前分析的视频片段在整体视频中的时间节点，以及之前分析内容的时间范围。

### 期望效果

**当前提示词**：
```
之前已分析的内容：
用户打开了浏览器...
```

**改进后提示词**：
```
之前已分析 0-15秒 的内容：
用户打开了浏览器...

你正在分析 10-25秒 的片段（时长15秒）
```

### 实现方案

#### 方案概述
在 gRPC `AnalysisRequest` 中添加上一个窗口的时间信息，让AI明确知道：
1. 当前窗口的时间范围（已有：start_offset, end_offset）
2. 上一个窗口的时间范围（需添加：prev_start_offset, prev_end_offset）

#### 技术实现

**1. 修改 Proto 定义**

```protobuf
message AnalysisRequest {
  string session_id = 1;
  int32 window_index = 2;
  string video_url = 3;
  string ai_model = 4;
  string context = 5;
  int32 start_offset = 6;          // 当前窗口开始时间
  int32 end_offset = 7;            // 当前窗口结束时间
  int32 prev_start_offset = 8;     // 上一个窗口开始时间（首窗口为0）
  int32 prev_end_offset = 9;       // 上一个窗口结束时间（首窗口为0）
}
```

**2. 修改 core-service (Java)**

在 `VideoProcessingService.java` 中维护上一个窗口的时间：

```java
// 分析窗口循环
double prevStartTime = 0.0;
double prevEndTime = 0.0;

for (WindowInfo window : windows) {
    double currentStart = window.getStartTime();
    double currentEnd = window.getEndTime();

    // 调用分析，传递当前和上一个窗口时间
    grpcClientService.analyzeVideo(
        sessionId,
        windowIndex,
        videoUrl,
        aiModel,
        context,
        currentStart,      // start_offset
        currentEnd,        // end_offset
        prevStartTime,     // prev_start_offset
        prevEndTime        // prev_end_offset
    );

    // 分析完成后，更新 prev 时间供下次使用
    prevStartTime = currentStart;
    prevEndTime = currentEnd;

    windowIndex++;
}
```

**3. 修改 GrpcClientService.java**

添加 prev 时间参数：

```java
public CompletableFuture<String> analyzeVideo(
    String sessionId,
    int windowIndex,
    String videoUrl,
    String aiModel,
    String context,
    Double startOffset,
    Double endOffset,
    Double prevStartOffset,   // 新增
    Double prevEndOffset,     // 新增
    Consumer<String> onChunk
) {
    AnalysisRequest request = AnalysisRequest.newBuilder()
        .setSessionId(sessionId)
        .setWindowIndex(windowIndex)
        .setVideoUrl(videoUrl)
        .setAiModel(aiModel)
        .setContext(context)
        .setStartOffset(startOffset.intValue())
        .setEndOffset(endOffset.intValue())
        .setPrevStartOffset(prevStartOffset.intValue())  // 新增
        .setPrevEndOffset(prevEndOffset.intValue())      // 新增
        .build();

    // ... 其余逻辑
}
```

**4. 修改 ai-service (Python)**

在 `grpc_server.py` 中接收并传递参数：

```python
def AnalyzeVideo(self, request, context):
    start_time = float(request.start_offset)
    end_time = float(request.end_offset)
    prev_start_time = float(request.prev_start_offset)  # 新增
    prev_end_time = float(request.prev_end_offset)      # 新增

    # 传递给 analyzer
    async for content_chunk in analyzer.analyze_video(
        video_url=video_url,
        context=context_text,
        session_id=session_id,
        window_index=window_index,
        start_time=start_time,
        end_time=end_time,
        prev_start_time=prev_start_time,   # 新增
        prev_end_time=prev_end_time        # 新增
    ):
        # ...
```

**5. 更新提示词模板**

`base_prompts.py` 中的提示词已经支持时间变量：

```python
SUBSEQUENT_WINDOW_PROMPT_ZH = """你正在分析视频的 **{start_time}-{end_time}秒** 片段。

**前置上下文**（之前已分析 {prev_start_time}-{prev_end_time}秒 的内容）：
{context}

**重要说明**：
- 当前片段（{start_time}-{end_time}秒）与前文（{prev_start_time}-{prev_end_time}秒）有{overlap}秒重叠
- 重点描述当前时段的新动作和变化，避免重复前文
...
```

**6. 重新生成 Proto 代码**

修改 proto 后需要重新生成：

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

### 实现挑战

1. **窗口大小不固定**：不能假设每个窗口时长相同（最后一个窗口可能更短）
2. **状态管理**：必须在 core-service 端维护状态，不能在 ai-service 用全局字典（gRPC无状态、并发问题）
3. **类型转换**：Java Double ↔ Proto int32 ↔ Python float 的转换需谨慎
4. **首窗口特殊处理**：第一个窗口的 prev 时间为 0

### 优先级评估

- **影响范围**：AI分析质量提升（提供更精确的时间上下文）
- **实现复杂度**：中等（需改proto、Java、Python三处）
- **收益**：提升AI对时间连续性的理解，减少时间混淆
- **风险**：proto修改需要协调前后端重新生成代码

### 当前状态

**暂不实现**，原因：
- 现有提示词已经通过 context 传递前文内容，基本满足需求
- 时间信息可以在后续迭代中补充，不影响核心功能
- 避免过早优化，先验证基础分析效果

---

## 其他计划功能

### 2. 分析结果后处理

- 自动摘要生成
- 关键帧提取
- 时间戳标注

### 3. 多模型对比

- 同时调用多个AI模型分析
- 结果对比和融合

### 4. 实时反馈机制

- 用户可标记错误片段
- 重新分析特定时间段
