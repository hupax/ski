import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function OAuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setAuth = useAuthStore((state) => state.setAuth)

  useEffect(() => {
    const accessToken = searchParams.get('access_token')
    const refreshToken = searchParams.get('refresh_token')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      alert(`Authentication failed: ${error}`)
      navigate('/')
      return
    }

    if (accessToken && refreshToken) {
      // Fetch user info from access token
      // For now, we'll decode the JWT to get user info
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]))
        const userInfo = {
          id: payload.userId,
          email: payload.email,
          username: payload.username,
          avatarUrl: null, // Will be fetched from /user/me if needed
        }

        setAuth(accessToken, refreshToken, userInfo)
        navigate('/')
      } catch (e) {
        console.error('Failed to parse token:', e)
        alert('Authentication failed')
        navigate('/')
      }
    } else {
      console.error('No tokens received')
      alert('Authentication failed: No tokens received')
      navigate('/')
    }
  }, [searchParams, navigate, setAuth])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  )
}
