import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrderOut } from '../types/ris'
import * as risApi from '../api/ris'

export function useOrders(status?: string) {
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const data = await risApi.getOrders(status)
      if (!controller.signal.aborted) {
        setOrders(data)
        setError(null)
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Failed to load orders')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [status])

  useEffect(() => {
    fetchOrders()
    return () => abortRef.current?.abort()
  }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}
