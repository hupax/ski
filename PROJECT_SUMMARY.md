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
