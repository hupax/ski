"""
Qwen video analyzer implementation using DashScope native SDK
"""
from typing import AsyncGenerator
import dashscope

from config import Config
from exceptions import AIServiceError
from models.base import VideoAnalyzer
from prompts import PromptBuilder
from utils.logger import setup_logger

logger = setup_logger(__name__)


class QwenAnalyzer(VideoAnalyzer):
    """Qwen video analyzer using DashScope native SDK"""

    def __init__(self):
        if not Config.QWEN_API_KEY:
            raise ValueError("QWEN_API_KEY not configured")

        dashscope.api_key = Config.QWEN_API_KEY
        self.model = Config.QWEN_MODEL

        # Initialize prompt builder
        self.prompt_builder = PromptBuilder(
            language=Config.PROMPT_LANGUAGE,
            scenario=Config.PROMPT_SCENARIO
        )

        logger.info(f"Initialized QwenAnalyzer with model: {self.model}")
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
        Analyze video using Qwen API

        Args:
            video_url: URL to video file
            context: Previous analysis for context
            session_id: Session ID
            window_index: Window index
            analysis_mode: Analysis mode ("full" or "sliding_window")

        Yields:
            Analysis result tokens
        """
        try:
            logger.info(f"Analyzing video with Qwen: session={session_id}, window={window_index}, mode={analysis_mode}")
            logger.info(
                f"🤖 [URL-TRACK] Sending to Qwen API: session={session_id}, window={window_index}, videoUrl={video_url}")

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

            # Build messages in DashScope format
            messages = [
                {
                    'role': 'user',
                    'content': [
                        {'video': video_url},
                        {'text': prompt}
                    ]
                }
            ]

            # Call DashScope API with streaming
            responses = dashscope.MultiModalConversation.call(
                model=self.model,
                messages=messages,
                stream=True
            )

            # Track previous length to yield only incremental content
            previous_length = 0
            full_content = ""

            for response in responses:
                if response.status_code == 200:
                    # DashScope returns complete text each time, extract only new part
                    try:
                        # Debug: log response structure
                        content = response.output.choices[0].message.content
                        logger.debug(f"Response content type: {type(content)}, content: {content}")

                        # Handle different response formats
                        if isinstance(content, list):
                            full_content = content[0]['text']
                        elif isinstance(content, str):
                            full_content = content
                        else:
                            logger.error(f"Unexpected content type: {type(content)}, content: {content}")
                            raise AIServiceError(f"Unexpected response format from Qwen API")

                        new_content = full_content[previous_length:]
                        previous_length = len(full_content)

                        if new_content:
                            yield new_content
                    except (KeyError, IndexError, TypeError) as e:
                        logger.error(f"Failed to parse Qwen response: {e}, response: {response}")
                        raise AIServiceError(f"Failed to parse Qwen response: {e}")
                else:
                    error_msg = f"DashScope API error: code={response.code}, message={response.message}"
                    logger.error(error_msg)
                    raise AIServiceError(error_msg)

            logger.info(
                f"Qwen analysis completed: session={session_id}, window={window_index}, length={len(full_content)}")

        except AIServiceError:
            raise
        except Exception as e:
            logger.error(f"Qwen API error: {e}")
            raise AIServiceError(f"Qwen analysis failed: {e}")

    def get_model_name(self) -> str:
        """Get model name"""
        return f"qwen-{self.model}"
