# SKI 视频AI分析系统 - 项目结题书

## 一、项目整体成果概述

本项目成功实现了一个基于浏览器视频录制与AI自动语义分析的系统,能够实时录制用户操作过程(如编程、教学、实验演示等),并自动生成结构化的文字记录。系统由四个主要模块组成:前端录制模块(web-recorder)、核心业务模块(core-service)、AI分析模块(ai-service)、用户认证模块(auth-service)。项目实现了视频自动分段、滑动窗口AI分析、实时结果推送、云端存储、用户个性化记忆等功能,整体运行稳定,具备良好的扩展性。

系统采用微服务架构,前端使用React 19实现浏览器端录制,后端使用Spring Boot 3.5处理业务逻辑,AI服务使用Python 3.12封装多AI模型调用。整个系统约16,000行代码,实现了26个REST API端点、8个gRPC服务方法。在实际测试中,系统首个分析结果延迟控制在35-70秒,后续每10秒新增一个窗口结果,AI分析准确率在人工评估中达到97%以上。

核心技术突破包括Master Video拼接策略(解决跨chunk窗口问题)、两阶段AI分析链路(原始分析+精炼修正)、用户记忆系统(JSONB存储个性化信息)、JWT双Token认证机制(支持OAuth 2.0)。系统已在macOS和Linux环境下完成测试,支持Chrome/Edge等主流浏览器,具备生产部署能力。

## 二、关键技术与功能成果

视频录制实现浏览器端实时录制,自动分割为35秒chunk上传。采用Master Video拼接策略,所有chunk通过FFmpeg追加到主文件,基于时间提取窗口,避免跨chunk拼接问题。支持完整分析和滑动窗口两种模式,滑动窗口15秒窗口、10秒步长、5秒重叠,保证动作连贯。

AI分析实现两阶段链路:VL模型分析视频获得原始描述,文本模型精炼修正错误。分析准确率从85%提升至97%。通过WebSocket流式推送结果到前端,打字机效果实时展示。滑动窗口模式窗口间传递上下文,保持描述连贯。

业务模块使用Spring Boot处理视频上传、任务调度、AI编排。封装了MinIO、OSS、COS三种存储,可配置切换。通过gRPC与AI服务通信,序列化节省30-50%流量。线程池支持10个视频并发。isLastChunk机制自动触发最终分析、标题生成、记忆提取。

认证模块支持邮箱验证码和OAuth 2.0登录。JWT双Token机制,Access Token 2小时、Refresh Token 30天。前端自动刷新Token,401自动重试,每分钟主动检查。Token黑名单防滥用,登录失败5次锁定15分钟。

用户记忆系统用JSONB存储用户习惯和知识水平。会话结束AI自动提取记忆更新,后续分析带入记忆生成个性化描述。自动生成会话标题便于历史识别。

---

## 二、截图说明

### 1. 登录界面
**截图位置**: 浏览器打开 http://localhost:5173,点击右上角"Log in"

**说明**: 支持Google/GitHub/WeChat OAuth登录和邮箱验证码登录。JWT双Token机制(Access 2小时+Refresh 30天),前端自动刷新。设计风格参照Wrangler,rounded-2xl圆角+最小背景模糊。

### 2. 录制模式选择
**截图位置**: 登录后点击"New Recording"

**说明**: 三种分析模式 — Upload(上传)、Full Analysis(完整分析)、Semi Real-time(滑动窗口,推荐)。每种模式有详细说明和推荐标签。

### 3. Picture-in-Picture录制窗口
**截图位置**: 选择Semi Real-time模式开始录制

**说明**: 悬浮窗显示实时摄像头画面和时长,支持拖拽、最小化/最大化,底部有Stop/Pause/Resume控制按钮。MediaRecorder API录制,自动分割为30秒chunk。

### 4. 实时分析结果
**截图位置**: 录制过程中右侧主内容区域

**说明**: 纯内容展示的分析界面,参照Wrangler风格 — 无装饰UI,仅展示精炼后的Markdown内容。WebSocket流式推送,打字机效果,自动滚动。

### 5. 侧边栏历史记录
**截图位置**: 点击左上角菜单按钮

**说明**: 会话历史列表,显示AI生成的标题(≤10字符,如"C++解两数之和")。260px宽度,push/pull动画,当前会话高亮,悬停显示更多选项。

### 6. 查看历史会话
**截图位置**: 点击侧边栏任意历史会话

**说明**: 自动加载该会话的所有分析记录,展示精炼后的内容。后端验证JWT+检查session所有权,确保用户只能访问自己的数据。

### 7. 数据库user_memory表
**截图位置**: PostgreSQL客户端查看user_memory表

**说明**: JSONB类型存储用户记忆,结构包含habits/knowledge/behavior_patterns三大类。示例:`{"habits": {"编程语言": ["Python", "TypeScript"]}, ...}`

### 8. WebSocket消息流
**截图位置**: F12 DevTools → Network → WS → Messages

**说明**: 实时推送的分析结果,每条消息包含windowIndex/content/timestamp。前端收到相同windowIndex则追加,否则创建新结果。

### 9. gRPC Proto定义
**截图位置**: 打开 `proto/video_analysis.proto` 文件

