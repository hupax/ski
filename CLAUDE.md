# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SKI is a video AI analysis system that records video in the browser and uses AI models (Qwen/Gemini) to generate text transcripts. The system supports two analysis modes:
- **Sliding Window Mode**: Real-time analysis with overlapping 15-second windows (default)
- **Full Mode**: Analyze the complete video after recording ends

## Architecture

Three-tier architecture with gRPC communication:

```
web-recorder (React) → core-service (Spring Boot) → ai-service (Python) → AI APIs
                              ↓
                      Storage (MinIO/OSS/COS) + PostgreSQL
```

### Module Responsibilities

**web-recorder** (frontend):
- React 19 + TypeScript + Vite
- MediaRecorder API for browser video capture
- WebSocket for real-time AI results
- Test mode for uploading pre-recorded chunks

**core-service** (business orchestration):
- Spring Boot 3.5 + Java 17
- gRPC client to ai-service
- Multi-storage support via factory pattern (MinIO/OSS/COS)
- PostgreSQL for session and analysis data
- WebSocket server for pushing results to frontend
- Master video management with FFmpeg operations via gRPC

**ai-service** (AI processing):
- Python 3.12 + gRPC server
- FFmpeg video processing (slicing, concatenation, duration)
- DashScope SDK for Qwen (required for video URL support)
- Google GenAI SDK for Gemini
- Streaming AI responses back to core-service

## Environment Configuration

All configuration is loaded from `.env` file in the project root directory:

- **Database**: PostgreSQL connection settings
- **Storage**: Choose one of MinIO (local), OSS (Aliyun), or COS (Tencent) via `STORAGE_TYPE`
- **AI APIs**: Qwen and/or Gemini API keys
- **gRPC**: ai-service host and port
- **Video Processing**: Window size (15s) and step (10s) for sliding window mode

**Important**: core-service uses dotenv-java to auto-load `.env` from project root. ai-service uses python-dotenv.

## Common Development Commands

### Starting Services

```bash
# 1. Start PostgreSQL
docker run -d --name skiuo-postgres \
  -e POSTGRES_DB=skiuo -e POSTGRES_USER=skiuo \
  -e POSTGRES_PASSWORD=your_password -p 5432:5432 postgres:15

# 2. Start ai-service
cd ai-service
python3.12 -m venv .venv
source .venv/bin/activate
pip3.12 install -r requirements.txt
# Generate proto files (see below)
python3.12 grpc_server.py

# 3. Start core-service
cd core-service
mvn clean compile  # Generates gRPC Java code from proto
mvn spring-boot:run

# 4. Start web-recorder
cd web-recorder
npm install
npm run dev
```

### Generating gRPC Code

**Java (core-service)**:
```bash
cd core-service
mvn clean compile
```
Proto files are in `../proto/` and generated code goes to `target/generated-sources/protobuf/`.

**Python (ai-service)**:
```bash
cd ai-service
source .venv/bin/activate
python3.12 -m grpc_tools.protoc \
  -I../proto \
  --python_out=./proto \
  --grpc_python_out=./proto \
  ../proto/video_analysis.proto

# Fix import (absolute → relative)
sed -i '' 's/^import video_analysis_pb2 as video__analysis__pb2/from . import video_analysis_pb2 as video__analysis__pb2/' proto/video_analysis_pb2_grpc.py
```

**Critical**: After generating Python proto files, you must run the `sed` command to fix imports from absolute to relative.

### Testing

```bash
# core-service
cd core-service
mvn test

# web-recorder
cd web-recorder
npm run lint
npm run build

# ai-service - run test scripts
cd ai-service
source .venv/bin/activate
python3.12 test_video_splitter.py /path/to/video.mp4 output_dir/ --chunk-duration 35
```

## Key Implementation Details

### Sliding Window Strategy

The sliding window mode ensures smooth action continuity:

```
Video 35s: 0----------------------------------35s
Window 1:  [0---------15s]
Window 2:         [10--------25s]
Window 3:                [20--------35s]
```

