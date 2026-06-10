import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const switchLocale = (next: string) => {
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`
  }

  const current = i18n.language

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => switchLocale('ru')}
        disabled={current === 'ru'}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          current === 'ru'
            ? 'bg-gray-200 text-gray-900'
            : 'text-gray-500 hover:text-gray-900'
        } disabled:opacity-100`}
      >
        RU
      </button>
      <span className="text-gray-300 text-xs">|</span>
      <button
        onClick={() => switchLocale('kk')}
        disabled={current === 'kk'}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
          current === 'kk'
            ? 'bg-gray-200 text-gray-900'
            : 'text-gray-500 hover:text-gray-900'
        } disabled:opacity-100`}
      >
        ҚАЗ
      </button>
    </div>
  )
}