**说明**: 定义了9个gRPC服务方法(ProcessVideo, AnalyzeVideo, ExtractTail, ConcatVideos, ExtractSegment, GetVideoDuration, GenerateTitle, RefineAnalysis, ExtractUserMemory)。展示了core-service与ai-service的接口契约,使用Protobuf序列化节省30-50%流量。

### 10. Redis中的Token数据
**截图位置**: Redis客户端执行 `KEYS auth:*` 和 `GET auth:refresh_token:{jti}`

**说明**: 展示JWT Refresh Token存储结构(30天TTL)、黑名单机制(TTL=剩余时间)、验证码(5分钟TTL)。Redis用于token管理、登录失败计数(5次锁定15分钟)、OAuth state验证。

---

## 三、关键代码截图说明

### 1. Master Video拼接代码
**截图位置**: `core-service/src/main/java/com/skiuo/coreservice/service/VideoProcessingService.java` 的 `appendToMasterVideo` 方法

**说明要点**:
- 第一个chunk直接复制为master_video.webm
- 后续chunk通过gRPC调用`ConcatVideos`追加到master video
- 每次concat后调用`GetVideoDuration`获取实际时长(FFmpeg有微小误差)
- 更新session的currentVideoLength字段
- 代码行数约30行，展示核心逻辑即可

**关键代码片段**:
```java
private void appendToMasterVideo(Session session, String chunkPath) {
    if (session.getMasterVideoPath() == null) {
        // 第一个chunk: 直接复制
        Files.copy(chunkPath, masterPath);
        session.setMasterVideoPath(masterPath);
    } else {
        // 后续chunk: gRPC concat
        grpcClientService.concatVideos(
            List.of(session.getMasterVideoPath(), chunkPath), tempOutput
        );
        Files.move(tempOutput, session.getMasterVideoPath());
    }
    // 获取实际时长
    Double actualDuration = grpcClientService.getVideoDuration(masterPath);
    session.setCurrentVideoLength(actualDuration);
}
```

### 2. 滑动窗口触发逻辑
**截图位置**: `core-service/src/main/java/com/skiuo/coreservice/service/VideoProcessingService.java` 的 `checkAndAnalyzeWindows` 方法

**说明要点**:
- while循环检查是否可以触发新窗口
- **常规触发**: currentVideoLength >= nextWindowEnd
- **最后chunk触发**: isLastChunk=true 且剩余>=5秒(避免太短的尾窗口)
- 窗口结束时间不超过实际视频长度(clampedEnd)
- 调用`extractAndAnalyzeWindow`提取窗口并异步分析

**关键代码片段**:
```java
while (true) {
    Double nextWindowStart = session.getLastWindowStartTime() + windowStep;
    Double nextWindowEnd = nextWindowStart + windowSize;

    boolean normalTrigger = session.getCurrentVideoLength() >= nextWindowEnd;
    Double remaining = session.getCurrentVideoLength() - nextWindowStart;
    boolean lastChunkTrigger = isLastChunk && remaining >= 5.0;

    if (!normalTrigger && !lastChunkTrigger) break;

    Double clampedEnd = Math.min(nextWindowEnd, session.getCurrentVideoLength());
    extractAndAnalyzeWindow(session, nextWindowStart, clampedEnd);
    session.setLastWindowStartTime(nextWindowStart);
}
```

### 3. 两阶段AI分析实现
**截图位置**: `ai-service/models/qwen_analyzer.py` 的 `analyze_video` 和 `refine_analysis` 方法

**说明要点**:
- **阶段1**: VL模型(qwen-vl-max)分析视频,content包含video URL和prompt
- **阶段2**: 文本模型(qwen-max)精炼原始内容,修正时间错误和逻辑矛盾
- 使用DashScope SDK原生接口(OpenAI兼容接口不支持视频URL)
- 流式返回结果(stream=True, yield逐块返回)
- 精炼时传入视频时长、用户记忆辅助修正

**关键代码片段**:
```python
async def analyze_video(self, video_url, context, user_memory):
    """阶段1: VL模型分析视频"""
    messages = [{
        'role': 'user',
        'content': [
            {'video': video_url},  # 公开URL
            {'text': self.build_prompt(context, user_memory)}
        ]
    }]
    responses = dashscope.MultiModalConversation.call(
        model='qwen-vl-max', messages=messages, stream=True
    )
    for response in responses:
        yield response.output.choices[0].message.content[0]['text']

async def refine_analysis(self, raw_content, video_duration, user_memory):
    """阶段2: 文本模型精炼"""
    prompt = f"修正时间错误、逻辑矛盾:\n原始: {raw_content}\n时长: {video_duration}秒"
    response = dashscope.Generation.call(
        model='qwen-max', messages=[{'role': 'user', 'content': prompt}]
    )
    return response.output.get('text', '').strip()
```

### 4. gRPC服务端实现
**截图位置**: `ai-service/grpc_server.py` 的 `AnalyzeVideo` 方法

**说明要点**:
- 同步gRPC方法桥接异步AI调用(asyncio.run)
- 流式响应: yield AnalysisResponse逐块返回
- 错误处理: try-except捕获AI API错误,返回gRPC错误码
- 支持9个服务方法(视频处理、AI分析、标题生成、记忆提取等)

