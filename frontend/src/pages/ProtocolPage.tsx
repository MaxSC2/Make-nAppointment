import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getOrder, getProtocol, signProtocol, upsertProtocol } from '../api/ris'
import type { OrderOut, ProtocolOut } from '../types/ris'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'
import { ViewerIcon } from '../components/Icons'
import { useTranslation } from 'react-i18next'

const TEMPLATES: Record<string, string> = {
  CT: `ПРОТОКОЛ КТ-исследования

Органы: грудная клетка / брюшная полость / головной мозг
Контрастирование: [да/нет]

Описание:
На серии компьютерных томограмм органов [указать] в стандартных проекциях с толщиной среза [X] мм...

Заключение:
Патологических изменений не выявлено.
Рекомендовано: ...`,
  MR: `ПРОТОКОЛ МРТ-исследования

Режимы: T1, T2, FLAIR, DWI
Контрастирование: [да/нет]

Описание:
...

Заключение:
...`,
  DX: `ПРОТОКОЛ рентгенографии

Укладка: стандартная
Проекция: прямая / боковая

Описание:
...

Заключение:
...`,
  US: `ПРОТОКОЛ УЗИ

Датчик: [конвексный/линейный]
Режим: B-mode / допплер

Описание:
...

Заключение:
...`,
}

export default function ProtocolPage() {
  const { t } = useTranslation()
  const { orderId = '' } = useParams<{ orderId: string }>()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderOut | null>(null)
  const [protocol, setProtocol] = useState<ProtocolOut | null>(null)
  const [body, setBody] = useState('')
  const [impression, setImpression] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef({ body: '', impression: '' })

  const canEdit = user?.is_superuser || user?.role_codes.some((r) => ['doctor', 'admin'].includes(r))
  const canSign = canEdit && !protocol?.signed_at

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [o, p] = await Promise.all([
          getOrder(orderId),
          getProtocol(orderId).catch(() => null),
        ])
        if (cancelled) return
        setOrder(o)
        if (p) {
          setProtocol(p)
          setBody(p.body)
          setImpression(p.impression ?? '')
          lastSavedRef.current = { body: p.body, impression: p.impression ?? '' }
        } else {
          const tmpl = TEMPLATES[o.modality] ?? ''
          setBody(tmpl)
          lastSavedRef.current = { body: tmpl, impression: '' }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('protocol.error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId, t])

  const doSave = useCallback(async (b: string, imp: string) => {
    try {
      const p = await upsertProtocol(orderId, { body: b, impression: imp })
      setProtocol(p)
      lastSavedRef.current = { body: b, impression: imp }
      setSavedAt(new Date().toLocaleTimeString('ru-RU'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('protocol.errorSave'))
    }
  }, [orderId, t])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    await doSave(body, impression)
    setSaving(false)
  }

  const autoSave = useCallback((b: string, imp: string) => {
    if (b === lastSavedRef.current.body && imp === lastSavedRef.current.impression) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => doSave(b, imp), 3000)
  }, [doSave])

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (canEdit && !protocol?.signed_at && (body || impression)) {
          void doSave(body, impression)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canEdit, protocol, body, impression, doSave])

  // Cleanup auto-save timer
  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      // Final save on unmount
      if (canEdit && !protocol?.signed_at) {
        void doSave(body, impression)
      }
    }
  }, [])  // eslint-disable-line

  const handleSign = async () => {
    if (!confirm(t('protocol.confirmSign'))) return
    setSigning(true)
    setError(null)
    try {
      if (!protocol || protocol.body !== body || (protocol.impression ?? '') !== impression) {
        await upsertProtocol(orderId, { body, impression })
      }
      const p = await signProtocol(orderId)
      setProtocol(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('protocol.errorSign'))
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">{t('protocol.loading')}</div>
  }

  if (!order) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg p-6">
        {t('protocol.notFound')}
      </div>
    )
  }

  const isSigned = !!protocol?.signed_at
  const patientId = order.patient_id

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
      <div>
        <div className="mb-4">
          <Link to="/studies" className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            {t('protocol.backToStudies')}
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('protocol.title')}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {t('protocol.order', { id: order.id })} · {order.modality} · {order.study_description || '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              {isSigned && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                  {t('protocol.signed')}
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('protocol.findingsLabel')}
              </label>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); autoSave(e.target.value, impression) }}
                disabled={!canEdit || isSigned}
                rows={18}
                className="w-full font-mono text-sm px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400"
                placeholder={t('protocol.findingsPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {t('protocol.impressionLabel')}
              </label>
              <textarea
                value={impression}
                onChange={(e) => { setImpression(e.target.value); autoSave(body, e.target.value) }}
                disabled={!canEdit || isSigned}
                rows={4}
                className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-400"
                placeholder={t('protocol.impressionPlaceholder')}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {savedAt && <span className="text-emerald-600 dark:text-emerald-400">{t('protocol.savedAt', { time: savedAt })}</span>}
                {isSigned && protocol?.signed_at && (
                  <span className="ml-3">{t('protocol.signedBy', { name: protocol.signed_by || '' })} {t('common.date')}: {new Date(protocol.signed_at).toLocaleDateString('ru-RU')}</span>
                )}
              </div>
              {canEdit && !isSigned && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || signing}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 transition"
                  >
                    {saving ? t('protocol.saving') : t('protocol.saveDraft')}
                  </button>
                  {canSign && (
                    <button
                      onClick={handleSign}
                      disabled={saving || signing}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:opacity-50 transition"
                    >
                      {signing ? t('protocol.signing') : t('protocol.signButton')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('protocol.orderInfo')}</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">ID</dt><dd className="font-mono text-slate-900 dark:text-slate-100">{order.id.slice(0, 8)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('common.modality')}</dt><dd className="text-slate-900 dark:text-slate-100">{order.modality}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('common.created')}</dt><dd className="text-slate-900 dark:text-slate-100">{new Date(order.created_at).toLocaleDateString('ru-RU')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('common.doctor')}</dt><dd className="text-slate-900 dark:text-slate-100">{order.referring_physician ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500 dark:text-slate-400">{t('common.patient')}</dt><dd><Link to={`/patients/${patientId}`} className="text-teal-600 dark:text-teal-400 hover:underline">{t('patients.openCard')}</Link></dd></div>
          </dl>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('protocol.images')}</h3>
          <Link
            to={`/viewer/${encodeURIComponent(order.study_uid)}`}
            className="flex items-center justify-center gap-2 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-teal-400 py-2 rounded-md text-sm font-medium transition"
          >
            <ViewerIcon />
            <span>{t('protocol.openViewer')}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
