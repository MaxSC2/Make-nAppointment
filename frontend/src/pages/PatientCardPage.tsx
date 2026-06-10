import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPatient, getPatientStudies } from '../api/ris'
import type { PatientOut } from '../types/queue'
import type { StudyOut } from '../types/ris'
import StatusBadge from '../components/StatusBadge'
import { useTranslation } from 'react-i18next'

export default function PatientCardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [patient, setPatient] = useState<PatientOut | null>(null)
  const [studies, setStudies] = useState<StudyOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      getPatient(id).catch(() => null),
      getPatientStudies(id).catch(() => []),
    ])
      .then(([p, s]) => {
        if (p) setPatient(p)
        setStudies(s)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6 text-sm text-gray-500">{t('common.loading')}</div>
  if (error) return <div className="p-6 text-sm text-red-600">{t('patientCard.error')} {error}</div>
  if (!patient) return <div className="p-6 text-sm text-gray-500">{t('common.notFound')}</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => navigate('/patients')}
        className="mb-4 text-sm text-blue-600 hover:underline"
      >
        {t('patientCard.backToPatients')}
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{patient.full_name}</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('patientCard.policy')}</span>
            <span className="ml-2 font-medium">{patient.policy_number}</span>
          </div>
          {patient.birth_date && (
            <div>
              <span className="text-gray-500">{t('patientCard.dob')}</span>
              <span className="ml-2 font-medium">{patient.birth_date}</span>
            </div>
          )}
          {patient.phone && (
            <div>
              <span className="text-gray-500">{t('patientCard.phone')}</span>
              <span className="ml-2 font-medium">{patient.phone}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{t('patientCard.studies', { count: studies.length })}</h3>
        <button
          onClick={() => navigate(`/orders/new?patient=${patient.id}`)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          {t('patientCard.assignStudy')}
        </button>
      </div>

      {studies.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center text-sm text-gray-400">
          {t('patientCard.noStudies')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {studies.map((study) => (
            <div key={study.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="text-sm font-medium text-gray-900">
                  {study.modality ?? t('patientCard.noPreview')}
                </div>
                <StatusBadge status={study.status} />
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>{study.description || t('patientCard.noDescription')}</p>
                <p>{study.study_date || t('patientCard.dateUnknown')}</p>
                <p>{t('patientCard.status')} {study.status === 'ordered' ? t('patientCard.statusAssigned') : study.status}</p>
              </div>
              {study.status !== 'ordered' && (
                <button
                  onClick={() => navigate(`/viewer/${study.study_uid}`)}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  {t('patientCard.open')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