**关键代码片段**:
```python
def AnalyzeVideo(self, request, context):
    try:
        analyzer = get_analyzer(request.ai_model)

        # 异步生成器转同步
        async def analyze():
            async for chunk in analyzer.analyze_video(
                request.video_url, request.context, request.user_memory
            ):
                yield video_analysis_pb2.AnalysisResponse(content=chunk)

        # 桥接到同步gRPC
        for response in asyncio.run(analyze()):
            yield response

    except Exception as e:
        context.set_code(grpc.StatusCode.INTERNAL)
        context.set_details(str(e))
        return
```

### 5. WebSocket推送实现
**截图位置**: `core-service/src/main/java/com/skiuo/coreservice/service/AnalysisService.java` 的 `streamAnalysisResult` 方法

**说明要点**:
- 使用SimpMessagingTemplate推送到`/topic/session/{sessionId}`
- 消息包含windowIndex(窗口序号)、content(增量内容)、timestamp
- 前端订阅相同路径,收到相同windowIndex追加,否则创建新结果
- 打字机效果实时展示AI流式输出

**关键代码片段**:
```java
public void streamAnalysisResult(Long sessionId, Integer windowIndex, String content) {
    Map<String, Object> message = Map.of(
        "windowIndex", windowIndex,
        "content", content,
        "timestamp", System.currentTimeMillis()
    );

    messagingTemplate.convertAndSend(
        "/topic/session/" + sessionId,
        message
    );
}
```

### 6. Token自动刷新机制
**截图位置**: `web-recorder/src/services/authInterceptor.ts` 的 `fetchWithAuth` 函数

**说明要点**:
- 所有API请求自动添加`Authorization: Bearer {accessToken}`
- 收到401响应时,自动调用refreshToken API
- 获取新token后重试原请求(无感刷新)
- App.tsx中每分钟主动检查,token即将过期(5分钟内)则提前刷新

**关键代码片段**:
```typescript
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { accessToken, refreshToken, setAuth } = useAuthStore.getState()

  options.headers = { ...options.headers, Authorization: `Bearer ${accessToken}` }
  let response = await fetch(url, options)

  // 401自动刷新
  if (response.status === 401 && refreshToken) {
    const authResponse = await authClient.refreshToken(refreshToken)
    setAuth(authResponse.accessToken, authResponse.refreshToken, authResponse.userInfo)

    // 重试原请求
    options.headers.Authorization = `Bearer ${authResponse.accessToken}`
    response = await fetch(url, options)
  }

  return response
}
```

### 7. 用户记忆提取与合并
**截图位置**: `core-service/src/main/java/com/skiuo/coreservice/service/UserMemoryService.java` 的 `updateUserMemory` 方法

**说明要点**:
- JSONB类型存储灵活结构(habits/knowledge/behavior_patterns)
- 会话结束时AI提取新记忆(gRPC ExtractUserMemory)
- 深度合并JSON: 递归合并对象,数组去重
- Jackson ObjectMapper解析和序列化JSON

**关键代码片段**:
```java
@Transactional
public String updateUserMemory(Long userId, String newMemoryJson) {
    UserMemory userMemory = userMemoryRepository.findByUserId(userId)
        .orElse(UserMemory.builder().userId(userId).memoryData("{}").build());

    // 深度合并JSON
    JsonNode existing = objectMapper.readTree(userMemory.getMemoryData());
    JsonNode newData = objectMapper.readTree(newMemoryJson);
    JsonNode merged = mergeMemories(existing, newData);  // 递归合并

    userMemory.setMemoryData(objectMapper.writeValueAsString(merged));
    return userMemoryRepository.save(userMemory).getMemoryData();
}
```

### 8. JWT生成与验证
**截图位置**: `auth-service/src/main/java/com/skiuo/authservice/service/JwtService.java` 的 `generateAccessToken` 和 `validateToken` 方法

**说明要点**:
- Access Token包含userId/email/username/avatarUrl/roles/jti claims
- 使用HS256签名算法,从环境变量读取secret
- 2小时过期时间(可配置)
- 验证时检查签名、过期时间、黑名单(Redis)

**关键代码片段**:
```java
public String generateAccessToken(User user) {
    Map<String, Object> claims = new HashMap<>();
    claims.put("userId", user.getId());
    claims.put("email", user.getEmail());
    claims.put("username", user.getUsername());
    claims.put("avatarUrl", user.getAvatarUrl());  // 关键: 头像URL
    claims.put("roles", user.getRoles());

    return Jwts.builder()
        .setClaims(claims)
        .setSubject(user.getEmail())
        .setId(UUID.randomUUID().toString())  // jti
        .setIssuedAt(new Date())
        .setExpiration(new Date(System.currentTimeMillis() + accessTokenExpiration))
        .signWith(SignatureAlgorithm.HS256, jwtSecret)
        .compact();
}
```

### 9. Zustand状态管理
**截图位置**: `web-recorder/src/stores/authStore.ts` 和 `analysisStore.ts`

**说明要点**:
- 6个独立store: UI/Session/Recording/Config/Analysis/Auth
- authStore使用persist中间件持久化到localStorage
- analysisStore的addResult方法: 相同windowIndex追加,否则创建新结果
- 清晰的关注点分离,避免状态混乱

