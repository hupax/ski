"""
Base prompts for video analysis.
Optimized for user activity recording scenarios (programming, crafts, teaching, etc.)
"""

# ==================== 基础提示词模板 ====================

# 首个窗口（无上下文）
FIRST_WINDOW_PROMPT_ZH = """描述这段视频, 我想通过你帮我记录这段活动.

要求:
1. 只记录事实, 不要因为输出格式而想当然的记录视频没有的内容
2. 重点关注: 具体操作、使用的工具/界面、关键动作和结果
{user_memory_context}

输出格式:
- **直接返回Markdown格式的文本** (可以使用标题、列表、加粗等Markdown语法)
- **不要用 ```markdown 代码块包裹**, 直接输出Markdown文本
- **参考示例输出, 注意保持客观和准确**
- **参考示例**(不要太死板完全按照示例的来):

#### [00:00] 开始

**Screen State:** IDE (IntelliJ) 打开，左侧 Project Tree 显示 `core-service` 模块；右侧标签页停留在 `GrpcClientService.java`。
**Actions:** 你移动光标到 `sendRequest()` 方法，按下 `⌘+B` 跳转到 `ProtoRequest`。
**Visual Cues:** 屏幕右上角的摄像画面显示你微微前倾，看起来在快速确认 proto 定义。

---

**要求:**
- 叙述方式自由, 可以使用第一人称、第二人称或第三人称, 选择最自然流畅的表达
- 保持客观和准确
- 中文输出

**补充:**
你分析的只是一个片段, 之后我会将每个片段的分析结果拼接起来, 你分析的这个片段就在其中.
最终的全部拼接起来的示例:

## 记录示例：Java 面试

**Meta**

- 场景：远程 Java 面试
    
- 时间：目前时间
    
- 总时长：xx 分钟
    

---

### Timeline（关键锚点）

#### [00:02] 启动前准备

**Screen State：** IDE（IntelliJ）打开，左侧 Project Tree 显示 `core-service` 模块；右侧标签页停留在 `GrpcClientService.java`。  
**Actions：** 你移动光标到 `sendRequest()` 方法，按下 `⌘+B` 跳转到 `ProtoRequest`。  
**Visual Cues：** 屏幕右上角的摄像画面显示你微微前倾，看起来在快速确认 proto 定义。  
**Cue Question：**

> 你当时在确认的，是消息结构是否匹配，还是序列化层的性能问题？  
> **Replay Cue：** 回看 00:02–00:08，看手指在键盘敲击三次的节奏。

---

#### [02:10] 面试官提问：「为什么用 gRPC 而不是 REST？」

**Screen State：** 你刚切回 IntelliJ 的 `GrpcClientService` 文件，终端窗口显示前一次测试日志（HTTP/2 stream established）。  
**Observed Actions：**

- 听到问题后，你吸气、略微点头；
    
- 手指在桌面轻敲两下，然后在屏幕下方笔记区写下三个字母：“RPC”；
    
- 开口解释时，语气从低到高，有明显的条理切分：“协议层性能 → 流式通信 → 接口定义”。
    

**Speech Trace（简述核心内容）**

> “主要因为我们希望在 AI 服务和核心之间传递二进制流而不是 JSON，这样带宽和解析效率更好。proto 定义的 API 比 REST 更强约束，也方便多语言对接。”

**Code Diff Snapshot：**

```java
// before: no comment
// after: // gRPC: proto-defined API, binary, http2 stream
```

**Sensory Tag：** 语速略快（0.6s），语气稳定；你在说“proto-defined API”时右手指向屏幕。  
**Cue Question：**

> 当时你最先想到的优势是“传输效率”还是“接口契约”？

---

#### [05:40] 白板讲解阶段

**Screen State：** 你切换到屏幕共享模式，打开白板 App。画面上画了三个矩形框：`core-service` ↔ `ai-service` ↔ `storage`。  
**Observed Actions：**

- 你先画箭头，再圈出“滑动窗口”字样；
    
- 在“core”下方补上小注释：“batch inference 200ms”;
    
- 同时说：“我们会用一个滑动窗口控制调用速率，防止队列堆积。”
    

**Micro Trace：**

> “这里如果换成 REST，就得轮询或批量 HTTP 请求，那延迟不可控。gRPC 的流式通道能持续 push。”

**Screen Detail：** 手写笔颜色从蓝切红（表示 IO 压力节点），右下角计时器显示 05:52。

**Cue Question：**

> 当时你为什么没有提 HTTP/3？是因为面试官语境偏向 RPC，还是你判断那会跑偏？

**Replay Cue：** 回看 05:40–05:52，看画圈那一瞬的手势。

---

#### [08:10] 事务与并发

**Prompt Context：** 面试官问：“如果并发写数据库时出现脏写，你怎么避免？”  
**Screen State：** IDE 聚焦在 `UserService.java`，`updateUser()` 方法被高亮。  
**Observed Dynamics：**

- 眉头轻皱；笔在空中停顿 1 秒；
    
- 右手写下笔记：“@Transactional + 乐观锁”；
    
- 光标移动到 `repo.save(u);`，打开注释框。
    

**You said：**

> “在大多数业务场景我会用乐观锁控制。Spring 的 `@Version` 字段能直接防止脏写。悲观锁我只在高竞争写入或事务嵌套里才考虑。”

**Code Snapshot：**

```java
// before
public void updateUser(User u) {{ repo.save(u); }}

// after
@Transactional
public void updateUser(User u) {{ repo.save(u); }} // version check added
```

**Context Note：** 右侧 notes 区域有一行未保存笔记：“传播级别 vs 乐观锁冲突 → test later”。  
**Cue for Reflection：**

> 你当时真正担心的，是事务边界不清还是版本号更新时机？

---

#### [17:30] 收尾环节

**Screen State：** 面试官总结：“OK，我们今天到这里。”  
**Observed Actions：**

- 你轻轻点头，嘴角上扬；
    
- 终端中断开了 gRPC client；
    
- 你在笔记里补上最后一句：“Q：I/O 优化——pool & compression”。
    

**Final Cue：**

> 若被追问“如何降低 IO”，你会先从连接池还是压缩算法说起？

---

### Step

- **第一步：** 按时间轴快速浏览锚点，重建节奏感（你当时的气息、光标移动、笔记）。
    
- **第二步：** 对每个 Cue Question 作出脑内回答，不查资料，纯回忆推理。
    
- **第三步：** 若要“重返场景”，打开视频的 Replay 段（例如 05:40–05:52），让视觉和语音重新触发记忆链。
    
- **第四步：** 若你在之后的面试中被问到相似问题，优先调取“行为层+语义层”的记忆，而非死记结论。
    

"""

