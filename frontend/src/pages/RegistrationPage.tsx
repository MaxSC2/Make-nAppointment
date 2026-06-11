import { useState } from 'react'
import { useCabinets } from '../hooks/useQueue'
import type { TicketCreateRequest, TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import StatusBadge from '../components/StatusBadge'
import { useTranslation } from 'react-i18next'

export default function RegistrationPage() {
  const { cabinets } = useCabinets()
  const { t } = useTranslation()
  const [form, setForm] = useState<TicketCreateRequest>({
    full_name: '',
    policy_number: '',
    iin: '',
    cabinet_code: 'CT',
    phone: '',
    priority: 'normal',
  })
  const [result, setResult] = useState<TicketDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const ticket = await queueApi.registerTicket(form)
      setResult(ticket)
      setForm({ full_name: '', policy_number: '', iin: '', cabinet_code: 'CT', phone: '', priority: 'normal' })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const priorityOpts = [
    { v: 'normal' as const, key: 'registration.priorityPlanned', cls: 'border-gray-300 hover:border-blue-400' },
    { v: 'urgent' as const, key: 'registration.priorityUrgent', cls: 'border-amber-300 hover:border-amber-500' },
    { v: 'stat' as const, key: 'registration.priorityEmergency', cls: 'border-rose-400 hover:border-rose-600' },
  ]

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold mb-6 dark:text-slate-100">{t('registration.title')}</h2>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('registration.patientName')}</label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('registration.patientNamePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('registration.policyNumber')}</label>
          <input
            type="text"
            required
            value={form.policy_number}
            onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0000 000000 0000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ИИН</label>
          <input
            type="text"
            maxLength={12}
            value={form.iin ?? ''}
            onChange={(e) => setForm({ ...form, iin: e.target.value })}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="000000000000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('registration.cabinet')}</label>
          <select
            value={form.cabinet_code}
            onChange={(e) => setForm({ ...form, cabinet_code: e.target.value })}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cabinets.map((c) => (
              <option key={c.code} value={c.modality}>
                {c.name} ({c.modality})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('registration.phone')}</label>
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('registration.priority')}</label>
          <div className="grid grid-cols-3 gap-2">
            {priorityOpts.map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setForm({ ...form, priority: opt.v })}
                className={`px-3 py-2 text-sm border-2 rounded-md font-medium transition ${
                  form.priority === opt.v
                    ? opt.v === 'stat' ? 'bg-rose-600 text-white border-rose-600'
                      : opt.v === 'urgent' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-600 text-white border-blue-600'
                    : `bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 ${opt.cls}`
                }`}
              >
                {t(opt.key)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? t('registration.registering') : t('registration.registerButton')}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 dark:text-green-400 mb-2">{t('registration.successTitle')}</h3>
          <div className="space-y-1 text-sm text-green-700 dark:text-green-300">
            <p>{t('registration.ticketLabel')} <span className="font-mono font-bold">{result.ticket_number}</span></p>
            <p>{t('registration.patientLabel')} {result.patient.full_name}</p>
            <p>{t('registration.cabinetLabel')} {result.cabinet.name}</p>
            <p>{t('registration.statusLabel')} <StatusBadge status={result.status} /></p>
          </div>
        </div>
      )}
    </div>
  )
}
