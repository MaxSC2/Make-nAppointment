import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { PatientOut } from '../types/queue'
import * as risApi from '../api/ris'

export default function PatientsPage() {
  const navigate = useNavigate()
  const [patients, setPatients] = useState<PatientOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      risApi.getPatients(search || undefined)
        .then(data => { if (!cancelled) { setPatients(data); setLoading(false) } })
        .catch(err => { if (!cancelled) { setError(err.message); setLoading(false) } })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Пациенты</h1>

      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Поиск по ФИО или номеру полиса..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg
                     text-sm focus:outline-none focus:border-teal-500 bg-white"
        />
        <svg className="absolute left-3 top-3 w-4 h-4 text-gray-400"
             fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <path strokeLinecap="round" d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-600 mb-3">{error}</p>
          <button
            onClick={() => setSearch(s => s)}
            className="text-teal-600 underline text-sm">
            Повторить
          </button>
        </div>
      )}

      {!loading && !error && patients.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-4 text-gray-300">👤</div>
          <p className="text-lg font-medium mb-2">
            {search ? 'Пациентов не найдено' : 'Список пуст'}
          </p>
          <p className="text-sm">
            {search
              ? 'Попробуйте изменить запрос'
              : 'Зарегистрируйте пациента на странице Регистрации'}
          </p>
        </div>
      )}

      {!loading && !error && patients.length > 0 && (
        <div className="space-y-3">
          {patients.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/patients/${p.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-4
                         hover:border-teal-400 hover:shadow-sm cursor-pointer
                         transition-all flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center
                              justify-center text-teal-700 font-bold text-lg flex-shrink-0">
                {p.full_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">
                  {p.full_name}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  Полис: {p.policy_number}
                  {p.birth_date && (
                    <span> · {new Date(p.birth_date).toLocaleDateString('ru-RU')}</span>
                  )}
                  {p.phone && <span> · {p.phone}</span>}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