- **Window size**: 15 seconds (configurable via `VIDEO_WINDOW_SIZE`)
- **Step size**: 10 seconds (configurable via `VIDEO_WINDOW_STEP`)
- **Overlap**: 5 seconds to prevent action truncation
- **Chunk duration**: Auto-calculated as `windowSize + 2×windowStep = 35s`

### Master Video Approach

Both analysis modes use a "master video" strategy:

1. **First chunk**: Copy to `master_video.webm`
2. **Subsequent chunks**: Concatenate to master video via gRPC `ConcatVideos`
3. **Window extraction**: Extract time segments via gRPC `ExtractSegment`
4. **Duration tracking**: Always get actual duration via gRPC `GetVideoDuration` after FFmpeg operations

This eliminates per-chunk slicing complexity and provides accurate time-based windowing.

### Storage Service Architecture

Factory pattern supports three storage backends:

- **MinIO**: Self-hosted, good for development (but videos must be publicly accessible for AI APIs)
- **Aliyun OSS**: Cloud storage, works with Qwen
- **Tencent COS**: Cloud storage, recommended for production in China

Storage service responsibilities:
- Upload video files (chunks, windows, master videos)
- Generate public URLs for AI APIs to download
- Delete files when `keepVideo=false`

**Why storage is required**: Qwen and Gemini are cloud APIs that need public URLs to access videos. They cannot access local file paths.

### AI Service Implementation

**Qwen-specific requirement**: Must use DashScope native SDK, not OpenAI-compatible endpoints. Only DashScope SDK supports video URL analysis.

```python
# models/qwen_analyzer.py
import dashscope

messages = [{
    'role': 'user',
    'content': [
        {'video': video_url},  # Public URL from storage
        {'text': prompt}
    ]
}]

responses = dashscope.MultiModalConversation.call(
    model='qwen-vl-max',
    messages=messages,
    stream=True
)
```

Gemini uses the new unified `google-genai` SDK (1.0.0+).

### Concurrency and Race Conditions

**Frontend safeguard**: Wait for last chunk upload to complete before calling `finishSession()`.

**Backend safeguard**: Track all async processing tasks and wait for completion in `finishSession()` before marking session as COMPLETED.

### Prompt System

The ai-service has a prompt management system (`prompts/base_prompts.py` and `prompts/prompt_builder.py`):

- **Language**: Chinese or English (via `PROMPT_LANGUAGE`)
- **Scenario**: programming, crafts, teaching, general (via `PROMPT_SCENARIO`)
- **Mode-specific prompts**: Different prompts for `full` vs `sliding_window` analysis modes
- **Context support**: Previous window summary passed to next window in sliding mode

## Code Architecture Notes

### core-service Key Classes

- **VideoProcessingService**: Orchestrates video processing workflows, manages master video, triggers window analysis
- **GrpcClientService**: Wrapper for all gRPC calls to ai-service
- **StorageServiceFactory**: Returns appropriate storage service (MinIO/OSS/COS) based on config
- **AnalysisService**: Saves analysis results to DB, streams to WebSocket
- **VideoUploadService**: Handles chunk uploads, session management, async task tracking
- **CleanupService**: Deletes temporary files and storage objects

### ai-service Key Modules

