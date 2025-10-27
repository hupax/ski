"""
Logging configuration for AI Service
"""
import logging
import sys
from config import Config


def setup_logger(name: str) -> logging.Logger:
    """
    Setup logger with consistent formatting

    Args:
        name: Logger name

    Returns:
        Configured logger instance
    """
    logger = logging.Logger(name)

    # Set log level from config
    log_level = getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(log_level)

    # Console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    # Format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)

    logger.addHandler(handler)

    return logger
