export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginRequest {
  username: string
  password: string
}

export interface UserOut {
  id: string
  username: string
  email: string | null
  full_name: string
  is_active: boolean
  is_superuser: boolean
  last_login_at: string | null
  created_at: string
  role_codes: string[]
}

export interface RoleOut {
  code: string
  name: string
  description: string | null
}
