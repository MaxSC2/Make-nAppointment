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
            className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-1.5 text-sm"
          >
            {cabinets.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            {loading ? '...' : t('doctor.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
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
