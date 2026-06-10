import { useQueue } from '../hooks/useQueue'
import StatusBadge from './StatusBadge'
import { useTranslation } from 'react-i18next'

export default function QueueTable({ cabinet }: { cabinet: string }) {
  const { tickets, loading, error, callNext, complete } = useQueue(cabinet)
  const { t } = useTranslation()

  if (loading) {
    return <div className="text-sm text-gray-500">{t('common.loading')}</div>
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{t('common.error')}: {error}</div>
  }

  if (!tickets.length) {
    return <div className="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-400">{t('queue.empty')}</div>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('queue.ticket')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.priority')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.patient')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.policy')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.cabinet')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.status')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.created')}</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {tickets.map((ticket) => {
            const isExternal = ticket.id > 10000
            return (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{ticket.ticket_number || ticket.id}</td>
                <td className="px-4 py-3">
                  {ticket.priority === 'emergency' ? (
                    <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">{t('queue.emergency')}</span>
                  ) : ticket.priority === 'urgent' ? (
                    <span className="text-xs font-medium text-amber-600">{t('queue.urgent')}</span>
                  ) : (
                    <span className="text-xs text-gray-500">{t('queue.planned')}</span>
                  )}
                </td>
                <td className="px-4 py-3">{ticket.patient_name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{ticket.policy_number ?? '—'}</td>
                <td className="px-4 py-3">{ticket.cabinet_code}</td>
                <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                <td className="px-4 py-3 text-gray-500">{new Date(ticket.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {isExternal ? (
                      <span
                        title={t('queue.externalNoCard')}
                        className="cursor-default text-xs text-gray-400 underline decoration-dotted"
                      >
                        {t('queue.patientCard')}
                      </span>
                    ) : (
                      <a
                        href={`/frontend/patient-card/${ticket.patient_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {t('queue.patientCard')}
                      </a>
                    )}
                    {ticket.status === 'waiting' && (
                      <button
                        onClick={() => callNext(ticket.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                      >
                        {t('queue.call')}
                      </button>
                    )}
                    {ticket.status === 'in_progress' && (
                      <button
                        onClick={() => complete(ticket.id)}
                        className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700"
                      >
                        {t('queue.complete')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
