import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { setToken as setClientToken } from '../api/client'
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
    if (access) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccessToken(access)
      setClientToken(access)
    }
    if (u) {
      try { setUser(JSON.parse(u)) } catch { localStorage.removeItem(STORAGE_USER) }
    }
    setLoading(false)
    if (refresh && access) {
      // best-effort refresh on mount
      void fetch('/elqueue/api/auth/me', { headers: { Authorization: `Bearer ${access}` } })
        .then(async (r) => {
          if (r.ok) {
            const fresh = await r.json() as UserOut
            setUser(fresh)
            localStorage.setItem(STORAGE_USER, JSON.stringify(fresh))
          } else if (r.status === 401 && refresh) {
            // try refresh
            const rr = await fetch('/elqueue/api/auth/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refresh }),
            })
            if (rr.ok) {
              const pair = await rr.json() as { access_token: string }
              setAccessToken(pair.access_token)
              setClientToken(pair.access_token)
              localStorage.setItem(STORAGE_ACCESS, pair.access_token)
            } else {
              // refresh failed — clear
              localStorage.removeItem(STORAGE_ACCESS)
              localStorage.removeItem(STORAGE_REFRESH)
              localStorage.removeItem(STORAGE_USER)
              setAccessToken(null)
              setUser(null)
            }
          }
        })
        .catch(() => undefined)
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/elqueue/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { detail?: string }).detail || `HTTP ${res.status}`)
    }
    const pair = await res.json() as { access_token: string; refresh_token: string }
    setAccessToken(pair.access_token)
    setClientToken(pair.access_token)
    localStorage.setItem(STORAGE_ACCESS, pair.access_token)
    localStorage.setItem(STORAGE_REFRESH, pair.refresh_token)
    // fetch user profile
    const me = await fetch('/elqueue/api/auth/me', {
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
    const res = await fetch('/elqueue/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) {
      const u = await res.json() as UserOut
      setUser(u)
      localStorage.setItem(STORAGE_USER, JSON.stringify(u))
    }
  }, [accessToken])

  const value = useMemo<AuthContextValue>(() => ({
    user, accessToken,
    isAuthenticated: !!accessToken,
    isLoading,
    login, logout, refreshUser,
  }), [user, accessToken, isLoading, login, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
