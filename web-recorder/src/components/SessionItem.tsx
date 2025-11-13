import { useRef, useEffect } from 'react'
import { MoreOptionsIcon } from './icons'
import { useSessionStore } from '../stores'

interface SessionItemProps {
  session: {
    id: number
    title: string
  }
  isActive: boolean
  isRenaming: boolean
  onSelect: (id: number) => void
  onOptionsClick: (e: React.MouseEvent, id: number) => void
  onRenameComplete: () => void
  buttonRef: (el: HTMLButtonElement | null) => void
}

export function SessionItem({
  session,
  isActive,
  isRenaming,
  onSelect,
  onOptionsClick,
  onRenameComplete,
  buttonRef,
}: SessionItemProps) {
  const { renameSession } = useSessionStore()
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (isRenaming && spanRef.current) {
      spanRef.current.focus()
      // 选中所有文本
      const range = document.createRange()
      range.selectNodeContents(spanRef.current)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [isRenaming])

  const handleBlur = async () => {
    if (spanRef.current) {
      const newTitle = spanRef.current.textContent?.trim() || ''
      if (newTitle && newTitle !== session.title) {
        try {
          await renameSession(session.id, newTitle)
        } catch (error) {
          console.error('Failed to rename:', error)
          spanRef.current.textContent = session.title
        }
      } else {
        spanRef.current.textContent = session.title
      }
    }
    onRenameComplete()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      spanRef.current?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (spanRef.current) {
        spanRef.current.textContent = session.title
      }
      onRenameComplete()
    }
  }

  return (
    <div
      onClick={() => !isRenaming && onSelect(session.id)}
      className={`group w-full flex items-center justify-between px-3 rounded-xl cursor-pointer transition-colors hover:bg-[rgb(239,239,239)] duration-200 ${
        isActive ? 'bg-[rgb(239,239,239)]' : ''
      }`}
      style={{ minHeight: '32px', height: '32px' }}
    >
      <div className="flex min-w-0 grow items-center gap-2" style={{ minHeight: '20px', height: '20px' }}>
        <span
          ref={spanRef}
          contentEditable={isRenaming}
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => isRenaming && e.stopPropagation()}
          className={`block truncate text-sm leading-5 ${
            isActive ? 'text-gray-800' : 'text-gray-700'
          } ${isRenaming ? 'outline-none' : ''}`}
          style={{ minHeight: '20px', height: '20px', lineHeight: '20px' }}
          dir="auto"
        >
          {session.title}
        </span>
      </div>

      {!isRenaming && (
        <div className="text-gray-500 flex items-center self-stretch">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              ref={buttonRef}
              className="w-7 h-7 flex items-center justify-center transition-all duration-150 cursor-pointer"
              onClick={(e) => onOptionsClick(e, session.id)}
              aria-label="Open session options"
            >
              <MoreOptionsIcon
                width={20}
                height={20}
                className="w-5 h-5 text-gray-700"
              />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
