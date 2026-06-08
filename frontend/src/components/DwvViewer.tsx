import { useEffect, useRef, useState, useCallback } from 'react'
import { App, AppOptions, ViewConfig } from 'dwv'
import type { DicomWebLoadOptions, PositionEvent } from 'dwv'
import { getToken } from '../api/client'

const TOOLS = [
  { id: 'Scroll', label: 'Cрезы' },
  { id: 'WindowLevel', label: 'Окно' },
  { id: 'ZoomAndPan', label: 'Зум' },
  { id: 'Draw', label: 'Рис.' },
] as const

const DRAW_SHAPES = ['Ruler', 'Circle', 'Rectangle', 'FreeHand', 'Arrow', 'Angle']

interface SeriesItem {
  series_uid: string
  modality: string
  description: string | null
  instance_count: number
  instances: { orthanc_id: string; sop_instance_uid: string }[]
}

interface StudyData {
  orthanc_id: string
  study_uid: string
  study_date: string | null
  study_description: string | null
  modality: string | null
  patient_id_dicom: string | null
  patient_name_dicom: string | null
  patient_birth_date: string | null
  accession_number: string | null
  is_stable: boolean
  unlinked: boolean
  patient: { id: string; full_name: string; birth_date: string | null } | null
  series: SeriesItem[]
}

interface DwvViewerProps {
  studyUid: string
  onError?: (message: string) => void
}

