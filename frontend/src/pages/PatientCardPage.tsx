import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPatient, getPatientStudies } from '../api/ris'
import type { PatientOut } from '../types/queue'
import type { PatientStudy } from '../types/ris'

export default function PatientCardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientOut | null>(null)
  const [studies, setStudies] = useState<PatientStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([getPatient(id), getPatientStudies(id)])
      .then(([p, s]) => {
        if (cancelled) return
        setPatient(p)
        setStudies(s)
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-slate-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          Ошибка: {error}
        </div>
        <button
          onClick={() => navigate('/patients')}
          className="mt-4 text-teal-600 hover:underline"
        >
          ← Назад к пациентам
        </button>
      </div>
    )
  }

  if (!patient) return null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/patients')}
        className="text-sm text-teal-600 hover:underline mb-4"
      >
        ← Назад к пациентам
      </button>

      <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              {patient.full_name}
            </h2>
            <div className="text-sm text-slate-600 space-y-1">
              <div>Полис: <span className="font-mono">{patient.policy_number}</span></div>
              {patient.birth_date && <div>Дата рождения: {patient.birth_date}</div>}
              {patient.phone && <div>Телефон: {patient.phone}</div>}
            </div>
          </div>
          <button
            onClick={() => navigate(`/orders/new?patientId=${patient.id}`)}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 transition flex-shrink-0"
          >
            + Назначить исследование
          </button>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-3">
        Исследования ({studies.length})
      </h3>

      {studies.length === 0 ? (
        <div className="text-center text-slate-500 py-12 bg-slate-50 rounded-lg">
          У этого пациента ещё нет исследований
        </div>
      ) : (
        <div className="space-y-2">
          {studies.map(s => (
            <div
              key={s.orthanc_id || s.study_uid}
              className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg p-3"
            >
              <div className="w-20 h-20 flex-shrink-0 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                {imgErrors[s.study_uid] ? (
                  <span className="text-xs text-slate-400">нет превью</span>
                ) : (
                  <img
                    src={`/api/v1/studies/${s.study_uid}/preview`}
                    alt={s.description || s.study_uid}
                    className="w-full h-full object-cover"
                    onError={() => setImgErrors(prev => ({ ...prev, [s.study_uid]: true }))}
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900">
                  {s.modality} · {s.description || 'Без описания'}
                </div>
                <div className="text-sm text-slate-500">
                  {s.study_date || 'Дата неизвестна'} · Статус: {s.status}
                </div>
              </div>

              <button
                onClick={() => navigate(`/viewer/${s.study_uid}`)}
                className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 flex-shrink-0"
              >
                Открыть
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
