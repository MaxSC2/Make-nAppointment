import { useNavigate } from 'react-router-dom'
import type { OrderOut } from '../types/ris'
import StatusBadge from './StatusBadge'
import { ViewerIcon, ProtocolIcon, PatientIcon } from './Icons'
import { useTranslation } from 'react-i18next'

interface OrderCardProps {
  order: OrderOut
  onClick?: (order: OrderOut) => void
  onCall?: (order: OrderOut) => void
  showCreatedBy?: boolean
  compact?: boolean
}

const priorityColors: Record<string, string> = {
  stat: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-800',
  urgent: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800',
  normal: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600',
}

export default function OrderCard({ order, onClick, onCall, showCreatedBy, compact }: OrderCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const priorityClass = priorityColors[order.priority ?? 'normal'] ?? priorityColors.normal
  const canCall = order.status === 'scheduled' && onCall
  const canView = !!order.study_uid
  const canProtocol = !!order.id
  const canPatient = !!order.patient_id

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-2 ${
        onClick ? 'cursor-pointer hover:shadow-md dark:hover:shadow-slate-900/50 hover:border-brand-300 dark:hover:border-brand-600 transition-all' : ''
      }`}
      onClick={() => onClick?.(order)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">#{order.id.slice(0, 8)}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${priorityClass}`}>
              {order.priority ?? 'normal'}
            </span>
          </div>
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1 truncate">
            {order.study_description || t('orderCard.noDescription')}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {order.modality && (
          <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-medium">
            {order.modality}
          </span>
        )}
        {order.cabinet_name && (
          <span className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
            {order.cabinet_name}
          </span>
        )}
      </div>

      {order.patient_id && (
        <button
          onClick={e => { e.stopPropagation(); navigate(`/patients/${order.patient_id}`) }}
          className="text-xs text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 truncate text-left"
          title={order.patient_name || ''}
        >
          👤 {order.patient_name || t('orderCard.noName')}
        </button>
      )}

      {showCreatedBy && order.created_by_username && (
        <div className="text-[11px] text-slate-400 dark:text-slate-500">
          {t('orderCard.createdBy')} <span className="font-medium">@{order.created_by_username}</span>
        </div>
      )}

      {order.scheduled_for && (
        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          🕐 {new Date(order.scheduled_for).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {order.status === 'cancelled' && order.cancellation_reason && (
        <div className="text-[11px] bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-2 py-1 rounded">
          ❌ {t('orderCard.cancelledReason')}: {order.cancellation_reason}
        </div>
      )}

      {!compact && (
        <div className="flex items-center gap-1 mt-1 pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="text-[10px] text-slate-400 dark:text-slate-500 flex-1">
            {new Date(order.created_at).toLocaleDateString('ru-RU')}
          </div>
          {canCall && (
            <button
              onClick={e => { e.stopPropagation(); onCall!(order) }}
              className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium flex items-center gap-1"
              title={t('orderCard.callHint')}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              {t('orderCard.call')}
            </button>
          )}
          {canView && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/viewer/${order.study_uid}`) }}
              className="px-2 py-1 text-[11px] bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50 transition flex items-center gap-1"
              title={t('orderCard.view')}
            >
              <ViewerIcon /> {t('orderCard.view')}
            </button>
          )}
          {canProtocol && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/protocol/${order.id}`) }}
              className="px-2 py-1 text-[11px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition flex items-center gap-1"
              title={t('orderCard.protocol')}
            >
              <ProtocolIcon /> {t('orderCard.protocol')}
            </button>
          )}
          {canPatient && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/patients/${order.patient_id}`) }}
              className="px-2 py-1 text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-1"
              title={t('orderCard.patient')}
            >
              <PatientIcon /> {t('orderCard.patient')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
