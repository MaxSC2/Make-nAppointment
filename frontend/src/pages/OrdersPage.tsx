import { useState } from 'react'
import { useOrders } from '../hooks/useOrders'
import OrderCard from '../components/OrderCard'

const STATUS_FILTERS = [
  { value: '', label: 'Все' },
  { value: 'scheduled', label: 'Запланированы' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'completed', label: 'Выполнены' },
] as const

export default function OrdersPage() {
  const [status, setStatus] = useState('')
  const { orders, loading, error, refetch } = useOrders(status || undefined)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Заказы RIS</h2>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={refetch}
            className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200"
          >
            Обновить
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Нет заказов</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
