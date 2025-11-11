import { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/layout';
import { ConfigSidebar, SessionsSidebar, RecordingSidebar } from './components/sidebars';
import { AnalysisDisplay } from './components/AnalysisDisplay';
import { TestUploader } from './components/TestUploader';
import { PictureInPictureVideo } from './components/PictureInPictureVideo';
import { useMediaRecorder } from './hooks/useMediaRecorder';
import { useWebSocket } from './hooks/useWebSocket';
import { DEFAULT_CONFIG, updateChunkDuration } from './config/constants';
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
        console.log(
          `Initialized with server config: window=${serverConfig.windowSize}s, step=${serverConfig.windowStep}s, chunk=${serverConfig.recommendedChunkDuration}s`
        );
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
  const activeSessionId =
    appMode === AppMode.RECORD ? recordModeSessionId : testModeSessionId;

  // WebSocket hook for receiving analysis results
  const { isConnected, results } = useWebSocket(activeSessionId);

  // Disable config changes while recording
  const isConfigDisabled =
    state !== RecordingState.IDLE && state !== RecordingState.STOPPED;

  // Handle test mode session ID changes
  const handleTestModeSessionIdChange = useCallback(
    (sessionId: number | null) => {
      setTestModeSessionId(sessionId);
      console.log('Test mode session ID updated:', sessionId);
    },
    []
  );

  // Clear test mode session when switching modes
  useEffect(() => {
    if (appMode === AppMode.RECORD) {
      setTestModeSessionId(null);
    }
  }, [appMode]);

  return (
    <>
      {/* Picture-in-Picture Video (only in RECORD mode) */}
      {appMode === AppMode.RECORD && (
        <PictureInPictureVideo
          stream={stream}
          isRecording={state === RecordingState.RECORDING}
        />
      )}

      <Layout
        // Config Sidebar Content
        configContent={
        <div className="flex flex-col h-full">
          <div className="flex-shrink-0">
            <ConfigSidebar
              config={config}
              onChange={setConfig}
              disabled={isConfigDisabled}
              appMode={appMode}
              onAppModeChange={setAppMode}
            />
          </div>

          {/* Test Mode Uploader (below config) */}
          {appMode === AppMode.TEST && (
            <div className="flex-1 overflow-y-auto border-t border-gray-200">
              <TestUploader
                config={config}
                chunkDuration={chunkDuration}
                onSessionIdChange={handleTestModeSessionIdChange}
              />
            </div>
          )}
        </div>
      }
      // Sessions Sidebar Content
      sessionsContent={
        <SessionsSidebar
          sessions={[]}
          onSessionSelect={(id) => console.log('Selected session:', id)}
          onSessionDelete={(id) => console.log('Delete session:', id)}
        />
      }
      // Recording Sidebar Content
      recordingContent={
        <RecordingSidebar
          state={state}
          sessionId={activeSessionId}
          chunkIndex={chunkIndex}
          onStart={startRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
        />
      }
      // Main Content Area
      mainContent={
        <div className="h-full flex flex-col bg-white">
          {/* Header Bar */}
          <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  SKI Video Analysis
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Record video and get AI-powered real-time transcription
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-3">
                {error && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
                    ❌ {error}
                  </div>
                )}
                <div className="flex items-center space-x-2 text-sm">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-gray-600">
                    {isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area - Always shows AnalysisDisplay */}
          <div className="flex-1 overflow-hidden p-6">
            <AnalysisDisplay
              results={results}
              isConnected={isConnected}
              sessionId={activeSessionId}
            />
          </div>
        </div>
      }
      />
    </>
  );
}

export default App;
