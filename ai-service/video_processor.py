"""
Video processing module using FFmpeg
Handles video slicing with sliding window strategy
"""
import os
import subprocess
from typing import List
from pathlib import Path

from config import Config
from exceptions import FFmpegError, VideoProcessingError
from utils.logger import setup_logger

logger = setup_logger(__name__)


class VideoProcessor:
    """Video processor for FFmpeg operations"""

    def __init__(self):
        self.temp_path = Config.TEMP_PATH
        self._ensure_temp_dir()

    def _ensure_temp_dir(self):
        """Ensure temporary directory exists"""
        Path(self.temp_path).mkdir(parents=True, exist_ok=True)
        logger.info(f"Temp directory ensured: {self.temp_path}")

    def slice_video(
            self,
            video_path: str,
            session_id: str,
            chunk_id: int,
            window_size: int = None,
            window_step: int = None
    ) -> List[str]:
        """
        Slice video using sliding window strategy

        Args:
            video_path: Path to input video file
            session_id: Session ID for organizing output
            chunk_id: Chunk ID
            window_size: Window size in seconds (default from config)
            window_step: Step size in seconds (default from config)

        Returns:
            List of sliced window file paths

        Raises:
            VideoProcessingError: If video processing fails
        """
        try:
            if not os.path.exists(video_path):
                raise VideoProcessingError(f"Video file not found: {video_path}")

            # Use config defaults if not specified
            window_size = window_size or Config.WINDOW_SIZE
            window_step = window_step or Config.WINDOW_STEP

            # Get video duration
            duration = self._get_video_duration(video_path)
            logger.info(f"Video duration: {duration}s, window_size: {window_size}s, step: {window_step}s")

            # Calculate windows
            windows = self._calculate_windows(duration, window_size, window_step)
            logger.info(f"Calculated {len(windows)} windows")

            # Create output directory
            output_dir = os.path.join(self.temp_path, session_id, f"chunk_{chunk_id}")
            Path(output_dir).mkdir(parents=True, exist_ok=True)

            # Slice video
            window_paths = []
            for i, (start, end) in enumerate(windows):
                output_path = os.path.join(output_dir, f"window_{i}.webm")
                self._slice_segment(video_path, output_path, start, end - start)
                window_paths.append(output_path)
                logger.info(f"Created window {i}: {start}-{end}s -> {output_path}")

            return window_paths

        except FFmpegError as e:
            logger.error(f"FFmpeg error: {e}")
            raise VideoProcessingError(f"Video slicing failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in slice_video: {e}")
            raise VideoProcessingError(f"Video processing failed: {e}")

    def _get_video_duration(self, video_path: str) -> float:
        """
        Get video duration using ffprobe

        Args:
            video_path: Path to video file

        Returns:
            Duration in seconds
        """
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                video_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

            duration = float(result.stdout.strip())
            return duration

        except subprocess.CalledProcessError as e:
            logger.error(f"ffprobe failed: {e.stderr}")
            raise FFmpegError(f"Failed to get video duration: {e.stderr}")
        except ValueError as e:
            logger.error(f"Failed to parse duration: {e}")
            raise FFmpegError(f"Invalid duration value")

    def _calculate_windows(
            self,
            duration: float,
            window_size: int,
            window_step: int
    ) -> List[tuple]:
        """
        Calculate sliding windows

        Args:
            duration: Video duration in seconds
            window_size: Window size in seconds
            window_step: Step size in seconds

        Returns:
            List of (start, end) tuples
        """
        windows = []
        start = 0

        while start < duration:
            end = min(start + window_size, duration)
            windows.append((start, end))

            # If this window reaches the end, break
            if end >= duration:
                break

            start += window_step

        return windows

    def _slice_segment(
            self,
            input_path: str,
            output_path: str,
            start: float,
            duration: float
    ):
        """
        Slice a segment using FFmpeg

        Args:
            input_path: Input video file
            output_path: Output video file
            start: Start time in seconds
            duration: Duration in seconds
        """
        try:
            cmd = [
                'ffmpeg',
                '-y',  # Overwrite output file
                '-i', input_path,
                '-ss', str(start),
                '-t', str(duration),
                '-c:v', 'libvpx-vp9',  # VP9 video codec for WebM
                '-c:a', 'libopus',  # Opus audio codec for WebM
                '-b:v', '1M',  # Video bitrate
                '-crf', '30',  # Quality (lower = better, range 0-63)
                output_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

            logger.debug(f"FFmpeg slicing completed: {output_path}")

        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg failed: {e.stderr}")
            raise FFmpegError(f"FFmpeg slicing failed: {e.stderr}")

    def cleanup_session(self, session_id: str):
        """
        Cleanup temporary files for a session

        Args:
            session_id: Session ID
        """
        try:
            session_dir = os.path.join(self.temp_path, session_id)
            if os.path.exists(session_dir):
                import shutil
                shutil.rmtree(session_dir)
                logger.info(f"Cleaned up session directory: {session_dir}")
        except Exception as e:
            logger.warning(f"Failed to cleanup session {session_id}: {e}")
