import { useCallback, useEffect, useRef, useState } from 'react'
import type { CabinetOut, TicketCreateRequest, TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'

export function useQueue(cabinet?: string, pollInterval = 10000) {
  const [tickets, setTickets] = useState<TicketDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTickets = useCallback(async () => {
    try {
      const data = await queueApi.getTickets(cabinet)
      setTickets(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [cabinet])

  useEffect(() => {
    const poll = () => {
      fetchTickets().finally(() => {
        timeoutRef.current = setTimeout(poll, pollInterval)
      })
    }
    poll()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchTickets, pollInterval])

  const register = useCallback(async (body: TicketCreateRequest) => {
    const ticket = await queueApi.registerTicket(body)
    await fetchTickets()
    return ticket
  }, [fetchTickets])

  return { tickets, loading, error, refetch: fetchTickets, register }
}

export function useCabinets() {
  const [cabinets, setCabinets] = useState<CabinetOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    queueApi.getCabinets()
      .then(setCabinets)
      .catch(() => { console.error('useCabinets: failed to load') })
      .finally(() => setLoading(false))
  }, [])

  return { cabinets, loading }
}
