import { useState } from 'react'
import { useCabinets, useQueue } from '../hooks/useQueue'
import QueueTable from '../components/QueueTable'
import { QueueStats } from '../components/QueueStats'
import { useTranslation } from 'react-i18next'

export default function QueuePage() {
  const { t } = useTranslation()
  const { cabinets } = useCabinets()
  const [cabinet, setCabinet] = useState<string | undefined>(undefined)
  const { tickets, loading, error } = useQueue(cabinet, 10000)

  const selectedCabinet = cabinet ? cabinets.find(c => c.code === cabinet)?.name : undefined

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold dark:text-slate-100">{t('queue.title')}</h2>
        <select
          value={cabinet ?? ''}
          onChange={(e) => setCabinet(e.target.value || undefined)}
          className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">{t('queue.allCabinets')}</option>
          {cabinets.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      <QueueStats tickets={tickets} cabinetName={selectedCabinet} />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">{t('common.loading')}</div>
      ) : (
        <QueueTable tickets={tickets} />
      )}
    </div>
  )
}
