import { useState, useEffect, useCallback } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { StatusIndicator } from './components/StatusIndicator';
import { VideoRecorder } from './components/VideoRecorder';
import { TestUploader } from './components/TestUploader';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useWebSocket } from './hooks/useWebSocket';
import { DEFAULT_CONFIG, UI_TEXT, updateChunkDuration } from './config/constants';
import { getServerConfig } from './services/apiClient';
import type { RecordingConfig } from './types';
import { RecordingState, AppMode } from './types';

function App() {
  // Configuration state
  const [config, setConfig] = useState<RecordingConfig>(DEFAULT_CONFIG);
  const [chunkDuration, setChunkDuration] = useState<number>(35); // seconds
  const [appMode, setAppMode] = useState<AppMode>(AppMode.RECORD);

  // Session ID state (unified for both record and test modes)
  const [testModeSessionId, setTestModeSessionId] = useState<number | null>(null);

  // Fetch server config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const serverConfig = await getServerConfig();
        updateChunkDuration(serverConfig.recommendedChunkDuration);
        setChunkDuration(serverConfig.recommendedChunkDuration);
        console.log(`Initialized with server config: window=${serverConfig.windowSize}s, step=${serverConfig.windowStep}s, chunk=${serverConfig.recommendedChunkDuration}s`);
      } catch (error) {
        console.error('Failed to fetch server config, using defaults:', error);
      }
    };

    fetchConfig();
  }, []);

  // MediaRecorder hook (for RECORD mode)
  const {
    state,
    stream,
    error,
    sessionId: recordModeSessionId,
    chunkIndex,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useMediaRecorder(config);

  // Use appropriate sessionId based on app mode
  const activeSessionId = appMode === AppMode.RECORD ? recordModeSessionId : testModeSessionId;

  // WebSocket hook for receiving analysis results
  const { isConnected, results } = useWebSocket(activeSessionId);

  // Disable config changes while recording
  const isConfigDisabled = state !== RecordingState.IDLE && state !== RecordingState.STOPPED;

  // Handle test mode session ID changes
  const handleTestModeSessionIdChange = useCallback((sessionId: number | null) => {
    setTestModeSessionId(sessionId);
    console.log('Test mode session ID updated:', sessionId);
  }, []);

  // Clear test mode session when switching modes
  useEffect(() => {
    if (appMode === AppMode.RECORD) {
      setTestModeSessionId(null);
    }
  }, [appMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">{UI_TEXT.APP_TITLE}</h1>
          <p className="mt-1 text-sm text-gray-600">
            通过浏览器录制视频，AI 实时分析生成文字记录
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Indicator */}
        <div className="mb-6">
          <StatusIndicator
            state={state}
            sessionId={activeSessionId}
            chunkIndex={chunkIndex}
            error={error}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Config + Video Recorder */}
          <div className="lg:col-span-1 space-y-6">
            {/* Config Panel */}
            <ConfigPanel
              config={config}
              onChange={setConfig}
              disabled={isConfigDisabled}
              appMode={appMode}
              onAppModeChange={setAppMode}
            />

            {/* Video Recorder or Test Uploader */}
            {appMode === AppMode.RECORD ? (
              <VideoRecorder
                state={state}
                stream={stream}
                onStart={startRecording}
                onStop={stopRecording}
                onPause={pauseRecording}
                onResume={resumeRecording}
              />
            ) : (
              <TestUploader
                config={config}
                chunkDuration={chunkDuration}
                onSessionIdChange={handleTestModeSessionIdChange}
              />
            )}
          </div>

          {/* Right Column: Analysis Results */}
          <div className="lg:col-span-2">
            <AnalysisDisplay
              results={results}
              isConnected={isConnected}
              sessionId={activeSessionId}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            录制的视频每 {chunkDuration} 秒自动分段上传并进行 AI 分析。
            {config.keepVideo
              ? '视频将保留在服务器。'
              : '分析完成后视频将自动删除。'}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <p>
                Skiuo © 2025 - AI 视频录制分析系统
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <span>WebSocket {isConnected ? '已连接' : '未连接'}</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
