import { useState } from 'react'
import { useCabinets } from '../hooks/useQueue'
import type { TicketCreateRequest, TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import StatusBadge from '../components/StatusBadge'

export default function RegistrationPage() {
  const { cabinets } = useCabinets()
  const [form, setForm] = useState<TicketCreateRequest>({
    full_name: '',
    policy_number: '',
    cabinet_code: '101',
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
      setForm({ full_name: '', policy_number: '', cabinet_code: '101', phone: '', priority: 'normal' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-2xl font-semibold mb-6">Регистрация пациента</h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ФИО пациента</label>
          <input
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Иванов Иван Иванович"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Номер полиса</label>
          <input
            type="text"
            required
            value={form.policy_number}
            onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0000 000000 0000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Кабинет</label>
          <select
            value={form.cabinet_code}
            onChange={(e) => setForm({ ...form, cabinet_code: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {cabinets.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name} ({c.modality})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
          <input
            type="tel"
            value={form.phone ?? ''}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'normal', label: 'Плановый', cls: 'border-gray-300 hover:border-blue-400' },
              { v: 'urgent', label: 'Срочный', cls: 'border-amber-300 hover:border-amber-500' },
              { v: 'stat', label: 'Экстренный', cls: 'border-rose-400 hover:border-rose-600' },
            ] as const).map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setForm({ ...form, priority: opt.v })}
                className={`px-3 py-2 text-sm border-2 rounded-md font-medium transition ${
                  form.priority === opt.v
                    ? opt.v === 'stat' ? 'bg-rose-600 text-white border-rose-600'
                      : opt.v === 'urgent' ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-blue-600 text-white border-blue-600'
                    : `bg-white text-gray-700 ${opt.cls}`
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Регистрация...' : 'Зарегистрировать'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Пациент зарегистрирован</h3>
          <div className="space-y-1 text-sm text-green-700">
            <p>Талон: <span className="font-mono font-bold">{result.ticket_number}</span></p>
            <p>Пациент: {result.patient.full_name}</p>
            <p>Кабинет: {result.cabinet.name}</p>
            <p>Статус: <StatusBadge status={result.status} /></p>
          </div>
        </div>
      )}
    </div>
  )
}
