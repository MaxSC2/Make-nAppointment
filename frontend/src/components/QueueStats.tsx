import { useMemo } from 'react'
import type { TicketDetail } from '../types/queue'

interface QueueStatsProps {
  tickets: TicketDetail[]
  cabinetName?: string
}

export function QueueStats({ tickets, cabinetName }: QueueStatsProps) {
  const stats = useMemo(() => {
    const waiting = tickets.filter(t => t.status === 'waiting').length
    const inProgress = tickets.filter(t => t.status === 'in_progress').length
    const done = tickets.filter(t => t.status === 'done').length
    const cancelled = tickets.filter(t => t.status === 'cancelled').length
    return { total: tickets.length, waiting, inProgress, done, cancelled }
  }, [tickets])

  const items = [
    { key: 'total', label: 'Всего', value: stats.total, color: 'bg-slate-50 text-slate-700 border-slate-200' },
    { key: 'waiting', label: 'Ожидают', value: stats.waiting, color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { key: 'in_progress', label: 'В работе', value: stats.inProgress, color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: 'done', label: 'Завершено', value: stats.done, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { key: 'cancelled', label: 'Отменено', value: stats.cancelled, color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ]

  return (
    <div className="mb-4">
      <div className="text-xs text-slate-500 mb-2">
        {cabinetName ? `Статистика по кабинету "${cabinetName}"` : 'Статистика по всем кабинетам'}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {items.map(item => (
          <div
            key={item.key}
            className={`border rounded-lg p-3 ${item.color}`}
          >
            <div className="text-2xl font-bold leading-none">{item.value}</div>
            <div className="text-xs mt-1 font-medium">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
