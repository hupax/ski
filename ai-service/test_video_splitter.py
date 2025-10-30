#!/usr/bin/env python3.12
"""
Test Video Splitter
Splits a local video file into chunks for testing half-realtime upload

Usage:
    python3.12 test_video_splitter.py

Configuration:
    - Input video: /Users/hupax/Downloads/IMG_3968.MOV
    - Output directory: /Users/hupax/Downloads/test/
    - Chunk duration: 70 seconds
"""

import os
import subprocess
import sys
from pathlib import Path


class VideoSplitter:
    """Split video into chunks using FFmpeg"""

    def __init__(self, input_path: str, output_dir: str, chunk_duration: int = 70):
        self.input_path = input_path
        self.output_dir = output_dir
        self.chunk_duration = chunk_duration

    def get_video_duration(self) -> float:
        """Get video duration using ffprobe"""
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                self.input_path
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
            print(f"❌ Error getting video duration: {e.stderr}")
            sys.exit(1)
        except ValueError as e:
            print(f"❌ Invalid duration value: {e}")
            sys.exit(1)

    def split_video(self):
        """Split video into chunks"""
        # Check input file
        if not os.path.exists(self.input_path):
            print(f"❌ Input file not found: {self.input_path}")
            sys.exit(1)

        # Create output directory
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        print(f"📁 Output directory: {self.output_dir}")

        # Get video duration
        total_duration = self.get_video_duration()
        print(f"🎬 Video duration: {total_duration:.2f} seconds")

        # Calculate number of chunks
        num_chunks = int(total_duration / self.chunk_duration) + 1
        print(f"✂️  Splitting into {num_chunks} chunks ({self.chunk_duration}s each)")

        # Split video
        for i in range(num_chunks):
            start_time = i * self.chunk_duration

            # Don't process beyond video duration
            if start_time >= total_duration:
                break

            # Calculate chunk duration (last chunk may be shorter)
            current_chunk_duration = min(self.chunk_duration, total_duration - start_time)

            output_path = os.path.join(self.output_dir, f"chunk_{i}.webm")

            print(f"\n🎞️  Processing chunk {i}:")
            print(f"   Start: {start_time}s")
            print(f"   Duration: {current_chunk_duration:.2f}s")
            print(f"   Output: {output_path}")

            self._slice_segment(
                start=start_time,
                duration=current_chunk_duration,
                output_path=output_path
            )

            print(f"   ✅ Chunk {i} created successfully")

        print(f"\n🎉 All chunks created in: {self.output_dir}")
        print(f"\nℹ️  Files created:")
        for i in range(num_chunks):
            chunk_path = os.path.join(self.output_dir, f"chunk_{i}.webm")
            if os.path.exists(chunk_path):
                size_mb = os.path.getsize(chunk_path) / (1024 * 1024)
                print(f"   - chunk_{i}.webm ({size_mb:.2f} MB)")

    def _slice_segment(self, start: float, duration: float, output_path: str):
        """Slice a segment using FFmpeg"""
        try:
            cmd = [
                'ffmpeg',
                '-y',  # Overwrite output file
                '-ss', str(start),  # Start time
                '-i', self.input_path,  # Input file
                '-t', str(duration),  # Duration
                '-c:v', 'libvpx-vp9',  # VP9 video codec for WebM
                '-c:a', 'libopus',  # Opus audio codec for WebM
                '-b:v', '1M',  # Video bitrate
                '-crf', '30',  # Quality (lower = better, range 0-63)
                '-threads', '4',  # Use 4 threads for faster encoding
                output_path
            ]

            # Run FFmpeg with minimal output
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

        except subprocess.CalledProcessError as e:
            print(f"❌ FFmpeg failed: {e.stderr}")
            sys.exit(1)


def main():
    """Main function"""
    # Configuration
    INPUT_VIDEO = "/Users/hupax/Downloads/IMG_3968.MOV"
    OUTPUT_DIR = "/Users/hupax/Downloads/test"
    CHUNK_DURATION = 70  # seconds

    print("=" * 60)
    print("🎬 Video Splitter for Testing")
    print("=" * 60)
    print(f"Input: {INPUT_VIDEO}")
    print(f"Output: {OUTPUT_DIR}")
    print(f"Chunk duration: {CHUNK_DURATION} seconds")
    print("=" * 60)
    print()

    # Create splitter
    splitter = VideoSplitter(
        input_path=INPUT_VIDEO,
        output_dir=OUTPUT_DIR,
        chunk_duration=CHUNK_DURATION
    )

    # Split video
    splitter.split_video()

    print()
    print("=" * 60)
    print("✅ Done! You can now use these chunks in the web-recorder test mode.")
    print("=" * 60)


if __name__ == "__main__":
    main()
