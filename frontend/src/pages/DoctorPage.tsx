import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCabinets } from '../hooks/useQueue'
import type { TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import QueueTable from '../components/QueueTable'
import { useTranslation } from 'react-i18next'
import { playCallSound } from '../utils/sound'

export default function DoctorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cabinets } = useCabinets()
  const [cabinetCode, setCabinetCode] = useState('1')
  const [tickets, setTickets] = useState<TicketDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [fillTicket, setFillTicket] = useState<TicketDetail | null>(null)
  const [fillName, setFillName] = useState('')
  const [fillPolicy, setFillPolicy] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await queueApi.getTickets(cabinetCode)
      setTickets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorLoading'))
    } finally {
      setLoading(false)
    }
  }, [cabinetCode, t])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 10000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refresh])

  const handleCall = useCallback(async (ticket: TicketDetail) => {
    try {
      await queueApi.callTicket(ticket.sourceTicketId!)
      playCallSound()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorCall'))
    }
  }, [refresh, t])

  const handleComplete = useCallback(async (ticket: TicketDetail) => {
    try {
      const result = await queueApi.completeTicket(ticket.sourceTicketId!)
      if (result.order_id) {
        navigate(`/protocol/${result.order_id}`)
      } else {
        await refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorComplete'))
    }
  }, [refresh, t, navigate])

  const handleFillPatient = useCallback((ticket: TicketDetail) => {
    setFillTicket(ticket)
    setFillName(ticket.patient.full_name || '')
    setFillPolicy(ticket.patient.policy_number || '')
  }, [])

  const handleSavePatient = useCallback(async () => {
    if (!fillTicket?.sourceTicketId || !fillName.trim()) return
    setSaving(true)
    try {
      await queueApi.updateTicketPatient(fillTicket.sourceTicketId, fillName.trim(), fillPolicy.trim())
      setFillTicket(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorSavePatient'))
    } finally {
      setSaving(false)
    }
  }, [fillTicket, fillName, fillPolicy, refresh, t])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">{t('doctor.cabinetTitle')}</h2>
        <div className="flex items-center gap-3">
          <select
            value={cabinetCode}
            onChange={(e) => setCabinetCode(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            {cabinets.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {t('doctor.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
      ) : (
        <QueueTable
          tickets={tickets}
          onCall={handleCall}
          onComplete={handleComplete}
          onFillPatient={handleFillPatient}
          showActions
        />
      )}

      {fillTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setFillTicket(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t('doctor.fillPatientTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.patient')}</label>
                <input
                  value={fillName}
                  onChange={e => setFillName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder={t('doctor.fillNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.policy')}</label>
                <input
                  value={fillPolicy}
                  onChange={e => setFillPolicy(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="0000 000000 0000"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setFillTicket(null)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSavePatient}
                disabled={saving || !fillName.trim()}
                className="px-4 py-2 text-sm text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
