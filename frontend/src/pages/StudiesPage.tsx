import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStudiesList, linkStudy } from '../api/ris'
import type { StudyListItem } from '../types/ris'

const MODALITY_FILTERS = [
  { value: '', label: 'Все модальности' },
  { value: 'CT', label: 'КТ' },
  { value: 'MR', label: 'МРТ' },
  { value: 'DX', label: 'Рентген' },
  { value: 'US', label: 'УЗИ' },
] as const

export default function StudiesPage() {
  const navigate = useNavigate()
  const [studies, setStudies] = useState<StudyListItem[]>([])
  const [modality, setModality] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStudiesList(modality || undefined)
      setStudies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  const handleLink = async (s: StudyListItem) => {
    if (!s.modality) {
      setError('Не удалось определить модальность снимка')
      return
    }
    if (!confirm(`Связать снимок "${s.patient_name_dicom || s.orthanc_id.slice(0, 8)}" с новым RIS-заказом?`)) {
      return
    }
    setLinkingId(s.orthanc_id)
    setError(null)
    try {
      const res = await linkStudy(s.orthanc_id, {
        modality_code: s.modality,
        referring_physician: undefined,
      })
      navigate(`/protocol/${res.order_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка линковки')
    } finally {
      setLinkingId(null)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [modality])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Исследования</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Снимки пациентов, загруженные в PACS (Orthanc)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MODALITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-md text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        </div>
      ) : studies.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
          <div className="text-slate-300 dark:text-slate-600 text-5xl mb-3">🔬</div>
          <h3 className="text-slate-700 dark:text-slate-300 font-medium">Нет исследований</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Зарегистрируйте пациента — система создаст DICOM в PACS автоматически
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Пациент</th>
                <th className="px-4 py-3 text-left font-medium">Study UID</th>
                <th className="px-4 py-3 text-left font-medium">Модальность</th>
                <th className="px-4 py-3 text-left font-medium">Описание</th>
                <th className="px-4 py-3 text-left font-medium">Дата</th>
                <th className="px-4 py-3 text-left font-medium">Связь</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {studies.map((s) => (
                <tr key={s.orthanc_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {s.patient?.full_name || s.patient_name_dicom || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {s.study_uid.slice(0, 18)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium">
                      {s.modality ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {s.study_description || s.ris_study_description || '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 tabular text-xs">
                    {s.study_date
                      ? new Date(s.study_date).toLocaleDateString('ru-RU')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.unlinked ? (
                      <span className="inline-flex px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs font-medium">
                        Не связан
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded text-xs font-medium">
                        Связан
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/viewer/${encodeURIComponent(s.study_uid)}`}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
                      >
                        Просмотр
                      </Link>
                      {s.ris_order_id ? (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <Link
                            to={`/protocol/${s.ris_order_id}`}
                            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                          >
                            Протокол
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <button
                            onClick={() => handleLink(s)}
                            disabled={linkingId === s.orthanc_id}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium disabled:opacity-50"
                          >
                            {linkingId === s.orthanc_id ? 'Создаём...' : '+ Заказ'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
