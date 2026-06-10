import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ru from './locales/ru.json'
import kk from './locales/kk.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      kk: { translation: kk },
    },
    fallbackLng: 'ru',
    detection: {
      order: ['localStorage', 'cookie'],
      caches: ['localStorage', 'cookie'],
      lookupCookie: 'NEXT_LOCALE',
      lookupLocalStorage: 'lang',
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
