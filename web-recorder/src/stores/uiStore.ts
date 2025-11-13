// UI State Store - Manages sidebar and view states
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Sidebar state
  isSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Current view
  currentView: 'analysis' | 'recording-mode-selection' | 'test' | 'upload' | 'recording'
  setCurrentView: (view: 'analysis' | 'recording-mode-selection' | 'test' | 'upload' | 'recording') => void

  // Scroll detection
  isScrolled: boolean
  setIsScrolled: (scrolled: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      isSidebarOpen: true,
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

      // View
      currentView: 'analysis',
      setCurrentView: (view) => set({ currentView: view }),

      // Scroll
      isScrolled: false,
      setIsScrolled: (scrolled) => set({ isScrolled: scrolled }),
    }),
    {
      name: 'ski-ui-storage',
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
      }),
    }
  )
)
