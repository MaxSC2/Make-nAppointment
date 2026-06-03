const STATUS_STYLES: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  scheduled: 'bg-gray-100 text-gray-800',
  completed: 'bg-green-100 text-green-800',
}

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Ожидание',
  in_progress: 'В работе',
  done: 'Завершён',
  cancelled: 'Отменён',
  scheduled: 'Запланирован',
  completed: 'Выполнен',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'
  const label = STATUS_LABELS[status] || status

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}>
      {label}
    </span>
  )
}
