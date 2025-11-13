import type {
  AuthResponse,
  CodeLoginRequest,
  ApiResponse,
  UserInfo,
} from '../types/auth'

const AUTH_BASE_URL = 'http://localhost:8081/api'

class AuthClient {

  /**
   * Send verification code to email
   */
  async sendVerificationCode(email: string): Promise<void> {
    const response = await fetch(`${AUTH_BASE_URL}/auth/code/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    const result: ApiResponse<string> = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || 'Failed to send verification code')
    }
  }

  /**
   * Login with verification code
   */
  async loginWithCode(request: CodeLoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${AUTH_BASE_URL}/auth/login/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    const result: ApiResponse<AuthResponse> = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || 'Login with code failed')
    }

    return result.data
  }

  /**
   * Logout
   */
  async logout(token: string): Promise<void> {
    const response = await fetch(`${AUTH_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result: ApiResponse<string> = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || 'Logout failed')
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser(token: string): Promise<UserInfo> {
    const response = await fetch(`${AUTH_BASE_URL}/user/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result: ApiResponse<UserInfo> = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || 'Failed to get user info')
    }

    return result.data
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await fetch(`${AUTH_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    })

    const result: ApiResponse<AuthResponse> = await response.json()

    if (result.code !== 200) {
      throw new Error(result.message || 'Token refresh failed')
    }

    return result.data
  }
}

export const authClient = new AuthClient()
