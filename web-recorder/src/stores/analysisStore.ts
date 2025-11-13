// Analysis Store - Manages analysis results and WebSocket connection
import { create } from 'zustand'
import type { AnalysisResult } from '../types'

interface AnalysisState {
  // WebSocket connection
  isConnected: boolean
  setIsConnected: (connected: boolean) => void

  // Analysis results for current session
  results: AnalysisResult[]
  addResult: (result: AnalysisResult) => void
  updateResult: (windowIndex: number, content: string) => void
  clearResults: () => void

  // Loading state
  isAnalyzing: boolean
  setIsAnalyzing: (analyzing: boolean) => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  // WebSocket
  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),

  // Results
  results: [],

  addResult: (result) => set((state) => {
    console.log('[AnalysisStore] Adding result:', result);
    // Check if result already exists for this window
    const existingIndex = state.results.findIndex(
      (r) => r.windowIndex === result.windowIndex
    )

    if (existingIndex >= 0) {
      // APPEND content to existing result (streaming)
      const newResults = [...state.results]
      newResults[existingIndex] = {
        ...newResults[existingIndex],
        content: newResults[existingIndex].content + result.content,
        timestamp: result.timestamp
      }
      console.log('[AnalysisStore] Appended to existing result, total chars:', newResults[existingIndex].content.length);
      return { results: newResults }
    } else {
      // Add new result
      const newResults = [...state.results, result];
      console.log('[AnalysisStore] Added new result, total:', newResults.length);
      return { results: newResults }
    }
  }),

  updateResult: (windowIndex, content) => set((state) => ({
    results: state.results.map((result) =>
      result.windowIndex === windowIndex
        ? { ...result, content }
        : result
    )
  })),

  clearResults: () => set({ results: [] }),

  // Analysis state
  isAnalyzing: false,
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
}))
