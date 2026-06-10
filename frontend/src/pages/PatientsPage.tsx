import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPatients } from '../api/ris'
import type { PatientOut } from '../types/queue'
import { useTranslation } from 'react-i18next'

export default function PatientsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [patients, setPatients] = useState<PatientOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      getPatients(search || undefined)
        .then(data => { if (!cancelled) setPatients(data) })
        .catch(err => { if (!cancelled) setError(err.message) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t('patients.title')}</h1>
      <p className="text-sm text-slate-500 mb-4">{t('patients.searchPlaceholder')}</p>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t('patients.searchPlaceholderShort')}
        className="w-full px-4 py-2 border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
      />

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          <div className="font-medium">{t('patients.error')}</div>
          <div className="text-sm">{error}</div>
          <button
            onClick={() => setSearch(s => s)}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {!loading && !error && patients.length === 0 && (
        <div className="text-center text-slate-500 py-12 bg-slate-50 rounded-lg">
          {t('patients.empty')}
        </div>
      )}

      {!loading && !error && patients.length > 0 && (
        <div className="space-y-2">
          {patients.map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/patients/${p.id}`)}
              className="w-full text-left bg-white border border-slate-200 rounded-lg p-4 hover:border-teal-500 hover:shadow-sm transition"
            >
              <div className="font-medium text-slate-900">{p.full_name}</div>
              <div className="text-sm text-slate-500 mt-1">
                {t('patients.policy')} {p.policy_number}
                {p.birth_date && ` ${t('patients.dob')} ${p.birth_date}`}
                {p.phone && ` · ${p.phone}`}
              </div>
              <div className="text-xs text-teal-600 mt-2">{t('patients.openCard')}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
