const ELQUEUE_BASE = '/elqueue/api'
const RIS_BASE = '/ris/api'
const RIS_V1_BASE = '/api/v1'

let authToken: string | null = null

export function setToken(token: string | null) {
  authToken = token
}

export function getToken() {
  return authToken
}

const REQUEST_TIMEOUT = 15_000

async function request(base: string, path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  const res = await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal }).finally(() => clearTimeout(timer))

  if (res.status === 401) {
    localStorage.removeItem('mp_access_token')
    localStorage.removeItem('mp_refresh_token')
    localStorage.removeItem('mp_user')
    authToken = null
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Сессия истекла. Войдите снова.')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }

  if (res.status === 204) return null
  return res.json()
}

// ---- elqueue ----
export function elqueueGet<T>(path: string) {
  return request(ELQUEUE_BASE, path) as Promise<T>
}

export function elqueuePost<T>(path: string, body?: unknown) {
  return request(ELQUEUE_BASE, path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }) as Promise<T>
}

// ---- ris ----
export function risGet<T>(path: string) {
  return request(RIS_BASE, path) as Promise<T>
}

export function risPost<T>(path: string, body?: unknown) {
  return request(RIS_BASE, path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }) as Promise<T>
}

export function risPatch(path: string, params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return request(RIS_BASE, `${path}${qs}`, { method: 'PATCH' })
}

export function risPatchBody<T>(path: string, body?: unknown) {
  return request(RIS_BASE, path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  }) as Promise<T>
}

export function risPut<T>(path: string, body?: unknown) {
  return request(RIS_BASE, path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  }) as Promise<T>
}

// ---- PACS-фасад (RIS, префикс /api/v1) ----
export function risV1Get<T>(path: string) {
  return request(RIS_V1_BASE, path) as Promise<T>
}

export function risV1Post<T>(path: string, body?: unknown) {
  return request(RIS_V1_BASE, path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }) as Promise<T>
}

export function risV1Delete<T>(path: string) {
  return request(RIS_V1_BASE, path, {
    method: 'DELETE',
  }) as Promise<T>
}

// ---- auth (RIS, без auto-refresh) ----
export function authLogin(username: string, password: string) {
  return request(RIS_BASE, '/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }) as Promise<{ access_token: string; refresh_token: string }>
}

export function authMe(token: string) {
  return fetch(`${RIS_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.ok ? r.json() : Promise.reject(r))
}

export function authRefresh(refreshToken: string) {
  return request(RIS_BASE, '/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  }) as Promise<{ access_token: string }>
}
