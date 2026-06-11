import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getStatsSummary,
  getStatsByModality,
  getStatsByCabinet,
  getStatsPhysicians,
  type StatsSummary,
  type ModalityStat,
  type CabinetStat,
  type PhysicianStat,
} from '../api/ris'


function StatCard({
  label, value, hint, color = 'slate',
}: {
  label: string
  value: string | number
  hint?: string
  color?: 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'teal'
}) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
  }
  return (
    <div className={`border rounded-lg p-4 ${colorMap[color]}`}>
      <div className="text-3xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-2 font-medium uppercase tracking-wide">{label}</div>
      {hint && <div className="text-xs mt-1 opacity-70">{hint}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'blue' }: { value: number; max: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${colorMap[color]} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-slate-600 tabular-nums w-16 text-right">{value} / {max}</span>
    </div>
  )
}

export default function MonitoringPage() {
  const { t } = useTranslation()
  const [summary, setSummary] = useState<StatsSummary | null>(null)
  const [byModality, setByModality] = useState<ModalityStat[]>([])
  const [byCabinet, setByCabinet] = useState<CabinetStat[]>([])
  const [physicians, setPhysicians] = useState<PhysicianStat[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [s, m, c, p] = await Promise.all([
          getStatsSummary(),
          getStatsByModality(),
          getStatsByCabinet(),
          getStatsPhysicians(),
        ])
        if (cancelled) return
        setSummary(s)
        setByModality(m.items)
        setByCabinet(c.items)
        setPhysicians(p.items)
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('monitoring.error'))
          setLoading(false)
        }
      }
    })()
    const id = setInterval(() => {
      getStatsSummary().then(setSummary).catch(() => {})
    }, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (loading) {
    return <div className="text-center py-12 text-slate-400">{t('monitoring.loading')}</div>
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
        <div className="font-medium mb-1">{t('monitoring.error')}</div>
        <div className="text-sm">{error}</div>
      </div>
    )
  }

  if (!summary) return null

  const maxModality = byModality.reduce((m, s) => Math.max(m, s.week), 0)
  const maxCabinet = byCabinet.reduce((m, s) => Math.max(m, s.waiting + s.in_progress), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">{t('monitoring.title')}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('monitoring.subtitle')}
          </p>
        </div>
      </div>

      {/* Главные KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t('monitoring.ordersToday')}
          value={summary.orders_today}
          hint={`${t('monitoring.ordersWeek')} ${summary.orders_week}`}
          color="blue"
        />
        <StatCard
          label={t('monitoring.completedToday')}
          value={summary.completed_today}
          hint={`${t('monitoring.ordersWeek')} ${summary.completed_week}`}
          color="emerald"
        />
        <StatCard
          label={t('monitoring.inProgress')}
          value={summary.in_progress}
          hint={`${t('monitoring.inProgressAssigned')} ${summary.scheduled}`}
          color="amber"
        />
        <StatCard
          label={t('monitoring.inQueue')}
          value={summary.tickets_waiting}
          hint={`${t('monitoring.inQueueTotal')} ${summary.patients_total}`}
          color="teal"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label={t('monitoring.protocolsSigned')}
          value={summary.signed_protocols_today}
          hint={t('monitoring.protocolsToday')}
          color="emerald"
        />
        <StatCard
          label={t('monitoring.avgProcessing')}
          value={summary.avg_completion_minutes_week > 0
            ? t('monitoring.avgMinutes', { time: summary.avg_completion_minutes_week })
            : '—'}
          hint={t('monitoring.avgDescription')}
          color="slate"
        />
        <StatCard
          label={t('monitoring.completionRate')}
          value={summary.orders_week > 0
            ? `${Math.round((summary.completed_week / summary.orders_week) * 100)}%`
            : '—'}
          hint={`${t('monitoring.completionOf')} ${summary.completed_week} ${t('monitoring.completionWeek')}`}
          color="emerald"
        />
      </div>

      {/* По модальностям */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">
          {t('monitoring.ordersByModality')}
        </h3>
        {byModality.length === 0 ? (
          <div className="text-slate-400 text-sm">{t('monitoring.noData')}</div>
        ) : (
          <div className="space-y-3">
            {byModality.map(m => (
              <div key={m.modality}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{m.modality}</span>
                  <span className="text-xs text-slate-500">
                    {t('monitoring.today')} <b>{m.today}</b> {t('monitoring.week')} {m.week} {t('monitoring.ready')} {m.completed}
                  </span>
                </div>
                <ProgressBar value={m.week} max={maxModality} color="blue" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* По кабинетам */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">
          {t('monitoring.cabinetLoad')}
        </h3>
        {byCabinet.length === 0 ? (
          <div className="text-slate-400 text-sm">{t('monitoring.noCabinets')}</div>
        ) : (
          <div className="space-y-3">
            {byCabinet.map(c => (
              <div key={c.code} className="grid grid-cols-[120px_1fr] gap-3 items-center">
                <div>
                  <div className="text-sm font-medium text-slate-700">{c.name}</div>
                  <div className="text-xs text-slate-500">{c.modality}</div>
                </div>
                <ProgressBar
                  value={c.waiting + c.in_progress}
                  max={Math.max(maxCabinet, 1)}
                  color={c.waiting > 5 ? 'rose' : c.waiting > 0 ? 'amber' : 'emerald'}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Активность врачей */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">
          {t('monitoring.doctorActivity')}
        </h3>
        {physicians.length === 0 ? (
          <div className="text-slate-400 text-sm">{t('monitoring.noActivity')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                  <th className="text-left py-2 font-medium">{t('monitoring.doctor')}</th>
                  <th className="text-right py-2 font-medium">{t('monitoring.orders')}</th>
                  <th className="text-right py-2 font-medium">{t('monitoring.signatures')}</th>
                </tr>
              </thead>
              <tbody>
                {physicians.map(p => (
                  <tr key={p.user_id} className="border-b border-slate-100">
                    <td className="py-2">
                      <div className="font-medium text-slate-900">{p.full_name}</div>
                      <div className="text-xs text-slate-500">@{p.username}</div>
                    </td>
                    <td className="text-right tabular-nums font-medium text-slate-900">
                      {p.orders_week}
                    </td>
                    <td className="text-right tabular-nums font-medium text-emerald-700">
                      {p.protocols_signed_week}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
