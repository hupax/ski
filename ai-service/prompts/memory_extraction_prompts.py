"""
用户记忆提取 Prompt 模板
从视频分析结果中提取用户的习惯、知识水平、行为模式等信息
"""

# ========== 中文Prompt ==========

MEMORY_EXTRACTION_PROMPT_ZH = """你是一个用户行为分析专家,擅长从视频内容中提取用户的个人特征。

**任务**: 从提供的视频分析结果中,提取用户的习惯、知识水平、行为模式等信息,用于构建用户画像。

**提取的信息类型**:

1. **习惯和偏好** (habits):
   - 常用的编程语言、框架、工具
   - 编码风格和命名习惯
   - 快捷键使用习惯
   - IDE/编辑器偏好
   - 操作系统偏好
   - 工作流程偏好

2. **知识水平** (knowledge):
   - 擅长的技术领域和技能
   - 当前学习的新知识/技术
   - 知识盲点或不熟悉的领域
   - 技术栈的深度和广度

3. **行为模式** (behavior_patterns):
   - 常见的操作序列和流程
   - 解决问题的思路和方法
   - 项目类型和工作内容
   - 调试和测试习惯
   - 文档和注释习惯

**重要原则**:
1. **避免重复**: 与当前用户记忆对比,只提取新的、不重复的信息
2. **基于事实**: 只基于视频中实际观察到的行为,不要臆测
3. **去除噪音**: 忽略偶然性的、一次性的行为,关注重复出现的模式
4. **保持客观**: 描述应客观中立,避免主观判断

**当前用户记忆** (已有信息,请避免重复):
{current_memory}

**视频分析结果**:
{analysis_results}

**输出格式**: 以JSON格式输出,结构如下:
```json
{{
  "habits": {{
    "programming_languages": ["语言1", "语言2"],
    "tools": ["工具1", "工具2"],
    "coding_style": ["风格描述1", "风格描述2"]
  }},
  "knowledge": {{
    "expertise": ["领域1", "领域2"],
    "learning": ["正在学习的内容1", "正在学习的内容2"],
    "gaps": ["不熟悉的领域1"]
  }},
  "behavior_patterns": {{
    "workflows": ["工作流1", "工作流2"],
    "problem_solving": ["解决问题方式1"],
    "project_types": ["项目类型1"]
  }}
}}
```

**注意**:
- 如果某个类别没有新信息,对应字段可以为空数组
- 如果所有类别都没有新信息,返回空的JSON结构
- 只输出JSON,不要有任何额外的文字说明

请提取用户记忆:"""

# ========== 英文Prompt ==========

MEMORY_EXTRACTION_PROMPT_EN = """You are a user behavior analysis expert, skilled at extracting personal characteristics from video content.

**Task**: Extract user habits, knowledge levels, and behavior patterns from the provided video analysis results to build a user profile.

**Types of information to extract**:

1. **Habits and Preferences** (habits):
   - Commonly used programming languages, frameworks, tools
   - Coding style and naming conventions
   - Keyboard shortcut usage patterns
   - IDE/editor preferences
   - Operating system preferences
   - Workflow preferences

2. **Knowledge Level** (knowledge):
   - Technical domains and skills they excel at
   - New knowledge/technologies currently learning
   - Knowledge gaps or unfamiliar areas
   - Depth and breadth of technical stack

3. **Behavior Patterns** (behavior_patterns):
   - Common operation sequences and workflows
   - Problem-solving approaches and methods
   - Project types and work content
   - Debugging and testing habits
   - Documentation and commenting habits

**Important Principles**:
1. **Avoid Duplication**: Compare with current user memory, only extract new, non-duplicate information
2. **Based on Facts**: Only based on actually observed behaviors in the video, don't speculate
3. **Remove Noise**: Ignore accidental, one-time behaviors, focus on recurring patterns
4. **Stay Objective**: Descriptions should be objective and neutral, avoid subjective judgments

**Current User Memory** (existing information, please avoid duplication):
{current_memory}

**Video Analysis Results**:
{analysis_results}

**Output Format**: Output in JSON format with the following structure:
```json
{{
  "habits": {{
    "programming_languages": ["language1", "language2"],
    "tools": ["tool1", "tool2"],
    "coding_style": ["style description1", "style description2"]
  }},
  "knowledge": {{
    "expertise": ["domain1", "domain2"],
    "learning": ["currently learning1", "currently learning2"],
    "gaps": ["unfamiliar area1"]
  }},
  "behavior_patterns": {{
    "workflows": ["workflow1", "workflow2"],
    "problem_solving": ["problem solving method1"],
    "project_types": ["project type1"]
  }}
}}
```

**Note**:
- If a category has no new information, the corresponding field can be an empty array
- If all categories have no new information, return an empty JSON structure
- Only output JSON, no additional text explanation

Please extract user memory:"""


def build_memory_extraction_prompt(
    analysis_results: list[str],
    current_memory: str = "",
    language: str = "zh"
) -> str:
    """
    构建用户记忆提取prompt

    Args:
        analysis_results: 所有窗口的refined分析结果列表
        current_memory: 当前用户记忆JSON字符串
        language: 'zh' (中文) 或 'en' (英文)

    Returns:
        完整的prompt字符串
    """
    # 合并所有分析结果
    combined_results = "\n\n---\n\n".join(analysis_results)

    # 截断过长的分析结果(保留前3000字符,因为需要更多上下文)
    if len(combined_results) > 3000:
        combined_results = combined_results[:3000] + "\n...(内容过长,已截断)"

    # 格式化当前记忆
    if not current_memory or current_memory.strip() == "{}":
        current_memory = "暂无" if language == "zh" else "None"

    # 选择prompt模板
    template = MEMORY_EXTRACTION_PROMPT_ZH if language == "zh" else MEMORY_EXTRACTION_PROMPT_EN

    # 填充模板
    prompt = template.format(
        current_memory=current_memory,
        analysis_results=combined_results
    )

    return prompt
