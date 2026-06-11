import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const switchLocale = (next: string) => {
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`
  }

  const current = i18n.language?.slice(0, 2)

  const btn = (code: string, label: string) => (
    <button
      onClick={() => switchLocale(code)}
      disabled={current === code}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
        current === code
          ? 'bg-gray-200 dark:bg-slate-600 text-gray-900 dark:text-slate-100'
          : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
      } disabled:opacity-100`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-1">
      {btn('ru', 'RU')}
      <span className="text-gray-300 dark:text-slate-600 text-xs">|</span>
      {btn('en', 'EN')}
      <span className="text-gray-300 dark:text-slate-600 text-xs">|</span>
      {btn('kk', 'ҚАЗ')}
    </div>
  )
}
