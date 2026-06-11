import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPatient, getPatientStudies, getProtocol } from '../api/ris'
import type { PatientOut } from '../types/queue'
import type { PatientStudy, ProtocolOut } from '../types/ris'
import { useTranslation } from 'react-i18next'

function calcAge(birthDate: string | null): number | null {
  if (!birthDate) return null
  const bd = new Date(birthDate)
  if (isNaN(bd.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - bd.getFullYear()
  const m = today.getMonth() - bd.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--
  return age
}

function statusColor(status: string | null | undefined): string {
  if (!status) return 'bg-slate-100 text-slate-600'
  switch (status) {
    case 'completed': case 'done': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'in_progress': case 'started': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    case 'scheduled': case 'waiting': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

export default function PatientCardPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [patient, setPatient] = useState<PatientOut | null>(null)
  const [studies, setStudies] = useState<PatientStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})
  const [protocols, setProtocols] = useState<Record<string, ProtocolOut>>({})
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null)

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

  const handleToggleProtocol = async (study: PatientStudy) => {
    if (expandedStudy === study.study_uid) {
      setExpandedStudy(null)
      return
    }
    setExpandedStudy(study.study_uid)
    if (!protocols[study.study_uid] && study.order_id) {
      try {
        const p = await getProtocol(study.order_id)
        setProtocols(prev => ({ ...prev, [study.study_uid]: p }))
      } catch {
        setProtocols(prev => ({ ...prev, [study.study_uid]: null as unknown as ProtocolOut }))
      }
    }
  }

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
          {t('patientCard.error')} {error}
        </div>
        <button
          onClick={() => navigate('/patients')}
          className="mt-4 text-teal-600 hover:underline"
        >
          {t('patientCard.backToPatients')}
        </button>
      </div>
    )
  }

  if (!patient) return null

  const age = calcAge(patient.birth_date)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/patients')}
        className="text-sm text-teal-600 hover:underline mb-4"
      >
        ← {t('patientCard.backToPatients')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 sticky top-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              {patient.full_name}
            </h2>

            <dl className="text-sm space-y-2">
              {patient.iin && (
                <>
                  <dt className="text-xs text-slate-400 uppercase">{t('patientCard.iin')}</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100 mb-2">{patient.iin}</dd>
                </>
              )}
              {age !== null && (
                <>
                  <dt className="text-xs text-slate-400 uppercase">{t('patientCard.age')}</dt>
                  <dd className="text-slate-900 dark:text-slate-100 mb-2">{age} {t('patients.years')}</dd>
                </>
              )}
              {patient.birth_date && (
                <>
                  <dt className="text-xs text-slate-400 uppercase">{t('patientCard.dob')}</dt>
                  <dd className="text-slate-900 dark:text-slate-100 mb-2">{new Date(patient.birth_date).toLocaleDateString()}</dd>
                </>
              )}
              <dt className="text-xs text-slate-400 uppercase">{t('patientCard.policy')}</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100 mb-2">{patient.policy_number}</dd>
              {patient.phone && (
                <>
                  <dt className="text-xs text-slate-400 uppercase">{t('patientCard.phone')}</dt>
                  <dd className="text-slate-900 dark:text-slate-100 mb-2">{patient.phone}</dd>
                </>
              )}
              {patient.notes && (
                <>
                  <dt className="text-xs text-slate-400 uppercase">{t('patientCard.notes')}</dt>
                  <dd className="text-slate-600 dark:text-slate-300 text-xs italic mb-2">{patient.notes}</dd>
                </>
              )}
            </dl>

            <button
              onClick={() => navigate(`/orders/new?patientId=${patient.id}`)}
              className="mt-4 w-full px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 transition"
            >
              {t('patientCard.assignStudy')}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {t('patientCard.studies')} ({studies.length})
          </h3>

          {studies.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
              {t('patientCard.noStudies')}
            </div>
          ) : (
            <div className="space-y-3">
              {studies.map(s => (
                <div
                  key={s.orthanc_id || s.study_uid}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center gap-4 p-3">
                    <div className="w-20 h-20 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden flex items-center justify-center">
                      {imgErrors[s.study_uid] ? (
                        <span className="text-xs text-slate-400">{t('patientCard.noPreview')}</span>
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {s.modality}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(s.order_status || s.ris_order_status)}`}>
                          {s.order_status || s.ris_order_status || t('patientCard.statusAssigned')}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                        {s.study_description || s.description || t('patientCard.noDescription')}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {s.study_date || (s.created_at?.slice(0, 10)) || t('patientCard.dateUnknown')}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => navigate(`/viewer/${s.study_uid}`)}
                        className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded hover:bg-teal-700"
                      >
                        {t('patientCard.open')}
                      </button>
                      {s.order_id && (
                        <button
                          onClick={() => handleToggleProtocol(s)}
                          className="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          {expandedStudy === s.study_uid ? t('common.hide') : t('patientCard.protocol')}
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedStudy === s.study_uid && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50">
                      {protocols[s.study_uid] === null ? (
                        <div className="text-xs text-slate-400">{t('patientCard.noProtocol')}</div>
                      ) : protocols[s.study_uid] ? (
                        <div className="text-sm space-y-2">
                          <p className="text-slate-700 dark:text-slate-300">{protocols[s.study_uid].body}</p>
                          {protocols[s.study_uid].impression && (
                            <>
                              <hr className="border-slate-200 dark:border-slate-600" />
                              <p className="text-sm font-medium text-slate-500">{t('patientCard.impression')}</p>
                              <p className="text-slate-700 dark:text-slate-300">{protocols[s.study_uid].impression}</p>
                            </>
                          )}
                          {protocols[s.study_uid].signed_at && (
                            <div className="text-xs text-slate-400 mt-1">
                              {t('patientCard.signed')} {new Date(protocols[s.study_uid].signed_at).toLocaleString()}
                              {protocols[s.study_uid].signed_by && ` · ${protocols[s.study_uid].signed_by}`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 animate-pulse">{t('common.loading')}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
