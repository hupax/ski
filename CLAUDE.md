# CLAUDE.md
# 第一, 用户没有明确说明就不要写任何的文档和sh脚本!!!!!!!
# 第二, 用户一般说中文, 比较难理解, 所以要至少读三遍用户说的话, 要彻底理解用户的意思再干活!!!!!
# 第三, 切记不要靠瞎猜去浪费 token , 不要瞎猜问题, 然后一次一次的改去验证你的猜测, 实在不能确定就写命令测试!!!!!
# 第四, 当有成功和失败的案例时, 直接对比所有相关代码找差异, 而不是局限于某一点反复猜测。

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SKI is a video AI analysis system with user authentication that records video in the browser and uses AI models (Qwen/Gemini) to generate text transcripts. The system supports:
- **Authentication**: OAuth 2.0 (Google, GitHub, WeChat) + Email verification code login
- **Video Recording**: Browser-based video capture with MediaRecorder API
- **AI Analysis**: Two modes - Sliding Window (real-time, recommended) and Full (post-recording)
- **Streaming Results**: WebSocket-based real-time AI output display

## Architecture

Four-tier architecture with gRPC communication:

```
web-recorder (React) → auth-service (Spring Boot) → User Auth
                    ↘  core-service (Spring Boot) → ai-service (Python) → AI APIs
                                     ↓
                             Storage (MinIO/OSS/COS) + PostgreSQL + Redis
```

**auth-service**: Separate authentication microservice
- Spring Boot 3.5 + Java 17
- JWT-based authentication (access + refresh tokens)
- OAuth 2.0 integration (Google, GitHub, WeChat)
- Email verification code login
- Redis for token management, blacklist, and verification codes
- PostgreSQL for user data storage

### Module Responsibilities

**web-recorder** (frontend):
- React 19 + TypeScript + Vite
- Zustand for state management (6 stores: UI, Session, Recording, Config, Analysis, Auth)
- MediaRecorder API for browser video capture
- WebSocket (STOMP) for real-time streaming AI results
- Wrangler-inspired UI design with push/pull sidebar animation
- OAuth login integration with modal-based auth flow
- Auto token refresh mechanism
- Test mode for uploading pre-recorded chunks (simulates recording for development)

**core-service** (business orchestration):
- Spring Boot 3.5 + Java 17
- gRPC client to ai-service
- Multi-storage support via factory pattern (MinIO/OSS/COS)
- PostgreSQL for session and analysis data
- WebSocket server for pushing streaming results to frontend
- Master video management with FFmpeg operations via gRPC

**ai-service** (AI processing):
- Python 3.12 + gRPC server
- FFmpeg video processing (slicing, concatenation, duration)
- DashScope SDK for Qwen (required for video URL support)
- Google GenAI SDK for Gemini
- Streaming AI responses back to core-service
- Two-stage analysis pipeline: VL model (video analysis) → text model (error refinement)

**common** (shared library):
- Spring Boot module with shared DTOs and exceptions
- Used by both auth-service and core-service
- Contains ApiResponse, BusinessException, and common data structures

## Environment Configuration

All configuration is loaded from `.env` file in the project root directory:

- **Database**: PostgreSQL connection settings
- **Redis**: Connection settings for auth-service (tokens, blacklist, verification codes)
- **Storage**: Choose one of MinIO (local), OSS (Aliyun), or COS (Tencent) via `STORAGE_TYPE`
- **AI APIs**: Qwen and/or Gemini API keys
- **gRPC**: ai-service host and port
- **Video Processing**: Window size (15s) and step (10s) for sliding window mode
- **OAuth**: Client IDs and secrets for Google, GitHub, WeChat
- **JWT**: Secret key and token expiration times
- **Email**: SMTP settings for sending verification codes

**Important**: Both core-service and auth-service use dotenv-java to auto-load `.env` from project root. ai-service uses python-dotenv.

## Common Development Commands

### Starting Services

