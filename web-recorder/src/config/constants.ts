import { AIModel, AnalysisMode, StorageType } from '../types';
import type { RecordingConfig } from '../types';

// ========== API Configuration ==========

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'http://localhost:8080';

export const API_ENDPOINTS = {
  UPLOAD_VIDEO: '/api/videos/upload',
  SESSION_STATUS: (sessionId: number) => `/api/videos/sessions/${sessionId}`,
  SESSION_RECORDS: (sessionId: number) => `/api/sessions/${sessionId}/records`,
  USER_SESSIONS: (userId: number) => `/api/users/${userId}/sessions`,
  HEALTH: '/api/videos/health',
} as const;

export const WS_ENDPOINTS = {
  CONNECT: '/ws',
  SESSION_TOPIC: (sessionId: number) => `/topic/session/${sessionId}`,
} as const;

// ========== Recording Configuration ==========

export const RECORDING_CONFIG = {
  // Chunk duration in milliseconds (30 seconds)
  CHUNK_DURATION: 30000,

  // Video constraints
  VIDEO_CONSTRAINTS: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },

  // MediaRecorder options
  RECORDER_OPTIONS: {
    mimeType: 'video/webm;codecs=vp8,opus',
    videoBitsPerSecond: 2500000, // 2.5 Mbps
  },
} as const;

// ========== Default User Configuration ==========

export const DEFAULT_CONFIG: RecordingConfig = {
  userId: 1, // Fixed user ID for MVP
  aiModel: AIModel.QWEN,
  analysisMode: AnalysisMode.SLIDING_WINDOW,
  keepVideo: false,
  storageType: StorageType.COS,
};

// ========== UI Constants ==========

export const UI_TEXT = {
  APP_TITLE: 'Skiuo - AI Video Recorder',

  // Recording states
  IDLE: 'Click Start to begin recording',
  REQUESTING_PERMISSION: 'Requesting camera permission...',
  READY: 'Ready to record',
  RECORDING: 'Recording in progress',
  PAUSED: 'Recording paused',
  STOPPED: 'Recording stopped',
  ERROR: 'Error occurred',

  // Buttons
  BTN_START: 'Start Recording',
  BTN_STOP: 'Stop Recording',
  BTN_PAUSE: 'Pause',
  BTN_RESUME: 'Resume',

  // Config panel
  CONFIG_AI_MODEL: 'AI Model',
  CONFIG_ANALYSIS_MODE: 'Analysis Mode',
  CONFIG_KEEP_VIDEO: 'Keep Video After Analysis',
  CONFIG_STORAGE_TYPE: 'Storage Service',

  // Analysis display
  ANALYSIS_TITLE: 'AI Analysis Results',
  ANALYSIS_EMPTY: 'No analysis results yet. Start recording to see results.',
  ANALYSIS_CONNECTING: 'Connecting to analysis service...',
  ANALYSIS_CONNECTED: 'Connected. Waiting for results...',
} as const;
