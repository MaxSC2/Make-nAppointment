import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'

const navItems = [
  { key: 'nav.queue', path: '/' },
  { key: 'nav.registration', path: '/register' },
  { key: 'nav.doctorCabinet', path: '/doctor' },
  { key: 'nav.studies', path: '/studies' },
  { key: 'nav.orders', path: '/orders' },
  { key: 'nav.patients', path: '/patients' },
  { key: 'nav.monitoring', path: '/monitoring' },
]

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t } = useTranslation()

  const userRole = user?.role_codes?.[0] ?? 'no_role'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white p-4 md:flex md:flex-col">
        <Link to="/" className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          {t('nav.risQueue')}
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            return (
              <Link
                key={item.key}
                to={item.path}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-gray-200 pt-4">
          <div className="mb-3 flex justify-center">
            <LanguageSwitcher />
          </div>
          <div className="mb-2 px-3 text-xs text-gray-400">
            {user?.username ?? t('nav.noRole')} · {userRole}
          </div>
          <button
            onClick={logout}
            title={t('nav.logout')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl"><Outlet /></div>
      </main>
    </div>
  )
}
