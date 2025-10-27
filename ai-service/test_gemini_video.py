"""
Test Gemini API video analysis with MinIO URL
"""
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash-exp')

# Test video URL from MinIO
VIDEO_URL = "https://jxzmnjcvm-1332406476.cos.ap-guangzhou.myqcloud.com/sessions/63/chunks/1761486506232_window_2_0.webm"


def test_gemini_video_analysis():
    """Test Gemini video analysis with MinIO URL"""

    print("=" * 60)
    print("Testing Gemini Video Analysis")
    print("=" * 60)
    print(f"Model: {GEMINI_MODEL}")
    print(f"Video URL: {VIDEO_URL}")
    print("=" * 60)
    print()

    # Initialize Gemini client
    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        print("Sending request to Gemini API...")
        print()

        # Determine MIME type from URL
        mime_type = 'video/webm'
        if VIDEO_URL.endswith('.mp4'):
            mime_type = 'video/mp4'
        elif VIDEO_URL.endswith('.mov'):
            mime_type = 'video/quicktime'

        print(f"Using MIME type: {mime_type}")
        print()

        # Build prompt
        prompt = """请详细描述这段视频中用户正在做什么，重点关注屏幕上的内容和用户的操作。

请用中文回答，输出应该连贯、简洁。"""

        # Call Gemini API with streaming
        response = client.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=[
                prompt,
                types.Part.from_uri(
                    file_uri=VIDEO_URL,
                    mime_type=mime_type
                )
            ]
        )

        # Collect streaming results
        print("Receiving streaming response:")
        print("-" * 60)
        full_content = ""
        for chunk in response:
            if chunk.text:
                content = chunk.text
                full_content += content
                print(content, end='', flush=True)

        print()
        print("-" * 60)
        print()
        print(f"✅ SUCCESS! Received {len(full_content)} characters")
        print()
        print("Full response:")
        print("=" * 60)
        print(full_content)
        print("=" * 60)

    except Exception as e:
        print()
        print("❌ ERROR!")
        print("-" * 60)
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        print("-" * 60)

        # Print detailed error info
        if hasattr(e, '__dict__'):
            print("Error details:")
            for key, value in e.__dict__.items():
                print(f"  {key}: {value}")

        # Print traceback
        import traceback
        print()
        print("Full traceback:")
        print("-" * 60)
        traceback.print_exc()
        print("-" * 60)

        raise


if __name__ == "__main__":
    print()
    test_gemini_video_analysis()
    print()
