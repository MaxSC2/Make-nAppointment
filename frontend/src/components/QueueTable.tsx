import { useNavigate } from 'react-router-dom'
import type { TicketDetail } from '../types/queue'
import StatusBadge from './StatusBadge'
import { useTranslation } from 'react-i18next'

interface QueueTableProps {
  tickets: TicketDetail[]
  onCall?: (ticket: TicketDetail) => void
  onComplete?: (ticket: TicketDetail) => void
  onFillPatient?: (ticket: TicketDetail) => void
  showActions?: boolean
}

export default function QueueTable({ tickets, onCall, onComplete, onFillPatient, showActions }: QueueTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const firstWaitingIdx = tickets.findIndex(t => t.status === 'waiting')
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        {t('queue.empty')}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
        <thead className="bg-gray-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('queue.ticket')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.priority')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('queue.serviceType')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.patient')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.policy')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.cabinet')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.created')}</th>
            {showActions && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
          {tickets.map((ticket, idx) => (
            <tr key={ticket.sourceTicketId ?? ticket.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
              <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900 dark:text-slate-100">
                {ticket.ticket_number}
              </td>
              <td className="px-4 py-3">
                {ticket.priority === 'stat' && (
                  <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded">
                    {t('queue.emergency')}
                  </span>
                )}
                {ticket.priority === 'urgent' && (
                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold rounded">
                    {t('queue.urgent')}
                  </span>
                )}
                {!ticket.priority || ticket.priority === 'normal' ? (
                  <span className="text-xs text-gray-400 dark:text-slate-500">{t('queue.planned')}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{ticket.service_type_name || ticket.cabinet.modality || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{ticket.patient.full_name}</td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">{ticket.patient.policy_number}</td>
              <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{ticket.cabinet.name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                {new Date(ticket.created_at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              {showActions && (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    <button
                      onClick={() => navigate(`/patients/${ticket.patient_id}`)}
                      disabled={!ticket.patient_id}
                      title={!ticket.patient_id ? t('queue.externalNoCard') : t('queue.patientCard')}
                      className="text-xs bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 border border-teal-300 dark:border-teal-700 px-2 py-1 rounded hover:bg-teal-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {t('queue.patientCard')}
                    </button>
                    {ticket.status === 'waiting' && onCall && firstWaitingIdx === idx && (
                      <button
                        onClick={() => onCall(ticket)}
                        className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 transition-colors font-medium"
                      >
                        {t('queue.call')}
                      </button>
                    )}
                    {ticket.status === 'in_progress' && (
                      <>
                        {!ticket.patient.full_name && onFillPatient && (
                          <button
                            onClick={() => onFillPatient(ticket)}
                            className="text-xs bg-amber-500 text-white px-2.5 py-1 rounded hover:bg-amber-600 transition-colors font-medium"
                          >
                            {t('queue.fillPatient')}
                          </button>
                        )}
                        {ticket.study_uid && (
                          <button
                            onClick={() => navigate(`/viewer/${ticket.study_uid}`)}
                            className="text-xs bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-slate-600 transition-colors"
                          >
                            {t('queue.view')}
                          </button>
                        )}
                        {onComplete && (
                          <button
                            onClick={() => onComplete(ticket)}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded hover:bg-green-700 transition-colors font-medium"
                          >
                            {t('queue.complete')}
                          </button>
                        )}
                      </>
                    )}
                    {ticket.status === 'done' && ticket.order_id && (
                      <button
                        onClick={() => navigate(`/protocol/${ticket.order_id}`)}
                        className="text-xs bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-slate-600 transition-colors"
                      >
                        {t('queue.protocol')}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
