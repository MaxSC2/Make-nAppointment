import { useCallback, useEffect, useRef, useState } from 'react'
import { useCabinets } from '../hooks/useQueue'
import type { TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import QueueTable from '../components/QueueTable'
import { useTranslation } from 'react-i18next'

export default function DoctorPage() {
  const { t } = useTranslation()
  const { cabinets } = useCabinets()
  const [cabinetCode, setCabinetCode] = useState('1')
  const [tickets, setTickets] = useState<TicketDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorCall'))
    }
  }, [refresh, t])

  const handleComplete = useCallback(async (ticket: TicketDetail) => {
    try {
      await queueApi.completeTicket(ticket.sourceTicketId!)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorComplete'))
    }
  }, [refresh, t])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold dark:text-slate-100">{t('doctor.cabinetTitle')}</h2>
        <div className="flex items-center gap-3">
          <select
            value={cabinetCode}
            onChange={(e) => setCabinetCode(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-md px-3 py-1.5 text-sm"
          >
            {cabinets.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
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
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">{error}</div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </div>
      ) : (
        <QueueTable
          tickets={tickets}
          onCall={handleCall}
          onComplete={handleComplete}
          showActions
        />
      )}
    </div>
  )
}
