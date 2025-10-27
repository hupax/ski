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
            duration: int = 15,
            include_scenario_hint: bool = True
    ) -> str:
        """
        Build prompt for the first window (no context)

        Args:
            duration: Window duration in seconds
            include_scenario_hint: Whether to include scenario-specific hints

        Returns:
            Complete prompt string
        """
        if self.language == 'zh':
            template = base_prompts.FIRST_WINDOW_PROMPT_ZH
            system_role = base_prompts.SYSTEM_ROLE_ZH
            core_req = base_prompts.CORE_REQUIREMENTS_ZH
            focus = base_prompts.FOCUS_POINTS_ZH
        else:
            template = base_prompts.FIRST_WINDOW_PROMPT_EN
            system_role = base_prompts.SYSTEM_ROLE_EN
            core_req = base_prompts.CORE_REQUIREMENTS_EN
            focus = base_prompts.FOCUS_POINTS_EN

        # Add scenario enhancement if requested
        scenario_hint = ""
        if include_scenario_hint and self.language == 'zh':
            scenario_hint = self._get_scenario_enhancement_zh()

        prompt = template.format(
            duration=duration,
            system_role=system_role,
            core_requirements=core_req,
            focus_points=focus + scenario_hint
        )

        return prompt

    def build_subsequent_window_prompt(
            self,
            context: str,
            duration: int = 15,
            overlap: int = 5,
            include_scenario_hint: bool = True
    ) -> str:
        """
        Build prompt for subsequent windows (with context)

        Args:
            context: Previous analysis result
            duration: Window duration in seconds
            overlap: Overlap duration with previous window in seconds
            include_scenario_hint: Whether to include scenario-specific hints

        Returns:
            Complete prompt string
        """
        if self.language == 'zh':
            template = base_prompts.SUBSEQUENT_WINDOW_PROMPT_ZH
            system_role = base_prompts.SYSTEM_ROLE_ZH
            core_req = base_prompts.CORE_REQUIREMENTS_ZH
            focus = base_prompts.FOCUS_POINTS_ZH
        else:
            template = base_prompts.SUBSEQUENT_WINDOW_PROMPT_EN
            system_role = base_prompts.SYSTEM_ROLE_EN
            core_req = base_prompts.CORE_REQUIREMENTS_EN
            focus = base_prompts.FOCUS_POINTS_EN

        # Add scenario enhancement if requested
        scenario_hint = ""
        if include_scenario_hint and self.language == 'zh':
            scenario_hint = self._get_scenario_enhancement_zh()

        prompt = template.format(
            duration=duration,
            overlap=overlap,
            context=context,
            system_role=system_role,
            core_requirements=core_req,
            focus_points=focus + scenario_hint
        )

        return prompt

    def build_full_video_prompt(
            self,
            duration: int = 30,
            include_scenario_hint: bool = True
    ) -> str:
        """
        Build prompt for full video analysis

        Args:
            duration: Total video duration in seconds
            include_scenario_hint: Whether to include scenario-specific hints

        Returns:
            Complete prompt string
        """
        if self.language == 'zh':
            template = base_prompts.FULL_VIDEO_PROMPT_ZH
            system_role = base_prompts.SYSTEM_ROLE_ZH
            core_req = base_prompts.CORE_REQUIREMENTS_ZH
            focus = base_prompts.FOCUS_POINTS_ZH
        else:
            template = base_prompts.FULL_VIDEO_PROMPT_EN
            system_role = base_prompts.SYSTEM_ROLE_EN
            core_req = base_prompts.CORE_REQUIREMENTS_EN
            focus = base_prompts.FOCUS_POINTS_EN

        # Add scenario enhancement if requested
        scenario_hint = ""
        if include_scenario_hint and self.language == 'zh':
            scenario_hint = self._get_scenario_enhancement_zh()

        prompt = template.format(
            duration=duration,
            system_role=system_role,
            core_requirements=core_req,
            focus_points=focus + scenario_hint
        )

        return prompt

    def _get_scenario_enhancement_zh(self) -> str:
        """Get scenario-specific enhancement prompt (Chinese)"""
        enhancements = {
            'programming': base_prompts.PROGRAMMING_ENHANCEMENT_ZH,
            'crafts': base_prompts.CRAFTS_ENHANCEMENT_ZH,
            'teaching': base_prompts.TEACHING_ENHANCEMENT_ZH,
            'general': base_prompts.GENERAL_ENHANCEMENT_ZH
        }
        return enhancements.get(self.scenario, base_prompts.GENERAL_ENHANCEMENT_ZH)

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
