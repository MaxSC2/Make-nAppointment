import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import OrderCard from '../components/OrderCard'
import { useTranslation } from 'react-i18next'

export default function OrdersPage() {
  const [status, setStatus] = useState('')
  const { orders, loading, error, refetch } = useOrders(status || undefined)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const statusFilters = [
    { value: '', key: 'orders.all' },
    { value: 'scheduled', key: 'orders.planned' },
    { value: 'in_progress', key: 'orders.inProgress' },
    { value: 'completed', key: 'orders.completed' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">{t('orders.title')}</h2>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            {statusFilters.map((f) => (
              <option key={f.value} value={f.value}>{t(f.key)}</option>
            ))}
          </select>
          <button
            onClick={refetch}
            className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            {t('orders.refresh')}
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="bg-teal-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-teal-700"
          >
            + Заказ
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('orders.loading')}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('orders.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={(o) => navigate(`/protocol/${o.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