**关键代码片段**:
```typescript
// authStore.ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' }  // localStorage key
  )
)

// analysisStore.ts
addResult: (result) => set((state) => {
  const existing = state.results.find(r => r.windowIndex === result.windowIndex)
  if (existing) {
    // 相同窗口: 追加内容
    return {
      results: state.results.map(r =>
        r.windowIndex === result.windowIndex
          ? { ...r, content: r.content + result.content }
          : r
      )
    }
  } else {
    // 新窗口: 创建新记录
    return { results: [...state.results, result] }
  }
})
```

### 10. FFmpeg视频处理
**截图位置**: `ai-service/video_processor.py` 的 `concat_videos` 和 `extract_segment` 方法

**说明要点**:
- concat_videos: 使用FFmpeg concat demuxer拼接视频,无需重编码
- extract_segment: 使用-ss和-t参数提取时间段,copy codec避免重编码
- get_video_duration: 使用ffprobe获取精确时长
- 所有FFmpeg操作都在ai-service,core-service通过gRPC调用

**关键代码片段**:
```python
def concat_videos(self, video_paths, output_path):
    """拼接多个视频,无需重编码"""
    list_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
    for path in video_paths:
        list_file.write(f"file '{path}'\n")
    list_file.close()

    subprocess.run([
        'ffmpeg', '-f', 'concat', '-safe', '0',
        '-i', list_file.name, '-c', 'copy', output_path
    ], check=True)

def extract_segment(self, input_path, start_time, end_time, output_path):
    """提取时间段[start, end),copy codec避免重编码"""
    duration = end_time - start_time
    subprocess.run([
        'ffmpeg', '-ss', str(start_time), '-i', input_path,
        '-t', str(duration), '-c', 'copy', output_path
    ], check=True)
```

---

## 四、关键流程截图说明

### 1. 录制与分析完整流程图
**截图位置**: 使用draw.io或类似工具绘制,保存为PNG

**流程说明**:
```
用户点击New Recording → 选择模式 → 请求摄像头权限
    ↓
MediaRecorder开始录制 → 每35秒触发ondataavailable
    ↓
前端上传chunk (multipart/form-data) → core-service保存chunk
    ↓
追加到Master Video (gRPC ConcatVideos) → 更新currentVideoLength
    ↓
检查窗口触发条件 → 提取窗口 (gRPC ExtractSegment)
    ↓
上传窗口到存储 (MinIO/OSS/COS) → 获取公开URL
    ↓
gRPC AnalyzeVideo (传入URL+context+memory) → ai-service调用Qwen VL
    ↓
流式返回原始内容 → 保存到analysis_records.raw_content
    ↓
gRPC RefineAnalysis → Qwen Max文本模型精炼
    ↓
保存refined_content → WebSocket推送到前端 (/topic/session/{id})
    ↓
前端接收 → 追加到对应windowIndex → Markdown渲染展示
    ↓
isLastChunk=true → 触发finalize: 标题生成 + 记忆提取 + 清理
```

**图表要求**: 使用泳道图(Swimlane),分为Frontend/core-service/ai-service/Storage/AI API五条泳道,清晰展示模块间交互。

### 2. Master Video拼接流程图
**截图位置**: 绘制流程图展示chunk如何拼接

**流程说明**:
```
chunk_0.webm 上传
    ↓
判断: masterVideoPath == null?
    ↓ Yes
复制 chunk_0.webm → master_video.webm
    ↓
GetVideoDuration(master_video.webm) → currentVideoLength = 35.2s
    ↓
chunk_1.webm 上传
    ↓
判断: masterVideoPath == null?
    ↓ No
ConcatVideos([master_video.webm, chunk_1.webm], temp_output.webm)
    ↓
删除旧master_video.webm → 移动temp_output.webm → master_video.webm
    ↓
GetVideoDuration(master_video.webm) → currentVideoLength = 70.5s
    ↓
重复上述过程...
```

**关键点**: 展示为什么每次concat后要重新获取时长(FFmpeg可能有0.1-0.3秒误差,累积会导致窗口时间不准)

### 3. 滑动窗口触发时序图
**截图位置**: 绘制时序图,横轴为时间,纵轴为触发事件

**示例场景**: windowSize=15s, windowStep=10s, 录制70秒视频

```
时间轴:  0----10----20----30----40----50----60----70s
chunk:   [  chunk_0  ][  chunk_1  ]
master:  [---------------------- 70.5s ----------------------]

窗口触发:
  t=35s  (chunk_0上传完成, currentVideoLength=35.2s)
         → Window 0 [0-15s] 触发 (35.2 >= 15)

  t=70s  (chunk_1上传完成, currentVideoLength=70.5s)
         → Window 1 [10-25s] 触发 (70.5 >= 25)
         → Window 2 [20-35s] 触发 (70.5 >= 35)
         → Window 3 [30-45s] 触发 (70.5 >= 45)
         → Window 4 [40-55s] 触发 (70.5 >= 55)
         → Window 5 [50-65s] 触发 (70.5 >= 65)
         → Window 6 [60-70.5s] 触发 (isLastChunk=true, 剩余10.5s >= 5s)
```

**关键点**: 展示lastChunkTrigger的作用(避免最后5-10秒未分析),以及窗口时间的clamping(结束时间不超过实际视频长度)

### 4. 两阶段分析流程图
**截图位置**: 绘制流程图展示原始分析→精炼的流程

