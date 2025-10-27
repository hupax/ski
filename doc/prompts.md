# AI 提示词系统说明

## 概述

本项目采用独立的提示词管理系统，将AI提示词从代码中解耦，实现灵活配置和场景化定制。

### 核心优势

- ✅ **解耦设计**: 提示词与模型实现分离，符合单一职责原则
- ✅ **可配置化**: 通过环境变量调整提示词策略，无需改代码
- ✅ **场景定制**: 支持编程、手工、教学等不同场景的专门优化
- ✅ **多语言支持**: 中文和英文提示词可切换
- ✅ **版本管理**: 统一管理，便于迭代和A/B测试

## 架构设计

```
ai-service/
├── prompts/                     # 提示词模块
│   ├── __init__.py
│   ├── base_prompts.py         # 基础提示词模板
│   └── prompt_builder.py       # 提示词构建器
├── models/
│   ├── qwen_analyzer.py        # 使用PromptBuilder
│   └── gemini_analyzer.py      # 使用PromptBuilder
└── config.py                    # 提示词配置
```

## 提示词设计原则

根据项目需求（见 `doc/dev3.md`），提示词强调：

### 1. 连贯性 (Coherence)
- AI理解上下文，生成连贯描述而非碎片
- 使用恰当的过渡词（接着、然后、随后等）
- 后续窗口继承前文语境

### 2. 完整性 (Completeness)
- 不遗漏关键信息
- 关注用户操作的完整序列
- 记录重要的状态变化

### 3. 准确性 (Accuracy)
- 准确描述用户行为，避免推测
- 关注实际操作和可见内容
- 第三人称客观描述

### 4. 时序性 (Chronology)
- 按时间顺序描述事件
- 明确动作的先后关系

### 5. 场景适应性 (Context-Awareness)
- 根据场景（编程/手工/教学）调整关注重点
- 识别领域特定的关键信息

## 配置说明

### 环境变量

```bash
# .env
# 提示词语言: zh (中文) | en (英文)
PROMPT_LANGUAGE=zh

# 应用场景: programming | crafts | teaching | general
PROMPT_SCENARIO=general

# 是否包含场景特定提示
PROMPT_INCLUDE_SCENARIO_HINT=true
```

### 语言选择 (PROMPT_LANGUAGE)

#### zh (中文) - 默认推荐
- 适合国内用户
- 提示词经过精心优化
- 输出自然流畅的中文描述

#### en (英文)
- 适合国际用户
- 英文提示词
- 输出英文描述

### 场景选择 (PROMPT_SCENARIO)

#### general (通用) - 默认
适用于大多数场景，关注：
- 用户的主要任务目标
- 使用的应用程序和界面
- 鼠标、键盘、触控等交互
- 界面元素和内容
- 操作顺序和逻辑

#### programming (编程)
适用于编程、开发场景，额外关注：
- 正在编辑的代码文件和编程语言
- 使用的IDE或编辑器
- 代码的主要功能和逻辑
- 调试、运行、测试操作
- 查看文档或搜索资料

#### crafts (手工)
适用于手工制作、DIY场景，额外关注：
- 使用的工具和材料
- 制作步骤和工艺流程
- 关键的操作技巧
- 半成品和成品状态
- 测量、切割、拼接等动作

#### teaching (教学)
适用于教学、培训场景，额外关注：
- 讲解的主题和内容
- 使用的教学材料（PPT、板书、演示）
- 重点概念和知识点
- 举例说明和演示
- 与学生的互动

## 提示词结构

### 首个窗口（无上下文）

```
系统角色定义
  ↓
核心要求
  - 连贯性
  - 完整性
  - 准确性
  - 时序性
  - 简洁性
  ↓
关注重点
  - 用户操作
  - 使用工具
  - 操作目的
  - 环境信息
  - 状态变化
  ↓
场景特定提示（可选）
  - programming: 代码、IDE、调试...
  - crafts: 工具、材料、工艺...
  - teaching: 教学材料、知识点...
  ↓
输出格式要求
  - 第三人称
  - 段落形式
  - 中文/英文
```

### 后续窗口（有上下文）

```
系统角色定义
  ↓
核心要求（同上）
  ↓
关注重点（同上）
  ↓
前置上下文
  - 之前的分析结果
  ↓
重要说明
  - 识别重叠部分（5秒）
  - 重点描述新动作
  - 避免重复前文
  - 保持连贯性
  ↓
场景特定提示（可选）
  ↓
输出格式要求
```

## 使用示例

### 代码中使用

```python
from prompts import PromptBuilder
from config import Config

# 初始化PromptBuilder
prompt_builder = PromptBuilder(
    language=Config.PROMPT_LANGUAGE,    # 'zh' or 'en'
    scenario=Config.PROMPT_SCENARIO      # 'general', 'programming', etc.
)

# 构建首个窗口提示词
first_prompt = prompt_builder.build_first_window_prompt(
    duration=15,                         # 窗口时长（秒）
    include_scenario_hint=True           # 包含场景提示
)

# 构建后续窗口提示词
subsequent_prompt = prompt_builder.build_subsequent_window_prompt(
    context="前面的分析结果...",         # 前文
    duration=15,                          # 窗口时长
    overlap=5,                            # 重叠时长
    include_scenario_hint=True
)

# 构建整体分析提示词
full_prompt = prompt_builder.build_full_video_prompt(
    duration=60,                          # 总时长
    include_scenario_hint=True
)
```

