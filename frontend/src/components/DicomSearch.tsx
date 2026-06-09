import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../api/client'

interface PacsStudy {
  orthanc_id: string
  study_uid: string
  study_date: string | null
  study_description: string | null
  modality: string | null
  patient_name_dicom: string | null
  patient_id_dicom: string | null
  accession_number: string | null
  is_stable: boolean
  unlinked: boolean
  ris_order_id: string | null
}

interface DicomSearchProps {
  onClose: () => void
}

export function DicomSearch({ onClose }: DicomSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [studies, setStudies] = useState<PacsStudy[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterUnlinked, setFilterUnlinked] = useState(false)

  const fetchStudies = useCallback(async (q: string) => {
    setLoading(true)
    setError(null)
    try {
      const token = getToken() ?? localStorage.getItem('mp_access_token') ?? ''
      const resp = await fetch('/api/v1/studies/', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error('RIS вернул ' + resp.status)
      const data: PacsStudy[] = await resp.json()
      let filtered = data
      if (filterUnlinked) {
        filtered = filtered.filter(s => s.unlinked)
      }
      if (q.trim()) {
        const lower = q.toLowerCase()
        filtered = filtered.filter(s =>
          (s.patient_name_dicom?.toLowerCase().includes(lower)) ||
          (s.patient_id_dicom?.toLowerCase().includes(lower)) ||
          (s.accession_number?.toLowerCase().includes(lower)) ||
          (s.study_description?.toLowerCase().includes(lower)) ||
          (s.study_uid?.toLowerCase().includes(lower)),
        )
      }
      setStudies(filtered.slice(0, 50))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [filterUnlinked])

  useEffect(() => {
    void fetchStudies('')
  }, [fetchStudies])

  useEffect(() => {
    const timer = setTimeout(() => void fetchStudies(query), 300)
    return () => clearTimeout(timer)
  }, [query, fetchStudies])

  const handleSelect = (s: PacsStudy) => {
    onClose()
    navigate(`/viewer/${s.study_uid}`)
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Поиск в PACS</h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>

      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ФИО, ID, Accession, study UID, описание..."
          className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="flex items-center gap-1 text-xs text-slate-700 whitespace-nowrap">
          <input
            type="checkbox"
            checked={filterUnlinked}
            onChange={e => setFilterUnlinked(e.target.checked)}
          />
          Только несвязанные
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-xs rounded px-2 py-1 mb-2">
          {error}
        </div>
      )}

      <div className="text-xs text-slate-500 mb-1">
        {loading ? 'Загрузка...' : `Найдено: ${studies.length}`}
      </div>

      <div className="bg-white border border-slate-200 rounded max-h-48 overflow-y-auto">
        {studies.length === 0 && !loading ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            {query ? 'Не найдено' : 'Нет исследований'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left text-slate-500 font-medium">Дата</th>
                <th className="px-2 py-1 text-left text-slate-500 font-medium">Мод.</th>
                <th className="px-2 py-1 text-left text-slate-500 font-medium">Пациент</th>
                <th className="px-2 py-1 text-left text-slate-500 font-medium">Описание</th>
                <th className="px-2 py-1 text-left text-slate-500 font-medium">Accession</th>
                <th className="px-2 py-1 text-left text-slate-500 font-medium">RIS</th>
              </tr>
            </thead>
            <tbody>
              {studies.map(s => (
                <tr
                  key={s.orthanc_id}
                  onClick={() => handleSelect(s)}
                  className="hover:bg-brand-50 cursor-pointer border-t border-slate-100"
                >
                  <td className="px-2 py-1 text-slate-700">{s.study_date || '—'}</td>
                  <td className="px-2 py-1">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">
                      {s.modality || '—'}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-slate-700 truncate max-w-[160px]">
                    {s.patient_name_dicom || '—'}
                  </td>
                  <td className="px-2 py-1 text-slate-500 truncate max-w-[200px]">
                    {s.study_description || '—'}
                  </td>
                  <td className="px-2 py-1 font-mono text-slate-500">
                    {s.accession_number || '—'}
                  </td>
                  <td className="px-2 py-1">
                    {s.ris_order_id ? (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                        ✓ {s.ris_order_id}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        unlinked
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
