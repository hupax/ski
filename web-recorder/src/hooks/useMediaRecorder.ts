import { useState, useRef, useCallback, useEffect } from 'react';
import { VideoRecorderService } from '../services/mediaRecorder';
import { uploadVideoChunk } from '../services/apiClient';
import { RecordingState } from '../types';
import type { RecordingConfig } from '../types';

interface UseMediaRecorderReturn {
  state: RecordingState;
  stream: MediaStream | null;
  error: string | null;
  sessionId: number | null;
  chunkIndex: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

/**
 * Custom hook for managing MediaRecorder and video upload
 */
export function useMediaRecorder(config: RecordingConfig): UseMediaRecorderReturn {
  const [state, setState] = useState<RecordingState>(RecordingState.IDLE);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [chunkIndex, setChunkIndex] = useState<number>(0);

  const recorderRef = useRef<VideoRecorderService | null>(null);
  const sessionIdRef = useRef<number | null>(null);  // Use ref to avoid closure issue
  const chunkIndexRef = useRef<number>(0);

  // Initialize recorder service
  useEffect(() => {
    if (!recorderRef.current) {
      recorderRef.current = new VideoRecorderService();
    }

    return () => {
      // Cleanup on unmount
      if (recorderRef.current) {
        recorderRef.current.cleanup();
        recorderRef.current = null;
      }
    };
  }, []);

  /**
   * Handle video chunk upload
   */
  const handleChunkUpload = useCallback(
    async (blob: Blob, duration: number) => {
      const currentChunkIndex = chunkIndexRef.current;
      const currentSessionId = sessionIdRef.current;

      try {
        console.log(`Uploading chunk ${currentChunkIndex}, sessionId=${currentSessionId}...`);

        const response = await uploadVideoChunk({
          file: blob,
          sessionId: currentSessionId || undefined,
          userId: config.userId,
          chunkIndex: currentChunkIndex,
          aiModel: config.aiModel,
          analysisMode: config.analysisMode,
          keepVideo: config.keepVideo,
          storageType: config.storageType,
          duration,
        });

        // Update session ID from first chunk response
        if (!currentSessionId && response.sessionId) {
          sessionIdRef.current = response.sessionId;
          setSessionId(response.sessionId);
          console.log('Session created:', response.sessionId);
        }

        // Increment chunk index for next upload
        chunkIndexRef.current += 1;
        setChunkIndex(chunkIndexRef.current);

        console.log(`Chunk ${currentChunkIndex} uploaded successfully to session ${response.sessionId}`);
      } catch (err) {
        console.error(`Failed to upload chunk ${currentChunkIndex}:`, err);
        setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    [config]
  );

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    if (!recorderRef.current) {
      setError('Recorder not initialized');
      return;
    }

    try {
      setState(RecordingState.REQUESTING_PERMISSION);
      setError(null);

      // Request camera access
      const mediaStream = await recorderRef.current.requestCameraAccess();
      setStream(mediaStream);
      setState(RecordingState.READY);

      // Start recording
      recorderRef.current.startRecording({
        onDataAvailable: handleChunkUpload,
        onError: (err) => {
          setError(err.message);
          setState(RecordingState.ERROR);
        },
        onStop: () => {
          setState(RecordingState.STOPPED);
        },
      });

      setState(RecordingState.RECORDING);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      setState(RecordingState.ERROR);
    }
  }, [handleChunkUpload]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording();
      setState(RecordingState.STOPPED);

      // Reset refs for next session
      sessionIdRef.current = null;
      chunkIndexRef.current = 0;
    }
  }, []);

  /**
   * Pause recording
   */
  const pauseRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.pauseRecording();
      setState(RecordingState.PAUSED);
    }
  }, []);

  /**
   * Resume recording
   */
  const resumeRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.resumeRecording();
      setState(RecordingState.RECORDING);
    }
  }, []);

  return {
    state,
    stream,
    error,
    sessionId,
    chunkIndex,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
