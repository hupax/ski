#!/usr/bin/env python3.12
"""
Test FULL mode analysis with a specific video URL
"""

import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path='../.env')

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models.factory import get_analyzer

def test_full_mode_analysis():
    """Test analyzing a full video"""

    # Video URL from user
    video_url = "https://jxzmnjcvm-1332406476.cos.ap-guangzhou.myqcloud.com/sessions/25/full_video.webm?sign=q-sign-algorithm%3Dsha1%26q-ak%3DAKIDv5CDC2g8MWQHxgQ3a2LRJ3fCg7Tjx441%26q-sign-time%3D1761827590%3B1761831190%26q-key-time%3D1761827590%3B1761831190%26q-header-list%3Dhost%26q-url-param-list%3D%26q-signature%3D791395ac4a47bb46133545c0501ef50ef5333085"

    # Get AI model from environment (default to qwen)
    ai_model = os.getenv('DEFAULT_AI_MODEL', 'qwen')

    print(f"🎥 Testing FULL mode analysis")
    print(f"📹 Video URL: {video_url[:80]}...")
    print(f"🤖 AI Model: {ai_model}")
    print("-" * 80)

    try:
        # Get analyzer
        analyzer = get_analyzer(ai_model)
        print(f"✅ Loaded {ai_model} analyzer")

        # Analyze video (no context for FULL mode)
        print("\n⏳ Starting analysis...\n")

        import asyncio

        async def run_analysis():
            full_result = ""
            async for chunk in analyzer.analyze_video(
                video_url=video_url,
                context="",  # No context for FULL mode
                session_id="test_full_mode",
                window_index=0
            ):
                # Print streaming output
                print(chunk, end='', flush=True)
                full_result += chunk
            return full_result

        full_result = asyncio.run(run_analysis())

        print("\n")
        print("-" * 80)
        print(f"✅ Analysis completed!")
        print(f"📊 Total length: {len(full_result)} characters")
        print("-" * 80)
        print("\n🎯 Complete Result:")
        print("=" * 80)
        print(full_result)
        print("=" * 80)

    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("FULL MODE ANALYSIS TEST")
    print("=" * 80 + "\n")

    success = test_full_mode_analysis()

    print("\n" + "=" * 80)
    if success:
        print("✅ Test completed successfully")
    else:
        print("❌ Test failed")
    print("=" * 80 + "\n")

    sys.exit(0 if success else 1)