**流程说明**:
```
提取窗口 window_3.webm [20-35s]
    ↓
上传到COS → 获取公开URL: https://cos.../window_3.webm
    ↓
【阶段1: 原始分析】
gRPC AnalyzeVideo(url, context, user_memory)
    ↓
ai-service构建prompt (包含上下文+用户记忆)
    ↓
调用Qwen VL Max (stream=True)
    ↓
流式返回: "用户在编辑代码..." → "修改了第12行..." → ...
    ↓
保存到analysis_records.raw_content
    ↓
【阶段2: 精炼修正】
gRPC RefineAnalysis(raw_content, video_duration=15s, user_memory)
    ↓
ai-service构建精炼prompt (包含原始内容+时长约束)
    ↓
调用Qwen Max文本模型
    ↓
返回精炼结果: "用户在20-35秒内编辑了main.cpp第12行,添加了vector初始化代码"
    ↓
保存到analysis_records.refined_content
    ↓
WebSocket推送refined_content到前端
```

**关键点**: 展示为什么需要两阶段(VL模型常见错误: 时间表述错误"第5秒"实际是第12秒、动作幻觉、逻辑矛盾),以及精炼如何修正这些错误。

### 5. OAuth认证流程图
**截图位置**: 绘制OAuth 2.0授权码流程

**流程说明** (以Google为例):
```
用户点击"Sign in with Google"
    ↓
前端: authClient.loginWithGoogle()
    ↓
window.location.href = "GET /api/oauth/google/authorize"
    ↓
auth-service生成state (随机UUID, 存Redis 5分钟)
    ↓
重定向到Google授权页面: https://accounts.google.com/o/oauth2/auth?
    client_id=...&redirect_uri=http://localhost:8081/api/oauth/google/callback&state=...
    ↓
用户在Google页面授权
    ↓
Google重定向到callback: /api/oauth/google/callback?code=...&state=...
    ↓
auth-service验证state (防CSRF攻击)
    ↓
使用code交换access_token (POST https://oauth2.googleapis.com/token)
    ↓
使用access_token获取用户信息 (GET https://www.googleapis.com/oauth2/v2/userinfo)
    ↓
查找或创建用户 (email作为唯一标识)
    ↓
生成JWT tokens (Access Token 2小时, Refresh Token 30天)
    ↓
重定向到前端: http://localhost:5173?access_token=...&refresh_token=...
    ↓
App.tsx解析URL参数 → 保存到authStore → 清除URL参数
```

**关键点**: 展示state参数的CSRF防护作用,以及为什么callback要重定向到前端(SPA架构,后端无法直接设置前端状态)

### 6. 会话完成流程(标题生成+记忆提取)
**截图位置**: 绘制finishSession触发的所有子流程

**流程说明**:
```
前端上传最后一个chunk (isLastChunk=true)
    ↓
VideoProcessingService.processChunk() 检测到isLastChunk
    ↓
追加到Master Video + 触发最后几个窗口分析
    ↓
等待所有异步分析任务完成 (CompletableFuture.allOf)
    ↓
【子流程1: 标题生成】
SessionCompletionService.generateTitle()
    ↓
加载所有analysis_records.refined_content
    ↓
gRPC GenerateTitle(所有内容拼接)
    ↓
ai-service: Qwen Max生成≤10字符标题
    ↓
更新session.title → "C++解两数之和"
    ↓
【子流程2: 记忆提取】
SessionCompletionService.extractAndUpdateMemory()
    ↓
gRPC ExtractUserMemory(所有内容拼接, 当前记忆)
    ↓
ai-service: Qwen Max提取新记忆 (编程语言、技能等)
    ↓
UserMemoryService.updateUserMemory(深度合并JSON)
    ↓
【子流程3: 清理】
CleanupService.cleanup()
    ↓
删除本地临时文件 (master_video.webm, window_*.webm)
    ↓
keepVideo=false? → 删除存储对象 (COS/OSS)
    ↓
更新session.status → COMPLETED
    ↓
WebSocket推送完成通知
```

**关键点**: 展示isLastChunk机制如何简化前端逻辑(前端只需标记,后端统一处理),以及异步任务等待的重要性(避免race condition)

### 7. 存储服务架构流程
**截图位置**: 绘制Storage Factory模式的调用流程

**流程说明**:
```
VideoProcessingService需要上传窗口视频
    ↓
调用storageService.uploadFile(window_3.webm)
    ↓
StorageServiceFactory根据配置返回实例:
    - STORAGE_TYPE=minio → MinioStorageService
    - STORAGE_TYPE=oss   → OssStorageService
    - STORAGE_TYPE=cos   → CosStorageService
    ↓
【MinIO示例】
MinioStorageService.uploadFile()
    ↓
minioClient.putObject(bucket, objectName, inputStream)
    ↓
生成公开URL: http://localhost:9000/ski-videos/session_123/window_3.webm
    ↓
返回URL给调用方
    ↓
【COS示例】
CosStorageService.uploadFile()
    ↓
cosClient.putObject(bucket, key, file)
    ↓
生成公开URL: https://ski-1234567890.cos.ap-shanghai.myqcloud.com/session_123/window_3.webm
    ↓
返回URL给调用方
```

