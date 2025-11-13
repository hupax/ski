// Config Store - Manages user configuration with defaults
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AIModel, AnalysisMode, StorageType } from '../types'
import type { RecordingConfig } from '../types'

interface ConfigState extends RecordingConfig {
  // Only keep essential setters for dynamic config
  setAnalysisMode: (mode: AnalysisMode) => void

  // Chunk duration from server
  chunkDuration: number
  setChunkDuration: (duration: number) => void
}

const defaultConfig: RecordingConfig = {
  aiModel: AIModel.QWEN,
  analysisMode: AnalysisMode.SLIDING_WINDOW,
  keepVideo: true,
  storageType: StorageType.COS,
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      // Initial config with defaults (QWEN, COS, keepVideo=true)
      ...defaultConfig,
      chunkDuration: 35, // Default, will be updated from server

      // Only analysis mode can be changed dynamically (based on recording mode selection)
      setAnalysisMode: (analysisMode) => set({ analysisMode }),
      setChunkDuration: (chunkDuration) => set({ chunkDuration }),
    }),
    {
      name: 'ski-config-storage',
    }
  )
)
