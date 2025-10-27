# Qwen视频分析使用说明

## 概述

本项目使用Qwen（通义千问）的视频理解能力进行视频内容分析。**重要**：必须使用DashScope原生SDK才能分析存储在COS/OSS等对象存储服务中的视频。

## 为什么使用DashScope SDK

### 问题背景
1. **AI云服务无法访问私有存储**: Qwen API无法直接读取私有MinIO存储的视频
2. **OpenAI兼容接口限制**: 使用OpenAI兼容接口无法传入视频URL进行分析

### 解决方案
1. **存储服务**: 使用公有云存储（COS/OSS）或配置MinIO公网访问
2. **SDK选择**: 使用DashScope原生SDK，支持通过URL分析视频

## DashScope SDK配置

### 1. 安装依赖

```bash
pip3.12 install dashscope
```

### 2. 配置API Key

```bash
# .env
QWEN_API_KEY=your_qwen_api_key
QWEN_MODEL=qwen-vl-max  # qwen-vl-max 或 qwen-vl-plus
```

获取API Key: https://dashscope.console.aliyun.com/

### 3. 代码实现

```python
import dashscope

# 配置API Key
dashscope.api_key = "your_qwen_api_key"

# 构建消息
messages = [{
    'role': 'user',
    'content': [
        {'video': 'https://your-cos-bucket.cos.ap-guangzhou.myqcloud.com/video.mp4'},
        {'text': '分析这段视频内容，描述用户正在做什么'}
    ]
}]

# 调用API（流式）
responses = dashscope.MultiModalConversation.call(
    model='qwen-vl-max',
    messages=messages,
    stream=True
)

# 处理流式响应
for response in responses:
    if response.status_code == 200:
        content = response.output.choices[0].message.content[0]['text']
        print(content, end='', flush=True)
    else:
        print(f"Error: {response.code}, {response.message}")
```

## 项目中的实现

### ai-service/models/qwen_analyzer.py

```python
class QwenAnalyzer(VideoAnalyzer):
    def __init__(self):
        if not Config.QWEN_API_KEY:
            raise ValueError("QWEN_API_KEY not configured")

        dashscope.api_key = Config.QWEN_API_KEY
        self.model = Config.QWEN_MODEL

    async def analyze_video(
        self,
        video_url: str,  # 必须是公网可访问的URL
        context: str = "",
        session_id: str = "",
        window_index: int = 0
    ) -> AsyncGenerator[str, None]:
        # 构建prompt
        prompt = self._build_prompt(context)

        # 构建消息
        messages = [{
            'role': 'user',
            'content': [
                {'video': video_url},  # 视频URL
                {'text': prompt}
            ]
        }]

        # 调用DashScope API
        responses = dashscope.MultiModalConversation.call(
            model=self.model,
            messages=messages,
            stream=True
        )

        # 流式返回结果
        previous_length = 0
        full_content = ""

        for response in responses:
            if response.status_code == 200:
                full_content = response.output.choices[0].message.content[0]['text']
                new_content = full_content[previous_length:]
                previous_length = len(full_content)

                if new_content:
                    yield new_content
            else:
                error_msg = f"DashScope API error: {response.code}, {response.message}"
                raise AIServiceError(error_msg)
```

## 存储服务配置

### 推荐：COS（腾讯云对象存储）

```yaml
# .env
STORAGE_TYPE=cos
COS_SECRET_ID=your_cos_secret_id
COS_SECRET_KEY=your_cos_secret_key
COS_REGION=ap-guangzhou
COS_BUCKET_NAME=your_bucket_name
```

### 或：OSS（阿里云对象存储）

```yaml
# .env
STORAGE_TYPE=oss
OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY_ID=your_oss_key_id
OSS_ACCESS_KEY_SECRET=your_oss_key_secret
OSS_BUCKET_NAME=your_bucket_name
OSS_REGION=cn-hangzhou
```

## 模型选择

### qwen-vl-max
- 最强性能，视频理解能力最好
- 推荐用于生产环境
- 成本相对较高

### qwen-vl-plus
- 平衡性能和成本
- 适合大规模调用
- 成本较低

## 常见问题

### Q1: 视频下载失败

**错误信息**: `DashScope API error: video download failed`

**原因**:
- 视频URL无法公网访问
- 使用了私有MinIO存储

**解决**:
1. 切换到COS或OSS公有云存储
2. 或配置MinIO公网访问

### Q2: OpenAI兼容接口无法读取视频

**原因**: OpenAI兼容接口不支持视频URL参数

**解决**: 必须使用DashScope原生SDK

### Q3: API调用限制

Qwen API有以下限制：
- 请求频率限制（QPM）
- Token限制
- 视频大小限制（通常100MB以内）

**解决**:
- 合理控制调用频率
- 视频切片处理
- 升级API套餐

## 提示词设计

### 基础提示词

```python
prompt = """分析这段视频内容，生成连贯的文字描述。
请描述视频中用户正在做什么，重点关注主要活动和动作。
输出应该连贯、简洁。"""
```

### 带上下文的提示词

```python
prompt = f"""分析这段视频内容，生成连贯的文字描述。

前置上下文（上一窗口的分析结果）：
{context}

请重点描述当前视频中的新动作和变化，避免重复已描述的内容。
输出应该连贯、简洁，重点关注用户的主要活动。"""
```

## 性能优化

### 1. 视频预处理
- 分辨率标准化到720p
- 帧率统一到30fps
- 适当压缩减小文件大小

### 2. 并发控制
- 控制同时分析的视频数量
- 避免超过API频率限制

### 3. 缓存策略
- 相似视频可复用分析结果
- 减少重复调用

## 参考资料

- DashScope官方文档: https://help.aliyun.com/zh/dashscope/
- Qwen-VL模型文档: https://help.aliyun.com/zh/dashscope/developer-reference/qwen-vl-api
- 视频理解API: https://help.aliyun.com/zh/dashscope/developer-reference/vl-plus-quick-start