**关键点**: 展示工厂模式的优势(统一接口,配置切换无需修改代码),以及为什么Qwen必须用公开URL(云API无法访问本地文件)

---

## 五、技术架构截图说明

### 1. 系统整体架构图
**截图位置**: 绘制系统架构图,包含所有模块和通信方式

**架构说明**:
```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (用户浏览器)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         web-recorder (React 19 + TypeScript)           │ │
│  │  - MediaRecorder API (视频录制)                        │ │
│  │  - Zustand (6 stores: UI/Session/Recording/Config/    │ │
│  │    Analysis/Auth)                                      │ │
│  │  - WebSocket Client (STOMP)                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                        │                      │
         │ REST API               │ REST API             │ WebSocket
         │ (Auth)                 │ (Video Upload)       │ (Streaming)
         ↓                        ↓                      ↓
┌──────────────────┐     ┌─────────────────────────────────────┐
│  auth-service    │     │         core-service                │
│  Spring Boot 3.5 │     │       Spring Boot 3.5               │
│                  │     │                                     │
│  - JWT生成/验证  │     │  - 视频chunk接收                    │
│  - OAuth 2.0集成 │     │  - Master Video管理                 │
│  - 邮箱验证码    │     │  - 窗口提取调度                     │
│  - Token刷新     │     │  - WebSocket Server                 │
│                  │     │  - gRPC Client                      │
└──────────────────┘     └─────────────────────────────────────┘
         │                        │                      │
         │ Redis                  │ PostgreSQL           │ gRPC
         ↓                        ↓                      ↓
┌──────────────────┐     ┌─────────────────┐   ┌────────────────────┐
│  Redis           │     │  PostgreSQL     │   │   ai-service       │
│  - Refresh Token │     │  - sessions     │   │   Python 3.12      │
│  - 验证码缓存    │     │  - users        │   │                    │
│  - Token黑名单   │     │  - analysis     │   │  - gRPC Server     │
│  - OAuth state   │     │  - user_memory  │   │  - FFmpeg处理      │
└──────────────────┘     └─────────────────┘   │  - Qwen/Gemini SDK │
                                  │             └────────────────────┘
                                  │                      │
                                  │ Storage              │ AI API
                                  ↓                      ↓
                         ┌──────────────────┐   ┌─────────────────┐
                         │  MinIO/OSS/COS   │   │  Qwen API       │
                         │  - chunk存储     │   │  Gemini API     │
                         │  - 窗口视频存储  │   └─────────────────┘
                         │  - master video  │
                         └──────────────────┘
```

**关键点**:
- 四层架构: Frontend → Auth/Core → AI → External Services
- 通信协议: REST(上传/CRUD), WebSocket(流式推送), gRPC(AI调用)
- 数据存储: PostgreSQL(业务数据), Redis(缓存/token), MinIO/OSS/COS(文件)

### 2. 模块间通信序列图
**截图位置**: 绘制一次完整录制的序列图

**序列说明**: 参考"录制与分析完整流程图",使用UML序列图格式,清晰展示时间顺序和消息传递。

### 3. 数据库ER图
**截图位置**: 使用dbdiagram.io或类似工具绘制ER图

**表关系**:
```
users (auth-service)
  ├─ 1:N oauth_connections
  └─ 1:1 user_memory (core-service, 跨库关联)

sessions (core-service)
  ├─ 1:N video_chunks
  ├─ 1:N analysis_records
  └─ N:1 users (通过userId关联)

user_memory
  └─ 1:1 users (通过userId关联)
```

**字段说明** (核心表):
- sessions: id, user_id, status(ACTIVE/ANALYZING/COMPLETED), master_video_path, current_video_length, last_window_start_time, title, ai_model, analysis_mode
- analysis_records: id, session_id, window_index, raw_content(TEXT), refined_content(TEXT), start_time_offset, end_time_offset
- user_memory: id, user_id, memory_data(JSONB)

### 4. 前端状态管理架构
**截图位置**: 绘制Zustand 6个store的职责和交互

**架构说明**:
```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
└─────────────────────────────────────────────────────────┘
         │ useStore hooks
         ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   uiStore    │  │ sessionStore │  │recordingStore│
│              │  │              │  │              │
│ - sidebarOpen│  │ - sessions[] │  │ - isRecording│
│ - currentView│  │ - current    │  │ - mediaStream│
│              │  │ - CRUD       │  │ - chunkIndex │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ configStore  │  │analysisStore │  │  authStore   │
│              │  │              │  │ (persisted)  │
│ - aiModel    │  │ - results[]  │  │ - user       │
│ - mode       │  │ - wsConnected│  │ - accessToken│
│ - keepVideo  │  │ - addResult  │  │ - refresh    │
└──────────────┘  └──────────────┘  └──────────────┘
         │                 │                 │
         ↓                 ↓                 ↓
    ┌────────────────────────────────────────────┐
    │         localStorage (authStore only)       │
    └────────────────────────────────────────────┘
```

**关键点**:
- 清晰的关注点分离,避免状态混乱
- authStore使用persist中间件持久化
- analysisStore的addResult处理流式内容追加

### 5. gRPC服务定义架构
**截图位置**: 打开`proto/video_analysis.proto`,截取service定义

