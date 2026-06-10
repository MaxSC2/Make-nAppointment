import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

const navItems = [
  { to: '/', key: 'nav.queue', roles: ['admin', 'registrar', 'doctor', 'technician', 'viewer'] },
  { to: '/register', key: 'nav.registration', roles: ['registrar', 'admin'] },
  { to: '/doctor', key: 'nav.doctorCabinet', roles: ['doctor', 'technician', 'admin'] },
  { to: '/studies', key: 'nav.studies', roles: ['doctor', 'admin', 'viewer'] },
  { to: '/orders', key: 'nav.orders', roles: ['doctor', 'admin', 'viewer'] },
  { to: '/patients', key: 'nav.patients', roles: ['doctor', 'admin', 'registrar', 'viewer'] },
  { to: '/monitoring', key: 'nav.monitoring', roles: ['admin', 'doctor', 'registrar'] },
] as const

function initials(name: string | null | undefined, username: string): string {
  const source = name && name.trim().length > 0 ? name : username
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return username.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  if (!isAuthenticated || !user) return <Outlet />

  const roles = user.role_codes
  const visibleNav = navItems.filter((n) =>
    roles.some((r) => n.roles.includes(r as never)) || user.is_superuser,
  )

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 h-16 flex items-center gap-1 overflow-x-auto">
          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center text-sm font-bold shrink-0">
              M
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-sm sm:text-base font-bold text-slate-900">MedPlatform</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">RIS + Эл. очередь</div>
            </div>
          </div>

          <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto">
            {visibleNav.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => {
                  const isPatientsSection = to === '/patients' && window.location.pathname.startsWith('/patients')
                  const active = isActive || isPatientsSection
                  return `px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                    active
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }}
              >
                {t(key)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto shrink-0 flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher />
            <div className="text-right leading-tight hidden sm:block">
              <div className="text-sm font-medium text-slate-900">{user.full_name || user.username}</div>
              <div className="text-xs text-slate-500">
                {roles.length > 0 ? roles.join(', ') : t('nav.noRole')}
              </div>
            </div>
            <div
              className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold"
              title={user.username}
            >
              {initials(user.full_name, user.username)}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 hover:text-slate-900 px-2 py-1 rounded transition"
              title={t('nav.logout')}
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-400">
        MedPlatform RIS · MVP · {new Date().getFullYear()}
      </footer>
    </div>
  )
}
