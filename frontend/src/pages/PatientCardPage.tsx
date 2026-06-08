import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { PatientOut } from '../types/queue'
import type { PatientStudy } from '../types/ris'
import * as risApi from '../api/ris'

export default function PatientCardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientOut | null>(null)
  const [studies, setStudies] = useState<PatientStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([risApi.getPatients(), risApi.getPatientStudies(id)])
      .then(([patList, stud]) => {
        if (!cancelled) {
          const pat = patList.find(p => p.id === id) ?? null
          setPatient(pat)
          setStudies(stud)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [id])

  if (loading) return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="h-8 w-40 bg-gray-100 rounded animate-pulse" />
      <div className="h-28 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
      {[1,2,3].map(i => (
        <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <button onClick={() => navigate('/patients')}
              className="text-teal-600 underline">
        ← Назад к пациентам
      </button>
    </div>
  )

  if (!patient) return null

  const uploadedStudies = studies.filter(s => s.is_uploaded)
  const pendingStudies = studies.filter(s => !s.is_uploaded)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/patients')}
        className="flex items-center gap-1 text-sm text-teal-600 mb-6 hover:underline">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="m15 18-6-6 6-6"/>
        </svg>
        Назад к пациентам
      </button>

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center
                          justify-center text-teal-700 text-2xl font-bold flex-shrink-0">
            {patient.full_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{patient.full_name}</h1>
            <div className="text-sm text-gray-500 mt-1 space-y-0.5">
              <div>Полис: <span className="font-medium">{patient.policy_number}</span></div>
              {patient.birth_date && (
                <div>Дата рождения: {new Date(patient.birth_date).toLocaleDateString('ru-RU')}</div>
              )}
              {patient.phone && <div>Телефон: {patient.phone}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-teal-600">{studies.length}</div>
          <div className="text-xs text-gray-500 mt-1">Всего заказов</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{uploadedStudies.length}</div>
          <div className="text-xs text-gray-500 mt-1">Снимков загружено</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{pendingStudies.length}</div>
          <div className="text-xs text-gray-500 mt-1">Ожидают снимка</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        История исследований
      </h2>

      {studies.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200
                        rounded-lg text-gray-500">
          У этого пациента ещё нет исследований
        </div>
      ) : (
        <div className="space-y-3">
          {studies.map(s => (
            <div key={s.order_id}
                 className="bg-white border border-gray-200 rounded-lg p-4
                            flex items-center gap-4">
              <div className="w-20 h-20 flex-shrink-0 bg-gray-900 rounded-lg
                              overflow-hidden flex items-center justify-center">
                {s.preview_url ? (
                  <img
                    src={s.preview_url}
                    alt="превью снимка"
                    className="w-full h-full object-cover"
                    onError={e => {
                      const el = e.currentTarget
                      el.style.display = 'none'
                      el.parentElement!.innerHTML =
                        '<span class="text-gray-500 text-xs text-center px-1">Нет превью</span>'
                    }}
                  />
                ) : (
                  <span className="text-gray-500 text-xs text-center px-1">
                    {s.is_uploaded ? 'Нет превью' : 'Снимок не загружен'}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {s.modality || 'Неизвестно'}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {new Date(s.created_at).toLocaleDateString('ru-RU')}
                </div>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                    ${s.order_status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : s.order_status === 'in_progress'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'}`}>
                    {s.order_status === 'completed' ? 'Завершено'
                      : s.order_status === 'in_progress' ? 'В процессе'
                      : 'Назначено'}
                  </span>
                </div>
              </div>

              {s.is_uploaded && s.study_uid ? (
                <button
                  onClick={() => navigate(`/viewer/${s.study_uid}`)}
                  className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white
                             rounded-lg text-sm font-medium hover:bg-teal-700
                             transition-colors">
                  Открыть
                </button>
              ) : (
                <span className="flex-shrink-0 px-4 py-2 bg-gray-100 text-gray-400
                                 rounded-lg text-sm">
                  Ожидание
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
