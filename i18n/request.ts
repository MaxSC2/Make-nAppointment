import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

const locales = new Set(['ru', 'en', 'kk'])

function parseAcceptLanguage(header: string | null): string | null {
  if (!header) return null
  const tags = header.split(',').map(t => {
    const [tag] = t.trim().split(';')
    return tag?.split('-')[0] || ''
  })
  return tags.find(t => locales.has(t)) || null
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headersList = await headers()

  const locale =
    cookieStore.get('NEXT_LOCALE')?.value ||
    parseAcceptLanguage(headersList.get('Accept-Language')) ||
    'ru'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
