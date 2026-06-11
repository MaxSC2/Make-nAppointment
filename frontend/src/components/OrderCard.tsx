import type { OrderOut } from '../types/ris'
import StatusBadge from './StatusBadge'
import { useTranslation } from 'react-i18next'

interface OrderCardProps {
  order: OrderOut
  onClick?: (order: OrderOut) => void
}

export default function OrderCard({ order, onClick }: OrderCardProps) {
  const { t } = useTranslation()
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 ${
        onClick ? 'cursor-pointer hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow' : ''
      }`}
      onClick={() => onClick?.(order)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-gray-500 dark:text-slate-400">#{order.id}</span>
        <StatusBadge status={order.status} />
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
        {order.study_description || t('orderCard.noDescription')}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
        <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">{order.modality}</span>
        <span>{t('orderCard.priority')} {order.priority}</span>
        {order.scheduled_for && (
          <span>
            {new Date(order.scheduled_for).toLocaleDateString('ru-RU')}
          </span>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
        {t('orderCard.created')} {new Date(order.created_at).toLocaleString('ru-RU')}
      </div>
    </div>
  )
}
