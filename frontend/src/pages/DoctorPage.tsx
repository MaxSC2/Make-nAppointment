import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCabinets } from '../hooks/useQueue'
import type { TicketDetail } from '../types/queue'
import * as queueApi from '../api/queue'
import { getPatients } from '../api/ris'
import QueueTable from '../components/QueueTable'
import { useTranslation } from 'react-i18next'
import { playCallSound } from '../utils/sound'

export default function DoctorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cabinets } = useCabinets()
  const [cabinetCode, setCabinetCode] = useState('1')
  const [tickets, setTickets] = useState<TicketDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [fillTicket, setFillTicket] = useState<TicketDetail | null>(null)
  const [fillName, setFillName] = useState('')
  const [fillPolicy, setFillPolicy] = useState('')
  const [fillIin, setFillIin] = useState('')
  const [saving, setSaving] = useState(false)
  const [iinFound, setIinFound] = useState('')

  const checkIIN = useCallback(async (iin: string) => {
    if (iin.length !== 12) { setIinFound(''); return }
    try {
      const patients = await getPatients(iin)
      const match = patients.find(p => p.iin === iin)
      if (match) {
        setIinFound(match.full_name)
        setFillName(match.full_name || fillName)
        setFillPolicy(match.policy_number || fillPolicy)
      } else {
        setIinFound('')
      }
    } catch { /* ignore */ }
  }, [fillName, fillPolicy])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await queueApi.getTickets(cabinetCode)
      setTickets(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorLoading'))
    } finally {
      setLoading(false)
    }
  }, [cabinetCode, t])

  useEffect(() => {
    const poll = async () => {
      await refresh()
      intervalRef.current = setTimeout(poll, 10000)
    }
    poll()
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [refresh])

  const handleCall = useCallback(async (ticket: TicketDetail) => {
    try {
      await queueApi.callTicket(ticket.sourceTicketId!)
      playCallSound()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('doctor.errorCall'))
    }
  }, [refresh, t])

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold dark:text-slate-100">{t('doctor.cabinetTitle')}</h2>
        <div className="flex items-center gap-3">
          <select
            value={cabinetCode}
            onChange={(e) => setCabinetCode(e.target.value)}
            className="border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-1.5 text-sm"
          >
            {cabinets.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={refresh}
            className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t('doctor.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">{error}</div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-slate-800 rounded-lg" />
        </div>
      ) : (
        <QueueTable
          tickets={tickets}
          onCall={handleCall}
          onComplete={handleComplete}
          onFillPatient={handleFillPatient}
          showActions
        />
      )}

      {fillTicket && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setFillTicket(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{t('doctor.fillPatientTitle')}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.patient')}</label>
                <input
                  value={fillName}
                  onChange={e => setFillName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder={t('doctor.fillNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.policy')}</label>
                <input
                  value={fillPolicy}
                  onChange={e => setFillPolicy(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="0000 000000 0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ИИН</label>
                <input
                  value={fillIin}
                  onChange={e => { setFillIin(e.target.value); checkIIN(e.target.value) }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  placeholder="000000000000"
                  maxLength={12}
                />
                {iinFound && (
                  <p className="mt-1 text-xs text-teal-600">✓ {t('registration.existingPatient')}: {iinFound}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setFillTicket(null)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
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
