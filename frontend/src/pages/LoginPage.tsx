import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, isLoading } = useAuth()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-slate-400 text-sm">Загрузка...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username, password)
      const from = (location.state as { from?: string } | null)?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8 gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center text-lg font-bold shadow-sm">
            M
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900 leading-tight">MedPlatform</div>
            <div className="text-xs text-slate-500 leading-tight">RIS + Электронная очередь</div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 space-y-5"
        >
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Вход в систему</h1>
            <p className="text-sm text-slate-500 mt-1">Введите учётные данные для продолжения</p>
          </div>

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
              Имя пользователя
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
              placeholder="admin"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2.5 flex items-start gap-2">
              <span className="font-semibold">!</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            {submitting ? 'Вход...' : 'Войти'}
          </button>

          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="font-medium text-slate-600 mb-1">Тестовые учётки:</div>
            <div className="grid grid-cols-2 gap-1 font-mono">
              <span>admin / admin123</span>
              <span>registrar / ...</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
