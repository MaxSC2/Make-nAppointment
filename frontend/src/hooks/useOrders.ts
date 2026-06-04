import { useCallback, useEffect, useState } from 'react'
import type { OrderOut } from '../types/ris'
import * as risApi from '../api/ris'

export function useOrders(status?: string) {
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const data = await risApi.getOrders(status)
      setOrders(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [status])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchOrders() }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}
