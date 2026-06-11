import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteOrthancStudy, getStudiesList, linkStudy, listSingleSliceStudies, type SingleSliceStudy } from '../api/ris'
import type { StudyListItem } from '../types/ris'
import { useTranslation } from 'react-i18next'
import { ViewerIcon, ProtocolIcon } from '../components/Icons'

const MODALITY_FILTERS = [
  { value: '', key: 'studies.allModalities' },
  { value: 'CT', key: 'studies.ct' },
  { value: 'MR', key: 'studies.mr' },
  { value: 'DX', key: 'studies.xray' },
  { value: 'US', key: 'studies.us' },
] as const

export default function StudiesPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [studies, setStudies] = useState<StudyListItem[]>([])
  const [modality, setModality] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupItems, setCleanupItems] = useState<SingleSliceStudy[]>([])
  const [cleanupSelected, setCleanupSelected] = useState<Set<string>>(new Set())
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupDeleting, setCleanupDeleting] = useState(false)
  const [cleanupError, setCleanupError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStudiesList(modality || undefined)
      setStudies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('studies.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleLink = async (s: StudyListItem) => {
    if (!s.modality) {
      setError(t('studies.unknownModality'))
      return
    }
    if (!confirm(t('studies.linkStudy', { studyId: s.patient_name_dicom || s.orthanc_id.slice(0, 8) }))) {
      return
    }
    setLinkingId(s.orthanc_id)
    setError(null)
    try {
      const res = await linkStudy(s.orthanc_id, {
        modality_code: s.modality,
        referring_physician: undefined,
      })
      navigate(`/protocol/${res.order_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('studies.linkError'))
    } finally {
      setLinkingId(null)
    }
  }

  const sorted = useMemo(() =>
    [...studies].sort((a, b) => (b.study_date || '').localeCompare(a.study_date || '')),
    [studies],
  )

  const openCleanup = async () => {
    setCleanupOpen(true)
    setCleanupLoading(true)
    setCleanupError(null)
    setCleanupSelected(new Set())
    try {
      const res = await listSingleSliceStudies()
      setCleanupItems(res.items)
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : t('studies.cleanupLoadError'))
    } finally {
      setCleanupLoading(false)
    }
  }

  const closeCleanup = () => {
    setCleanupOpen(false)
    setCleanupItems([])
    setCleanupSelected(new Set())
    setCleanupError(null)
  }

  const toggleCleanupItem = (orthancId: string) => {
    setCleanupSelected((prev) => {
      const next = new Set(prev)
      if (next.has(orthancId)) next.delete(orthancId)
      else next.add(orthancId)
      return next
    })
  }

  const toggleCleanupAll = () => {
    if (cleanupSelected.size === cleanupItems.length) {
      setCleanupSelected(new Set())
    } else {
      setCleanupSelected(new Set(cleanupItems.map((i) => i.orthanc_id)))
    }
  }

  const runCleanup = async () => {
    if (cleanupSelected.size === 0) return
    if (!window.confirm(t('studies.cleanupConfirmMessage', { count: cleanupSelected.size }))) return
    setCleanupDeleting(true)
    setCleanupError(null)
    let ok = 0
    let fail = 0
    for (const id of cleanupSelected) {
      try {
        await deleteOrthancStudy(id)
        ok++
      } catch {
        fail++
      }
    }
    setCleanupDeleting(false)
    setCleanupItems((prev) => prev.filter((i) => !cleanupSelected.has(i.orthanc_id)))
    setCleanupSelected(new Set())
    if (fail > 0) {
      setCleanupError(t('studies.cleanupDeletedPartial', { ok, total: ok + fail }))
    } else {
      setCleanupError(t('studies.cleanupDeletedOk', { count: ok }))
    }
    await load()
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [modality])

  const linked = sorted.filter(s => !s.unlinked)
  const unlinked = sorted.filter(s => s.unlinked)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{t('studies.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('studies.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={modality}
            onChange={(e) => setModality(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {MODALITY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{t(f.key)}</option>
            ))}
          </select>
          <button
            onClick={load}
            className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {t('studies.refresh')}
          </button>
          <button
            onClick={openCleanup}
            className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-md text-sm hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
            title={t('studies.cleanupSubtitle')}
          >
            🧹 {t('studies.cleanupButton')}
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="bg-teal-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-teal-700 transition"
          >
            {t('studies.newOrder')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16" />
            ))}
          </div>
        </div>
      ) : studies.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
          <div className="text-5xl mb-3">🔬</div>
          <h3 className="text-slate-700 dark:text-slate-300 font-medium">{t('studies.noStudies')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('studies.noStudiesHint')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unlinked.length > 0 && (
            <div>
              <div className="text-xs font-medium text-amber-500 uppercase tracking-wide mb-2 px-1">
                {t('studies.unlinked')} ({unlinked.length})
              </div>
              <StudiesTable studies={unlinked} imgErrors={imgErrors} setImgErrors={setImgErrors} linkingId={linkingId} onLink={handleLink} t={t} />
            </div>
          )}

          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-1">
              {linked.length > 0 ? `${t('studies.linked')} (${linked.length})` : ''}
            </div>
            {linked.length > 0 ? (
              <StudiesTable studies={linked} imgErrors={imgErrors} setImgErrors={setImgErrors} linkingId={linkingId} onLink={handleLink} t={t} />
            ) : unlinked.length === 0 ? null : (
              <div className="text-center text-slate-400 text-sm py-6">{t('studies.noStudies')}</div>
            )}
          </div>
        </div>
      )}

      {cleanupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 transition-opacity duration-200" onClick={closeCleanup}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">🧹 {t('studies.cleanupTitle')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('studies.cleanupSubtitle')}</p>
              </div>
              <button onClick={closeCleanup} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shrink-0">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {cleanupSelected.size > 0 ? t('studies.cleanupSelected', { count: cleanupSelected.size }) : `${cleanupItems.length}`}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleCleanupAll}
                  disabled={cleanupItems.length === 0}
                  className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
                >
                  {cleanupSelected.size === cleanupItems.length && cleanupItems.length > 0
                    ? t('studies.cleanupDeselectAll')
                    : t('studies.cleanupSelectAll')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {cleanupError && (
                <div className="m-2 p-2 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm">
                  {cleanupError}
                </div>
              )}
              {cleanupLoading ? (
                <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>
              ) : cleanupItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">{t('studies.cleanupEmpty')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-slate-500 sticky top-0 bg-white dark:bg-slate-800">
                    <tr>
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 text-left">{t('studies.cleanupStudyPatient')}</th>
                      <th className="px-2 py-2 text-left">{t('studies.cleanupStudyModality')}</th>
                      <th className="px-2 py-2 text-left">{t('studies.cleanupStudyDescription')}</th>
                      <th className="px-2 py-2 text-left">{t('studies.cleanupStudyDate')}</th>
                      <th className="px-2 py-2 text-left">{t('studies.cleanupStudyId')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cleanupItems.map((it) => (
                      <tr
                        key={it.orthanc_id}
                        onClick={() => toggleCleanupItem(it.orthanc_id)}
                        className={`cursor-pointer border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${cleanupSelected.has(it.orthanc_id) ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                      >
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={cleanupSelected.has(it.orthanc_id)}
                            onChange={() => toggleCleanupItem(it.orthanc_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="px-2 py-2 text-slate-700 dark:text-slate-300">{it.patient_name || '—'}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{it.modality || '—'}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{it.study_description || '—'}</td>
                        <td className="px-2 py-2 text-slate-500 dark:text-slate-500 font-mono text-xs">{it.study_date || '—'}</td>
                        <td className="px-2 py-2 text-slate-400 font-mono text-xs">{it.orthanc_id.slice(0, 8)}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0">
              <button
                onClick={closeCleanup}
                disabled={cleanupDeleting}
                className="px-4 py-2 rounded-md text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50"
              >
                {t('studies.cleanupCancel')}
              </button>
              <button
                onClick={runCleanup}
                disabled={cleanupSelected.size === 0 || cleanupDeleting}
                className="px-4 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {cleanupDeleting ? t('studies.cleanupDeleting') : `${t('studies.cleanupDelete')} (${cleanupSelected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StudiesTable({
  studies, imgErrors, setImgErrors, linkingId, onLink, t,
}: {
  studies: StudyListItem[]
  imgErrors: Record<string, boolean>
  setImgErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  linkingId: string | null
  onLink: (s: StudyListItem) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3 text-left font-medium w-16"></th>
              <th className="px-3 py-3 text-left font-medium">{t('common.patient')}</th>
              <th className="px-3 py-3 text-left font-medium hidden md:table-cell">{t('common.modality')}</th>
              <th className="px-3 py-3 text-left font-medium hidden lg:table-cell">{t('common.description')}</th>
              <th className="px-3 py-3 text-left font-medium">{t('common.date')}</th>
              <th className="px-3 py-3 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {studies.map((s) => (
              <tr key={s.orthanc_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td className="px-3 py-2">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden flex items-center justify-center">
                    {imgErrors[s.study_uid] ? (
                      <span className="text-[9px] text-slate-400">—</span>
                    ) : (
                      <img
                        src={`/api/v1/studies/${s.study_uid}/preview`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={() => setImgErrors(prev => ({ ...prev, [s.study_uid]: true }))}
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-slate-900 dark:text-slate-100 truncate max-w-[140px] text-sm">
                    {s.patient?.full_name || s.patient_name_dicom || '—'}
                  </div>
                  {s.patient?.id && (
                    <Link to={`/patients/${s.patient.id}`} className="text-xs text-teal-600 dark:text-teal-400 hover:underline">
                      {t('patients.openCard')}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 hidden md:table-cell">
                  <span className="inline-flex px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium">
                    {s.modality ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-xs hidden lg:table-cell max-w-[200px] truncate">
                  {s.study_description || s.ris_study_description || '—'}
                </td>
                <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs tabular-nums whitespace-nowrap">
                  {s.study_date ? new Date(s.study_date).toLocaleDateString('ru-RU') : '—'}
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      to={`/viewer/${encodeURIComponent(s.study_uid)}`}
                      className="px-2 py-1 text-xs bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50"
                      title={t('studies.view')}
                    >
                      <ViewerIcon />
                    </Link>
                    {s.ris_order_id ? (
                      <Link
                        to={`/protocol/${s.ris_order_id}`}
                        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        title={t('studies.protocol')}
                      >
                        <ProtocolIcon />
                      </Link>
                    ) : (
                      <button
                        onClick={() => onLink(s)}
                        disabled={linkingId === s.orthanc_id}
                        className="px-2 py-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 disabled:opacity-50"
                      >
                        {linkingId === s.orthanc_id ? '…' : '+'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