```bash
# 1. Start PostgreSQL
docker run -d --name skiuo-postgres \
  -e POSTGRES_DB=skiuo -e POSTGRES_USER=skiuo \
  -e POSTGRES_PASSWORD=your_password -p 5432:5432 postgres:15

# 2. Start Redis (for auth-service)
docker run -d --name skiuo-redis \
  -p 6379:6379 redis:7

# 3. Start auth-service
cd auth-service
mvn spring-boot:run

# 4. Start ai-service
cd ai-service
python3.12 -m venv .venv
source .venv/bin/activate
pip3.12 install -r requirements.txt
# Generate proto files (see below)
python3.12 grpc_server.py

# 5. Start core-service
cd core-service
mvn clean compile  # Generates gRPC Java code from proto
mvn spring-boot:run

# 6. Start web-recorder
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

### Two-Stage AI Analysis Pipeline

To improve accuracy, each video window goes through a two-stage analysis process:

1. **Stage 1 (Vision-Language Model)**: VL model (Qwen VL Max / Gemini) analyzes the video and generates raw content
2. **Stage 2 (Text Model Refinement)**: Text model (Qwen Max / Gemini) refines the raw content to fix obvious errors

This two-stage approach improves accuracy from ~85% to ~97% (based on manual evaluation), at the cost of 5-10 seconds additional latency per window. The refinement model uses specialized prompts to fix common VL model errors like hallucinations and temporal inconsistencies.

Implementation:
- Raw content is saved to `analysis_records.raw_content`
- Refined content is saved to `analysis_records.refined_content`
- Only refined content is sent to frontend via WebSocket
- Refinement happens via gRPC `RefineAnalysis` call with video metadata

### User Memory System

The system automatically builds and maintains user profiles to personalize analysis:

**Storage**: JSONB column `memory_data` in `user_memory` table with flexible schema:
```json
{
  "habits": {"programming_languages": ["Python", "TypeScript"]},
  "knowledge": {"expertise_areas": ["web development", "AI"]},
  "behavior_patterns": {"coding_style": "prefers functional programming"}
}
```

**Workflow**:
1. Session completes → Extract user memory from all analysis results via gRPC `ExtractUserMemory`
2. Merge new memory with existing memory (AI decides what to keep/update/add)
3. Save to database for the user
4. Future sessions: Load user memory and pass to AI models for personalized analysis

**Benefits**: AI can reference user's known skills, preferences, and context to generate more relevant descriptions.

### Automatic Title Generation

When a session completes (isLastChunk=true), the system automatically generates a concise title (≤10 characters) via gRPC `GenerateTitle`. The title is displayed in the session history sidebar for easy identification.

Example titles: "C++解两数之和", "React组件优化", "数据库设计"

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

### Streaming Content Strategy

**Backend**: Sends streaming content chunks via WebSocket to `/topic/session/{sessionId}`

**Frontend**:
- Receives chunks and appends to existing result for same `windowIndex`
- Multiple windows are combined into single markdown stream for display
- Auto-scrolls to bottom as new content arrives

### Concurrency and Race Conditions

**Frontend safeguard**: Wait for last chunk upload to complete before calling `finishSession()`.

**Backend safeguard**: Track all async processing tasks and wait for completion in `finishSession()` before marking session as COMPLETED.

### Prompt System

The ai-service has a prompt management system (`prompts/base_prompts.py` and `prompts/prompt_builder.py`):

- **Language**: Chinese or English (via `PROMPT_LANGUAGE`)
- **Scenario**: programming, crafts, teaching, general (via `PROMPT_SCENARIO`)
- **Mode-specific prompts**: Different prompts for `full` vs `sliding_window` analysis modes
- **Context support**: Previous window summary passed to next window in sliding mode

## Frontend Architecture (web-recorder)

### State Management (Zustand Stores)

The app uses **6 Zustand stores** for clean separation of concerns:

1. **uiStore**: UI state (sidebar open/close, current view)
2. **sessionStore**: Session list, current session, CRUD operations
3. **recordingStore**: Recording state, media stream, chunk index
4. **configStore**: Recording configuration (AI model, analysis mode, storage type, keepVideo, chunk duration)
5. **analysisStore**: Analysis results, WebSocket connection status, streaming content
6. **authStore**: Authentication state (user info, tokens), persisted to localStorage

### UI Components Architecture

**Wrangler-inspired Design**:
- Clean, minimal interface with emphasis on content
- Push/pull sidebar animation (260px ↔ 0px)
- Sticky navbar with fade effects
- Pure markdown rendering for analysis results (no decorative UI)

**Key Components**:

- **MainLayout**: Root layout with sidebar + navbar + main content area
  - Push/pull sidebar animation with smooth transitions
  - Content area gets pushed (not overlay)

- **Navbar**: Sticky top bar
  - Menu button (rotates 90deg when sidebar opens, fades out)
  - New Recording button (fades when sidebar opens)
  - Scroll-based separator line fade effect

- **Sidebar**: Collapsible navigation
  - SidebarHeader with menu items (New Recording, Search History, Test)
  - Session history list with auto-scroll to current session
  - Scroll-based separator fade

- **RecordingModeSelector**: Mode selection screen
  - Three options: Upload, Full Analysis, Semi Real-time (recommended)
  - Card-based layout with icons and descriptions

- **AnalysisDisplay**: Pure content rendering
  - Combines all analysis results into single markdown stream
  - No headers, cards, timestamps, or window info
  - Matches Wrangler's note display exactly
  - Auto-scroll to bottom as new content arrives

- **PictureInPictureVideo**: Floating recording preview
  - Draggable, resizable window
  - Recording/Paused indicator badges
  - Stop, Pause, Resume controls in bottom bar
  - Minimize/Maximize toggle

- **TestPage**: Test mode configuration and execution
  - Shows config form initially (centered full-screen)
  - After "Start Test" → hides config, shows AnalysisDisplay (simulates New Recording)
  - TestUploader handles file selection and background upload

**Authentication Components**:

- **Navbar**: Includes auth UI
  - Shows "Log in" / "Sign up for free" buttons when unauthenticated
  - Shows user avatar with dropdown menu when authenticated
  - Avatar displays OAuth profile picture or username initial
  - Dropdown menu: user email + logout option
  - Click-outside detection to close dropdown

- **AuthModal**: Multi-step authentication modal
  - LoginMethodSelector: OAuth buttons (Google/GitHub/WeChat) + email input
  - EmailLoginForm: Verification code login (send code → enter code → login)
  - Wrangler/ChatGPT-inspired design with rounded-2xl modal, rounded-full buttons
  - Minimal backdrop blur (0.5px)

- **WelcomeModal**: Auto-popup modal for unauthenticated users
  - Shows on first visit (tracked via localStorage 'hasVisited')
  - Shows after logout (tracked via localStorage 'showWelcomeAfterLogout')
  - Two variants: "Get started" (first visit) vs "Welcome back" (after logout)
  - Options: Log in / Sign up for free / Stay logged out

- **LogoutConfirmModal**: Confirmation dialog before logout
  - Shows user email
  - Two buttons: "Log out" (confirm) / "Cancel"
  - Same styling as other modals (rounded-2xl, custom border color)

### User Flow

**Production Recording Flow**:
1. Click "New Recording" (navbar or sidebar)
2. Choose mode: Upload / Full Analysis / Semi Real-time
3. For recording modes: Camera permission → Recording starts
4. Main area shows AnalysisDisplay with streaming results
5. Picture-in-Picture shows camera preview with controls
6. Stop recording → Session saved to history

**Test Mode Flow** (simulates recording for development):
1. Click "Test" in sidebar
2. Config screen appears (AI model, analysis mode, storage, keepVideo, chunk duration, file selection)
3. Select video chunk files (chunk_0.webm, chunk_1.webm, ...)
4. Click "Start Test"
5. **Config screen disappears completely**
6. Main area shows AnalysisDisplay with streaming results (identical to production)
7. Background: Files upload automatically, analysis results stream in real-time
8. User experience identical to New Recording, just video source is pre-recorded files

### Hooks

- **useMediaRecorderWithStore**: Wraps VideoRecorderService with Zustand stores
  - Manages recording lifecycle (start, stop, pause, resume)
  - Handles chunk upload via apiClient
  - Updates recordingStore state

- **useWebSocketWithStore**: WebSocket connection management
  - STOMP client with SockJS
  - Subscribes to `/topic/session/{sessionId}`
  - Receives streaming analysis chunks
  - Appends content to analysisStore (same windowIndex = append, new windowIndex = new result)

**Authentication Hooks**: None (authentication logic in components and services)

### Services

- **mediaRecorder.ts**: VideoRecorderService class
  - MediaRecorder API wrapper
  - Camera/screen capture with audio
  - Chunk creation (35s default)
  - Blob generation for upload

- **apiClient.ts**: REST API client
  - uploadVideoChunk: POST /api/video/upload (multipart/form-data)
  - getServerConfig: GET /api/config
  - Session CRUD operations
  - Uses fetch with FormData

- **authClient.ts**: Authentication API client
  - sendVerificationCode: POST /api/auth/code/send
  - loginWithCode: POST /api/auth/login/code
  - logout: POST /api/auth/logout
  - getCurrentUser: GET /api/user/me
  - refreshToken: POST /api/auth/refresh
  - OAuth flows via window.location.href redirects

- **authInterceptor.ts**: Token management utilities
  - fetchWithAuth: Fetch wrapper with automatic token refresh on 401
  - isTokenExpired: Check if token is about to expire (within 5 minutes)
  - refreshTokenIfNeeded: Proactively refresh token before expiration
  - Used by App.tsx to check token every minute

- **websocketClient.ts**: WebSocket utilities (deprecated, now using useWebSocketWithStore hook)

## Code Architecture Notes

### auth-service Key Classes

- **AuthService**: Main authentication business logic
  - register: Email/password registration with auto-generated username
  - loginWithPassword: Password authentication with login failure tracking
  - loginWithCode: Email verification code login with auto-registration
  - logout: Token revocation
  - refreshToken: Generate new access token from refresh token

- **OAuthService**: OAuth 2.0 integration
  - Google OAuth: getGoogleAuthUrl, handleGoogleCallback
  - GitHub OAuth: getGithubAuthUrl, handleGithubCallback
  - WeChat OAuth: getWechatAuthUrl, handleWechatCallback
  - Exchanges authorization codes for user info
  - Creates/updates users with OAuth provider info
  - Links OAuth accounts to existing email users

- **JwtService**: JWT token management
  - generateAccessToken: Creates access token with user claims (2 hours)
  - generateRefreshToken: Creates refresh token (30 days, stored in Redis)
  - extractClaims: Parse and validate tokens
  - validateToken: Check token signature, expiration, blacklist
  - revokeToken: Add token to blacklist (stored in Redis)
  - refreshAccessToken: Generate new access token from valid refresh token
  - **Important**: Access tokens include `avatarUrl` in claims for frontend avatar display

- **RedisService**: Redis operations wrapper
  - Verification codes (5 min TTL, 1 min cooldown)
  - JWT blacklist (TTL = token remaining time)
  - Refresh tokens (30 days TTL)
  - Login failure counter (15 min TTL, 5 attempts = account lock)
  - OAuth state (5 min TTL)

- **UserService**: User CRUD operations
  - createUser: Email + username + password
  - createUserWithoutPassword: For OAuth and code login
  - findByEmail, findByUsername: User lookup
  - updateLastLogin: Track login timestamp
  - linkOAuthAccount: Associate OAuth provider with user

- **EmailService**: Email verification
  - sendVerificationCode: Generate 6-digit code, send via SMTP
  - Uses Thymeleaf templates for email content

### core-service Key Classes

- **VideoProcessingService**: Orchestrates video processing workflows, manages master video, triggers window analysis
- **GrpcClientService**: Wrapper for all gRPC calls to ai-service (9 methods: ProcessVideo, AnalyzeVideo, ExtractTail, ConcatVideos, ExtractSegment, GetVideoDuration, GenerateTitle, RefineAnalysis, ExtractUserMemory)
- **StorageServiceFactory**: Returns appropriate storage service (MinIO/OSS/COS) based on config
- **AnalysisService**: Saves analysis results to DB, streams to WebSocket via `/topic/session/{sessionId}`
- **VideoUploadService**: Handles chunk uploads, session management, async task tracking
- **SessionCompletionService**: Handles session finalization (title generation, memory extraction, cleanup)
- **UserMemoryService**: Manages user memory CRUD operations and AI-based memory extraction
- **CleanupService**: Deletes temporary files and storage objects

### ai-service Key Modules

- **grpc_server.py**: gRPC service implementation, bridges sync gRPC with async AI calls (9 service methods)
- **video_processor.py**: FFmpeg operations (slicing, concatenation, extraction, duration)
- **models/factory.py**: Returns appropriate analyzer (Qwen/Gemini) based on model name
- **models/qwen_analyzer.py**: DashScope SDK integration with streaming support
- **models/gemini_analyzer.py**: Google GenAI SDK integration with streaming support
- **prompts/base_prompts.py**: Prompt templates for analysis (language/scenario/mode-specific)
- **prompts/prompt_builder.py**: Prompt construction logic with context and memory support
- **prompts/analysis_refinement_prompts.py**: Prompts for stage 2 refinement
- **prompts/title_generation_prompts.py**: Prompts for session title generation

### Database Schema

**auth-service database** (separate from core-service):
- **users**: User accounts (email, username, password hash, avatar URL, OAuth connections)
- **oauth_connections**: Links users to OAuth providers (Google/GitHub/WeChat)
- **email_verification_tokens**: Email verification tokens (not currently used)
- **password_reset_tokens**: Password reset tokens (not currently used)

**core-service database**:
- **sessions**: Recording sessions with status, mode, storage type, master video path
- **video_chunks**: Individual uploaded chunks (less important after master video approach)
- **analysis_records**: AI analysis results per window with time ranges, raw_content (stage 1), refined_content (stage 2)
- **user_memory**: User personalization data (JSONB: habits, knowledge, behavior_patterns)
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
   - Backend sends to `/topic/session/{sessionId}` (NOT `/topic/analysis/{sessionId}`)
   - Frontend subscribes to same path
   - Each message contains `windowIndex`, `content` (incremental), `timestamp`

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

11. **isLastChunk mechanism**:
    - Frontend sends `isLastChunk=true` with the final chunk upload
    - Backend automatically triggers session finalization: title generation + memory extraction + cleanup
    - Simplifies frontend logic, centralizes completion handling in backend
    - SessionCompletionService waits for all async analysis tasks to complete before marking COMPLETED

12. **UI Design Philosophy**:
    - Match Wrangler's clean, minimal aesthetic
    - Pure content focus (no decorative UI in analysis display)
    - Smooth animations (0.4s cubic-bezier transitions)
    - Push/pull sidebar (content gets pushed, not overlaid)

13. **Test Mode Purpose**:
    - Simulates production recording flow exactly
    - Allows testing with pre-recorded chunks
    - Config options only in Test mode (production uses fixed defaults)
    - User sees identical experience: config → streaming analysis results

14. **Authentication Flow**:
    - OAuth: User clicks OAuth button → redirect to provider → callback with code → exchange for tokens → redirect to frontend with tokens in URL → App.tsx parses tokens and saves to authStore
    - Email code: User enters email → send code → user enters code → backend validates → returns tokens → frontend saves to authStore
    - Token structure: JWT with claims (userId, email, username, avatarUrl, roles, jti)
    - Token refresh: Check every minute if access token expires within 5 minutes, auto-refresh if needed
    - Logout: Revoke access token (add to blacklist), delete refresh token from Redis, clear authStore

15. **Avatar Display Logic**:
    - OAuth users: avatarUrl from provider stored in DB, included in JWT token
    - Non-OAuth users: avatarUrl = null, display first letter of username/email
    - Frontend checks `user.avatarUrl`: if exists, show `<img>`, else show `<span>` with initial
    - **Critical**: JWT tokens must include `avatarUrl` claim, old tokens without it show only initials
    - **Fix for missing avatars**: Clear all users (DB + Redis) + clear localStorage + re-login

16. **Modal Design System**:
    - All modals use same styling: `rounded-2xl` modal, `rounded-full` buttons
    - Custom border color: `rgb(229, 229, 229)` (between gray-200 and gray-300)
    - Minimal backdrop blur: `backdrop-blur-[0.5px]`
    - Padding: `px-7 py-10` for modal content, `px-4` for text content
    - Button hierarchy: Black (`bg-black`) for primary, white with border for secondary
    - Text sizes: `text-3xl` for titles, `text-base` for body/buttons

## Project Structure

```
ski/
├── common/                    # Shared Spring Boot library
│   └── src/main/java/com/skiuo/common/
│       ├── dto/               # Shared DTOs (ApiResponse, etc.)
│       └── exception/         # Shared exceptions (BusinessException, etc.)
│
├── auth-service/              # Spring Boot authentication service
│   ├── src/main/java/com/skiuo/authservice/
│   │   ├── controller/       # REST endpoints (AuthController, OAuthController, UserController)
│   │   ├── service/          # Business logic (AuthService, OAuthService, JwtService, RedisService)
│   │   ├── repository/       # JPA repositories
│   │   ├── entity/           # Database entities (User, OAuthConnection)
│   │   ├── config/           # Configuration (SecurityConfig, RedisConfig, DotenvConfig)
│   │   ├── dto/              # Request/response objects (AuthResponse, LoginRequest, etc.)
│   │   ├── security/         # Security filters (JwtAuthenticationFilter, CustomUserDetailsService)
│   │   └── exception/        # Custom exceptions
│   ├── pom.xml               # Maven dependencies
│   └── src/main/resources/application.yml
│
├── core-service/              # Spring Boot video processing backend
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
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SidebarHeader.tsx
│   │   │   ├── RecordingModeSelector.tsx
│   │   │   ├── AnalysisDisplay.tsx
│   │   │   ├── PictureInPictureVideo.tsx
│   │   │   ├── TestPage.tsx
│   │   │   ├── TestUploader.tsx
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   ├── icons/        # Icon components
│   │   │   ├── auth/         # Auth components (AuthModal, LoginMethodSelector, EmailLoginForm, etc.)
│   │   │   └── layout/       # Layout components (deprecated, now using MainLayout, Navbar, Sidebar)
│   │   ├── hooks/            # Custom hooks
│   │   │   ├── useMediaRecorderWithStore.ts
│   │   │   └── useWebSocketWithStore.ts
│   │   ├── stores/           # Zustand stores
│   │   │   ├── uiStore.ts
│   │   │   ├── sessionStore.ts
│   │   │   ├── recordingStore.ts
│   │   │   ├── configStore.ts
│   │   │   ├── analysisStore.ts
│   │   │   └── authStore.ts  # NEW: Authentication state with localStorage persistence
│   │   ├── services/         # API clients
│   │   │   ├── apiClient.ts
│   │   │   ├── mediaRecorder.ts
│   │   │   ├── authClient.ts        # NEW: Authentication API client
│   │   │   ├── authInterceptor.ts   # NEW: Token refresh interceptor
│   │   │   └── websocketClient.ts
│   │   ├── types/            # TypeScript types
│   │   │   ├── index.ts
│   │   │   └── auth.ts       # NEW: Authentication types
│   │   └── config/           # Constants
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

