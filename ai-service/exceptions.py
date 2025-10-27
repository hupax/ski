"""
Custom exceptions for AI Service
"""


class VideoProcessingError(Exception):
    """Raised when video processing fails"""
    pass


class AIServiceError(Exception):
    """Raised when AI API call fails"""
    pass


class ModelNotFoundError(Exception):
    """Raised when specified AI model is not found"""
    pass


class FFmpegError(Exception):
    """Raised when FFmpeg operation fails"""
    pass
