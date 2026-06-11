import { useNavigate } from 'react-router-dom'
import type { OrderOut } from '../types/ris'
import StatusBadge from './StatusBadge'
import { useTranslation } from 'react-i18next'

interface OrderCardProps {
  order: OrderOut
  onClick?: (order: OrderOut) => void
}

export default function OrderCard({ order, onClick }: OrderCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 ${
        onClick ? 'cursor-pointer hover:shadow-md dark:hover:shadow-slate-900/50 transition-shadow' : ''
      }`}
      onClick={() => onClick?.(order)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm text-gray-500 dark:text-slate-400">#{order.id.slice(0, 8)}</span>
        <StatusBadge status={order.status} />
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-1">
        {order.study_description || t('orderCard.noDescription')}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
        <span className="bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded font-medium">{order.modality}</span>
        <span>{t('orderCard.priority')} {order.priority}</span>
        {order.scheduled_for && (
          <span>{new Date(order.scheduled_for).toLocaleDateString('ru-RU')}</span>
        )}
      </div>
      {order.referring_physician && (
        <div className="mt-1.5 text-xs text-gray-400 dark:text-slate-500">
          {t('common.doctor')}: {order.referring_physician}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="text-xs text-gray-400 dark:text-slate-500 flex-1">
          {new Date(order.created_at).toLocaleString('ru-RU')}
        </div>
        {order.study_uid && (
          <button
            onClick={e => { e.stopPropagation(); navigate(`/viewer/${order.study_uid}`) }}
            className="px-2 py-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50"
          >
            🖼
          </button>
        )}
        {order.study_uid && (
          <button
            onClick={e => { e.stopPropagation(); navigate(`/protocol/${order.id}`) }}
            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
          >
            📋
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); navigate(`/patients/${order.patient_id}`) }}
          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          👤
        </button>
      </div>
    </div>
  )
}
