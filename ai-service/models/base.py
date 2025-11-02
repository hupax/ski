"""
Abstract base class for video analyzers
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator


class VideoAnalyzer(ABC):
    """Abstract base class for AI video analysis"""

    @abstractmethod
    async def analyze_video(
            self,
            video_url: str,
            context: str = "",
            session_id: str = "",
            window_index: int = 0,
            analysis_mode: str = "sliding_window"
    ) -> AsyncGenerator[str, None]:
        """
        Analyze video and yield results as stream

        Args:
            video_url: URL to video file (MinIO presigned URL)
            context: Previous window analysis result for context
            session_id: Session ID for logging
            window_index: Window index for logging
            analysis_mode: Analysis mode ("full" or "sliding_window")

        Yields:
            Analysis result tokens (streaming)

        Raises:
            AIServiceError: If AI API call fails
        """
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Get the model name"""
        pass
