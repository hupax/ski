import { useState } from 'react';
import { ConfigPanel } from './components/ConfigPanel';
import { StatusIndicator } from './components/StatusIndicator';
import { VideoRecorder } from './components/VideoRecorder';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useWebSocket } from './hooks/useWebSocket';
import { DEFAULT_CONFIG, UI_TEXT } from './config/constants';
import type { RecordingConfig } from './types';
import { RecordingState } from './types';

function App() {
  // Configuration state
  const [config, setConfig] = useState<RecordingConfig>(DEFAULT_CONFIG);

  // MediaRecorder hook
  const {
    state,
    stream,
    error,
    sessionId,
    chunkIndex,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useMediaRecorder(config);

  // WebSocket hook for receiving analysis results
  const { isConnected, results } = useWebSocket(sessionId);

  // Disable config changes while recording
  const isConfigDisabled = state !== RecordingState.IDLE && state !== RecordingState.STOPPED;

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
            sessionId={sessionId}
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
            />

            {/* Video Recorder */}
            <VideoRecorder
              state={state}
              stream={stream}
              onStart={startRecording}
              onStop={stopRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
            />
          </div>

          {/* Right Column: Analysis Results */}
          <div className="lg:col-span-2">
            <AnalysisDisplay
              results={results}
              isConnected={isConnected}
              sessionId={sessionId}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            录制的视频每 30 秒自动分段上传并进行 AI 分析。
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