export function DwvViewer({ studyUid, onError }: DwvViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<App | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const studyDataRef = useRef<StudyData | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeTool, setActiveTool] = useState('Scroll')
  const [activeShape, setActiveShape] = useState('Ruler')
  const [showShapes, setShowShapes] = useState(false)
  const [sliceInfo, setSliceInfo] = useState({ current: 0, total: 0 })
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([])
  const [activeSeriesUid, setActiveSeriesUid] = useState('')
  const [studyInfo, setStudyInfo] = useState<{ name: string; id: string } | null>(null)

  const initApp = useCallback((containerId: string): App => {
    const viewConfig = new ViewConfig(containerId)
    viewConfig.defaultCharacterSet = 'utf-8'
    const options = new AppOptions({ '*': [viewConfig] })
    options.tools = { Scroll: {}, WindowLevel: {}, ZoomAndPan: {}, Draw: {} }
    options.viewOnFirstLoadItem = true
    const app = new App()
    app.init(options)
    return app
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const containerId = `dwv-${Math.random().toString(36).slice(2, 9)}`
    containerRef.current.id = containerId

    let app: App
    try {
      app = initApp(containerId)
      appRef.current = app
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Не удалось инициализировать DWV: ' + msg)
      onError?.(msg)
      return
    }

    app.addEventListener('loadstart', () => {
      setLoading(true)
      setLoaded(false)
      setError(null)
    })

    app.addEventListener('loadend', () => {
      setLoading(false)
      setLoaded(true)
      try {
        const vc = app.getViewController()
        if (vc && typeof vc.getNumberOfSlices === 'function') {
          const total = vc.getNumberOfSlices()
          setSliceInfo({ current: 1, total })
        }
      } catch { /* ignore */ }
      // После загрузки восстанавливаем активный Draw shape
      if (activeTool === 'Draw') {
        try { app.setToolFeatures({ shapeName: activeShape }) } catch { /* ignore */ }
      }
    })

    app.addEventListener('error', (event) => {
      const ev = event as { data?: { message?: string } | string }
      const data = ev.data
      const message = typeof data === 'string'
        ? data
        : data?.message ?? 'Ошибка загрузки DICOM'
      setError(message)
      setLoading(false)
      onError?.(message)
    })

    app.addEventListener('positionchange', (event) => {
      const ev = event as PositionEvent
      const pos = ev.position
      if (pos?.slice) {
        setSliceInfo({
          current: pos.slice.number ?? pos.slice.index + 1,
          total: pos.slice.total,
        })
      }
    })

    return () => {
      try { app.reset() } catch { /* ignore */ }
      appRef.current = null
      studyDataRef.current = null
    }
    // activeTool/activeShape читаются внутри loadend-callback,
    // а их изменение не требует пересоздания App — подавляем лишние deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initApp, onError])

  const loadSeries = useCallback((seriesUid: string) => {
    const data = studyDataRef.current
    if (!data || !appRef.current) return

    const series = data.series.find(s => s.series_uid === seriesUid)
    if (!series || series.instances.length === 0) return

    const urls: string[] = series.instances.map(
      inst => `/api/v1/instances/${inst.orthanc_id}/dicom`,
    )

    const token = getToken() ?? localStorage.getItem('mp_access_token') ?? ''
    const requestHeaders = token
      ? [{ name: 'Authorization', value: `Bearer ${token}` }]
      : [{ name: 'Accept', value: 'application/dicom' }]
    const options: DicomWebLoadOptions = {
      requestHeaders,
      forceLoader: 'dicom',
    }

    appRef.current.loadURLs(urls, options)
  }, [])

  useEffect(() => {
    if (!studyUid) return

    let cancelled = false
    studyDataRef.current = null

    const fetchStudy = async () => {
      try {
        const token = getToken() ?? localStorage.getItem('mp_access_token') ?? ''
        const resp = await fetch(
          `/api/v1/studies/${encodeURIComponent(studyUid)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!resp.ok) throw new Error('RIS вернул ' + resp.status)
        const data: StudyData = await resp.json()
        if (cancelled) return

        studyDataRef.current = data
        setStudyInfo({
          name: data.patient_name_dicom || data.patient?.full_name || '—',
          id: data.patient_id_dicom || data.patient?.id || '—',
        })

        const series: SeriesItem[] = (data.series || []).map((s: { series_uid: string; modality: string; series_description: string | null; instance_count: number; instances: { orthanc_id: string; sop_instance_uid: string }[] }) => ({
          series_uid: s.series_uid,
          modality: s.modality,
          description: s.series_description || null,
          instance_count: s.instance_count ?? (s.instances || []).length,
          instances: s.instances || [],
        }))
        setSeriesList(series)

        if (series.length > 0) {
          const first = series[0].series_uid
          setActiveSeriesUid(first)
          loadSeries(first)
        } else {
          setError('Исследование не содержит серий')
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError('Ошибка загрузки: ' + msg)
          onError?.(msg)
        }
      }
    }

    void fetchStudy()
    return () => { cancelled = true }
  }, [studyUid, loadSeries, onError])

  const handleToolChange = useCallback((tool: string) => {
    setActiveTool(tool)
    setShowShapes(tool === 'Draw')
    try {
      appRef.current?.setTool(tool)
    } catch { /* tool may not be ready yet */ }
    if (tool === 'Draw') {
      try {
        appRef.current?.setToolFeatures({ shapeName: activeShape })
      } catch { /* tool not initialized yet */ }
    }
  }, [activeShape])

  const handleShapeChange = useCallback((shape: string) => {
    setActiveShape(shape)
    try {
      appRef.current?.setToolFeatures({ shapeName: shape })
    } catch { /* tool not initialized yet */ }
  }, [])

  const handleSeriesChange = useCallback((seriesUid: string) => {
    if (seriesUid === activeSeriesUid) return
    setActiveSeriesUid(seriesUid)
    setLoaded(false)
    loadSeries(seriesUid)
  }, [activeSeriesUid, loadSeries])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      appRef.current?.loadFiles(files)
      setLoaded(false)
      setError(null)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800 text-white text-sm select-none">
        <div className="flex items-center gap-1">
          {TOOLS.map(tool => (
            <div key={tool.id} className="relative">
              <button
                onClick={() => handleToolChange(tool.id)}
                className={
                  'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ' +
                  (activeTool === tool.id
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700')
                }
              >
                {tool.label}
              </button>
              {tool.id === 'Draw' && showShapes && (
                <div className="absolute top-full left-0 mt-1 bg-slate-700 rounded shadow-lg z-10 flex flex-wrap gap-0.5 p-1 min-w-[120px]">
                  {DRAW_SHAPES.map(shape => (
                    <button
                      key={shape}
                      onClick={() => handleShapeChange(shape)}
                      className={
                        'px-2 py-0.5 rounded text-xs cursor-pointer ' +
                        (activeShape === shape
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-200 hover:bg-slate-600')
                      }
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {seriesList.length > 1 && (
            <span className="mx-2 w-px h-4 bg-slate-600" />
          )}

          {seriesList.length > 1 && (
            <select
              value={activeSeriesUid}
              onChange={e => handleSeriesChange(e.target.value)}
              className="bg-slate-600 text-white text-xs rounded px-1.5 py-0.5 border border-slate-500 cursor-pointer max-w-[200px]"
            >
              {seriesList.map(s => (
                <option key={s.series_uid} value={s.series_uid}>
                  {s.modality}
                  {s.description ? ' - ' + s.description : ''}
                  {' (' + s.instance_count + ')'}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loaded && sliceInfo.total > 0 && (
            <span className="text-xs text-slate-400">
              Cрез {sliceInfo.current}/{sliceInfo.total}
            </span>
          )}
          {loading && (
            <span className="text-xs text-blue-300">Загрузка...</span>
          )}
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-700 text-white text-xs">
        <span className="text-slate-300">
          {studyInfo && (studyInfo.name + ' · ' + studyInfo.id)}
        </span>
        <label className="text-slate-300 hover:text-white cursor-pointer flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,.dicom,application/dicom"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          DICOM
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="px-2 py-1.5 bg-red-900 text-red-100 text-xs">
          {error}
        </div>
      )}

      {/* DICOM container */}
      <div
        ref={containerRef}
        className="flex-1 bg-black relative min-h-[400px]"
      />
    </div>
  )
}
