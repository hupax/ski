import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../stores'
import { TrashIcon, VideoIcon } from './icons'
import { SidebarHeader } from './SidebarHeader'

interface SidebarProps {
  onSessionSelect: (sessionId: number) => void
  onClose: () => void
  onNewRecording: () => void
  onTest: () => void
}

export function Sidebar({ onSessionSelect, onClose, onNewRecording, onTest }: SidebarProps) {
  const { sessions, currentSessionId, deleteSession } = useSessionStore()
  const [showSeparator, setShowSeparator] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const buttonRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({})

  // Auto-scroll to current session
  useEffect(() => {
    if (currentSessionId && buttonRefs.current[currentSessionId] && scrollContainerRef.current) {
      const currentElement = buttonRefs.current[currentSessionId]
      const scrollContainer = scrollContainerRef.current

      const containerRect = scrollContainer.getBoundingClientRect()
      const elementRect = currentElement.getBoundingClientRect()

      const isVisible =
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom

      if (!isVisible) {
        const scrollTop = scrollContainer.scrollTop
        const relativeTop = elementRect.top - containerRect.top
        const targetScrollTop =
          scrollTop + relativeTop - containerRect.height / 2 + elementRect.height / 2

        scrollContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        })
      }
    }
  }, [currentSessionId, sessions.length])

  // Monitor scroll for separator
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop
        setShowSeparator(scrollTop > 15)
      }
    }

    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll)
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleSessionClick = (sessionId: number) => {
    onSessionSelect(sessionId)
  }

  const handleDeleteClick = (e: React.MouseEvent, sessionId: number) => {
    e.stopPropagation()
    if (confirm('Delete this session?')) {
      deleteSession(sessionId)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full bg-[rgb(249,249,249)] border-r border-gray-200 flex flex-col overflow-y-auto openai-scrollbar"
      style={{
        borderRightWidth: '1px',
        borderRightColor: 'rgb(237, 237, 237)',
        boxShadow: 'none',
      }}
    >
      <SidebarHeader
        onClose={onClose}
        showSeparator={showSeparator}
        onNewRecording={onNewRecording}
        onTest={onTest}
      />

      <div className="px-4 py-4">
        <h3 className="px-3 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          History
        </h3>

        <div className="space-y-px">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-500">
              No recordings yet
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                ref={(el) => (buttonRefs.current[session.id] = el)}
                onClick={() => handleSessionClick(session.id)}
                className={`group w-full flex items-start justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                  currentSessionId === session.id
                    ? 'bg-[rgb(239,239,239)]'
                    : 'hover:bg-[rgb(239,239,239)]'
                }`}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <div className="flex-shrink-0 mt-0.5">
                    <VideoIcon width={16} height={16} className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {formatDate(session.startTime)}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {session.aiModel} • {session.analysisMode}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {session.totalChunks} chunks
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDeleteClick(e, session.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
                    aria-label="Delete session"
                  >
                    <TrashIcon width={14} height={14} className="text-gray-600" />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
