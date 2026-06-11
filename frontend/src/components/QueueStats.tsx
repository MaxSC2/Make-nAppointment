import { useMemo } from 'react'
import type { TicketDetail } from '../types/queue'
import { useTranslation } from 'react-i18next'

interface QueueStatsProps {
  tickets: TicketDetail[]
  cabinetName?: string
}

export function QueueStats({ tickets, cabinetName }: QueueStatsProps) {
  const { t } = useTranslation()
  const stats = useMemo(() => {
    const waiting = tickets.filter(t => t.status === 'waiting').length
    const inProgress = tickets.filter(t => t.status === 'in_progress').length
    const done = tickets.filter(t => t.status === 'done').length
    const cancelled = tickets.filter(t => t.status === 'cancelled').length
    return { total: tickets.length, waiting, inProgress, done, cancelled }
  }, [tickets])

  const items = [
    { key: 'total', label: t('stats.total'), value: stats.total, color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
    { key: 'waiting', label: t('stats.waiting'), value: stats.waiting, color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
    { key: 'in_progress', label: t('stats.inProgress'), value: stats.inProgress, color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
    { key: 'done', label: t('stats.completed'), value: stats.done, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
    { key: 'cancelled', label: t('stats.cancelled'), value: stats.cancelled, color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' },
  ]

  return (
    <div className="mb-4">
      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        {cabinetName ? t('stats.forCabinet', { name: cabinetName }) : t('stats.forAll')}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
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
