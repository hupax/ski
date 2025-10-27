"""
AI Service - Video Analysis Service using gRPC

Main entry point for the AI service.
"""
import sys

from config import Config
from utils.logger import setup_logger
from models.factory import list_available_models

logger = setup_logger(__name__)


def main():
    """Main function"""
    try:
        # Print banner
        print("\n" + "=" * 60)
        print("AI Service - Video Analysis Service")
        print("=" * 60)

        # Validate configuration
        logger.info("Validating configuration...")
        try:
            Config.validate()
        except ValueError as e:
            logger.error(f"Configuration validation failed: {e}")
            sys.exit(1)

        # Print configuration
        Config.print_config()

        # List available models
        models = list_available_models()
        if models:
            logger.info(f"Available AI models: {', '.join(models)}")
        else:
            logger.warning("No AI models configured! Please configure at least one API key.")
            sys.exit(1)

        # Import and start gRPC server
        # Import here to catch proto generation errors
        try:
            from grpc_server import serve
        except ImportError as e:
            logger.error(f"Failed to import gRPC server: {e}")
            logger.error("Please generate proto files first:")
            logger.error("  cd ai-service")
            logger.error("  python3.12 -m grpc_tools.protoc -I../proto --python_out=./proto --grpc_python_out=./proto ../proto/video_analysis.proto")
            sys.exit(1)

        # Start server
        logger.info("Starting gRPC server...")
        serve()

    except KeyboardInterrupt:
        logger.info("\nReceived shutdown signal. Stopping server...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