**WebSocket not receiving messages**:
- Check subscription path: Must be `/topic/session/{sessionId}` (NOT `/topic/analysis/{sessionId}`)
- Verify backend sends to same path
- Check browser console for connection status and message logs

**Analysis results not displaying**:
- Check that `analysisStore.addResult` is appending content for same `windowIndex` (not replacing)
- Verify `AnalysisDisplay` combines all results: `results.map(r => r.content).join('\n\n')`
- Ensure no decorative UI (headers, cards, window numbers) in AnalysisDisplay

**Test mode config panel not hiding**:
- TestUploader must call `setState(TestState.UPLOADING)` immediately in `handleStart`
- TestPage must listen to state changes via `onStateChange` callback
- Check that `isConfigVisible` becomes false when state !== IDLE

**OAuth login not redirecting properly**:
- All OAuth callbacks must redirect to root path `/` with tokens in query params
- Frontend App.tsx listens on root path for OAuth callback
- Check: `http://localhost:5173?access_token=...&refresh_token=...` (NOT `/oauth/callback`)

**Avatar not displaying despite avatarUrl in database**:
- Check JWT token includes `avatarUrl` claim: decode token at jwt.io
- Old tokens without `avatarUrl` will only show initials
- Solution: Clear all users (POST `/api/auth/dev/clear-all-users`), clear localStorage (`localStorage.removeItem('auth-storage')`), re-login
- Verify `JwtService.generateAccessToken` includes: `claims.put("avatarUrl", user.getAvatarUrl())`

**Token refresh not working**:
- Check `authInterceptor.ts` is being used for API calls
- Verify `App.tsx` has `useEffect` that calls `refreshTokenIfNeeded()` every minute
- Check browser console for "[Auth] Token expired, refreshing..." logs
- Ensure refresh token is valid in Redis (not expired or deleted)
