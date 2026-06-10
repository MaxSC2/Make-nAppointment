import { useCallback, useEffect, useRef, useState } from 'react'
import { useCabinets } from '../hooks/useQueue'
import type { TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import QueueTable from '../components/QueueTable'

export default function DoctorPage() {
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
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [cabinetCode])

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
      setError(e instanceof Error ? e.message : 'Ошибка вызова')
    }
  }, [refresh])

  const handleComplete = useCallback(async (ticket: TicketDetail) => {
    try {
      await queueApi.completeTicket(ticket.sourceTicketId!)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка завершения')
    }
  }, [refresh])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Кабинет врача</h2>
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
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 transition-colors"
          >
            {loading ? '...' : 'Обновить'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      <QueueTable
        tickets={tickets}
        onCall={handleCall}
        onComplete={handleComplete}
        showActions
      />
    </div>
  )
}
