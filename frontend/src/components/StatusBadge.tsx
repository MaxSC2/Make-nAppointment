import { useTranslation } from 'react-i18next'

const statusMap: Record<string, string> = {
  waiting: 'statusBadge.waiting',
  in_progress: 'statusBadge.inProgress',
  completed: 'statusBadge.completed',
  cancelled: 'statusBadge.cancelled',
  planned: 'statusBadge.planned',
  done: 'statusBadge.done',
}

const colors: Record<string, string> = {
  waiting: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 ring-yellow-200 dark:ring-yellow-800',
  in_progress: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-blue-200 dark:ring-blue-800',
  completed: 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-green-200 dark:ring-green-800',
  cancelled: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-gray-200 dark:ring-gray-700',
  planned: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-purple-200 dark:ring-purple-800',
  done: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-emerald-200 dark:ring-emerald-800',
}

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const key = statusMap[status]
  const label = key ? t(key) : status
  const color = colors[status] ?? 'bg-gray-50 text-gray-600 ring-gray-200'

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}>
      {label}
    </span>
  )
}
