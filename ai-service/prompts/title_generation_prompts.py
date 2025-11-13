"""
标题生成 Prompt 模板
根据视频分析结果生成简洁的标题(不超过10字,可包含英文)
"""

# ========== 中文Prompt ==========

TITLE_GENERATION_PROMPT_ZH = """你是一个擅长总结和提炼信息的AI助手。

**任务**: 根据提供的视频分析结果,生成一个简洁的标题。

**要求**:
1. **长度限制**: 标题不超过10个字符(汉字、英文字母、数字都计入)
2. **准确性**: 标题必须准确反映视频的核心内容或主题
3. **简洁性**: 抓住最关键的信息,去除冗余
4. **可读性**: 标题应该清晰易懂,避免过于抽象
5. **可使用英文**: 如果英文更简洁准确,可以使用英文或中英混合

**输出格式**: 只输出标题文本,不要有任何额外的解释、标点或前缀

**示例**:
- 视频内容: 用户在编写Python爬虫代码 → 标题: "Python爬虫"
- 视频内容: 用户在配置Docker容器 → 标题: "Docker配置"
- 视频内容: 用户在学习React Hooks → 标题: "React Hooks"
- 视频内容: 用户在制作木工桌子 → 标题: "手工木桌"
- 视频内容: 用户在教授机器学习 → 标题: "ML教学"

{user_memory_context}

**视频分析结果**:
{analysis_results}

请生成标题:"""

# ========== 英文Prompt ==========

TITLE_GENERATION_PROMPT_EN = """You are an AI assistant skilled at summarization and information extraction.

**Task**: Generate a concise title based on the provided video analysis results.

**Requirements**:
1. **Length Limit**: Title must not exceed 10 characters (letters, numbers, Chinese characters all count)
2. **Accuracy**: Title must accurately reflect the core content or theme of the video
3. **Conciseness**: Capture the most critical information, remove redundancy
4. **Readability**: Title should be clear and understandable, avoid being too abstract
5. **Mixed Languages OK**: You can use English, Chinese, or a mix if it's more concise

**Output Format**: Only output the title text, no extra explanation, punctuation, or prefix

**Examples**:
- Video content: User writing Python web scraper → Title: "Python scraper"
- Video content: User configuring Docker containers → Title: "Docker setup"
- Video content: User learning React Hooks → Title: "React Hooks"
- Video content: User making wooden table → Title: "Wood table"
- Video content: User teaching machine learning → Title: "ML teaching"

{user_memory_context}

**Video Analysis Results**:
{analysis_results}

Please generate the title:"""


# ========== 用户记忆上下文模板 ==========

USER_MEMORY_CONTEXT_ZH = """
**用户背景信息**(帮助你更好地理解用户的视频内容):
{user_memory}
"""

USER_MEMORY_CONTEXT_EN = """
**User Background Information** (helps you better understand the user's video content):
{user_memory}
"""


def build_title_generation_prompt(analysis_results: list[str], user_memory: str = "", language: str = "zh") -> str:
    """
    构建标题生成prompt

    Args:
        analysis_results: 所有窗口的refined分析结果列表
        user_memory: 用户记忆JSON字符串
        language: 'zh' (中文) 或 'en' (英文)

    Returns:
        完整的prompt字符串
    """
    # 合并所有分析结果
    combined_results = "\n\n---\n\n".join(analysis_results)

    # 截断过长的分析结果(保留前2000字符)
    if len(combined_results) > 2000:
        combined_results = combined_results[:2000] + "\n...(内容过长,已截断)"

    # 构建用户记忆上下文
    user_memory_context = ""
    if user_memory:
        context_template = USER_MEMORY_CONTEXT_ZH if language == "zh" else USER_MEMORY_CONTEXT_EN
        user_memory_context = context_template.format(user_memory=user_memory)

    # 选择prompt模板
    template = TITLE_GENERATION_PROMPT_ZH if language == "zh" else TITLE_GENERATION_PROMPT_EN

    # 填充模板
    prompt = template.format(
        user_memory_context=user_memory_context,
        analysis_results=combined_results
    )

    return prompt
