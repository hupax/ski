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
  const lastChunkUploadRef = useRef<Promise<void> | null>(null);  // Track last chunk upload

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
    async (blob: Blob, duration: number, isLastChunk: boolean = false) => {
      const currentChunkIndex = chunkIndexRef.current;
      const currentSessionId = sessionIdRef.current;

      // Create upload promise and track it
      const uploadPromise = (async () => {
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
            isLastChunk,
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
      })();

      // Store reference to this upload
      lastChunkUploadRef.current = uploadPromise;

      return uploadPromise;
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
  const stopRecording = useCallback(async () => {
    if (recorderRef.current) {
      // Stop recording (will trigger ondataavailable for final chunk)
      recorderRef.current.stopRecording();

      // Wait for the last chunk upload to complete
      if (lastChunkUploadRef.current) {
        console.log('Waiting for final chunk upload to complete...');
        try {
          await lastChunkUploadRef.current;
          console.log('Final chunk upload completed');
        } catch (err) {
          console.error('Final chunk upload failed:', err);
        }
        lastChunkUploadRef.current = null;
      }

      // Clean up camera stream to release resources and turn off camera light
      recorderRef.current.cleanup();

      setState(RecordingState.STOPPED);
      setStream(null);  // Clear stream from UI

      // No need to call finishSession - last chunk is marked with isLastChunk=true
      console.log(`Recording stopped. Last chunk will be processed with isLastChunk=true`);

      // Reset refs for next session
      sessionIdRef.current = null;
      chunkIndexRef.current = 0;
      setSessionId(null);
      setChunkIndex(0);
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
