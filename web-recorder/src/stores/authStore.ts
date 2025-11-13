import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserInfo } from '../types/auth'

interface AuthState {
  // Authentication state
  isAuthenticated: boolean
  accessToken: string | null
  refreshToken: string | null
  user: UserInfo | null

  // Actions
  setAuth: (accessToken: string, refreshToken: string, user: UserInfo) => void
  clearAuth: () => void
  setUser: (user: UserInfo) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,

      // Set authentication data
      setAuth: (accessToken, refreshToken, user) =>
        set({
          isAuthenticated: true,
          accessToken,
          refreshToken,
          user,
        }),

      // Clear authentication data (logout)
      clearAuth: () =>
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          user: null,
        }),

      // Update user info
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage', // LocalStorage key
      partialize: (state) => ({
        // Only persist these fields
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
)
