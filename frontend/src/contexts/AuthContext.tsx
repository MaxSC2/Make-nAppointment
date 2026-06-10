import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setToken as setClientToken, authLogin, authMe } from '../api/client'
import type { UserOut } from '../types/auth'

const STORAGE_ACCESS = 'mp_access_token'
const STORAGE_REFRESH = 'mp_refresh_token'
const STORAGE_USER = 'mp_user'

interface AuthState {
  user: UserOut | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}
export type { AuthContextValue }

const AuthContext = createContext<AuthContextValue | null>(null)
export { AuthContext }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    const access = localStorage.getItem(STORAGE_ACCESS)
    const refresh = localStorage.getItem(STORAGE_REFRESH)
    const u = localStorage.getItem(STORAGE_USER)

    if (!access) {
      setLoading(false)
      return
    }

    setClientToken(access)
    if (u) {
      try { setUser(JSON.parse(u)) } catch { console.error('Auth: corrupted user in localStorage'); localStorage.removeItem(STORAGE_USER) }
    }

    if (refresh && access) {
      authMe(access).then(fresh => {
        setAccessToken(access)
        setUser(fresh)
        localStorage.setItem(STORAGE_USER, JSON.stringify(fresh))
        setLoading(false)
      }).catch(async () => {
        try {
          const rr = await fetch('/ris/api/auth/refresh', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refresh }),
          })
          if (rr.ok) {
            const pair = await rr.json() as { access_token: string }
            setClientToken(pair.access_token)
            setAccessToken(pair.access_token)
            localStorage.setItem(STORAGE_ACCESS, pair.access_token)
          } else {
            setClientToken(null)
            localStorage.removeItem(STORAGE_ACCESS)
            localStorage.removeItem(STORAGE_REFRESH)
            localStorage.removeItem(STORAGE_USER)
          }
        } catch { /* offline — stay on login */ }
        setLoading(false)
      })
    } else {
      setClientToken(null)
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const pair = await authLogin(username, password)
    setAccessToken(pair.access_token)
    setClientToken(pair.access_token)
    localStorage.setItem(STORAGE_ACCESS, pair.access_token)
    localStorage.setItem(STORAGE_REFRESH, pair.refresh_token)
    const me = await fetch('/ris/api/auth/me', {
      headers: { Authorization: `Bearer ${pair.access_token}` },
    })
    if (me.ok) {
      const u = await me.json() as UserOut
      setUser(u)
      localStorage.setItem(STORAGE_USER, JSON.stringify(u))
    }
  }, [])

  const logout = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setClientToken(null)
    localStorage.removeItem(STORAGE_ACCESS)
    localStorage.removeItem(STORAGE_REFRESH)
    localStorage.removeItem(STORAGE_USER)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!accessToken) return
    try {
      const u = await authMe(accessToken)
      setUser(u)
      localStorage.setItem(STORAGE_USER, JSON.stringify(u))
    } catch { /* token may be expired */ }
  }, [accessToken])

  const value = useMemo<AuthContextValue>(() => ({
    user, accessToken,
    isAuthenticated: !!accessToken,
    isLoading,
    login, logout, refreshUser,
  }), [user, accessToken, isLoading, login, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
