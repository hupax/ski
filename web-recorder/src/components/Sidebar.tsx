import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '../stores'
import { SidebarHeader } from './SidebarHeader'
import { SessionItem } from './SessionItem'
import SessionOptionsMenu from './SessionOptionsMenu'

interface SidebarProps {
  onSessionSelect: (sessionId: number) => void
  onClose: () => void
  onNewRecording: () => void
  onTest: () => void
}

export function Sidebar({ onSessionSelect, onClose, onNewRecording, onTest }: SidebarProps) {
  const { sessions, currentSessionId } = useSessionStore()
  const [showSeparator, setShowSeparator] = useState(false)
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<number | null>(null)
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null)
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

  const handleOptionsClick = (e: React.MouseEvent, sessionId: number) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveMenuSessionId(activeMenuSessionId === sessionId ? null : sessionId)
  }

  const handleMenuClose = () => {
    setActiveMenuSessionId(null)
  }

  const handleStartRename = (sessionId: number) => {
    setRenamingSessionId(sessionId)
    setActiveMenuSessionId(null)
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
              <SessionItem
                key={session.id}
                session={session}
                isActive={currentSessionId === session.id}
                isRenaming={renamingSessionId === session.id}
                onSelect={handleSessionClick}
                onOptionsClick={handleOptionsClick}
                onRenameComplete={() => setRenamingSessionId(null)}
                buttonRef={(el) => (buttonRefs.current[session.id] = el)}
              />
            ))
          )}
        </div>
      </div>

      {/* Session options menu */}
      {activeMenuSessionId && (
        <SessionOptionsMenu
          sessionId={activeMenuSessionId}
          sessionTitle={sessions.find(s => s.id === activeMenuSessionId)?.title || ''}
          isOpen={true}
          onClose={handleMenuClose}
          onRename={handleStartRename}
          buttonRef={{ current: buttonRefs.current[activeMenuSessionId] || null }}
        />
      )}
    </div>
  )
}