FIRST_WINDOW_PROMPT_EN = """Describe this video segment. I want you to help me record this activity.

Requirements:
1. Record only facts, don't invent content based on expected format
2. Focus on: specific actions, tools/interfaces used, key operations and results
{user_memory_context}

Output Format:
- **Return Markdown formatted text directly** (you can use headings, lists, bold, etc.)
- **Do NOT wrap with ```markdown code blocks**, output Markdown text directly
- **Refer to the example output, keep objective and accurate**
- **Example reference** (don't follow too rigidly):

#### [00:00] Start

**Screen State:** IDE (IntelliJ) open, left Project Tree shows `core-service` module; right tab stays on `GrpcClientService.java`.
**Actions:** You move cursor to `sendRequest()` method, press `⌘+B` to jump to `ProtoRequest`.
**Visual Cues:** Top-right camera shows you leaning forward slightly, appears to be quickly confirming proto definition.

---

**Requirements:**
- Free narrative style, you can use first-person, second-person, or third-person perspective - choose the most natural expression
- Keep objective and accurate
- English output"""

# 后续窗口（有上下文）
SUBSEQUENT_WINDOW_PROMPT_ZH = """继续分析视频的下一个片段.

**前置内容** (之前已记录):
{context}

要求:
1. 当前片段与前文有重叠, **重点描述新出现的动作**, 避免重复
2. 如果是前文动作的延续, 简要说明"继续..."即可, 然后描述新变化
3. 使用过渡词保持连贯性 (接着、然后、随后等)
{user_memory_context}

输出格式:
- **直接返回Markdown格式的文本**
- **不要用 ```markdown 代码块包裹**
- **参考示例输出, 注意保持客观和准确**
- **参考示例**(不要太死板完全按照示例的来):

#### [00:15] 继续操作

**Screen State:** 终端窗口显示前一次测试日志（HTTP/2 stream established）。
**Actions:**
- 继续在终端输入命令
- 切换到浏览器标签页，检查网络请求

**Observed Actions:**
- 手指在桌面轻敲两下，然后在屏幕下方笔记区写下三个字母："API"
- 开口解释时，语气从低到高，有明显的条理切分

---

**要求:**
- 保持与前文风格一致
- 中文输出

**补充:**
你分析的只是一个片段, 之后我会将每个片段的分析结果拼接起来, 你分析的这个片段就在其中.
最终的全部拼接起来的示例:

## 记录示例：Java 面试

**Meta**

- 场景：远程 Java 面试
    
- 时间：目前时间
    
- 总时长：xx 分钟
    

---

### Timeline（关键锚点）

#### [00:02] 启动前准备

**Screen State：** IDE（IntelliJ）打开，左侧 Project Tree 显示 `core-service` 模块；右侧标签页停留在 `GrpcClientService.java`。  
**Actions：** 你移动光标到 `sendRequest()` 方法，按下 `⌘+B` 跳转到 `ProtoRequest`。  
**Visual Cues：** 屏幕右上角的摄像画面显示你微微前倾，看起来在快速确认 proto 定义。  
**Cue Question：**

> 你当时在确认的，是消息结构是否匹配，还是序列化层的性能问题？  
> **Replay Cue：** 回看 00:02–00:08，看手指在键盘敲击三次的节奏。

---

#### [02:10] 面试官提问：「为什么用 gRPC 而不是 REST？」

**Screen State：** 你刚切回 IntelliJ 的 `GrpcClientService` 文件，终端窗口显示前一次测试日志（HTTP/2 stream established）。  
**Observed Actions：**

- 听到问题后，你吸气、略微点头；
    
- 手指在桌面轻敲两下，然后在屏幕下方笔记区写下三个字母：“RPC”；
    
- 开口解释时，语气从低到高，有明显的条理切分：“协议层性能 → 流式通信 → 接口定义”。
    

**Speech Trace（简述核心内容）**

> “主要因为我们希望在 AI 服务和核心之间传递二进制流而不是 JSON，这样带宽和解析效率更好。proto 定义的 API 比 REST 更强约束，也方便多语言对接。”

**Code Diff Snapshot：**

```java
// before: no comment
// after: // gRPC: proto-defined API, binary, http2 stream
```

**Sensory Tag：** 语速略快（0.6s），语气稳定；你在说“proto-defined API”时右手指向屏幕。  
**Cue Question：**

> 当时你最先想到的优势是“传输效率”还是“接口契约”？

---

#### [05:40] 白板讲解阶段

**Screen State：** 你切换到屏幕共享模式，打开白板 App。画面上画了三个矩形框：`core-service` ↔ `ai-service` ↔ `storage`。  
**Observed Actions：**

- 你先画箭头，再圈出“滑动窗口”字样；
    
- 在“core”下方补上小注释：“batch inference 200ms”;
    
- 同时说：“我们会用一个滑动窗口控制调用速率，防止队列堆积。”
    

**Micro Trace：**

> “这里如果换成 REST，就得轮询或批量 HTTP 请求，那延迟不可控。gRPC 的流式通道能持续 push。”

**Screen Detail：** 手写笔颜色从蓝切红（表示 IO 压力节点），右下角计时器显示 05:52。

**Cue Question：**

> 当时你为什么没有提 HTTP/3？是因为面试官语境偏向 RPC，还是你判断那会跑偏？

**Replay Cue：** 回看 05:40–05:52，看画圈那一瞬的手势。

---

#### [08:10] 事务与并发

**Prompt Context：** 面试官问：“如果并发写数据库时出现脏写，你怎么避免？”  
**Screen State：** IDE 聚焦在 `UserService.java`，`updateUser()` 方法被高亮。  
**Observed Dynamics：**

- 眉头轻皱；笔在空中停顿 1 秒；
    
- 右手写下笔记：“@Transactional + 乐观锁”；
    
- 光标移动到 `repo.save(u);`，打开注释框。
    

**You said：**

> “在大多数业务场景我会用乐观锁控制。Spring 的 `@Version` 字段能直接防止脏写。悲观锁我只在高竞争写入或事务嵌套里才考虑。”

**Code Snapshot：**

```java
// before
public void updateUser(User u) {{ repo.save(u); }}

// after
@Transactional
public void updateUser(User u) {{ repo.save(u); }} // version check added
```

**Context Note：** 右侧 notes 区域有一行未保存笔记：“传播级别 vs 乐观锁冲突 → test later”。  
**Cue for Reflection：**

> 你当时真正担心的，是事务边界不清还是版本号更新时机？

---

#### [17:30] 收尾环节

**Screen State：** 面试官总结：“OK，我们今天到这里。”  
**Observed Actions：**

- 你轻轻点头，嘴角上扬；
    
- 终端中断开了 gRPC client；
    
- 你在笔记里补上最后一句：“Q：I/O 优化——pool & compression”。
    

**Final Cue：**

> 若被追问“如何降低 IO”，你会先从连接池还是压缩算法说起？

---

### Step

- **第一步：** 按时间轴快速浏览锚点，重建节奏感（你当时的气息、光标移动、笔记）。
    
- **第二步：** 对每个 Cue Question 作出脑内回答，不查资料，纯回忆推理。
    
- **第三步：** 若要“重返场景”，打开视频的 Replay 段（例如 05:40–05:52），让视觉和语音重新触发记忆链。
    
- **第四步：** 若你在之后的面试中被问到相似问题，优先调取“行为层+语义层”的记忆，而非死记结论。
    

"""


