import { useAuthStore } from '../stores/authStore'
import { authClient } from './authClient'

/**
 * Create a fetch wrapper with token refresh logic
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState()

  // Add authorization header if token exists
  if (accessToken) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    }
  }

  // Make the request
  let response = await fetch(url, options)

  // If 401 Unauthorized, try to refresh token
  if (response.status === 401 && refreshToken) {
    try {
      console.log('[Auth] Token expired, refreshing...')

      // Refresh the token
      const authResponse = await authClient.refreshToken(refreshToken)

      // Update stored tokens
      setAuth(authResponse.accessToken, authResponse.refreshToken, authResponse.userInfo)

      console.log('[Auth] Token refreshed successfully')

      // Retry the original request with new token
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${authResponse.accessToken}`,
      }
      response = await fetch(url, options)
    } catch (error) {
      console.error('[Auth] Token refresh failed:', error)

      // Clear auth state and redirect to login
      clearAuth()

      // You might want to trigger a login modal here
      // For now, just throw the error
      throw new Error('Authentication failed. Please log in again.')
    }
  }

  return response
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const exp = payload.exp * 1000 // Convert to milliseconds
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    return exp - now < fiveMinutes
  } catch {
    return true
  }
}

/**
 * Proactively refresh token if it's about to expire
 */
export async function refreshTokenIfNeeded(): Promise<void> {
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState()

  if (!accessToken || !refreshToken) {
    return
  }

  if (isTokenExpired(accessToken)) {
    try {
      console.log('[Auth] Proactively refreshing token...')
      const authResponse = await authClient.refreshToken(refreshToken)
      setAuth(authResponse.accessToken, authResponse.refreshToken, authResponse.userInfo)
      console.log('[Auth] Token refreshed proactively')
    } catch (error) {
      console.error('[Auth] Proactive token refresh failed:', error)
      clearAuth()
    }
  }
}
