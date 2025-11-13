"""
Gemini video analyzer implementation using Google Generative AI
"""
from typing import AsyncGenerator
from google import genai
from google.genai import types
import json

from config import Config
from exceptions import AIServiceError
from models.base import VideoAnalyzer
from prompts import PromptBuilder
from prompts import title_generation_prompts
from prompts import analysis_refinement_prompts
from prompts import memory_extraction_prompts
from utils.logger import setup_logger

logger = setup_logger(__name__)


class GeminiAnalyzer(VideoAnalyzer):
    """Gemini video analyzer using Google Generative AI API"""

    def __init__(self):
        if not Config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")

        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.vl_model = Config.GEMINI_VL_MODEL  # Video + Language model
        self.text_model = Config.GEMINI_TEXT_MODEL  # Text-only model

        # Initialize prompt builder
        self.prompt_builder = PromptBuilder(
            language=Config.PROMPT_LANGUAGE,
            scenario=Config.PROMPT_SCENARIO
        )

        logger.info(f"Initialized GeminiAnalyzer with VL model: {self.vl_model}, Text model: {self.text_model}")
        logger.info(f"Prompt config: language={Config.PROMPT_LANGUAGE}, scenario={Config.PROMPT_SCENARIO}")

    async def analyze_video(
            self,
            video_url: str,
            context: str = "",
            session_id: str = "",
            window_index: int = 0,
            analysis_mode: str = "sliding_window",
            user_memory: str = ""
    ) -> AsyncGenerator[str, None]:
        """
        Analyze video using Gemini API

        Args:
            video_url: URL to video file (must be accessible URL, e.g., gs:// or https://)
            context: Previous analysis for context
            session_id: Session ID
            window_index: Window index
            analysis_mode: Analysis mode ("full" or "sliding_window")

        Yields:
            Analysis result tokens
        """
        try:
            logger.info(f"Analyzing video with Gemini: session={session_id}, window={window_index}, mode={analysis_mode}")

            # Build prompt using PromptBuilder based on analysis mode
            if analysis_mode == "full":
                # Full video analysis - use dedicated full video prompt
                prompt = self.prompt_builder.build_full_video_prompt(
                    include_scenario_hint=Config.PROMPT_INCLUDE_SCENARIO_HINT,
                    user_memory=user_memory
                )
                logger.debug("Built full video analysis prompt")
            elif context:
                # Subsequent window with context (sliding window mode)
                prompt = self.prompt_builder.build_subsequent_window_prompt(
                    context=context,
                    include_scenario_hint=Config.PROMPT_INCLUDE_SCENARIO_HINT,
                    user_memory=user_memory
                )
                logger.debug(f"Built subsequent window prompt with context length: {len(context)}")
            else:
                # First window (sliding window mode)
                prompt = self.prompt_builder.build_first_window_prompt(
                    include_scenario_hint=Config.PROMPT_INCLUDE_SCENARIO_HINT,
                    user_memory=user_memory
                )
                logger.debug("Built first window prompt")

            # Determine MIME type from URL
            mime_type = 'video/mp4'
            if video_url.endswith('.webm'):
                mime_type = 'video/webm'
            elif video_url.endswith('.mov'):
                mime_type = 'video/quicktime'

            # Use the new API to stream content with video (use VL model)
            # Note: video_url must be a publicly accessible URL (e.g., gs:// or https://)
            response = self.client.models.generate_content_stream(
                model=self.vl_model,
                contents=[
                    prompt,
                    types.Part.from_uri(
                        file_uri=video_url,
                        mime_type=mime_type
                    )
                ]
            )

            # Stream results
            full_content = ""
            for chunk in response:
                if chunk.text:
                    content = chunk.text
                    full_content += content
                    yield content

            logger.info(f"Gemini analysis completed: session={session_id}, window={window_index}, length={len(full_content)}")

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            raise AIServiceError(f"Gemini analysis failed: {e}")

    def get_model_name(self) -> str:
        """Get model name"""
        return f"gemini-{self.model_name}"

    async def generate_title(
            self,
            analysis_results: list[str],
            user_memory: str = ""
    ) -> str:
        """
        Generate a concise title (<=10 chars) based on analysis results

        Args:
            analysis_results: List of all refined analysis results
            user_memory: User memory JSON string

        Returns:
            Generated title string
        """
        try:
            logger.info("Generating title with Gemini")

            # Build prompt
            prompt = title_generation_prompts.build_title_generation_prompt(
                analysis_results=analysis_results,
                user_memory=user_memory,
                language=Config.PROMPT_LANGUAGE
            )

            # Call Gemini API (text-only, non-streaming, use text model)
            response = self.client.models.generate_content(
                model=self.text_model,
                contents=prompt
            )

            title = response.text.strip()
            logger.info(f"Generated title: {title}")
            return title

        except Exception as e:
            logger.error(f"Title generation failed: {e}")
            raise AIServiceError(f"Title generation failed: {e}")

    async def refine_analysis(
            self,
            raw_content: str,
            video_duration: float,
            user_memory: str = "",
            extra_metadata: dict = None
    ) -> str:
        """
        Refine analysis result by fixing obvious errors

        Args:
            raw_content: Raw analysis result
            video_duration: Total video duration in seconds
            user_memory: User memory JSON string
            extra_metadata: Extra metadata dict

        Returns:
            Refined analysis result
        """
        try:
            logger.info("Refining analysis with Gemini")

            # Build prompt
            prompt = analysis_refinement_prompts.build_refinement_prompt(
                raw_content=raw_content,
                video_duration=video_duration,
                user_memory=user_memory,
                extra_metadata=extra_metadata,
                language=Config.PROMPT_LANGUAGE
            )

            # Call Gemini API (text-only, non-streaming, use text model)
            response = self.client.models.generate_content(
                model=self.text_model,
                contents=prompt
            )

            refined = response.text.strip()
            logger.info(f"Refined content length: {len(refined)}")
            return refined

        except Exception as e:
            logger.error(f"Analysis refinement failed: {e}")
            raise AIServiceError(f"Analysis refinement failed: {e}")

    async def extract_user_memory(
            self,
            analysis_results: list[str],
            current_memory: str = ""
    ) -> str:
        """
        Extract user memory (habits, knowledge, behavior patterns) from analysis

        Args:
            analysis_results: List of all refined analysis results
            current_memory: Current user memory JSON string

        Returns:
            Extracted new memory data (JSON string)
        """
        try:
            logger.info("Extracting user memory with Gemini")

            # Build prompt
            prompt = memory_extraction_prompts.build_memory_extraction_prompt(
                analysis_results=analysis_results,
                current_memory=current_memory,
                language=Config.PROMPT_LANGUAGE
            )

            # Call Gemini API (text-only, non-streaming, use text model)
            response = self.client.models.generate_content(
                model=self.text_model,
                contents=prompt
            )

            memory_json = response.text.strip()

            # Validate JSON format
            try:
                json.loads(memory_json)
                logger.info(f"Extracted memory length: {len(memory_json)}")
                return memory_json
            except json.JSONDecodeError as je:
                logger.warning(f"Invalid JSON returned, using empty structure: {je}")
                return json.dumps({
                    "habits": {},
                    "knowledge": {},
                    "behavior_patterns": {}
                })

        except Exception as e:
            logger.error(f"Memory extraction failed: {e}")
            raise AIServiceError(f"Memory extraction failed: {e}")
