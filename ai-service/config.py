"""
Configuration management for AI Service.
Loads configuration from environment variables.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Configuration class for AI Service"""

    # ==================== AI API Configuration ====================
    # Qwen API (Aliyun DashScope)
    QWEN_API_KEY = os.getenv('QWEN_API_KEY', '')
    QWEN_API_ENDPOINT = os.getenv(
        'QWEN_API_ENDPOINT',
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
    )
    QWEN_VL_MODEL = os.getenv('QWEN_VL_MODEL', 'qwen-vl-max')  # For video analysis
    QWEN_TEXT_MODEL = os.getenv('QWEN_TEXT_MODEL', 'qwen-max')  # For text-only tasks

    # Gemini API (Google)
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
    GEMINI_VL_MODEL = os.getenv('GEMINI_VL_MODEL', 'gemini-2.0-flash-exp')  # For video analysis
    GEMINI_TEXT_MODEL = os.getenv('GEMINI_TEXT_MODEL', 'gemini-2.0-flash-exp')  # For text-only tasks

    # ==================== gRPC Configuration ====================
    GRPC_PORT = int(os.getenv('AI_SERVICE_PORT', 50051))
    GRPC_WORKERS = int(os.getenv('AI_SERVICE_WORKERS', 4))
    GRPC_MAX_MESSAGE_LENGTH = 100 * 1024 * 1024  # 100MB

    # ==================== Video Processing Configuration ====================
    WINDOW_SIZE = int(os.getenv('VIDEO_WINDOW_SIZE', 15))  # seconds
    WINDOW_STEP = int(os.getenv('VIDEO_WINDOW_STEP', 10))  # seconds
    TEMP_PATH = os.path.expanduser(os.getenv('TEMP_VIDEO_PATH', '/tmp/skiuo'))

    # ==================== Logging Configuration ====================
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    DEBUG_MODE = os.getenv('DEBUG_MODE', 'false').lower() == 'true'

    # ==================== Prompt Configuration ====================
    # Language for AI prompts: 'zh' (Chinese) or 'en' (English)
    PROMPT_LANGUAGE = os.getenv('PROMPT_LANGUAGE', 'zh')
    # Scenario type: 'programming', 'crafts', 'teaching', 'general'
    PROMPT_SCENARIO = os.getenv('PROMPT_SCENARIO', 'general')
    # Whether to include scenario-specific hints in prompts
    PROMPT_INCLUDE_SCENARIO_HINT = os.getenv('PROMPT_INCLUDE_SCENARIO_HINT', 'true').lower() == 'true'

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        errors = []

        if not cls.QWEN_API_KEY and not cls.GEMINI_API_KEY:
            errors.append("At least one AI API key must be configured (QWEN_API_KEY or GEMINI_API_KEY)")

        if errors:
            raise ValueError(f"Configuration validation failed:\n" + "\n".join(errors))

    @classmethod
    def print_config(cls):
        """Print current configuration (mask sensitive data)"""
        print("=" * 50)
        print("AI Service Configuration")
        print("=" * 50)
        print(f"gRPC Port: {cls.GRPC_PORT}")
        print(f"gRPC Workers: {cls.GRPC_WORKERS}")
        print(f"Window Size: {cls.WINDOW_SIZE}s")
        print(f"Window Step: {cls.WINDOW_STEP}s")
        print(f"Temp Path: {cls.TEMP_PATH}")
        print(f"Qwen API: {'Configured' if cls.QWEN_API_KEY else 'Not configured'}")
        print(f"Gemini API: {'Configured' if cls.GEMINI_API_KEY else 'Not configured'}")
        print(f"Prompt Language: {cls.PROMPT_LANGUAGE}")
        print(f"Prompt Scenario: {cls.PROMPT_SCENARIO}")
        print(f"Scenario Hints: {'Enabled' if cls.PROMPT_INCLUDE_SCENARIO_HINT else 'Disabled'}")
        print(f"Log Level: {cls.LOG_LEVEL}")
        print(f"Debug Mode: {cls.DEBUG_MODE}")
        print("=" * 50)
