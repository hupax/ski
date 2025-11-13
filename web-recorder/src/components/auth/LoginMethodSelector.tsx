import { Mail } from 'lucide-react'
import { useState } from 'react'

interface LoginMethodSelectorProps {
  onEmailLogin: (email: string) => void
  onGoogleLogin: () => void
  onGithubLogin: () => void
  onWechatLogin: () => void
}

export function LoginMethodSelector({
  onEmailLogin,
  onGoogleLogin,
  onGithubLogin,
  onWechatLogin,
}: LoginMethodSelectorProps) {
  const [email, setEmail] = useState('')

  const handleEmailContinue = async () => {
    if (!email) return

    // 传递邮箱给父组件
    onEmailLogin(email)
  }

  return (
    <div className="space-y-3">
      <div className="text-center px-4">
        <h2 className="text-3xl font-normal text-gray-900 mb-3">Log in or sign up</h2>
        <p className="text-gray-600 text-base mb-8 leading-relaxed">
          You'll get smarter responses and can upload files, images, and more.
        </p>
      </div>

      <div className="space-y-3">
        {/* Google Login */}
        <button
          onClick={onGoogleLogin}
          className="w-full py-3 px-4 bg-white border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 text-base text-gray-900"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* GitHub Login */}
        <button
          onClick={onGithubLogin}
          className="w-full py-3 px-4 bg-white border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 text-base text-gray-900"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>

        {/* WeChat Login */}
        <button
          onClick={onWechatLogin}
          className="w-full py-3 px-4 bg-white border border-gray-300 rounded-full font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-3 text-base text-gray-900"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#09BB07">
            <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-2.186 6.123-2.186v-.66c0-4.054-3.89-7.342-8.691-7.342zm5.785 5.233a.678.678 0 0 1-.678.678H8.472a.678.678 0 0 1 0-1.356h5.326a.678.678 0 0 1 .678.678z" />
            <path d="M24 14.835c0-3.316-3.123-6.01-6.969-6.01-3.847 0-6.971 2.694-6.971 6.01s3.124 6.009 6.971 6.009c.715 0 1.404-.133 2.039-.366a.8.8 0 0 1 .623.094l1.417.83a.289.289 0 0 0 .15.048.267.267 0 0 0 .268-.267.246.246 0 0 0-.043-.19l-.322-1.214a.546.546 0 0 1 .187-.582C22.888 17.837 24 16.388 24 14.835zm-11.507-1.357a.678.678 0 0 1 .678-.678h4.326a.678.678 0 0 1 0 1.356h-4.326a.678.678 0 0 1-.678-.678z" />
          </svg>
          Continue with WeChat
        </button>

      </div>

      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3 bg-white text-gray-500 font-medium">OR</span>
        </div>
      </div>

      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-base placeholder:text-gray-400"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleEmailContinue()
            }
          }}
        />
        <button
          onClick={handleEmailContinue}
          disabled={!email}
          className="w-full py-3 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition-colors disabled:cursor-not-allowed text-base"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
