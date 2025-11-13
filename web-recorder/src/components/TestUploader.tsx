import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadVideoChunk } from '../services/apiClient';
import type { RecordingConfig, ChunkFile, TestUploadState } from '../types';
import { TestUploadState as TestState } from '../types';

interface TestUploaderProps {
  config: RecordingConfig;
  chunkDuration: number;
  onSessionIdChange?: (sessionId: number | null) => void;
  onStateChange?: (state: TestUploadState) => void;
}

export function TestUploader({ config, chunkDuration, onSessionIdChange, onStateChange }: TestUploaderProps) {
  const [chunks, setChunks] = useState<ChunkFile[]>([]);
  const [state, setState] = useState<TestUploadState>(TestState.IDLE);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chunksRef = useRef<ChunkFile[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const sessionIdRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const remainingTimeRef = useRef<number>(0);

  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    currentChunkIndexRef.current = currentChunkIndex;
  }, [currentChunkIndex]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Notify parent of state changes
  useEffect(() => {
    if (onStateChange) {
      onStateChange(state);
    }
  }, [state, onStateChange]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const chunkFiles: ChunkFile[] = Array.from(files)
      .filter(file => file.name.endsWith('.webm') || file.name.endsWith('.mp4'))
      .sort((a, b) => {
        const indexA = parseInt(a.name.match(/chunk_(\d+)/)?.[1] || '0');
        const indexB = parseInt(b.name.match(/chunk_(\d+)/)?.[1] || '0');
        return indexA - indexB;
      })
      .map((file, index) => ({
        file,
        index,
        duration: chunkDuration,
      }));

    setChunks(chunkFiles);
    setCurrentChunkIndex(0);
    setSessionId(null);
    setError(null);
    setState(TestState.IDLE);

    chunksRef.current = chunkFiles;
    currentChunkIndexRef.current = 0;
    sessionIdRef.current = null;

    console.log(`Selected ${chunkFiles.length} chunks (duration: ${chunkDuration}s each):`, chunkFiles.map(c => c.file.name));
  }, [chunkDuration]);

  const uploadChunk = useCallback(async (chunk: ChunkFile, isLastChunk: boolean = false) => {
    try {
      console.log(`Uploading chunk ${chunk.index}/${chunksRef.current.length - 1}...`);

      const response = await uploadVideoChunk({
        file: chunk.file,
        sessionId: sessionIdRef.current || undefined,
        chunkIndex: chunk.index,
        aiModel: config.aiModel,
        analysisMode: config.analysisMode,
        keepVideo: config.keepVideo,
        storageType: config.storageType,
        duration: chunk.duration,
        isLastChunk,
      });

      if (!sessionIdRef.current && response.sessionId) {
        sessionIdRef.current = response.sessionId;
        setSessionId(response.sessionId);
        console.log('Session created:', response.sessionId);

        if (onSessionIdChange) {
          onSessionIdChange(response.sessionId);
        }
      }

      console.log(`Chunk ${chunk.index} uploaded successfully`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      console.error(`Failed to upload chunk ${chunk.index}:`, err);
      setState(TestState.ERROR);
      return false;
    }
  }, [config, onSessionIdChange]);

  const startCountdown = useCallback((seconds: number, onComplete: () => void) => {
    remainingTimeRef.current = seconds;

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = window.setInterval(() => {
      remainingTimeRef.current -= 1;

      if (remainingTimeRef.current <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        onComplete();
      }
    }, 1000);
  }, []);

  const uploadNextChunkRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const uploadNextChunk = useCallback(async () => {
    const currentIndex = currentChunkIndexRef.current;
    const allChunks = chunksRef.current;

    if (currentIndex >= allChunks.length) {
      console.log('All chunks uploaded!');

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      console.log('Test upload complete. Last chunk was processed with isLastChunk=true');
      setState(TestState.COMPLETED);
      return;
    }

    const chunk = allChunks[currentIndex];
    const isLastChunk = currentIndex === allChunks.length - 1;

    const success = await uploadChunk(chunk, isLastChunk);

    if (!success) {
      return;
    }

    const nextIndex = currentIndex + 1;
    currentChunkIndexRef.current = nextIndex;
    setCurrentChunkIndex(nextIndex);

    if (nextIndex < allChunks.length) {
      setState(TestState.WAITING);

      const testInterval = 10;
      startCountdown(testInterval, () => {
        uploadNextChunkRef.current?.();
      });
    } else {
      setState(TestState.COMPLETED);
    }
  }, [uploadChunk, startCountdown]);

  useEffect(() => {
    uploadNextChunkRef.current = uploadNextChunk;
  }, [uploadNextChunk]);

  const handleStart = useCallback(() => {
    if (chunksRef.current.length === 0) {
      setError('Please select chunk files first');
      return;
    }

    setError(null);
    currentChunkIndexRef.current = 0;
    sessionIdRef.current = null;
    setCurrentChunkIndex(0);
    setSessionId(null);

    // Set state to UPLOADING immediately so config panel hides
    setState(TestState.UPLOADING);

    uploadNextChunk();
  }, [uploadNextChunk]);

  const isIdle = state === TestState.IDLE || state === TestState.COMPLETED;

  return (
    <div>
      {/* File Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Video Chunks
        </label>
        <input
          type="file"
          multiple
          accept=".webm,.mp4"
          onChange={handleFileSelect}
          disabled={!isIdle}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {chunks.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {chunks.length} file{chunks.length > 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={chunks.length === 0 || !isIdle}
        className="mt-6 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
      >
        Start Test
      </button>
    </div>
  );
}
