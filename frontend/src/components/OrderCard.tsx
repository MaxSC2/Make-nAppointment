import type { OrderOut } from '../types/ris'
import StatusBadge from './StatusBadge'
import { useTranslation } from 'react-i18next'

export default function OrderCard({ order }: { order: OrderOut }) {
  const { t } = useTranslation()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">{order.patient_name ?? t('orderCard.noDescription')}</h3>
        <StatusBadge status={order.status} />
      </div>
      <div className="space-y-1 text-xs text-gray-500">
        <p>{t('orderCard.priority')} {order.priority}</p>
        {order.modality && <p>{order.modality}</p>}
        <p>{t('orderCard.created')} {new Date(order.created_at).toLocaleString()}</p>
        {order.description && <p className="text-gray-400">{order.description}</p>}
      </div>
    </div>
  )
}
