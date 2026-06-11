import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createOrder, getModalities, getPatient, getPatients } from '../api/ris'
import type { PatientOut } from '../types/queue'
import type { ModalityOut } from '../types/ris'

const PRIORITIES = [
  { value: 'normal', label: 'Плановый' },
  { value: 'urgent', label: 'Срочный' },
  { value: 'stat', label: 'Экстренный' },
] as const

type Priority = (typeof PRIORITIES)[number]['value']

export default function OrderEntryPage() {
  const navigate = useNavigate()
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
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [presetPatientId])

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients.slice(0, 20)
    const q = patientSearch.toLowerCase()
    return patients
      .filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        p.policy_number.toLowerCase().includes(q),
      )
      .slice(0, 20)
  }, [patients, patientSearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!patientId) {
      setError('Выберите пациента')
      return
    }
    if (!modality) {
      setError('Выберите модальность')
      return
    }

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
      setError(e instanceof Error ? e.message : 'Ошибка создания заказа')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400 dark:text-slate-500">Загрузка...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(presetPatientId ? `/patients/${presetPatientId}` : '/patients')}
        className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-4"
      >
        ← Назад
      </button>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Назначение исследования</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Заполните форму — заказ появится в очереди у рентгенолога
        </p>

        {presetPatient && (
          <div className="mb-4 px-3 py-2 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-md text-sm text-teal-800 dark:text-teal-300">
            Пациент предзаполнен: <span className="font-medium">{presetPatient.full_name}</span> (полис {presetPatient.policy_number})
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Пациент <span className="text-red-500">*</span>
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
                  placeholder="Поиск по ФИО или полису..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <select
                  value={patientId}
                  onChange={e => {
                    setPatientId(e.target.value)
                    const found = patients.find(p => p.id === e.target.value)
                    if (found) setPatientSearch(found.full_name)
                  }}
                  size={Math.min(6, Math.max(1, filteredPatients.length))}
                  className="mt-1 w-full px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 dark:text-slate-200"
                >
                  {filteredPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} — {p.policy_number}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Найдено: {filteredPatients.length} {patients.length > 20 ? `из ${patients.length}` : ''}
                </p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Модальность <span className="text-red-500">*</span>
            </label>
            <select
              value={modality}
              onChange={e => setModality(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {modalities.map(m => (
                <option key={m.code} value={m.code}>{m.code} — {m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Приоритет
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition ${
                    priority === p.value
                      ? 'bg-brand-50 dark:bg-brand-900/40 border-brand-500 text-brand-700 dark:text-brand-300'
                      : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Примечание
            </label>
            <textarea
              value={studyDescription}
              onChange={e => setStudyDescription(e.target.value)}
              rows={3}
              placeholder="Клиническая информация, предварительный диагноз..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Направивший врач
            </label>
            <input
              type="text"
              value={referringPhysician}
              onChange={e => setReferringPhysician(e.target.value)}
              placeholder="ФИО врача"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => navigate(presetPatientId ? `/patients/${presetPatientId}` : '/patients')}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-600 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-md disabled:opacity-50 transition"
            >
              {submitting ? 'Создание...' : 'Назначить исследование'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
