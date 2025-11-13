"""
分析结果修复 Prompt 模板
修复分析结果中的明显错误,提高准确性和可读性
"""

# ========== 中文Prompt ==========

REFINEMENT_PROMPT_ZH = """你是一个视频分析内容审核和修复专家。

**任务**: 审查并修复提供的AI视频分析结果中的明显错误。

**你需要检查和修复的错误类型**:
1. **事实性错误**:
   - 时间顺序错误(例如:先发生B再发生A,但文中写成先A后B)
   - 操作步骤错误(例如:用户实际点击了按钮X,但文中写成按钮Y)
   - 工具或对象识别错误(例如:用户使用VSCode,但文中写成Sublime)

2. **逻辑性错误**:
   - 因果关系混乱(例如:结果在前,原因在后)
   - 步骤遗漏或重复
   - 前后矛盾的描述

3. **语言表达问题**:
   - 明显的语法错误
   - 不通顺的句子
   - 术语使用不当
   - 重复或冗余的内容

4. **格式问题**:
   - Markdown格式错误
   - 列表或标题层级混乱

**你不应该做的事**:
- 不要添加分析结果中未提及的新信息
- 不要改变原有的写作风格和详细程度
- 不要删除重要的细节信息
- 不要过度修改(只修复明显错误)

**辅助信息**:
{metadata_context}
{user_memory_context}

**原始分析结果**:
{raw_content}

**输出要求**:
- 只输出修复后的分析结果,不要有任何前缀(如"修复后:"、"结果:"等)
- 保持原有的Markdown格式
- 如果没有发现明显错误,直接输出原文即可

请输出修复后的分析结果:"""

# ========== 英文Prompt ==========

REFINEMENT_PROMPT_EN = """You are an expert in video analysis content review and refinement.

**Task**: Review and fix obvious errors in the provided AI video analysis result.

**Types of errors you need to check and fix**:
1. **Factual Errors**:
   - Timeline errors (e.g., B happened before A, but text says A then B)
   - Operation step errors (e.g., user clicked button X, but text says button Y)
   - Tool or object recognition errors (e.g., user used VSCode, but text says Sublime)

2. **Logic Errors**:
   - Confused cause-and-effect relationships
   - Missing or duplicated steps
   - Contradictory descriptions

3. **Language Expression Issues**:
   - Obvious grammatical errors
   - Awkward sentences
   - Improper terminology usage
   - Repetitive or redundant content

4. **Formatting Issues**:
   - Markdown format errors
   - Confused list or heading hierarchy

**What you should NOT do**:
- Don't add new information not mentioned in the original analysis
- Don't change the original writing style or level of detail
- Don't remove important details
- Don't over-edit (only fix obvious errors)

**Supporting Information**:
{metadata_context}
{user_memory_context}

**Raw Analysis Result**:
{raw_content}

**Output Requirements**:
- Only output the refined analysis result, no prefix (like "Refined:", "Result:", etc.)
- Keep the original Markdown format
- If no obvious errors found, output the original text as-is

Please output the refined analysis result:"""


# ========== 元数据上下文模板 ==========

METADATA_CONTEXT_ZH = """
**视频元数据**:
- 视频总长度: {duration:.2f}秒
{extra_metadata}
"""

METADATA_CONTEXT_EN = """
**Video Metadata**:
- Total video duration: {duration:.2f} seconds
{extra_metadata}
"""

USER_MEMORY_CONTEXT_ZH = """
**用户背景信息**(帮助你判断技术术语和操作是否合理):
{user_memory}
"""

USER_MEMORY_CONTEXT_EN = """
**User Background Information** (helps you judge if technical terms and operations are reasonable):
{user_memory}
"""


def build_refinement_prompt(
    raw_content: str,
    video_duration: float,
    user_memory: str = "",
    extra_metadata: dict = None,
    language: str = "zh"
) -> str:
    """
    构建分析结果修复prompt

    Args:
        raw_content: 原始分析结果
        video_duration: 视频总长度(秒)
        user_memory: 用户记忆JSON字符串
        extra_metadata: 额外的元数据字典(可选)
        language: 'zh' (中文) 或 'en' (英文)

    Returns:
        完整的prompt字符串
    """
    # 构建元数据上下文
    extra_meta_text = ""
    if extra_metadata:
        for key, value in extra_metadata.items():
            extra_meta_text += f"- {key}: {value}\n"

    metadata_template = METADATA_CONTEXT_ZH if language == "zh" else METADATA_CONTEXT_EN
    metadata_context = metadata_template.format(
        duration=video_duration,
        extra_metadata=extra_meta_text
    )

    # 构建用户记忆上下文
    user_memory_context = ""
    if user_memory:
        context_template = USER_MEMORY_CONTEXT_ZH if language == "zh" else USER_MEMORY_CONTEXT_EN
        user_memory_context = context_template.format(user_memory=user_memory)

    # 选择prompt模板
    template = REFINEMENT_PROMPT_ZH if language == "zh" else REFINEMENT_PROMPT_EN

    # 填充模板
    prompt = template.format(
        metadata_context=metadata_context,
        user_memory_context=user_memory_context,
        raw_content=raw_content
    )

    return prompt
