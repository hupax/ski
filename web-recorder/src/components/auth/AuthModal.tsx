import { useState } from 'react'
import { X } from 'lucide-react'
import { LoginMethodSelector } from './LoginMethodSelector'
import { EmailLoginForm } from './EmailLoginForm'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

type ViewType = 'welcome' | 'selector' | 'email-login'

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [view, setView] = useState<ViewType>('selector')
  const [initialEmail, setInitialEmail] = useState<string>('')

  if (!isOpen) return null

  const handleBack = () => {
    if (view === 'email-login') {
      setView('selector')
      setInitialEmail('')
    }
  }

  const handleEmailLogin = (email: string) => {
    setInitialEmail(email)
    setView('email-login')
  }

  return (
    <div className="fixed inset-0 backdrop-blur-[0.5px] flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-250 w-full max-w-[388px] mx-4 relative overflow-hidden" style={{ borderColor: 'rgb(229, 229, 229)' }}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="px-7 py-10">
          {view === 'selector' && (
            <LoginMethodSelector
              onEmailLogin={handleEmailLogin}
              onGoogleLogin={() => {
                window.location.href =
                  'http://localhost:8081/api/auth/oauth/google'
              }}
              onGithubLogin={() => {
                window.location.href =
                  'http://localhost:8081/api/auth/oauth/github'
              }}
              onWechatLogin={() => {
                window.location.href =
                  'http://localhost:8081/api/auth/oauth/wechat'
              }}
            />
          )}

          {view === 'email-login' && (
            <EmailLoginForm
              initialEmail={initialEmail}
              onSuccess={onClose}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  )
}
