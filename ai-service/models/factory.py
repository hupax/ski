"""
Factory for creating video analyzers
"""
from models.base import VideoAnalyzer
from models.qwen_analyzer import QwenAnalyzer
from models.gemini_analyzer import GeminiAnalyzer
from exceptions import ModelNotFoundError
from config import Config
from utils.logger import setup_logger

logger = setup_logger(__name__)


def get_analyzer(model_name: str) -> VideoAnalyzer:
    """
    Get video analyzer instance by model name

    Args:
        model_name: Model name ('qwen' or 'gemini')

    Returns:
        VideoAnalyzer instance

    Raises:
        ModelNotFoundError: If model not found or not configured
    """
    model_name = model_name.lower()

    try:
        if model_name == "qwen":
            if not Config.QWEN_API_KEY:
                raise ModelNotFoundError("Qwen model not configured (QWEN_API_KEY missing)")
            analyzer = QwenAnalyzer()
            logger.info("Created Qwen analyzer")
            return analyzer

        elif model_name == "gemini":
            if not Config.GEMINI_API_KEY:
                raise ModelNotFoundError("Gemini model not configured (GEMINI_API_KEY missing)")
            analyzer = GeminiAnalyzer()
            logger.info("Created Gemini analyzer")
            return analyzer

        else:
            raise ModelNotFoundError(f"Unknown model: {model_name}. Supported models: qwen, gemini")

    except ValueError as e:
        logger.error(f"Failed to create analyzer: {e}")
        raise ModelNotFoundError(str(e))
    except Exception as e:
        logger.error(f"Unexpected error creating analyzer: {e}")
        raise ModelNotFoundError(f"Failed to create analyzer: {e}")


def list_available_models() -> list:
    """
    List available (configured) models

    Returns:
        List of available model names
    """
    models = []

    if Config.QWEN_API_KEY:
        models.append("qwen")

    if Config.GEMINI_API_KEY:
        models.append("gemini")

    return models
