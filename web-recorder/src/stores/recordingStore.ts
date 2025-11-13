// Recording Store - Manages recording state
import { create } from 'zustand'
import { RecordingState } from '../types'

interface RecordingStoreState {
  // Recording state
  state: RecordingState
  setState: (state: RecordingState) => void

  // Media stream
  stream: MediaStream | null
  setStream: (stream: MediaStream | null) => void

  // Session info
  sessionId: number | null
  setSessionId: (id: number | null) => void

  // Chunk tracking
  chunkIndex: number
  setChunkIndex: (index: number) => void
  incrementChunkIndex: () => void

  // Error
  error: string | null
  setError: (error: string | null) => void

  // Actions
  reset: () => void
}

export const useRecordingStore = create<RecordingStoreState>((set) => ({
  // Initial state
  state: RecordingState.IDLE,
  stream: null,
  sessionId: null,
  chunkIndex: 0,
  error: null,

  // Setters
  setState: (newState) => set({ state: newState }),
  setStream: (stream) => set({ stream }),
  setSessionId: (id) => set({ sessionId: id }),
  setChunkIndex: (index) => set({ chunkIndex: index }),
  incrementChunkIndex: () => set((state) => ({ chunkIndex: state.chunkIndex + 1 })),
  setError: (error) => set({ error }),

  // Actions
  reset: () => set({
    state: RecordingState.IDLE,
    stream: null,
    sessionId: null,
    chunkIndex: 0,
    error: null,
  }),
}))
