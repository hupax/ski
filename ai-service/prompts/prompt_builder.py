"""
Prompt builder for video analysis.
Provides flexible and configurable prompt generation.
"""

from typing import Optional
from prompts import base_prompts


class PromptBuilder:
    """Build analysis prompts based on context and configuration"""

    def __init__(self, language: str = 'zh', scenario: Optional[str] = None):
        """
        Initialize prompt builder

        Args:
            language: Language code ('zh' or 'en')
            scenario: Scenario type ('programming', 'crafts', 'teaching', 'general')
        """
        self.language = language.lower()
        self.scenario = scenario or 'general'

        # Validate language
        if self.language not in ['zh', 'en']:
            raise ValueError(f"Unsupported language: {self.language}. Use 'zh' or 'en'.")

    def build_first_window_prompt(
            self,
            include_scenario_hint: bool = True,
            user_memory: str = ""
    ) -> str:
        """
        Build prompt for the first window (no context)

        Args:
            include_scenario_hint: Whether to include scenario-specific hints (deprecated, kept for compatibility)
            user_memory: User memory JSON string

        Returns:
            Complete prompt string
        """
        template = base_prompts.FIRST_WINDOW_PROMPT_ZH if self.language == 'zh' else base_prompts.FIRST_WINDOW_PROMPT_EN
        user_memory_context = self._build_user_memory_context(user_memory)

        return template.format(user_memory_context=user_memory_context)

    def build_subsequent_window_prompt(
            self,
            context: str,
            include_scenario_hint: bool = True,
            user_memory: str = ""
    ) -> str:
        """
        Build prompt for subsequent windows (with context)

        Args:
            context: Previous analysis result
            include_scenario_hint: Whether to include scenario-specific hints (deprecated, kept for compatibility)
            user_memory: User memory JSON string

        Returns:
            Complete prompt string
        """
        template = base_prompts.SUBSEQUENT_WINDOW_PROMPT_ZH if self.language == 'zh' else base_prompts.SUBSEQUENT_WINDOW_PROMPT_EN
        user_memory_context = self._build_user_memory_context(user_memory)

        return template.format(
            context=context,
            user_memory_context=user_memory_context
        )

    def build_full_video_prompt(
            self,
            include_scenario_hint: bool = True,
            user_memory: str = ""
    ) -> str:
        """
        Build prompt for full video analysis

        Args:
            include_scenario_hint: Whether to include scenario-specific hints (deprecated, kept for compatibility)
            user_memory: User memory JSON string

        Returns:
            Complete prompt string
        """
        template = base_prompts.FULL_VIDEO_PROMPT_ZH if self.language == 'zh' else base_prompts.FULL_VIDEO_PROMPT_EN
        user_memory_context = self._build_user_memory_context(user_memory)

        return template.format(user_memory_context=user_memory_context)

    def _build_user_memory_context(self, user_memory: str) -> str:
        """Build user memory context section"""
        if not user_memory or user_memory.strip() in ['', '{}']:
            return ""

        if self.language == 'zh':
            return f"\n\n**用户背景信息**(帮助你更好地理解视频内容和用户习惯):\n```json\n{user_memory}\n```\n"
        else:
            return f"\n\n**User Background Information** (helps you better understand video content and user habits):\n```json\n{user_memory}\n```\n"

    def set_language(self, language: str):
        """Change language setting"""
        if language.lower() not in ['zh', 'en']:
            raise ValueError(f"Unsupported language: {language}")
        self.language = language.lower()

    def set_scenario(self, scenario: str):
        """Change scenario setting"""
        valid_scenarios = ['programming', 'crafts', 'teaching', 'general']
        if scenario not in valid_scenarios:
            raise ValueError(f"Invalid scenario: {scenario}. Must be one of {valid_scenarios}")
        self.scenario = scenario
