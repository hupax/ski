export interface UserInfo {
  id: number
  email: string
  username: string
  avatarUrl?: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  userInfo: UserInfo
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
}

export interface CodeLoginRequest {
  email: string
  code: string
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  timestamp: string
}
