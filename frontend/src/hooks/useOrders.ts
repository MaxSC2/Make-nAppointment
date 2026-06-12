import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrderOut } from '../types/ris'
import * as risApi from '../api/ris'
import type { GetOrdersParams } from '../api/ris'

export interface OrdersFilters extends GetOrdersParams {
  page: number
  perPage: number
}

export interface OrdersResult {
  items: OrderOut[]
  total: number
  hasMore: boolean
}

export function useOrders(filters: Partial<OrdersFilters> = {}) {
  const [orders, setOrders] = useState<OrderOut[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { page, perPage, ...apiParams } = filters
  const offset = ((page ?? 1) - 1) * (perPage ?? 50)

  const fetchOrders = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const data = await risApi.getOrders({
        ...apiParams,
        limit: perPage ?? 50,
        offset,
      })
      if (!controller.signal.aborted) {
        setOrders(data.items)
        setTotal(data.total)
        setHasMore(data.has_more)
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
  }, [JSON.stringify(apiParams), perPage, offset])

  useEffect(() => {
    fetchOrders()
    return () => abortRef.current?.abort()
  }, [fetchOrders])

  return { orders, total, hasMore, loading, error, refetch: fetchOrders }
}
