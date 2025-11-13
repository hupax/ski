// Session Store - Manages recording sessions and history
import { create } from 'zustand'
import type { SessionStatusResponse } from '../types'
import { fetchWithAuth } from '../services/authInterceptor'
import { API_BASE_URL } from '../config/constants'

interface Session {
  id: number
  title: string  // AI-generated title or "Untitled Session"
  status: string
  aiModel: string
  analysisMode: string
  startTime: string
  endTime?: string
  updatedAt: string
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
  renameSession: (id: number, newTitle: string) => Promise<void>
  deleteSessionById: (id: number) => Promise<void>
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
      const response = await fetchWithAuth(`${API_BASE_URL}/api/videos/sessions`)

      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }

      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      setError('Failed to load sessions')
      setSessions([])  // Clear sessions on error
    } finally {
      setIsLoading(false)
    }
  },

  selectSession: (id) => {
    set({ currentSessionId: id })
  },

  renameSession: async (id, newTitle) => {
    const { updateSession, setError } = get()
    setError(null)

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/videos/sessions/${id}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle }),
      })

      if (!response.ok) {
        throw new Error('Failed to rename session')
      }

      updateSession(id, { title: newTitle })
    } catch (error) {
      console.error('Failed to rename session:', error)
      setError('Failed to rename session')
      throw error
    }
  },

  deleteSessionById: async (id) => {
    const { deleteSession, setError } = get()
    setError(null)

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/videos/sessions/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete session')
      }

      deleteSession(id)
    } catch (error) {
      console.error('Failed to delete session:', error)
      setError('Failed to delete session')
      throw error
    }
  },
}))
