"""
Simple test script for Qwen VL video analysis
Change VIDEO_URL to test different videos
"""
import os
import dashscope
from dotenv import load_dotenv

load_dotenv()
dashscope.api_key = os.getenv('QWEN_API_KEY')

# ========================================
# 👇 修改这里的 URL 来测试不同的视频
# ========================================
VIDEO_URL = "https://jxzmnjcvm-1332406476.cos.ap-guangzhou.myqcloud.com/sessions/63/chunks/1761486538795_window_2_1.webm?sign=q-sign-algorithm%3Dsha1%26q-ak%3DAKIDv5CDC2g8MWQHxgQ3a2LRJ3fCg7Tjx441%26q-sign-time%3D1761486539%3B1761490139%26q-key-time%3D1761486539%3B1761490139%26q-header-list%3Dhost%26q-url-param-list%3D%26q-signature%3D95d62d043dd555919075234665c54802cb2b39c0"


def test_video():
    print("=" * 60)
    print("Testing Qwen VL Video Analysis")
    print("=" * 60)
    print(f"Video URL: {VIDEO_URL}")
    print("=" * 60)
    print()

    messages = [
        {
            'role': 'user',
            'content': [
                {'video': VIDEO_URL},
                {'text': '请详细描述这段视频中的内容。'}
            ]
        }
    ]

    print("Analyzing video...")
    print("-" * 60)

    response = dashscope.MultiModalConversation.call(
        model='qwen-vl-max',
        messages=messages
    )

    if response.status_code == 200:
        content = response.output.choices[0].message.content[0]['text']
        print(content, flush=True)
        print()
        print("-" * 60)
        print(f"\n✅ Analysis completed ({len(content)} characters)")
    else:
        print(f"\n❌ Error {response.status_code}: {response.message}")


if __name__ == "__main__":
    test_video()
