import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCabinets } from '../hooks/useQueue'
import type { TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import { getPatients } from '../api/ris'
import { useTranslation } from 'react-i18next'
import { playCallSound } from '../utils/sound'
import { BellIcon, MuteIcon, NextIcon } from '../components/Icons'

type StatusFilter = 'all' | 'waiting' | 'in_progress'

function formatWaitingTime(createdAt: string, t: (k: string) => string): { label: string; minutes: number; tone: 'fresh' | 'normal' | 'long' | 'verylong' } {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - created)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return { label: t('doctor.justNow'), minutes, tone: 'fresh' }
  if (minutes < 60) return { label: `${minutes} ${t('doctor.minutes')}`, minutes, tone: minutes < 5 ? 'fresh' : minutes < 15 ? 'normal' : 'long' }
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return { label: `${hours}${t('doctor.hours')} ${remMin > 0 ? remMin + t('doctor.minutes') : ''}`.trim(), minutes, tone: 'verylong' }
}

const waitingToneColors: Record<string, string> = {
  fresh: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  normal: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  long: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  verylong: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
}

const priorityCardColors: Record<string, string> = {
  stat: 'ring-2 ring-rose-400 dark:ring-rose-500 bg-rose-50/30 dark:bg-rose-950/20',
  urgent: 'ring-2 ring-amber-300 dark:ring-amber-500',
  normal: '',
}