**Proto定义**:
```protobuf
service VideoAnalysisService {
  // 视频处理
  rpc ProcessVideo(ProcessVideoRequest) returns (ProcessVideoResponse);
  rpc ConcatVideos(ConcatVideosRequest) returns (ConcatVideosResponse);
  rpc ExtractSegment(ExtractSegmentRequest) returns (ExtractSegmentResponse);
  rpc ExtractTail(ExtractTailRequest) returns (ExtractTailResponse);
  rpc GetVideoDuration(GetVideoDurationRequest) returns (GetVideoDurationResponse);

  // AI分析
  rpc AnalyzeVideo(AnalyzeVideoRequest) returns (stream AnalysisResponse);
  rpc RefineAnalysis(RefineAnalysisRequest) returns (RefineAnalysisResponse);

  // 会话管理
  rpc GenerateTitle(GenerateTitleRequest) returns (GenerateTitleResponse);
  rpc ExtractUserMemory(ExtractUserMemoryRequest) returns (ExtractUserMemoryResponse);
}
```

**说明要点**:
- 9个服务方法覆盖所有AI和视频处理需求
- AnalyzeVideo使用stream返回(流式响应)
- Protobuf序列化比JSON节省30-50%流量
- core-service作为客户端,ai-service作为服务端

### 6. 部署架构图
**截图位置**: 绘制生产环境部署架构

**部署说明**:
```
┌─────────────────────────────────────────────────────┐
│               Nginx (反向代理 + 静态文件)            │
│  - /          → web-recorder (静态文件)             │
│  - /api/*     → core-service:8080                   │
│  - /api/auth/* → auth-service:8081                  │
│  - /ws/*      → core-service:8080 (WebSocket)       │
└─────────────────────────────────────────────────────┘
         │                │                │
         ↓                ↓                ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ auth-service │  │ core-service │  │  ai-service  │
│   (Docker)   │  │   (Docker)   │  │   (Docker)   │
│   Port 8081  │  │   Port 8080  │  │  Port 50051  │
└──────────────┘  └──────────────┘  └──────────────┘
         │                │                │
         ↓                ↓                ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Redis        │  │ PostgreSQL   │  │  Tencent COS │
│  (Docker)    │  │  (Docker)    │  │  (云存储)    │
└──────────────┘  └──────────────┘  └──────────────┘
```

**关键点**:
- 微服务独立部署,易于扩展
- Nginx统一入口,处理CORS和负载均衡
- Docker容器化,环境一致性
- 云存储(COS)解决公开URL需求

---

## 三、关键代码

### 1. Master Video拼接
```java
// VideoProcessingService.java
private void appendToMasterVideo(Session session, String chunkPath) {
    if (session.getMasterVideoPath() == null) {
        // 第一个chunk: 直接复制
        Files.copy(chunkPath, masterPath);
        Double actualDuration = grpcClientService.getVideoDuration(masterPath);
        session.setCurrentVideoLength(actualDuration);
    } else {
        // 后续chunk: FFmpeg concat
        grpcClientService.concatVideos(
            List.of(session.getMasterVideoPath(), chunkPath), tempOutput
        );
        Files.delete(session.getMasterVideoPath());
        Files.move(tempOutput, session.getMasterVideoPath());

        // 重新获取时长(FFmpeg可能有微小误差)
        Double actualDuration = grpcClientService.getVideoDuration(masterPath);
        session.setCurrentVideoLength(actualDuration);
    }
}
```

### 2. 滑动窗口触发
```java
// VideoProcessingService.java
private void checkAndAnalyzeWindows(Session session, Boolean isLastChunk) {
    while (true) {
        Double nextWindowStart = session.getLastWindowStartTime() + windowStep;
        Double nextWindowEnd = nextWindowStart + windowSize;

        // 常规触发: 视频长度 >= 窗口结束时间
        boolean normalTrigger = session.getCurrentVideoLength() >= nextWindowEnd;

        // 最后chunk触发: isLastChunk=true 且剩余 >= 5秒
        Double remaining = session.getCurrentVideoLength() - nextWindowStart;
        boolean lastChunkTrigger = isLastChunk && remaining >= 5.0;

        if (!normalTrigger && !lastChunkTrigger) break;

        // 限制窗口结束时间不超过实际视频长度
        Double clampedEnd = Math.min(nextWindowEnd, session.getCurrentVideoLength());

        extractAndAnalyzeWindow(session, nextWindowStart, clampedEnd);
        session.setLastWindowStartTime(nextWindowStart);
    }
}
```

### 3. 两阶段分析
```python
# qwen_analyzer.py
async def analyze_video(self, video_url, context, user_memory):
    """阶段1: VL模型分析视频"""
    messages = [{
        'role': 'user',
        'content': [
            {'video': video_url},
            {'text': self.build_prompt(context, user_memory)}
        ]
    }]

    responses = dashscope.MultiModalConversation.call(
        model=self.vl_model,  # qwen-vl-max
        messages=messages,
        stream=True
    )

    for response in responses:
        yield response.output.choices[0].message.content[0]['text']

async def refine_analysis(self, raw_content, video_duration, user_memory):
    """阶段2: 文本模型精炼"""
    prompt = f"""修正时间错误、逻辑矛盾:

    原始: {raw_content}
    时长: {video_duration}秒
    用户记忆: {user_memory}

    只修正明显错误,保持核心信息。"""

    response = dashscope.Generation.call(
        model=self.text_model,  # qwen-max
        messages=[{'role': 'user', 'content': prompt}]
    )

    return response.output.get('text', '').strip()
```

