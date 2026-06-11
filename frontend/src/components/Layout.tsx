import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../contexts/ThemeContext'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'
import Sidebar from './Sidebar'

const icon = (d: string) => (
  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const navItems = [
  { to: '/', key: 'nav.queue', icon: icon('M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5'), roles: ['admin', 'registrar', 'doctor', 'technician', 'viewer'] },
  { to: '/register', key: 'nav.registration', icon: icon('M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75'), roles: ['registrar', 'admin'] },
  { to: '/doctor', key: 'nav.doctorCabinet', icon: icon('M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'), roles: ['doctor', 'technician', 'admin'] },
  { to: '/studies', key: 'nav.studies', icon: icon('M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z'), roles: ['doctor', 'admin', 'viewer'] },
  { to: '/orders', key: 'nav.orders', icon: icon('M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z'), roles: ['doctor', 'admin', 'viewer'] },
  { to: '/patients', key: 'nav.patients', icon: icon('M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z'), roles: ['doctor', 'admin', 'registrar', 'viewer'] },
  { to: '/monitoring', key: 'nav.monitoring', icon: icon('M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'), roles: ['admin', 'doctor', 'registrar'] },
]

function initials(name: string | null | undefined, username: string): string {
  const source = name && name.trim().length > 0 ? name : username
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return username.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Layout() {
  const { user, logout, isAuthenticated } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(false)

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
    <div className={`h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden ${sidebarPinned ? 'lg:ml-60' : ''}`}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isPinned={sidebarPinned}
        onTogglePin={() => {
          if (window.innerWidth >= 1024) {
            if (sidebarPinned) { setSidebarPinned(false); setSidebarOpen(false) }
            else { setSidebarPinned(true); setSidebarOpen(true) }
          } else {
            setSidebarPinned((p) => !p)
          }
        }}
        items={visibleNav}
      />

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="px-2 sm:px-4 md:px-6 h-16 flex items-center gap-1">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className={`p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition ${sidebarPinned ? 'lg:hidden' : ''}`}
            title={t('nav.menu')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center text-sm font-bold shrink-0">
              M
            </div>
            <div className="leading-tight hidden lg:block">
              <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">MedPlatform</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">RIS + Эл. очередь</div>
            </div>
          </div>

          <div className="flex-1" />

          <div className="shrink-0 flex items-center gap-1 sm:gap-2">
            <button
              onClick={toggle}
              className="p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
            <LanguageSwitcher />
            <div className="text-right leading-tight hidden md:block">
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{user.full_name || user.username}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {roles.length > 0 ? roles.join(', ') : t('nav.noRole')}
              </div>
            </div>
            <div
              className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-800 text-brand-700 dark:text-brand-200 grid place-items-center text-sm font-semibold"
              title={user.username}
            >
              {initials(user.full_name, user.username)}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 rounded transition"
              title={t('nav.logout')}
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main
        onClick={() => { if (!sidebarPinned && sidebarOpen && window.innerWidth >= 1024) setSidebarOpen(false) }}
        className="flex-1 min-h-0 px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 overflow-y-auto"
      >
        <Outlet />
        <footer className="pt-8 pb-2 text-center text-xs text-slate-400 dark:text-slate-600">
          MedPlatform RIS · MVP · {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  )
}
