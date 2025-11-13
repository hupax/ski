import { useEffect, useState } from 'react'
import {
  MainLayout,
  RecordingModeSelector,
  AnalysisDisplay,
  PictureInPictureVideo,
} from './components'
import { TestPage } from './components/TestPage'
import {
  useUIStore,
  useSessionStore,
  useRecordingStore,
  useConfigStore,
  useAnalysisStore,
  useAuthStore,
} from './stores'
import { useMediaRecorderWithStore } from './hooks/useMediaRecorderWithStore'
import { useWebSocketWithStore } from './hooks/useWebSocketWithStore'
import { getServerConfig } from './services/apiClient'
import { refreshTokenIfNeeded } from './services/authInterceptor'
import { AnalysisMode, RecordingState } from './types'

function App() {
  const { currentView, setCurrentView } = useUIStore()
  const { currentSessionId, fetchSessions } = useSessionStore()
  const { state: recordingState, stream, sessionId: recordingSessionId } = useRecordingStore()
  const { setChunkDuration } = useConfigStore()
  const { results, isConnected } = useAnalysisStore()
  const setAuth = useAuthStore((state) => state.setAuth)

  // Recording mode selection state (from RecordingModeSelector)
  const [, setSelectedMode] = useState<'upload' | 'full' | 'sliding_window' | null>(null)

  // Upload mode session ID
  const [uploadSessionId, setUploadSessionId] = useState<number | null>(null)

  // Get config from store
  const config = useConfigStore()

  // Use media recorder hook with stores
  const {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useMediaRecorderWithStore(config)

  // Active session ID (either from recording, upload, or selected session)
  const activeSessionId = recordingSessionId || uploadSessionId || currentSessionId

  // Use WebSocket hook with stores
  useWebSocketWithStore(activeSessionId)

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const accessToken = urlParams.get('access_token')
    const refreshToken = urlParams.get('refresh_token')
    const error = urlParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      alert(`Authentication failed: ${error}`)
      window.history.replaceState({}, '', '/')
      return
    }

    if (accessToken && refreshToken) {
      try {
        // Decode JWT to get user info
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        const userInfo = {
          id: payload.userId,
          email: payload.email,
          username: payload.username || payload.sub,
          avatarUrl: payload.avatarUrl || null,
        }

        setAuth(accessToken, refreshToken, userInfo)
        console.log('OAuth login successful:', userInfo.email)

        // Clean URL
        window.history.replaceState({}, '', '/')
      } catch (e) {
        console.error('Failed to parse OAuth token:', e)
        alert('Authentication failed')
        window.history.replaceState({}, '', '/')
      }
    }
  }, [setAuth])

  // Debug: Log active session ID changes
  useEffect(() => {
    console.log('[App] Active session ID:', activeSessionId)
  }, [activeSessionId])

  // Proactively refresh token if needed (check every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTokenIfNeeded()
    }, 60000) // Check every minute

    // Initial check
    refreshTokenIfNeeded()

    return () => clearInterval(interval)
  }, [])

  // Fetch server config and sessions on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Fetch server config
        const serverConfig = await getServerConfig()
        setChunkDuration(serverConfig.recommendedChunkDuration)
        console.log(
          `Initialized with server config: window=${serverConfig.windowSize}s, step=${serverConfig.windowStep}s, chunk=${serverConfig.recommendedChunkDuration}s`
        )
      } catch (error) {
        console.error('Failed to fetch server config, using defaults:', error)
      }

      // Fetch sessions
      await fetchSessions()
    }

    initializeApp()
  }, [setChunkDuration, fetchSessions])

  // Handle "New Recording" button click
  const handleNewRecording = () => {
    setCurrentView('recording-mode-selection')
  }

  // Handle "Test" button click
  const handleTest = () => {
    setCurrentView('test')
  }

  // Handle mode selection
  const handleModeSelect = async (mode: 'upload' | 'full' | 'sliding_window') => {
    setSelectedMode(mode)

    // Update config based on mode
    if (mode === 'full') {
      config.setAnalysisMode(AnalysisMode.FULL)
    } else if (mode === 'sliding_window') {
      config.setAnalysisMode(AnalysisMode.SLIDING_WINDOW)
    }

    // For upload mode, show upload interface
    if (mode === 'upload') {
      setCurrentView('upload')
      return
    }

    // For recording modes, start recording
    try {
      await startRecording()
      setCurrentView('recording')
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  // Handle upload session ID change
  const handleUploadSessionChange = (sessionId: number | null) => {
    console.log('[App] Upload session ID changed:', sessionId)
    setUploadSessionId(sessionId)
    if (sessionId) {
      useSessionStore.getState().setCurrentSessionId(sessionId)
      // Clear previous results when starting new test
      useAnalysisStore.getState().clearResults()
    }
  }

  // Show Picture-in-Picture when recording
  const showPiP = recordingState === RecordingState.RECORDING || recordingState === RecordingState.PAUSED

  return (
    <>
      {/* Picture-in-Picture Video */}
      {showPiP && stream && (
        <PictureInPictureVideo
          stream={stream}
          isRecording={recordingState === RecordingState.RECORDING}
          isPaused={recordingState === RecordingState.PAUSED}
          onStop={stopRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
        />
      )}

      {/* Main Layout */}
      <MainLayout onNewRecording={handleNewRecording} onTest={handleTest}>
        {/* Content based on current view */}
        {currentView === 'recording-mode-selection' ? (
          <RecordingModeSelector onModeSelect={handleModeSelect} />
        ) : currentView === 'upload' ? (
          <div className="h-full flex">
            {/* Left: Upload Interface (from mode selection) */}
            <div className="w-96 border-r border-gray-200 flex-shrink-0">
              <div className="h-full p-6 flex items-center justify-center text-gray-500">
                Upload video file interface - TODO
              </div>
            </div>
            {/* Right: Analysis Results */}
            <div className="flex-1">
              <AnalysisDisplay
                results={results}
                isConnected={isConnected}
                sessionId={activeSessionId}
              />
            </div>
          </div>
        ) : currentView === 'test' ? (
          <TestPage
            defaultChunkDuration={config.chunkDuration}
            onSessionIdChange={handleUploadSessionChange}
          />
        ) : (
          <AnalysisDisplay
            results={results}
            isConnected={isConnected}
            sessionId={activeSessionId}
          />
        )}
      </MainLayout>
    </>
  )
}

export default App