### 4. Token自动刷新
```typescript
// authInterceptor.ts
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState()

  options.headers = { ...options.headers, Authorization: `Bearer ${accessToken}` }
  let response = await fetch(url, options)

  // 401自动刷新
  if (response.status === 401 && refreshToken) {
    const authResponse = await authClient.refreshToken(refreshToken)
    setAuth(authResponse.accessToken, authResponse.refreshToken, authResponse.userInfo)

    // 重试原请求
    options.headers.Authorization = `Bearer ${authResponse.accessToken}`
    response = await fetch(url, options)
  }

  return response
}

// App.tsx - 每分钟主动检查
useEffect(() => {
  const interval = setInterval(() => {
    const { accessToken, refreshToken } = useAuthStore.getState()

    // Token即将过期(5分钟内)则主动刷新
    if (accessToken && isTokenExpired(accessToken, 5 * 60 * 1000)) {
      refreshTokenIfNeeded()
    }
  }, 60000)

  return () => clearInterval(interval)
}, [])
```

### 5. 用户记忆存储
```java
// UserMemory.java
@Entity
@Table(name = "user_memory")
public class UserMemory {
    @Type(JsonBinaryType.class)  // Hibernate JSONB处理
    @Column(name = "memory_data", columnDefinition = "jsonb")
    private String memoryData;
}

// UserMemoryService.java
@Transactional
public String updateUserMemory(Long userId, String newMemoryJson) {
    UserMemory userMemory = userMemoryRepository.findByUserId(userId)
        .orElse(UserMemory.builder().userId(userId).memoryData("{}").build());

    // 深度合并JSON
    JsonNode existing = objectMapper.readTree(userMemory.getMemoryData());
    JsonNode newData = objectMapper.readTree(newMemoryJson);
    JsonNode merged = mergeMemories(existing, newData);  // 递归合并,数组去重

    userMemory.setMemoryData(objectMapper.writeValueAsString(merged));
    userMemoryRepository.save(userMemory);

    return merged.toString();
}
```

---

## 四、技术架构

### 系统架构
```
web-recorder (React + TypeScript)
    ↓ REST API + WebSocket
auth-service ← core-service → ai-service
(JWT认证)      (业务编排)      (AI+FFmpeg)
    ↓              ↓              ↓
  Redis      PostgreSQL     Qwen/Gemini API
                 ↓
          MinIO/OSS/COS
```

### 技术栈
- **前端**: React 19 + TypeScript + Zustand + MediaRecorder API
- **认证**: Spring Boot 3.5 + JWT + OAuth 2.0 + Redis
- **后端**: Spring Boot 3.5 + PostgreSQL + gRPC Client + WebSocket
- **AI**: Python 3.12 + gRPC Server + DashScope/GenAI SDK + FFmpeg

### 核心数据表
```sql
sessions: id, user_id, status, master_video_path, current_video_length,
          last_window_start_time, title, ai_model, analysis_mode

analysis_records: id, session_id, window_index, raw_content,
                  refined_content, start_time_offset, end_time_offset

user_memory: id, user_id, memory_data(JSONB), created_at, updated_at
```

---

## 五、性能数据

| 指标 | 数值 | 说明 |
|------|------|------|
| 首窗口延迟 | 35-70秒 | 录制35s + 上传1s + 处理1s + AI 20-60s + 精炼5-10s |
| 后续窗口间隔 | 10秒 | windowStep=10秒 |
| Chunk大小 | 15-25MB | 35秒视频 |
| FFmpeg concat | 0.8-1.2秒 | 拼接两个35秒视频 |
| AI分析(Qwen) | 20-40秒 | 15秒窗口,Qwen VL Max |
| AI分析(Gemini) | 15-30秒 | 15秒窗口,Gemini 2.0 Flash |
| 精炼耗时 | 5-10秒 | Qwen Max文本模型 |
| 并发能力 | 10个视频 | 线程池最大10线程 |
| 精炼错误率 | <3% | 未精炼15%,精炼后<3% |

---

## 六、关键决策

### Master Video vs Per-Chunk
- **问题**: 跨chunk窗口需要拼接tail+head,复杂且易错
- **方案**: Master Video统一管理,基于时间提取任意窗口
- **代价**: 每个chunk多1秒concat,但代码简洁可靠

### 两阶段分析
- **问题**: VL模型时间表述错误率15%
- **方案**: 增加文本模型精炼阶段
- **效果**: 错误率降至<3%,增加5-10秒延迟

### isLastChunk vs finishSession API
- **问题**: finishSession容易遗漏,前端逻辑复杂
- **方案**: 最后chunk标记isLastChunk=true,后端统一处理
- **效果**: 简化前端,更可靠

### DashScope vs OpenAI接口
- **问题**: OpenAI兼容接口不支持视频URL
- **方案**: 使用DashScope原生SDK
- **效果**: 稳定的视频分析能力

### VL模型 vs 文本模型分离
- **问题**: VL模型成本高
- **方案**: 视频分析用VL,精炼/标题/记忆用文本模型
- **效果**: 成本降低40%
