import { useNavigate } from 'react-router-dom'
import type { TicketDetail } from '../types/queue'
import StatusBadge from './StatusBadge'

interface QueueTableProps {
  tickets: TicketDetail[]
  onCall?: (ticket: TicketDetail) => void
  onComplete?: (ticket: TicketDetail) => void
  showActions?: boolean
}

export default function QueueTable({ tickets, onCall, onComplete, showActions }: QueueTableProps) {
  const navigate = useNavigate()
  const firstWaitingIdx = tickets.findIndex(t => t.status === 'waiting')
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        Очередь пуста
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Талон</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Приоритет</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Пациент</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Полис</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Кабинет</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создан</th>
            {showActions && <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tickets.map((ticket, idx) => (
            <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">
                {ticket.ticket_number}
              </td>
              <td className="px-4 py-3">
                {ticket.priority === 'stat' && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-xs font-semibold rounded">
                    ЭКСТРЕННЫЙ
                  </span>
                )}
                {ticket.priority === 'urgent' && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded">
                    Срочный
                  </span>
                )}
                {!ticket.priority || ticket.priority === 'normal' ? (
                  <span className="text-xs text-gray-400">Плановый</span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-sm text-gray-700">{ticket.patient.full_name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{ticket.patient.policy_number}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{ticket.cabinet.name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={ticket.status} />
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(ticket.created_at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              {showActions && (
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => navigate(`/patients/${ticket.patient_id}`)}
                    className="text-sm bg-white text-teal-600 border border-teal-300 px-3 py-1 rounded hover:bg-teal-50 transition-colors"
                  >
                    Карта пациента
                  </button>
                  {ticket.status === 'waiting' && onCall && firstWaitingIdx === idx && (
                    <button
                      onClick={() => onCall(ticket)}
                      className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                      Вызвать
                    </button>
                  )}
                  {ticket.status === 'in_progress' && onComplete && (
                    <button
                      onClick={() => onComplete(ticket)}
                      className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                    >
                      Завершить
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
