import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadVideoChunk } from '../services/apiClient';
import type { RecordingConfig, ChunkFile, TestUploadState } from '../types';
import { TestUploadState as TestState } from '../types';

interface TestUploaderProps {
  config: RecordingConfig;
  chunkDuration: number; // seconds, from server config
  onSessionIdChange?: (sessionId: number | null) => void; // Callback to notify parent of sessionId
}

export function TestUploader({ config, chunkDuration, onSessionIdChange }: TestUploaderProps) {
  const [chunks, setChunks] = useState<ChunkFile[]>([]);
  const [state, setState] = useState<TestUploadState>(TestState.IDLE);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  // Use refs to avoid closure traps (same pattern as useMediaRecorder)
  const chunksRef = useRef<ChunkFile[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const sessionIdRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const remainingTimeRef = useRef<number>(0); // for pause/resume

  // Sync refs with state
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);

  useEffect(() => {
    currentChunkIndexRef.current = currentChunkIndex;
  }, [currentChunkIndex]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    // Convert FileList to ChunkFile array
    const chunkFiles: ChunkFile[] = Array.from(files)
      .filter(file => file.name.endsWith('.webm') || file.name.endsWith('.mp4'))
      .sort((a, b) => {
        // Extract chunk index from filename (e.g., chunk_0.webm)
        const indexA = parseInt(a.name.match(/chunk_(\d+)/)?.[1] || '0');
        const indexB = parseInt(b.name.match(/chunk_(\d+)/)?.[1] || '0');
        return indexA - indexB;
      })
      .map((file, index) => ({
        file,
        index,
        duration: chunkDuration, // Use server config
      }));

    setChunks(chunkFiles);
    setCurrentChunkIndex(0);
    setSessionId(null);
    setError(null);
    setState(TestState.IDLE);

    // Reset refs
    chunksRef.current = chunkFiles;
    currentChunkIndexRef.current = 0;
    sessionIdRef.current = null;

    console.log(`Selected ${chunkFiles.length} chunks (duration: ${chunkDuration}s each):`, chunkFiles.map(c => c.file.name));
  }, [chunkDuration]);

  /**
   * Upload a single chunk
   */
  const uploadChunk = useCallback(async (chunk: ChunkFile, isLastChunk: boolean = false) => {
    try {
      console.log(`Uploading chunk ${chunk.index}/${chunksRef.current.length - 1}...`);
      setState(TestState.UPLOADING);

      const response = await uploadVideoChunk({
        file: chunk.file,
        sessionId: sessionIdRef.current || undefined,
        userId: config.userId,
        chunkIndex: chunk.index,
        aiModel: config.aiModel,
        analysisMode: config.analysisMode,
        keepVideo: config.keepVideo,
        storageType: config.storageType,
        duration: chunk.duration,
        isLastChunk,
      });

      // Save session ID from first upload
      if (!sessionIdRef.current && response.sessionId) {
        sessionIdRef.current = response.sessionId;
        setSessionId(response.sessionId);
        console.log('Session created:', response.sessionId);

        // Notify parent component (App.tsx) of the new session ID for WebSocket subscription
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
  }, [config]);

  /**
   * Start countdown before next upload
   * Uses remainingTimeRef to support pause/resume
   */
  const startCountdown = useCallback((seconds: number, onComplete: () => void) => {
    remainingTimeRef.current = seconds;
    setCountdown(seconds);

    // Clear any existing interval
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Update countdown every second
    countdownIntervalRef.current = window.setInterval(() => {
      remainingTimeRef.current -= 1;
      setCountdown(remainingTimeRef.current);

      if (remainingTimeRef.current <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        onComplete();
      }
    }, 1000);
  }, []);

  /**
   * Upload all chunks sequentially (using refs to avoid closure trap)
   */
  const uploadNextChunkRef = useRef<() => Promise<void>>();

  const uploadNextChunk = useCallback(async () => {
    const currentIndex = currentChunkIndexRef.current;
    const allChunks = chunksRef.current;

    if (currentIndex >= allChunks.length) {
      console.log('All chunks uploaded!');

      // Clear countdown timer
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      // No need to call finishSession - last chunk is marked with isLastChunk=true
      console.log('Test upload complete. Last chunk was processed with isLastChunk=true');

      setState(TestState.COMPLETED);
      return;
    }

    const chunk = allChunks[currentIndex];
    const isLastChunk = currentIndex === allChunks.length - 1;

    // Upload current chunk
    const success = await uploadChunk(chunk, isLastChunk);

    if (!success) {
      return; // Error occurred, stop
    }

    // Move to next chunk
    const nextIndex = currentIndex + 1;
    currentChunkIndexRef.current = nextIndex;
    setCurrentChunkIndex(nextIndex);

    // If not last chunk, wait before uploading next
    if (nextIndex < allChunks.length) {
      setState(TestState.WAITING);

      // Simulate real recording: wait chunkDuration seconds before next upload
      startCountdown(chunkDuration, () => {
        // Use ref to call the latest version of uploadNextChunk
        uploadNextChunkRef.current?.();
      });
    } else {
      setState(TestState.COMPLETED);
    }
  }, [uploadChunk, chunkDuration, startCountdown]);

  // Store latest uploadNextChunk in ref
  useEffect(() => {
    uploadNextChunkRef.current = uploadNextChunk;
  }, [uploadNextChunk]);

  /**
   * Start test upload
   */
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
    uploadNextChunk();
  }, [uploadNextChunk]);

  /**
   * Pause upload (saves remaining time for resume)
   */
  const handlePause = useCallback(() => {
    setState(TestState.PAUSED);

    // Clear countdown but save remaining time
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    console.log(`Upload paused (${remainingTimeRef.current}s remaining)`);
  }, []);

  /**
   * Resume upload (continues from where it left off)
   */
  const handleResume = useCallback(() => {
    console.log(`Upload resumed (continuing with ${remainingTimeRef.current}s remaining)`);

    // If we were in the middle of waiting, continue countdown
    if (remainingTimeRef.current > 0) {
      setState(TestState.WAITING);
      startCountdown(remainingTimeRef.current, () => {
        uploadNextChunkRef.current?.();
      });
    } else {
      // If not waiting, upload next chunk immediately
      uploadNextChunk();
    }
  }, [uploadNextChunk, startCountdown]);

  /**
   * Stop upload (resets everything)
   */
  const handleStop = useCallback(() => {
    setState(TestState.IDLE);
    currentChunkIndexRef.current = 0;
    sessionIdRef.current = null;
    remainingTimeRef.current = 0;
    setCurrentChunkIndex(0);
    setSessionId(null);
    setCountdown(0);

    // Clear timers
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Notify parent to clear session ID
    if (onSessionIdChange) {
      onSessionIdChange(null);
    }

    console.log('Upload stopped');
  }, [onSessionIdChange]);

  const isIdle = state === TestState.IDLE || state === TestState.COMPLETED;
  const isUploading = state === TestState.UPLOADING;
  const isWaiting = state === TestState.WAITING;
  const isPaused = state === TestState.PAUSED;
  const hasError = state === TestState.ERROR;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">测试模式 - 上传本地Chunks</h2>

      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          选择 chunk 文件
        </label>
        <input
          type="file"
          multiple
          accept=".webm,.mp4"
          onChange={handleFileSelect}
          disabled={!isIdle}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-2 text-xs text-gray-500">
          选择由 test_video_splitter.py 生成的 chunk_0.webm, chunk_1.webm, ... 文件（可多选）
        </p>
      </div>

      {/* Chunks Info */}
      {chunks.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700 font-semibold mb-2">
            已选择 {chunks.length} 个 chunk 文件
          </p>
          <div className="space-y-1">
            {chunks.map((chunk) => (
              <div
                key={chunk.index}
                className={`text-xs ${
                  chunk.index === currentChunkIndex && !isIdle
                    ? 'text-blue-900 font-bold'
                    : 'text-blue-600'
                }`}
              >
                {chunk.index === currentChunkIndex && isUploading && '⏳ '}
                {chunk.index < currentChunkIndex && '✓ '}
                {chunk.file.name} ({(chunk.file.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Display */}
      {!isIdle && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">状态:</span>
            <span
              className={`text-sm font-semibold ${
                isUploading
                  ? 'text-blue-600'
                  : isWaiting
                  ? 'text-yellow-600'
                  : isPaused
                  ? 'text-gray-600'
                  : 'text-green-600'
              }`}
            >
              {isUploading && '⏳ 上传中...'}
              {isWaiting && `⏰ 等待 ${countdown}秒 后上传下一个chunk`}
              {isPaused && '⏸️ 已暂停'}
              {state === TestState.COMPLETED && '✅ 全部完成'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">进度:</span>
            <span className="text-sm text-gray-600">
              {currentChunkIndex} / {chunks.length} chunks
            </span>
          </div>
          {sessionId && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-medium text-gray-700">Session ID:</span>
              <span className="text-sm text-gray-600">{sessionId}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {hasError && error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">
            <strong>错误:</strong> {error}
          </p>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex space-x-3">
        {isIdle && (
          <button
            onClick={handleStart}
            disabled={chunks.length === 0}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始测试
          </button>
        )}

        {(isUploading || isWaiting) && (
          <button
            onClick={handlePause}
            className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors"
          >
            暂停
          </button>
        )}

        {isPaused && (
          <button
            onClick={handleResume}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
          >
            继续
          </button>
        )}

        {!isIdle && (
          <button
            onClick={handleStop}
            className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
          >
            停止
          </button>
        )}
      </div>

      {/* Info Message */}
      {isIdle && chunks.length === 0 && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-sm text-gray-700">
            <strong>使用说明:</strong>
          </p>
          <ol className="mt-2 text-sm text-gray-600 list-decimal list-inside space-y-1">
            <li>运行 ai-service/test_video_splitter.py 生成 chunk 文件</li>
            <li>选择生成的 chunk_*.webm 文件（可多选）</li>
            <li>点击"开始测试"</li>
            <li>系统会按顺序上传 chunks，每个间隔 {chunkDuration} 秒（模拟真实录制）</li>
            <li>实时查看右侧的分析结果</li>
          </ol>
        </div>
      )}
    </div>
  );
}
