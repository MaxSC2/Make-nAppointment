import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getOrder, getProtocol, signProtocol, upsertProtocol } from '../api/ris'
import type { OrderOut, ProtocolOut } from '../types/ris'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'

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
        } else {
          setBody(TEMPLATES[o.modality] ?? '')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [orderId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const p = await upsertProtocol(orderId, { body, impression })
      setProtocol(p)
      setSavedAt(new Date().toLocaleTimeString('ru-RU'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleSign = async () => {
    if (!confirm('Подписать протокол? После подписи изменения невозможны.')) return
    setSigning(true)
    setError(null)
    try {
      if (!protocol || protocol.body !== body || (protocol.impression ?? '') !== impression) {
        await upsertProtocol(orderId, { body, impression })
      }
      const p = await signProtocol(orderId)
      setProtocol(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подписи')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Загрузка...</div>
  }

  if (!order) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-6">
        Заказ не найден
      </div>
    )
  }

  const isSigned = !!protocol?.signed_at

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="mb-4">
          <Link to="/studies" className="text-sm text-slate-500 hover:text-slate-700">← К исследованиям</Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Протокол исследования</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Заказ <span className="font-mono">{order.id}</span> · {order.modality} · {order.study_description || '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={order.status} />
              {isSigned && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  ✓ Подписан
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Описание / Findings
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!canEdit || isSigned}
                rows={18}
                className="w-full font-mono text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-600"
                placeholder="Текст протокола..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Заключение / Impression
              </label>
              <textarea
                value={impression}
                onChange={(e) => setImpression(e.target.value)}
                disabled={!canEdit || isSigned}
                rows={4}
                className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-600"
                placeholder="Краткое заключение..."
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {savedAt && <span className="text-emerald-600">✓ Сохранено в {savedAt}</span>}
                {isSigned && protocol?.signed_at && (
                  <span className="ml-3">Подписан: {new Date(protocol.signed_at).toLocaleString('ru-RU')}</span>
                )}
              </div>
              {canEdit && !isSigned && (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || signing}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    {saving ? 'Сохранение...' : 'Сохранить черновик'}
                  </button>
                  {canSign && (
                    <button
                      onClick={handleSign}
                      disabled={saving || signing}
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-md disabled:opacity-50 transition"
                    >
                      {signing ? 'Подписание...' : '✓ Подписать'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Информация о заказе</h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500">ID</dt><dd className="font-mono text-slate-900">{order.id}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Модальность</dt><dd className="text-slate-900">{order.modality}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Study UID</dt><dd className="font-mono text-slate-600 truncate ml-2" title={order.study_uid}>{order.study_uid.slice(0, 12)}…</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Создан</dt><dd className="text-slate-900">{new Date(order.created_at).toLocaleDateString('ru-RU')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Врач</dt><dd className="text-slate-900">{order.referring_physician ?? '—'}</dd></div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Снимки</h3>
          <Link
            to={`/viewer/${order.study_uid}`}
            className="block text-center bg-brand-50 hover:bg-brand-100 text-brand-700 py-2 rounded-md text-sm font-medium transition"
          >
            🖼 Открыть DICOM Viewer
          </Link>
        </div>
      </div>
    </div>
  )
}
