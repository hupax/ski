"""
Gemini video analyzer implementation using Google Generative AI
"""
from typing import AsyncGenerator
from google import genai
from google.genai import types

from config import Config
from exceptions import AIServiceError
from models.base import VideoAnalyzer
from prompts import PromptBuilder
from utils.logger import setup_logger

logger = setup_logger(__name__)


class GeminiAnalyzer(VideoAnalyzer):
    """Gemini video analyzer using Google Generative AI API"""

    def __init__(self):
        if not Config.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")

        self.client = genai.Client(api_key=Config.GEMINI_API_KEY)
        self.model_name = Config.GEMINI_MODEL

        # Initialize prompt builder
        self.prompt_builder = PromptBuilder(
            language=Config.PROMPT_LANGUAGE,
            scenario=Config.PROMPT_SCENARIO
        )

        logger.info(f"Initialized GeminiAnalyzer with model: {self.model_name}")
        logger.info(f"Prompt config: language={Config.PROMPT_LANGUAGE}, scenario={Config.PROMPT_SCENARIO}")

    async def analyze_video(
            self,
            video_url: str,
            context: str = "",
            session_id: str = "",
            window_index: int = 0,
            analysis_mode: str = "sliding_window"
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
                    include_scenario_hint=Config.PROMPT_INCLUDE_SCENARIO_HINT
                )
                logger.debug("Built full video analysis prompt")
            elif context:
                # Subsequent window with context (sliding window mode)
                prompt = self.prompt_builder.build_subsequent_window_prompt(
                    context=context,
                    include_scenario_hint=Config.PROMPT_INCLUDE_SCENARIO_HINT
                )
                logger.debug(f"Built subsequent window prompt with context length: {len(context)}")
            else:
                # First window (sliding window mode)
                prompt = self.prompt_builder.build_first_window_prompt(
                    include_scenario_hint=Config.PROMPT_INCLUDE_SCENARIO_HINT
                )
                logger.debug("Built first window prompt")

            # Determine MIME type from URL
            mime_type = 'video/mp4'
            if video_url.endswith('.webm'):
                mime_type = 'video/webm'
            elif video_url.endswith('.mov'):
                mime_type = 'video/quicktime'

            # Use the new API to stream content with video
            # Note: video_url must be a publicly accessible URL (e.g., gs:// or https://)
            response = self.client.models.generate_content_stream(
                model=self.model_name,
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
