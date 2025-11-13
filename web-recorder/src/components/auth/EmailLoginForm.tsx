import { useState, useEffect, useRef } from 'react'
import { Mail, ArrowLeft } from 'lucide-react'
import { authClient } from '../../services/authClient'
import { useAuthStore } from '../../stores/authStore'

interface EmailLoginFormProps {
  initialEmail: string
  onSuccess: () => void
  onBack: () => void
}

export function EmailLoginForm({ initialEmail, onSuccess, onBack }: EmailLoginFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const hasSentCode = useRef(false)

  const setAuth = useAuthStore((state) => state.setAuth)

  // Auto-send code when email is provided
  useEffect(() => {
    if (initialEmail && !codeSent && !hasSentCode.current) {
      hasSentCode.current = true
      handleSendCode()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEmail])

  const handleSendCode = async () => {
    if (!email) {
      setError('Please enter your email')
      return
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setError('')
    setLoading(true)

    try {
      await authClient.sendVerificationCode(email)
      setCodeSent(true)
      setCountdown(60)

      // Countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authClient.loginWithCode({ email, code })
      setAuth(response.accessToken, response.refreshToken, response.userInfo)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="text-gray-600 hover:text-gray-800 flex items-center gap-1.5 text-sm font-medium -ml-1"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">
          {codeSent ? 'Enter verification code' : 'Enter your email'}
        </h2>
        <p className="text-gray-600 text-sm mt-2 leading-relaxed">
          {codeSent
            ? `We've sent a 6-digit code to ${email}`
            : "We'll send you a verification code to log in or sign up."}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Verification Code Input */}
        {codeSent ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2.5">
              Verification Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 6) {
                    setCode(value)
                  }
                }}
                placeholder="000000"
                maxLength={6}
                className="flex-1 px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-center text-2xl tracking-widest font-mono"
                required
              />
            </div>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading || countdown > 0}
              className="mt-3 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive? Resend code"}
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3"></div>
            <p className="text-sm">Sending verification code...</p>
          </div>
        )}

        {/* Action Button */}
        {codeSent && (
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3.5 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        )}
      </form>

      <p className="text-xs text-gray-500 text-center leading-relaxed">
        By continuing, you agree to SKI's Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
