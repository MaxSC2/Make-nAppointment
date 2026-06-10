import { useState } from 'react'
import QueueTable from '../components/QueueTable'
import QueueStats from '../components/QueueStats'
import { useCabinets } from '../hooks/useQueue'
import { useTranslation } from 'react-i18next'

export default function QueuePage() {
  const { cabinets } = useCabinets()
  const [cabinet, setCabinet] = useState('')
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('queue.title')}</h1>
      <QueueStats cabinetCode={cabinet} />
      <div className="flex items-center gap-3">
        <select
          value={cabinet}
          onChange={(e) => setCabinet(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          <option value="">{t('queue.allCabinets')}</option>
          {cabinets.map((c) => (
            <option key={c.id} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>
      <QueueTable cabinet={cabinet} />
    </div>
  )
}
