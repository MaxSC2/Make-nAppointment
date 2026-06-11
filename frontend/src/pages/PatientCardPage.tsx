import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPatient, getPatientStudies } from '../api/ris'
import type { PatientOut } from '../types/queue'
import type { PatientStudy } from '../types/ris'
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
  if (!status) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  switch (status) {
    case 'completed': case 'done': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
    case 'in_progress': case 'started': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
    case 'scheduled': case 'waiting': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
    case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

function sortStudies(studies: PatientStudy[]): PatientStudy[] {
  return [...studies].sort((a, b) => {
    const dateA = a.study_date || a.created_at || ''
    const dateB = b.study_date || b.created_at || ''
    return dateB.localeCompare(dateA)
  })
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
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ full_name: '', iin: '', phone: '', notes: '', birth_date: '' })

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
        setEditForm({
          full_name: p.full_name,
          iin: p.iin || '',
          phone: p.phone || '',
          notes: p.notes || '',
          birth_date: p.birth_date ? p.birth_date.slice(0, 10) : '',
        })
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [id])

  const sorted = useMemo(() => sortStudies(studies), [studies])
  const activeStudies = sorted.filter(s =>
    s.order_status === 'in_progress' || s.order_status === 'scheduled' ||
    s.ris_order_status === 'in_progress' || s.ris_order_status === 'scheduled'
  )
  const completedStudies = sorted.filter(s => !activeStudies.includes(s))
  const lastStudyDate = sorted[0]?.study_date || sorted[0]?.created_at?.slice(0, 10) || null

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
        <button onClick={() => navigate('/patients')} className="mt-4 text-teal-600 hover:underline">
          {t('patientCard.backToPatients')}
        </button>
      </div>
    )
  }

  if (!patient) return null

  const age = calcAge(patient.birth_date)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button onClick={() => navigate('/patients')} className="text-sm text-teal-600 hover:underline mb-4">
        {t('patientCard.backToPatients')}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 sticky top-4">
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {patient.full_name}
              </h2>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✎
              </button>
            </div>

            <dl className="text-sm space-y-2">
              <dt className="text-xs text-slate-400 uppercase">{t('patientCard.iin')}</dt>
              <dd className="font-mono text-slate-900 dark:text-slate-100 mb-2">{patient.iin || '—'}</dd>

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
              {patient.policy_number !== patient.iin && patient.policy_number !== patient.id && (
                <>
                  <dt className="text-xs text-slate-400 uppercase">{t('patientCard.policy')}</dt>
                  <dd className="font-mono text-slate-900 dark:text-slate-100 mb-2">{patient.policy_number}</dd>
                </>
              )}
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
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('patientCard.studies', { count: studies.length })}
            </h3>
            <div className="flex gap-3 text-xs text-slate-500">
              {lastStudyDate && <span>{t('patientCard.lastStudy')}: {lastStudyDate}</span>}
              {activeStudies.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400">{t('patientCard.activeOrders')}: {activeStudies.length}</span>
              )}
            </div>
          </div>

          {studies.length === 0 ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-12 bg-slate-50 dark:bg-slate-800 rounded-lg">
              {t('patientCard.noStudies')}
            </div>
          ) : (
            <div className="space-y-4">
              {activeStudies.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">{t('patientCard.active')}</div>
                  <div className="space-y-2">
                    {activeStudies.map(s => (
                      <StudyCard key={s.study_uid} study={s} imgErrors={imgErrors} setImgErrors={setImgErrors} t={t} navigate={navigate} />
                    ))}
                  </div>
                </div>
              )}

              {completedStudies.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">{t('patientCard.completed')}</div>
                  <div className="space-y-2">
                    {completedStudies.map(s => (
                      <StudyCard key={s.study_uid} study={s} imgErrors={imgErrors} setImgErrors={setImgErrors} t={t} navigate={navigate} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('patientCard.editTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('patientCard.editName')}</label>
                <input
                  value={editForm.full_name}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('patientCard.iin')}</label>
                <input
                  value={editForm.iin}
                  onChange={e => setEditForm(f => ({ ...f, iin: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm font-mono bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  maxLength={12}
                  placeholder="000000000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('patientCard.editBirthDate')}</label>
                <input
                  type="date"
                  value={editForm.birth_date}
                  onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('patientCard.phone')}</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  placeholder="+77051234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t('patientCard.notes')}</label>
                <textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                  rows={3}
                  placeholder={t('patientCard.editNotesPlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-white bg-teal-600 rounded-md hover:bg-teal-700"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StudyCard({
  study, imgErrors, setImgErrors, t, navigate,
}: {
  study: PatientStudy
  imgErrors: Record<string, boolean>
  setImgErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  t: (key: string, opts?: Record<string, unknown>) => string
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 flex-shrink-0 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden flex items-center justify-center">
          {imgErrors[study.study_uid] ? (
            <span className="text-[10px] text-slate-400">{t('patientCard.noPreview')}</span>
          ) : (
            <img
              src={`/api/v1/studies/${study.study_uid}/preview`}
              alt={study.description || study.study_uid}
              className="w-full h-full object-cover"
              onError={() => setImgErrors(prev => ({ ...prev, [study.study_uid]: true }))}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{study.modality}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor(study.order_status || study.ris_order_status)}`}>
              {study.order_status || study.ris_order_status || t('patientCard.statusAssigned')}
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
            {study.study_description || study.description || t('patientCard.noDescription')}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {study.study_date || study.created_at?.slice(0, 10) || t('patientCard.dateUnknown')}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => navigate(`/viewer/${study.study_uid}`)}
            className="px-2.5 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700"
            title={t('patientCard.open')}
          >
            🖼
          </button>
          {study.order_id && (
            <button
              onClick={() => navigate(`/protocol/${study.order_id}`)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
              title={t('patientCard.protocol')}
            >
              📋
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
