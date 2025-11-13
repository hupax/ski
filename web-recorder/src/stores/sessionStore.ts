// Session Store - Manages recording sessions and history
import { create } from 'zustand'
import type { SessionStatusResponse } from '../types'

interface Session {
  id: number
  userId: number
  status: string
  aiModel: string
  analysisMode: string
  keepVideo: boolean
  startTime: string
  endTime?: string
  totalChunks: number
  analyzedChunks: number
}

interface SessionState {
  // Sessions list
  sessions: Session[]
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: number, updates: Partial<Session>) => void
  deleteSession: (id: number) => void

  // Current session
  currentSessionId: number | null
  setCurrentSessionId: (id: number | null) => void

  // Loading state
  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  // Error state
  error: string | null
  setError: (error: string | null) => void

  // Actions
  fetchSessions: () => Promise<void>
  selectSession: (id: number) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // State
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,

  // Setters
  setSessions: (sessions) => set({ sessions }),

  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions]
  })),

  updateSession: (id, updates) => set((state) => ({
    sessions: state.sessions.map((session) =>
      session.id === id ? { ...session, ...updates } : session
    )
  })),

  deleteSession: (id) => set((state) => ({
    sessions: state.sessions.filter((session) => session.id !== id),
    currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
  })),

  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Actions
  fetchSessions: async () => {
    const { setIsLoading, setError, setSessions } = get()
    setIsLoading(true)
    setError(null)

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/sessions')
      // const data = await response.json()
      // setSessions(data)

      // Mock data for now
      setSessions([])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      setError('Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  },

  selectSession: (id) => {
    set({ currentSessionId: id })
  },
}))
