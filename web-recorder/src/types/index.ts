// ========== Enums ==========

export const AIModel = {
  QWEN: 'qwen',
  GEMINI: 'gemini',
} as const;

export type AIModel = (typeof AIModel)[keyof typeof AIModel];

export const AnalysisMode = {
  FULL: 'FULL',
  SLIDING_WINDOW: 'SLIDING_WINDOW',
} as const;

export type AnalysisMode = (typeof AnalysisMode)[keyof typeof AnalysisMode];

export const SessionStatus = {
  RECORDING: 'RECORDING',
  ANALYZING: 'ANALYZING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export const RecordingState = {
  IDLE: 'IDLE',
  REQUESTING_PERMISSION: 'REQUESTING_PERMISSION',
  READY: 'READY',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  ERROR: 'ERROR',
} as const;

export type RecordingState = (typeof RecordingState)[keyof typeof RecordingState];

export const StorageType = {
  MINIO: 'minio',
  OSS: 'oss',
  COS: 'cos',
} as const;

export type StorageType = (typeof StorageType)[keyof typeof StorageType];

export const AppMode = {
  RECORD: 'RECORD',
  TEST: 'TEST',
} as const;

export type AppMode = (typeof AppMode)[keyof typeof AppMode];

export const TestUploadState = {
  IDLE: 'IDLE',
  UPLOADING: 'UPLOADING',
  WAITING: 'WAITING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  ERROR: 'ERROR',
} as const;

export type TestUploadState = (typeof TestUploadState)[keyof typeof TestUploadState];

// ========== Configuration ==========

export interface RecordingConfig {
  aiModel: AIModel;
  analysisMode: AnalysisMode;
  keepVideo: boolean;
  storageType: StorageType;
}

// ========== API Request/Response Types ==========

export interface VideoUploadRequest {
  file: Blob;
  sessionId?: number;
  chunkIndex: number;
  aiModel: string;
  analysisMode: string;
  keepVideo: boolean;
  storageType: string;
  duration?: number;
  isLastChunk?: boolean;
}

export interface VideoUploadResponse {
  sessionId: number;
  chunkId: number;
  status: string;
  message: string;
}

export interface SessionStatusResponse {
  id: number;
  userId: number;
  status: SessionStatus;
  aiModel: string;
  analysisMode: string;
  keepVideo: boolean;
  startTime: string;
  endTime?: string;
  totalChunks: number;
  analyzedChunks: number;
}

export interface AnalysisRecordResponse {
  id: number;
  sessionId: number;
  chunkId: number;
  windowIndex?: number;
  content: string;
  startTimeOffset: number;
  endTimeOffset: number;
  createdAt: string;
}

export interface ServerConfigResponse {
  windowSize: number;
  windowStep: number;
  recommendedChunkDuration: number;
}

// ========== WebSocket Message Types ==========

export interface WebSocketMessage {
  type: 'analysis_result';
  sessionId: number;
  windowIndex: number;
  content: string;
  timestamp: number;
}

// ========== Component State Types ==========

export interface RecorderState {
  state: RecordingState;
  stream: MediaStream | null;
  error: string | null;
  sessionId: number | null;
  chunkIndex: number;
}

export interface AnalysisResult {
  windowIndex: number;
  content: string;
  timestamp: number;
}

// ========== Test Mode Types ==========

export interface ChunkFile {
  file: File;
  index: number;
  duration: number; // seconds
}

// ========== Auth Types ==========

export * from './auth'