export default function DoctorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cabinets } = useCabinets()
  const [cabinetCode, setCabinetCode] = useState('1')
  const [tickets, setTickets] = useState<TicketDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [fillTicket, setFillTicket] = useState<TicketDetail | null>(null)
  const [fillName, setFillName] = useState('')
  const [fillPolicy, setFillPolicy] = useState('')
  const [fillIin, setFillIin] = useState('')
  const [saving, setSaving] = useState(false)
  const [iinFound, setIinFound] = useState('')
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTicketIds = useRef<Set<string>>(new Set())

  // === IIN lookup ===
  const checkIIN = useCallback(async (iin: string) => {
    if (iin.length !== 12) { setIinFound(''); return }
    try {
      const patients = await getPatients(iin)
      const match = patients.find(p => p.iin === iin)
      if (match) {
        setIinFound(match.full_name)
        setFillName(prev => prev || match.full_name || '')
        setFillPolicy(prev => prev || match.policy_number || '')
      } else {
        setIinFound('')
      }
    } catch { /* ignore */ }
  }, [])

  // === Refresh ===
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await queueApi.getTickets(cabinetCode)
      // Автозвук: если появился новый ticket в 'in_progress' — играем
      const newIds = new Set(data.map(t => t.sourceTicketId ?? t.id))
      const oldIds = lastTicketIds.current
      for (const t of data) {
        if ((t.status === 'in_progress' || t.status === 'called') && !oldIds.has(t.sourceTicketId ?? t.id)) {
          if (soundOn) playCallSound()
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(t('doctor.nextPatient'), { body: t.patient.full_name || t.ticket_number })
          }
          break
        }
      }
      lastTicketIds.current = newIds
      setTickets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorLoading'))
    } finally {
      setLoading(false)
    }
  }, [cabinetCode, soundOn, t])

  // === Auto-refresh ===
  useEffect(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current)
      intervalRef.current = null
    }
    if (!autoRefresh) return

    const poll = async () => {
      await refresh()
      intervalRef.current = setTimeout(poll, 10000)
    }
    poll()
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [refresh, autoRefresh])

  // === Cabinet default ===
  useEffect(() => {
    if (cabinets.length > 0 && !cabinets.find(c => c.code === cabinetCode)) {
      setCabinetCode(cabinets[0].code)
    }
  }, [cabinets, cabinetCode])

  // === Stats ===
  const stats = useMemo(() => {
    const waiting = tickets.filter(t => t.status === 'waiting').length
    const inProgress = tickets.filter(t => t.status === 'in_progress').length
    const completedToday = tickets.filter(t => t.status === 'completed' || t.status === 'done').length
    return { waiting, inProgress, completedToday }
  }, [tickets])

  // === Filtered tickets ===
  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return tickets
    return tickets.filter(t => t.status === statusFilter)
  }, [tickets, statusFilter])

  // === First waiting ticket (for "Next" button) ===
  const nextWaiting = useMemo(() => {
    return tickets.find(t => t.status === 'waiting')
  }, [tickets])

  // === Handlers ===
  const handleCall = useCallback(async (ticket: TicketDetail) => {
    try {
      await queueApi.callTicket(ticket.sourceTicketId!)
      if (soundOn) playCallSound()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorCall'))
    }
  }, [refresh, soundOn, t])

  const handleCallNext = useCallback(async () => {
    if (!nextWaiting) return
    await handleCall(nextWaiting)
  }, [nextWaiting, handleCall])

  const handleComplete = useCallback(async (ticket: TicketDetail) => {
    try {
      const result = await queueApi.completeTicket(ticket.sourceTicketId!)
      if (result.order_id) {
        navigate(`/protocol/${result.order_id}`)
      } else {
        await refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorComplete'))
    }
  }, [refresh, t, navigate])

  const handleFillPatient = useCallback((ticket: TicketDetail) => {
    setFillTicket(ticket)
    setFillName(ticket.patient.full_name || '')
    setFillPolicy(ticket.patient.policy_number || '')
    setFillIin(ticket.patient.iin || '')
  }, [])

  const handleSavePatient = useCallback(async () => {
    if (!fillTicket?.sourceTicketId || !fillName.trim()) return
    setSaving(true)
    try {
      await queueApi.updateTicketPatient(fillTicket.sourceTicketId, fillName.trim(), fillPolicy.trim(), fillIin.trim())
      setFillTicket(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorSavePatient'))
    } finally {
      setSaving(false)
    }
  }, [fillTicket, fillName, fillPolicy, fillIin, refresh, t])

  // === Keyboard shortcuts ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (fillTicket) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (nextWaiting) handleCall(nextWaiting)
      } else if (e.code === 'Enter') {
        e.preventDefault()
        const inProgress = tickets.find(t => t.status === 'in_progress')
        if (inProgress) handleComplete(inProgress)
      } else if (e.key === '?' || e.key === '/') {
        e.preventDefault()
        setShowShortcuts(s => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nextWaiting, tickets, fillTicket, handleCall, handleComplete])

  // === Request notification permission on mount ===
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-semibold dark:text-slate-100">{t('doctor.cabinetTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('doctor.cabinetSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cabinets.length === 0 ? (
            <span className="text-sm text-amber-600 dark:text-amber-400">{t('doctor.noCabinets')}</span>
          ) : (
            <select
              value={cabinetCode}
              onChange={(e) => setCabinetCode(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {cabinets.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={handleCallNext}
            disabled={!nextWaiting}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('doctor.nextHint')}
          >
            <NextIcon /> {t('doctor.next')}
          </button>
          <button
            onClick={refresh}
            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title={t('doctor.refresh')}
          >
            ↻
          </button>
          <button
            onClick={() => setSoundOn(s => !s)}
            className="px-2 py-1.5 rounded-md text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title={soundOn ? t('doctor.soundOn') : t('doctor.soundOff')}
          >
            {soundOn ? <BellIcon /> : <MuteIcon />}
          </button>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition ${
              autoRefresh
                ? 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}
            title={t('doctor.autoRefresh')}
          >
            {autoRefresh ? t('doctor.autoRefreshOn') : t('doctor.autoRefreshOff')}
          </button>
          <button
            onClick={() => setShowShortcuts(s => !s)}
            className="px-2 py-1.5 rounded-md text-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            title={t('doctor.shortcuts')}
          >
            ?
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
          <div className="text-2xl">⏳</div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.waiting}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('doctor.stats.waiting')}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
          <div className="text-2xl">🩺</div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.inProgress}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('doctor.stats.inProgress')}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex items-center gap-3">
          <div className="text-2xl">✅</div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.completedToday}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('doctor.stats.completedToday')}</div>
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">{t('doctor.filter')}:</span>
        {(['all', 'waiting', 'in_progress'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition ${
              statusFilter === s
                ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 ring-1 ring-brand-300 dark:ring-brand-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {s === 'all' ? t('doctor.allStatuses') : s === 'waiting' ? t('doctor.waiting') : t('doctor.inProgress')}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {showShortcuts && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md text-sm">
          <div className="font-medium text-indigo-900 dark:text-indigo-200 mb-1">{t('doctor.shortcuts')}:</div>
          <ul className="text-indigo-800 dark:text-indigo-300 text-xs space-y-0.5">
            <li>• <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-xs font-mono">Space</kbd> — {t('doctor.shortcutCall')}</li>
            <li>• <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-xs font-mono">Enter</kbd> — {t('doctor.shortcutComplete')}</li>
            <li>• <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-xs font-mono">?</kbd> — toggle this help</li>
          </ul>
        </div>
      )}

      {/* Content */}
      {loading && tickets.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="text-5xl mb-3">🏥</div>
          <h3 className="text-slate-700 dark:text-slate-300 font-medium">{t('doctor.empty')}</h3>
          <button
            onClick={() => navigate('/')}
            className="mt-4 inline-flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-teal-700 transition"
          >
            {t('doctor.emptyAction')}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTickets.map((ticket) => {
            const waitInfo = formatWaitingTime(ticket.created_at, t)
            const priorityClass = priorityCardColors[ticket.priority] ?? ''
            return (
              <div
                key={ticket.id}
                className={`bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-3 ${priorityClass}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="font-mono text-sm text-slate-500 dark:text-slate-400">#{ticket.ticket_number}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded uppercase ${
                    ticket.priority === 'stat' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' :
                    ticket.priority === 'urgent' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {ticket.priority}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {ticket.patient.full_name || '—'}
                  </span>
                  {ticket.patient.iin && (
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                      {ticket.patient.iin}
                    </span>
                  )}
                  {ticket.modality && (
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                      {ticket.modality}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${waitingToneColors[waitInfo.tone]}`}>
                    🕐 {t('doctor.waitingTime')} {waitInfo.label}
                  </span>
                  {ticket.status === 'waiting' && (
                    <button
                      onClick={() => handleCall(ticket)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                    >
                      📞 {t('queue.call')}
                    </button>
                  )}
                  {ticket.status === 'in_progress' && (
                    <button
                      onClick={() => handleComplete(ticket)}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition font-medium"
                    >
                      ✅ {t('queue.complete')}
                    </button>
                  )}
                  {(!ticket.patient.full_name || !ticket.patient.iin) && (
                    <button
                      onClick={() => handleFillPatient(ticket)}
                      className="px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                    >
                      👤 {t('queue.fillPatient')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fill patient modal */}
      {fillTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setFillTicket(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 dark:text-slate-100">{t('doctor.fillPatientTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.patient')}</label>
                <input
                  value={fillName}
                  onChange={e => setFillName(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder={t('doctor.fillNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('common.policy')}</label>
                <input
                  value={fillPolicy}
                  onChange={e => setFillPolicy(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0000 000000 0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ИИН</label>
                <input
                  value={fillIin}
                  onChange={e => { setFillIin(e.target.value); checkIIN(e.target.value) }}
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="000000000000"
                  maxLength={12}
                />
                {iinFound && (
                  <p className="mt-1 text-xs text-teal-600 dark:text-teal-400">✓ {t('registration.existingPatient')}: {iinFound}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setFillTicket(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSavePatient}
                disabled={saving || !fillName.trim()}
                className="px-4 py-2 text-sm text-white bg-amber-500 rounded-md hover:bg-amber-600 disabled:opacity-50"
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
