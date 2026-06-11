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
  waiting: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:ring-yellow-800',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800',
  completed: 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-800',
  cancelled: 'bg-gray-50 text-gray-500 ring-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:ring-gray-700',
  planned: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-800',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800',
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
