import { useQueue } from '../hooks/useQueue'
import { useTranslation } from 'react-i18next'

export default function QueueStats({ cabinetCode }: { cabinetCode: string }) {
  const { tickets } = useQueue(cabinetCode)
  const { t } = useTranslation()

  const total = tickets.length
  const waiting = tickets.filter((t) => t.status === 'waiting').length
  const inProgress = tickets.filter((t) => t.status === 'in_progress').length
  const completed = tickets.filter((t) => t.status === 'completed').length
  const cancelled = tickets.filter((t) => t.status === 'cancelled').length
  const cabinetName = cabinetCode

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        {cabinetCode ? t('stats.forCabinet', { name: cabinetName }) : t('stats.forAll')}
      </h2>
      <div className="grid grid-cols-5 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500">{t('stats.total')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{waiting}</div>
          <div className="text-xs text-gray-500">{t('stats.waiting')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
          <div className="text-xs text-gray-500">{t('stats.inProgress')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{completed}</div>
          <div className="text-xs text-gray-500">{t('stats.completed')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-400">{cancelled}</div>
          <div className="text-xs text-gray-500">{t('stats.cancelled')}</div>
        </div>
      </div>
    </div>
  )
}