### 运行时切换

```python
# 切换语言
prompt_builder.set_language('en')

# 切换场景
prompt_builder.set_scenario('programming')
```

## 提示词样例

### 中文首个窗口（编程场景）

```
你正在分析一段视频的开始部分（时长约15秒）。

你是一个专业的视频内容分析助手，专注于准确、连贯地描述用户的活动。
你的任务是观察视频中用户的行为，并生成详细、连贯的文字记录。

核心要求：
1. **连贯性**：生成流畅、连贯的描述，而非碎片化的句子
2. **完整性**：不遗漏关键信息和重要动作
3. **准确性**：准确描述用户正在做什么，避免推测
4. **时序性**：按照时间顺序描述事件发展
5. **简洁性**：用词精炼，避免冗余

关注重点：
- 用户的主要操作和动作序列
- 正在使用的工具、设备或材料
- 操作的目的和步骤
- 环境和上下文信息（如屏幕内容、物品等）
- 关键的状态变化和结果

**编程场景特别关注**：
- 正在编辑的代码文件和编程语言
- 使用的IDE或编辑器
- 代码的主要功能和逻辑
- 调试、运行、测试等操作
- 查看文档或搜索资料的行为

输出格式：
- 使用第三人称描述（如：用户打开了...）
- 自然的段落形式，不要使用列表
- 中文输出

请开始分析这段视频：
```

### 中文后续窗口（带上下文）

```
你正在分析一段视频的后续部分（时长约15秒）。

[系统角色和核心要求...]

**前置上下文**（之前已分析的内容）：
用户打开了VSCode编辑器，创建了一个新的Python文件main.py，并开始编写代码...

**重要说明**：
- 这段视频与前文有5秒重叠，请注意识别已描述的内容
- **重点描述当前时段的新动作和变化**，避免重复前文
- 如果动作是前文的延续，简要说明"继续..."即可，然后重点描述新的变化
- 保持与前文的连贯性，使用恰当的过渡词（如：接着、然后、随后等）

[输出格式要求...]

请继续分析这段视频：
```

## 提示词优化建议

### 针对不同AI模型

#### Qwen (DashScope)
- 中文提示词效果更好
- 擅长理解中文语境和细节
- 推荐使用 `PROMPT_LANGUAGE=zh`

#### Gemini
- 支持中英文，但英文可能更稳定
- 可以尝试 `PROMPT_LANGUAGE=en`
- 视具体效果调整

### A/B测试

建议对比测试不同配置：

1. **语言对比**: zh vs en
2. **场景对比**: general vs specific scenario
3. **场景提示**: include_scenario_hint true vs false

记录输出质量，选择最优配置。

## 扩展指南

### 添加新的场景

1. 在 `prompts/base_prompts.py` 添加场景提示：

```python
# 新场景：医疗诊断
MEDICAL_ENHANCEMENT_ZH = """
**医疗诊断场景特别关注**：
- 使用的医疗设备和仪器
- 检查的部位和方法
- 观察到的症状和体征
- 诊断过程和判断依据
- 记录和报告的内容
"""
```

2. 在 `PromptBuilder._get_scenario_enhancement_zh()` 添加映射：

```python
enhancements = {
    # ... 现有场景
    'medical': base_prompts.MEDICAL_ENHANCEMENT_ZH
}
```

3. 使用新场景：

```bash
PROMPT_SCENARIO=medical
```

### 自定义提示词模板

如果需要完全自定义提示词，可以：

1. 继承 `PromptBuilder` 类
2. 重写 `build_*_prompt()` 方法
3. 在analyzer中使用自定义builder

## 常见问题

### Q: 提示词太长会影响性能吗？

A: 会略微增加token消耗，但：
- 更好的提示词 = 更高质量的输出
- 减少后期人工修正成本
- 总体性价比更高

### Q: 英文输出质量不如中文？

A: 取决于具体场景和AI模型：
- Qwen: 中文优势明显
- Gemini: 中英文都不错
- 建议测试后选择

### Q: 如何验证提示词效果？

A: 建议方法：
1. 录制测试视频（包含典型场景）
2. 使用不同配置分析
3. 对比输出的连贯性、完整性、准确性
4. 选择最优配置

### Q: 可以动态调整提示词吗？

A: 可以：
- 运行时修改环境变量
- 重启ai-service生效
- 或使用 `PromptBuilder.set_language()` / `set_scenario()` 方法

## 参考资料

- 项目需求: `doc/dev3.md` - 核心需求和关键特征
- AI配置: `CLAUDE.md` - 开发指南
- Qwen使用: `doc/qwen.md` - DashScope SDK
