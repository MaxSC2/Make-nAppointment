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
  waiting: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  completed: 'bg-green-50 text-green-700 ring-green-200',
  cancelled: 'bg-gray-50 text-gray-500 ring-gray-200',
  planned: 'bg-purple-50 text-purple-700 ring-purple-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
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
