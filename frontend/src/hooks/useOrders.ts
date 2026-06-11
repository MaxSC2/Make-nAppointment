import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrderOut } from '../types/ris'
import * as risApi from '../api/ris'

export function useOrders(status?: string) {
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await risApi.getOrders(status)
      if (mountedRef.current) {
        setOrders(data)
      }
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load orders')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [status])

  useEffect(() => {
    mountedRef.current = true
    fetchOrders()
    return () => { mountedRef.current = false }
  }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}
