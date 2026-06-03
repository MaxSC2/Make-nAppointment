import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStudies } from '../api/ris'
import type { OrderOut } from '../types/ris'
import StatusBadge from '../components/StatusBadge'

const MODALITY_FILTERS = [
  { value: '', label: 'Все модальности' },
  { value: 'CT', label: 'КТ' },
  { value: 'MR', label: 'МРТ' },
  { value: 'DX', label: 'Рентген' },
  { value: 'US', label: 'УЗИ' },
] as const

export default function StudiesPage() {
  const [studies, setStudies] = useState<OrderOut[]>([])
  const [modality, setModality] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStudies(modality || undefined)
      setStudies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [modality])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Исследования</h2>
          <p className="text-sm text-slate-500 mt-1">
            Снимки пациентов, загруженные в PACS (Orthanc)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MODALITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md text-sm hover:bg-slate-200 transition"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        </div>
      ) : studies.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <div className="text-slate-300 text-5xl mb-3">🔬</div>
          <h3 className="text-slate-700 font-medium">Нет исследований</h3>
          <p className="text-sm text-slate-500 mt-1">
            Зарегистрируйте пациента — система создаст DICOM в PACS автоматически
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Study UID</th>
                <th className="px-4 py-3 text-left font-medium">Модальность</th>
                <th className="px-4 py-3 text-left font-medium">Описание</th>
                <th className="px-4 py-3 text-left font-medium">Статус</th>
                <th className="px-4 py-3 text-left font-medium">Создан</th>
                <th className="px-4 py-3 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studies.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {s.study_uid.slice(0, 18)}…
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                      {s.modality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.study_description ?? '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-slate-500 tabular text-xs">
                    {new Date(s.created_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/protocol/${s.id}`}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Протокол
                      </Link>
                      <span className="text-slate-300">·</span>
                      <a
                        href={`/ris/api/orthanc/app/explorer.html#study?study-uid=${encodeURIComponent(s.study_uid)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        Orthanc
                      </a>
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
