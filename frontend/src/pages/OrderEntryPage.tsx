import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createOrder, getModalities, getPatient, getPatients } from '../api/ris'
import type { PatientOut } from '../types/queue'
import type { ModalityOut } from '../types/ris'
import { useTranslation } from 'react-i18next'

const PRIORITIES = [
  { value: 'normal' as const, key: 'orderEntry.priorityPlanned' },
  { value: 'urgent' as const, key: 'orderEntry.priorityUrgent' },
  { value: 'stat' as const, key: 'orderEntry.priorityEmergency' },
]

type Priority = (typeof PRIORITIES)[number]['value']

export default function OrderEntryPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const presetPatientId = searchParams.get('patientId') ?? ''

  const [patients, setPatients] = useState<PatientOut[]>([])
  const [modalities, setModalities] = useState<ModalityOut[]>([])
  const [patientId, setPatientId] = useState(presetPatientId)
  const [patientSearch, setPatientSearch] = useState('')
  const [modality, setModality] = useState('')
  const [priority, setPriority] = useState<Priority>('normal')
  const [studyDescription, setStudyDescription] = useState('')
  const [referringPhysician, setReferringPhysician] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presetPatient, setPresetPatient] = useState<PatientOut | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [mods, list] = await Promise.all([getModalities(), getPatients()])
        if (cancelled) return
        setModalities(mods)
        setPatients(list)
        if (mods.length > 0) setModality(mods[0].code)
        if (presetPatientId) {
          const preset = await getPatient(presetPatientId).catch(() => null)
          if (!cancelled) {
            setPresetPatient(preset)
            if (preset) {
              setPatientId(preset.id)
              setPatientSearch(preset.full_name)
            }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('orderEntry.errorLoading'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [presetPatientId, t])

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 20)
    const q = patientSearch.toLowerCase()
    return patients
      .filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        (p.iin ?? '').includes(q) ||
        p.policy_number.toLowerCase().includes(q),
      )
      .slice(0, 20)
  }, [patients, patientSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!patientId) { setError(t('orderEntry.errorNeedPatient')); return }
    if (!modality) { setError(t('orderEntry.errorNeedModality')); return }

    setSubmitting(true)
    try {
      const order = await createOrder({
        patient_id: patientId,
        modality,
        priority,
        study_description: studyDescription.trim() || undefined,
        referring_physician: referringPhysician.trim() || undefined,
      })
      navigate(`/patients/${order.patient_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('orderEntry.errorCreating'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(presetPatientId ? `/patients/${presetPatientId}` : '/patients')}
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
      >
        {t('orderEntry.back')}
      </button>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">{t('orderEntry.title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('orderEntry.subtitle')}</p>

        {presetPatient && (
          <div className="mb-4 px-3 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-md text-sm text-teal-800 dark:text-teal-400">
            {t('orderEntry.patientPrefilled', { name: presetPatient.full_name, policy: presetPatient.iin || '—' })}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('orderEntry.patientRequired')}
            </label>
            {presetPatient ? (
              <input
                type="text"
                value={patientSearch}
                disabled
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm"
              />
            ) : (
              <>
                <input
                  type="text"
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder={t('orderEntry.patientSearch')}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {filteredPatients.length > 0 && (
                  <select
                    value={patientId}
                    onChange={e => {
                      setPatientId(e.target.value)
                      const found = patients.find(p => p.id === e.target.value)
                      if (found) setPatientSearch(found.full_name)
                    }}
                    size={Math.min(6, Math.max(2, filteredPatients.length))}
                    className="mt-1 w-full px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    {filteredPatients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}{p.iin ? ` — ${p.iin}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {filteredPatients.length > 0
                    ? t('orderEntry.found', { count: filteredPatients.length })
                    : patientSearch.trim() ? t('common.notFound') : t('orderEntry.selectPatient')}
                </p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('orderEntry.modality')}
            </label>
            <select
              value={modality}
              onChange={e => setModality(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">{t('orderEntry.selectModality')}</option>
              {modalities.map(m => (
                <option key={m.code} value={m.code}>{m.code} — {m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('orderEntry.priority')}
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition ${
                    priority === p.value
                      ? p.value === 'stat'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : p.value === 'urgent'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {t(p.key)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('orderEntry.note')}
            </label>
            <textarea
              value={studyDescription}
              onChange={e => setStudyDescription(e.target.value)}
              rows={3}
              placeholder={t('orderEntry.notePlaceholder')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {t('orderEntry.referringDoctor')}
            </label>
            <input
              type="text"
              value={referringPhysician}
              onChange={e => setReferringPhysician(e.target.value)}
              placeholder={t('orderEntry.doctorName')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => navigate(presetPatientId ? `/patients/${presetPatientId}` : '/patients')}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 transition"
            >
              {t('orderEntry.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:opacity-50 transition"
            >
              {submitting ? t('orderEntry.creating') : t('orderEntry.assignStudy')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
