import { type ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { useUIStore, useSessionStore } from '../stores'

interface MainLayoutProps {
  children: ReactNode
  onNewRecording: () => void
  onTest: () => void
}

export function MainLayout({ children, onNewRecording, onTest }: MainLayoutProps) {
  const { isSidebarOpen, setSidebarOpen, toggleSidebar } = useUIStore()
  const { setCurrentSessionId } = useSessionStore()

  const handleSessionSelect = (sessionId: number) => {
    setCurrentSessionId(sessionId)
    // TODO: Load session analysis results
  }

  return (
    <div className="h-screen bg-white flex">
      {/* Sidebar container - push/pull animation */}
      <div
        style={{
          width: isSidebarOpen ? '260px' : '0px',
          transition: 'width 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)',
          willChange: 'width',
        }}
        className="overflow-hidden"
      >
        <div className="w-[260px] h-full overflow-y-auto">
          <Sidebar
            onSessionSelect={handleSessionSelect}
            onClose={toggleSidebar}
            onNewRecording={onNewRecording}
            onTest={onTest}
          />
        </div>
      </div>

      {/* Main content - gets pushed */}
      <div className="h-screen flex flex-col flex-1 overflow-hidden">
        <Navbar onNewRecording={onNewRecording} />
        <main className="flex-1 overflow-y-auto main-scrollbar">
          {children}
        </main>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
