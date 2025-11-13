import { useState, useEffect, useRef } from 'react'
import { MenuIcon, NewRecordingIcon } from './icons'
import { useUIStore, useAuthStore } from '../stores'
import { AuthModal } from './auth/AuthModal'
import { WelcomeModal } from './WelcomeModal'
import { LogoutConfirmModal } from './LogoutConfirmModal'
import { authClient } from '../services/authClient'

interface NavbarProps {
  onNewRecording: () => void
}

export function Navbar({ onNewRecording }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { isSidebarOpen, toggleSidebar } = useUIStore()
  const { isAuthenticated, user, accessToken, clearAuth } = useAuthStore()

  useEffect(() => {
    const handleScroll = () => {
      const mainElement = document.querySelector('main')
      if (mainElement) {
        const scrollTop = mainElement.scrollTop
        const newIsScrolled = scrollTop > 50
        setIsScrolled(newIsScrolled)
      }
    }

    const timer = setTimeout(() => {
      const mainElement = document.querySelector('main')
      if (mainElement) {
        handleScroll()
        mainElement.addEventListener('scroll', handleScroll, { passive: true })
      }
    }, 100)

    return () => {
      clearTimeout(timer)
      const mainElement = document.querySelector('main')
      if (mainElement) {
        mainElement.removeEventListener('scroll', handleScroll)
      }
    }
  }, [])

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogoutClick = () => {
    setIsOpen(false)
    setShowLogoutModal(true)
  }

  const handleLogoutConfirm = async () => {
    if (accessToken) {
      try {
        await authClient.logout(accessToken)
      } catch (error) {
        console.error('Logout error:', error)
      }
    }
    clearAuth()
    setShowLogoutModal(false)
    // 设置标记，登出后显示 welcome modal
    localStorage.setItem('showWelcomeAfterLogout', 'true')
    setShowWelcomeModal(true)
  }

  // Show welcome modal on first visit or after logout
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisited')
    const showWelcomeAfterLogout = localStorage.getItem('showWelcomeAfterLogout')

    if (!isAuthenticated) {
      if (showWelcomeAfterLogout === 'true') {
        // 登出后显示
        setShowWelcomeModal(true)
        localStorage.removeItem('showWelcomeAfterLogout')
      } else if (!hasVisited) {
        // 第一次访问显示
        const timer = setTimeout(() => {
          setShowWelcomeModal(true)
          localStorage.setItem('hasVisited', 'true')
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [isAuthenticated])

  return (
    <div className="flex items-center justify-between w-full px-4 py-2 sticky top-0 z-50 bg-white">
      {/* Separator line - with fade effect */}
      <div
        className={`absolute bottom-0 left-0 w-full h-px bg-gray-200 transition-opacity duration-200 ${
          isScrolled ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Left section */}
      <div className="flex items-center pl-2">
        {/* Menu button */}
        <button
          onClick={toggleSidebar}
          className={`w-8 h-8 flex items-center justify-center rounded-xl bg-transparent hover:bg-gray-100 hover:border-gray-100 border-2 border-transparent cursor-e-resize ${
            isSidebarOpen
              ? 'opacity-0 pointer-events-none scale-50'
              : 'opacity-100 scale-100'
          }`}
          style={{
            transform: isSidebarOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)',
            willChange: 'transform, opacity, scale',
          }}
          aria-label="Toggle sidebar"
        >
          <MenuIcon width={18} height={18} className="text-black" />
        </button>

        {/* New Recording button */}
        <button
          className={`w-8 h-8 flex items-center justify-center rounded-xl bg-transparent hover:bg-gray-100 hover:border-gray-100 border-2 border-transparent ml-8 cursor-pointer ${
            isSidebarOpen
              ? 'opacity-0 pointer-events-none scale-50'
              : 'opacity-100 scale-100'
          }`}
          style={{
            transition: 'all 0.4s cubic-bezier(0.4, 0.0, 0.2, 1)',
            willChange: 'opacity, scale',
          }}
          onClick={onNewRecording}
          aria-label="New recording"
        >
          <NewRecordingIcon width={18} height={18} className="text-black" />
        </button>
      </div>

      {/* Middle spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-2">
        {!isAuthenticated ? (
          <>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-gray-800 transition-colors border border-black"
            >
              Log in
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors border border-gray-300 rounded-full hover:bg-gray-50"
            >
              Sign up for free
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Help"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <circle cx="12" cy="17" r="0.5" fill="currentColor" />
              </svg>
            </button>
          </>
        ) : (
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Open profile menu"
              className="group user-select-none ps-2 focus-visible:outline-0"
              type="button"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="group-hover:bg-gray-100 flex h-9 w-9 items-center justify-center rounded-full group-focus-visible:ring-2 transition-colors">
                <div className="flex overflow-hidden rounded-full select-none bg-gradient-to-br from-purple-500 to-pink-500 h-8 w-8 shrink-0 cursor-pointer">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="h-8 w-8 shrink-0 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-8 w-8 flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {user?.username?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>

            {isOpen && (
              <div
                className="fixed z-50"
                style={{
                  left: '0px',
                  top: '0px',
                  transform: 'translate(calc(100vw - 280px - 1rem), 48px)',
                  minWidth: 'max-content',
                }}
              >
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="z-50 max-w-xs rounded-2xl bg-white shadow-xl border border-gray-200 py-1.5 min-w-[280px] max-h-[95vh] overflow-y-auto select-none animate-slideUpAndFade"
                  tabIndex={-1}
                >
                  <div className="flex flex-col">
                    {/* 用户信息 */}
                    <div className="px-1">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 text-gray-500">
                        <div className="flex items-center justify-center w-5 h-5">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <div className="flex min-w-0 grow items-center gap-2.5">
                          <div className="truncate text-sm">{user?.email}</div>
                        </div>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="bg-gray-200 h-px mx-4 my-1"></div>

                    {/* 登出 */}
                    <div className="px-1">
                      <div
                        role="menuitem"
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={handleLogoutClick}
                      >
                        <div className="flex items-center justify-center w-5 h-5 text-gray-700">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                        </div>
                        <span className="text-sm text-gray-700">Log out</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <WelcomeModal
        isOpen={showWelcomeModal}
        isFirstVisit={!localStorage.getItem('showWelcomeAfterLogout')}
        onLogin={() => {
          setShowWelcomeModal(false)
          setShowAuthModal(true)
        }}
        onSignup={() => {
          setShowWelcomeModal(false)
          setShowAuthModal(true)
        }}
        onStayLoggedOut={() => setShowWelcomeModal(false)}
      />
      <LogoutConfirmModal
        isOpen={showLogoutModal}
        userEmail={user?.email || ''}
        onConfirm={handleLogoutConfirm}
        onCancel={() => setShowLogoutModal(false)}
      />
    </div>
  )
}