- **grpc_server.py**: gRPC service implementation, bridges sync gRPC with async AI calls
- **video_processor.py**: FFmpeg operations (slicing, concatenation, extraction, duration)
- **models/factory.py**: Returns appropriate analyzer (Qwen/Gemini) based on model name
- **models/qwen_analyzer.py**: DashScope SDK integration
- **models/gemini_analyzer.py**: Google GenAI SDK integration
- **prompts/**: Prompt templates and builder logic

### Database Schema

- **sessions**: Recording sessions with status, mode, storage type, master video path
- **video_chunks**: Individual uploaded chunks (less important after master video approach)
- **analysis_records**: AI analysis results per window with time ranges
- **user_config**: User preferences (currently minimal)

## Important Development Notes

1. **Always use Python 3.12** for ai-service: `python3.12` command, not `python` or `python3`

2. **Virtual environment required** for ai-service: All Python commands must run inside `.venv`

3. **Proto generation order matters**:
   - Generate Java first: `mvn clean compile`
   - Generate Python second and fix imports with `sed`

4. **Storage service selection**:
   - Development: MinIO (local)
   - Production with Qwen: OSS or COS (public cloud with accessible URLs)
   - Recommended: COS (faster in China)

5. **FFmpeg operations** are always done via gRPC calls to ai-service, never directly in core-service

6. **Context passing** in sliding window mode uses simple truncation (last 500 chars). Can be enhanced with actual summarization.

7. **WebSocket streaming** pushes AI results in real-time as they arrive from the streaming gRPC response

8. **Error handling** is critical for all external calls:
   - Storage uploads/downloads
   - gRPC calls
   - AI API calls
   - Database operations

9. **Cleanup strategy**:
   - Always delete local temp files after processing
   - Delete storage objects when `keepVideo=false`
   - Keep storage objects when `keepVideo=true` for later review

10. **Session status flow**: ACTIVE → ANALYZING → COMPLETED (or FAILED)

## Project Structure

```
ski/
├── core-service/              # Spring Boot backend
│   ├── src/main/java/com/skiuo/coreservice/
│   │   ├── controller/       # REST endpoints
│   │   ├── service/          # Business logic
│   │   ├── repository/       # JPA repositories
│   │   ├── entity/           # Database entities
│   │   ├── config/           # Configuration classes
│   │   ├── dto/              # Request/response objects
│   │   └── exception/        # Custom exceptions
│   ├── pom.xml               # Maven dependencies
│   └── src/main/resources/application.yml
│
├── ai-service/                # Python gRPC service
│   ├── grpc_server.py        # gRPC service entry point
│   ├── video_processor.py    # FFmpeg operations
│   ├── config.py             # Configuration loading
│   ├── models/
│   │   ├── factory.py        # Analyzer factory
│   │   ├── qwen_analyzer.py  # Qwen implementation
│   │   └── gemini_analyzer.py# Gemini implementation
│   ├── prompts/
│   │   ├── base_prompts.py   # Prompt templates
│   │   └── prompt_builder.py # Prompt construction
│   ├── proto/                # Generated gRPC code
│   └── requirements.txt
│
├── web-recorder/              # React frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom hooks (useMediaRecorder)
│   │   └── services/         # API clients
│   ├── package.json
│   └── vite.config.ts
│
├── proto/                     # gRPC proto definitions
│   └── video_analysis.proto  # Shared service contract
│
├── .env                       # Environment variables (DO NOT COMMIT)
├── .env.example               # Environment template
└── doc/                       # Additional documentation
    ├── dev3.md               # Detailed architecture
    ├── prompt.md             # Prompt system details
    └── input-extension.md    # Future input methods
```

## Troubleshooting

**Proto import errors in ai-service**:
```
ERROR: No module named 'video_analysis_pb2'
```
Solution: Re-generate proto files and fix imports with `sed` command.

**gRPC connection refused**:
```
UNAVAILABLE: io exception
```
Solution: Ensure ai-service is running on correct port (default 50051).

**Qwen cannot read video**:
```
DashScope API error: video download failed
```
Solution: Video URL must be publicly accessible. Switch from MinIO to OSS/COS, or configure MinIO for public access.

**.env file not loaded**:
Check that `.env` exists in project root (`/Users/xxx/ski/.env`). Look for "✓ Loaded .env file successfully" in startup logs.

**FFmpeg errors**:
Ensure FFmpeg is installed: `ffmpeg -version`. ai-service requires FFmpeg for all video operations.

**Master video duration mismatch**:
Always get duration via `GetVideoDuration` gRPC call after FFmpeg operations. Don't rely on cumulative chunk durations.
