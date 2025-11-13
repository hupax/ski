"""
Qwen video analyzer implementation using DashScope native SDK
"""
from typing import AsyncGenerator
import dashscope
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


class QwenAnalyzer(VideoAnalyzer):
    """Qwen video analyzer using DashScope native SDK"""

    def __init__(self):
        if not Config.QWEN_API_KEY:
            raise ValueError("QWEN_API_KEY not configured")

        dashscope.api_key = Config.QWEN_API_KEY
        self.vl_model = Config.QWEN_VL_MODEL  # Video + Language model
        self.text_model = Config.QWEN_TEXT_MODEL  # Text-only model

        # Initialize prompt builder
        self.prompt_builder = PromptBuilder(
            language=Config.PROMPT_LANGUAGE,
            scenario=Config.PROMPT_SCENARIO
        )

        logger.info(f"Initialized QwenAnalyzer with VL model: {self.vl_model}, Text model: {self.text_model}")
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

            # Call DashScope API with streaming (use VL model for video analysis)
            responses = dashscope.MultiModalConversation.call(
                model=self.vl_model,
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
            logger.info("Generating title with Qwen")

            # Build prompt
            prompt = title_generation_prompts.build_title_generation_prompt(
                analysis_results=analysis_results,
                user_memory=user_memory,
                language=Config.PROMPT_LANGUAGE
            )

            # Call Qwen API (text-only, non-streaming, use text model)
            # Use Generation API for qwen-max (text models)
            response = dashscope.Generation.call(
                model=self.text_model,
                messages=[{'role': 'user', 'content': prompt}]
            )

            if response.status_code == 200:
                # For Generation API, response is in output['text']
                title = response.output.get('text', '').strip()
                logger.info(f"Generated title: {title}")
                return title
            else:
                error_msg = f"Qwen API error: {response.code} - {response.message}"
                logger.error(error_msg)
                raise AIServiceError(error_msg)

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
            logger.info("Refining analysis with Qwen")

            # Build prompt
            prompt = analysis_refinement_prompts.build_refinement_prompt(
                raw_content=raw_content,
                video_duration=video_duration,
                user_memory=user_memory,
                extra_metadata=extra_metadata,
                language=Config.PROMPT_LANGUAGE
            )

            # Call Qwen API (text-only, non-streaming, use text model)
            # Use Generation API for qwen-max (text models)
            response = dashscope.Generation.call(
                model=self.text_model,
                messages=[{'role': 'user', 'content': prompt}]
            )

            if response.status_code == 200:
                # For Generation API, response is in output['text']
                refined = response.output.get('text', '').strip()
                logger.info(f"Refined content length: {len(refined)}")
                return refined
            else:
                error_msg = f"Qwen API error: {response.code} - {response.message}"
                logger.error(error_msg)
                raise AIServiceError(error_msg)

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
            logger.info("Extracting user memory with Qwen")

            # Build prompt
            prompt = memory_extraction_prompts.build_memory_extraction_prompt(
                analysis_results=analysis_results,
                current_memory=current_memory,
                language=Config.PROMPT_LANGUAGE
            )

            # Call Qwen API (text-only, non-streaming, use text model)
            # Use Generation API for qwen-max (text models)
            response = dashscope.Generation.call(
                model=self.text_model,
                messages=[{'role': 'user', 'content': prompt}]
            )

            if response.status_code == 200:
                # For Generation API, response is in output['text']
                memory_json = response.output.get('text', '').strip()
                logger.info(f"Raw Qwen response for memory extraction: '{memory_json}'")

                # Validate JSON format
                try:
                    # Try to extract JSON if wrapped in markdown code block
                    if memory_json.startswith("```json") and memory_json.endswith("```"):
                        memory_json = memory_json[7:-3].strip()
                    elif memory_json.startswith("```") and memory_json.endswith("```"):
                        memory_json = memory_json[3:-3].strip()

                    json.loads(memory_json)
                    logger.info(f"Extracted memory length: {len(memory_json)}")
                    return memory_json
                except json.JSONDecodeError as je:
                    logger.warning(f"Invalid JSON returned: '{memory_json}', error: {je}")
                    return json.dumps({
                        "habits": {},
                        "knowledge": {},
                        "behavior_patterns": {}
                    })
            else:
                error_msg = f"Qwen API error: {response.code} - {response.message}"
                logger.error(error_msg)
                raise AIServiceError(error_msg)

        except Exception as e:
            logger.error(f"Memory extraction failed: {e}")
            raise AIServiceError(f"Memory extraction failed: {e}")