SUBSEQUENT_WINDOW_PROMPT_EN = """Continue analyzing the next video segment.

**Previous Content** (already recorded):
{context}

Requirements:
1. Current segment has 5-second overlap with previous content, **focus on new actions**, avoid repetition
2. If action continues from previous segment, briefly note "continues..." then describe new changes
3. Use transition words to maintain coherence (then, next, subsequently, etc.)
{user_memory_context}

Output Format:
- **Return Markdown formatted text directly**
- **Do NOT wrap with ```markdown code blocks**
- **Refer to the example output, keep objective and accurate**
- **Example reference** (don't follow too rigidly):

#### [00:15] Continue operation

**Screen State:** Terminal shows previous test log (HTTP/2 stream established).
**Actions:**
- Continue typing commands in terminal
- Switch to browser tab, check network requests

**Observed Actions:**
- Fingers tap desk twice, then write three letters in note area below: "API"
- When explaining, tone rises from low to high, clear structure

---

**Requirements:**
- Maintain consistency with previous content style
- English output"""

# ==================== 整体分析模式 ====================

FULL_VIDEO_PROMPT_ZH = """描述这个视频,我想通过你帮我记录这一视频.
要求:
    1. 只记录事实,不要因为输出格式而想当然的记录视频没有的内容.
{user_memory_context}

输出格式：
- **直接返回Markdown格式的文本**（可以使用标题、列表、加粗等Markdown语法）
- **不要用 ```markdown 代码块包裹**，直接输出Markdown文本
- **参考示例输出, 注意保持客观和准确**
- **参考示例**(不要太死板完全按照示例的来):

## 记录示例：Java 面试

**Meta**

- 场景：远程 Java 面试
    
- 时间：目前时间
    
- 总时长：xx 分钟
    

---

### Timeline（关键锚点）

#### [00:02] 启动前准备

**Screen State：** IDE（IntelliJ）打开，左侧 Project Tree 显示 `core-service` 模块；右侧标签页停留在 `GrpcClientService.java`。  
**Actions：** 你移动光标到 `sendRequest()` 方法，按下 `⌘+B` 跳转到 `ProtoRequest`。  
**Visual Cues：** 屏幕右上角的摄像画面显示你微微前倾，看起来在快速确认 proto 定义。  
**Cue Question：**

> 你当时在确认的，是消息结构是否匹配，还是序列化层的性能问题？  
> **Replay Cue：** 回看 00:02–00:08，看手指在键盘敲击三次的节奏。

---

#### [02:10] 面试官提问：「为什么用 gRPC 而不是 REST？」

**Screen State：** 你刚切回 IntelliJ 的 `GrpcClientService` 文件，终端窗口显示前一次测试日志（HTTP/2 stream established）。  
**Observed Actions：**

- 听到问题后，你吸气、略微点头；
    
- 手指在桌面轻敲两下，然后在屏幕下方笔记区写下三个字母：“RPC”；
    
- 开口解释时，语气从低到高，有明显的条理切分：“协议层性能 → 流式通信 → 接口定义”。
    

**Speech Trace（简述核心内容）**

> “主要因为我们希望在 AI 服务和核心之间传递二进制流而不是 JSON，这样带宽和解析效率更好。proto 定义的 API 比 REST 更强约束，也方便多语言对接。”

**Code Diff Snapshot：**

```java
// before: no comment
// after: // gRPC: proto-defined API, binary, http2 stream
```

**Sensory Tag：** 语速略快（0.6s），语气稳定；你在说“proto-defined API”时右手指向屏幕。  
**Cue Question：**

> 当时你最先想到的优势是“传输效率”还是“接口契约”？

---

#### [05:40] 白板讲解阶段

**Screen State：** 你切换到屏幕共享模式，打开白板 App。画面上画了三个矩形框：`core-service` ↔ `ai-service` ↔ `storage`。  
**Observed Actions：**

- 你先画箭头，再圈出“滑动窗口”字样；
    
- 在“core”下方补上小注释：“batch inference 200ms”;
    
- 同时说：“我们会用一个滑动窗口控制调用速率，防止队列堆积。”
    

**Micro Trace：**

> “这里如果换成 REST，就得轮询或批量 HTTP 请求，那延迟不可控。gRPC 的流式通道能持续 push。”

**Screen Detail：** 手写笔颜色从蓝切红（表示 IO 压力节点），右下角计时器显示 05:52。

**Cue Question：**

> 当时你为什么没有提 HTTP/3？是因为面试官语境偏向 RPC，还是你判断那会跑偏？

**Replay Cue：** 回看 05:40–05:52，看画圈那一瞬的手势。

---

#### [08:10] 事务与并发

**Prompt Context：** 面试官问：“如果并发写数据库时出现脏写，你怎么避免？”  
**Screen State：** IDE 聚焦在 `UserService.java`，`updateUser()` 方法被高亮。  
**Observed Dynamics：**

- 眉头轻皱；笔在空中停顿 1 秒；
    
- 右手写下笔记：“@Transactional + 乐观锁”；
    
- 光标移动到 `repo.save(u);`，打开注释框。
    

**You said：**

> “在大多数业务场景我会用乐观锁控制。Spring 的 `@Version` 字段能直接防止脏写。悲观锁我只在高竞争写入或事务嵌套里才考虑。”

**Code Snapshot：**

```java
// before
public void updateUser(User u) {{ repo.save(u); }}

// after
@Transactional
public void updateUser(User u) {{ repo.save(u); }} // version check added
```

**Context Note：** 右侧 notes 区域有一行未保存笔记：“传播级别 vs 乐观锁冲突 → test later”。  
**Cue for Reflection：**

> 你当时真正担心的，是事务边界不清还是版本号更新时机？

---

#### [17:30] 收尾环节

**Screen State：** 面试官总结：“OK，我们今天到这里。”  
**Observed Actions：**

- 你轻轻点头，嘴角上扬；
    
- 终端中断开了 gRPC client；
    
- 你在笔记里补上最后一句：“Q：I/O 优化——pool & compression”。
    

**Final Cue：**

> 若被追问“如何降低 IO”，你会先从连接池还是压缩算法说起？

---

### Step

- **第一步：** 按时间轴快速浏览锚点，重建节奏感（你当时的气息、光标移动、笔记）。
    
- **第二步：** 对每个 Cue Question 作出脑内回答，不查资料，纯回忆推理。
    
- **第三步：** 若要“重返场景”，打开视频的 Replay 段（例如 05:40–05:52），让视觉和语音重新触发记忆链。
    
- **第四步：** 若你在之后的面试中被问到相似问题，优先调取“行为层+语义层”的记忆，而非死记结论。
    

"""

