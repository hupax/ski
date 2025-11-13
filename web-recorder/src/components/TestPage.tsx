import { useState, useCallback } from 'react'
import { TestUploader } from './TestUploader'
import { AnalysisDisplay } from './AnalysisDisplay'
import { AIModel, AnalysisMode, StorageType, TestUploadState } from '../types'
import type { RecordingConfig } from '../types'
import { useAnalysisStore } from '../stores'

interface TestPageProps {
  defaultChunkDuration: number
  onSessionIdChange?: (sessionId: number | null) => void
}

export function TestPage({ defaultChunkDuration, onSessionIdChange }: TestPageProps) {
  const { results, isConnected } = useAnalysisStore()

  // Test config state (separate from production config)
  const [testConfig, setTestConfig] = useState<RecordingConfig>({
    aiModel: AIModel.QWEN,
    analysisMode: AnalysisMode.SLIDING_WINDOW,
    keepVideo: true,
    storageType: StorageType.COS,
  })

  const [chunkDuration, setChunkDuration] = useState(defaultChunkDuration)
  const [isConfigVisible, setIsConfigVisible] = useState(true)
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)

  // Listen for test start to hide config
  const handleTestStateChange = useCallback((state: TestUploadState) => {
    // Hide config when test starts (not IDLE)
    if (state !== TestUploadState.IDLE) {
      setIsConfigVisible(false)
    } else {
      // Show config again when test is reset
      setIsConfigVisible(true)
    }
  }, [])

  // Handle session ID change from uploader
  const handleSessionChange = useCallback((sessionId: number | null) => {
    setActiveSessionId(sessionId)
    if (onSessionIdChange) {
      onSessionIdChange(sessionId)
    }
  }, [onSessionIdChange])

  // Show config panel before test starts
  if (isConfigVisible) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="w-full max-w-2xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Test Configuration</h2>

          <div className="space-y-6">
            {/* AI Model */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Model
              </label>
              <select
                value={testConfig.aiModel}
                onChange={(e) => setTestConfig({ ...testConfig, aiModel: e.target.value as AIModel })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={AIModel.QWEN}>Qwen VL Max</option>
                <option value={AIModel.GEMINI}>Gemini Pro Vision</option>
              </select>
            </div>

            {/* Analysis Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Mode
              </label>
              <select
                value={testConfig.analysisMode}
                onChange={(e) => setTestConfig({ ...testConfig, analysisMode: e.target.value as AnalysisMode })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={AnalysisMode.SLIDING_WINDOW}>Sliding Window</option>
                <option value={AnalysisMode.FULL}>Full Analysis</option>
              </select>
            </div>

            {/* Storage Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Storage Type
              </label>
              <select
                value={testConfig.storageType}
                onChange={(e) => setTestConfig({ ...testConfig, storageType: e.target.value as StorageType })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={StorageType.COS}>Tencent COS</option>
                <option value={StorageType.OSS}>Aliyun OSS</option>
                <option value={StorageType.MINIO}>MinIO (Local)</option>
              </select>
            </div>

            {/* Keep Video */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keep Video
              </label>
              <select
                value={testConfig.keepVideo ? 'true' : 'false'}
                onChange={(e) => setTestConfig({ ...testConfig, keepVideo: e.target.value === 'true' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            {/* Chunk Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chunk Duration (seconds)
              </label>
              <input
                type="number"
                value={chunkDuration}
                onChange={(e) => setChunkDuration(parseInt(e.target.value) || defaultChunkDuration)}
                min="10"
                max="60"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* File Upload - Hidden component that handles upload logic */}
            <TestUploader
              config={testConfig}
              chunkDuration={chunkDuration}
              onSessionIdChange={handleSessionChange}
              onStateChange={handleTestStateChange}
            />
          </div>

          <div className="mt-6 text-sm text-gray-500">
            ⚠️ Test mode only - Production uses default config (Qwen, COS, keepVideo=true)
          </div>
        </div>
      </div>
    )
  }

  // After test starts, show full-screen analysis results (like New Recording)
  return (
    <AnalysisDisplay
      results={results}
      isConnected={isConnected}
      sessionId={activeSessionId}
    />
  )
}