FULL_VIDEO_PROMPT_EN = """Describe this video. I want you to help me record this video.

Requirements:
1. Record only facts, don't invent content based on expected format
{user_memory_context}

Output Format:
- **Return Markdown formatted text directly** (you can use headings, lists, bold, etc.)
- **Do NOT wrap with ```markdown code blocks**, output Markdown text directly
- **Refer to the example output, keep objective and accurate**
- **Example reference** (don't follow too rigidly):

## Recording Example: Java Interview

**Meta**

- Scene: Remote Java Interview
- Time: 2025-10-31 14:07
- Duration: 18 minutes

---

### Timeline (Key Anchors)

#### [00:02] Pre-launch preparation

**Screen State:** IDE (IntelliJ) open, left Project Tree shows `core-service` module; right tab stays on `GrpcClientService.java`.
**Actions:** You move cursor to `sendRequest()` method, press `⌘+B` to jump to `ProtoRequest`.
**Visual Cues:** Top-right camera shows you leaning forward slightly, appears to be quickly confirming proto definition.
**Cue Question:**

> Were you confirming message structure match, or serialization layer performance issues?
> **Replay Cue:** Rewatch 00:02–00:08, observe the rhythm of three keyboard taps.

---

#### [02:10] Interviewer asks: "Why use gRPC instead of REST?"

**Screen State:** You just switched back to IntelliJ's `GrpcClientService` file, terminal shows previous test log (HTTP/2 stream established).
**Observed Actions:**

- After hearing question, you inhale, nod slightly;
- Fingers tap desk twice, then write three letters in note area below: "RPC";
- When explaining, tone rises from low to high, clear structure: "protocol layer performance → streaming communication → interface definition".

**Speech Trace (core content summary)**

> "Mainly because we want to transfer binary streams between AI service and core instead of JSON, better bandwidth and parsing efficiency. Proto-defined API is more strictly constrained than REST, also convenient for multi-language integration."

**Code Diff Snapshot:**

```java
// before: no comment
// after: // gRPC: proto-defined API, binary, http2 stream
```

**Sensory Tag:** Slightly fast speech (0.6s), stable tone; when saying "proto-defined API", right hand points to screen.
**Cue Question:**

> Was your first thought advantage "transmission efficiency" or "interface contract"?

---

#### [05:40] Whiteboard explanation phase

**Screen State:** You switch to screen sharing mode, open whiteboard app. Drawing shows three rectangles: `core-service` ↔ `ai-service` ↔ `storage`.
**Observed Actions:**

- You draw arrows first, then circle "sliding window" text;
- Add small note below "core": "batch inference 200ms";
- Simultaneously saying: "We'll use a sliding window to control call rate, prevent queue buildup."

**Micro Trace:**

> "If we switch to REST here, we'd need polling or batch HTTP requests, that latency is uncontrollable. gRPC's streaming channel can continuously push."

**Screen Detail:** Stylus color changes from blue to red (indicates IO pressure point), bottom-right timer shows 05:52.

**Cue Question:**

> Why didn't you mention HTTP/3? Was it because interviewer's context leaned toward RPC, or you judged it would digress?

**Replay Cue:** Rewatch 05:40–05:52, observe the hand gesture when circling.

---

#### [08:10] Transactions and concurrency

**Prompt Context:** Interviewer asks: "If dirty writes occur during concurrent database writes, how do you prevent it?"
**Screen State:** IDE focuses on `UserService.java`, `updateUser()` method highlighted.
**Observed Dynamics:**

- Eyebrows slightly furrow; pen pauses in air for 1 second;
- Right hand writes note: "@Transactional + optimistic lock";
- Cursor moves to `repo.save(u);`, opens comment box.

**You said:**

> "In most business scenarios I'd use optimistic locking control. Spring's `@Version` field can directly prevent dirty writes. Pessimistic locks I only consider in high-contention writes or nested transactions."

**Code Snapshot:**

```java
// before
public void updateUser(User u) {{ repo.save(u); }}

// after
@Transactional
public void updateUser(User u) {{ repo.save(u); }} // version check added
```

**Context Note:** Right notes area has one unsaved note: "propagation level vs optimistic lock conflict → test later".
**Cue for Reflection:**

> What you were really worried about - unclear transaction boundaries or version number update timing?

---

#### [17:30] Wrap-up

**Screen State:** Interviewer concludes: "OK, let's stop here today."
**Observed Actions:**

- You nod slightly, smile;
- Terminal disconnects gRPC client;
- You add final line to notes: "Q: I/O optimization—pool & compression".

**Final Cue:**

> If asked "how to reduce IO", would you start with connection pool or compression algorithm?

---

### Steps

- **Step 1:** Quickly browse anchors along timeline, rebuild rhythm sense (your breathing, cursor movement, notes at that time).
- **Step 2:** Answer each Cue Question mentally, don't look up info, pure recall reasoning.
- **Step 3:** To "return to scene", open video Replay segment (e.g., 05:40–05:52), let visual and audio re-trigger memory chain.
- **Step 4:** If asked similar questions in later interviews, prioritize retrieving "behavior layer + semantic layer" memory, not rote conclusions.
"""

