import { useEffect, useRef, useState, useCallback } from 'react'
import { App, AppOptions, ViewConfig } from 'dwv'
import type { DicomWebLoadOptions, PositionEvent } from 'dwv'
import { getToken } from '../api/client'

export const TOOLS = [
  { id: 'Scroll', label: 'Cрезы' },
  { id: 'WindowLevel', label: 'Окно' },
  { id: 'ZoomAndPan', label: 'Зум' },
  { id: 'Draw', label: 'Рис.' },
] as const

export const DRAW_SHAPES = ['Ruler', 'Circle', 'Rectangle', 'Ellipse', 'Arrow']

export const LOAD_TIMEOUT_MS = 15000

export interface SeriesInstance {
  orthanc_id: string
  sop_instance_uid: string
}

export interface SeriesItem {
  series_uid: string
  modality: string
  description: string | null
  instance_count: number
  instances: SeriesInstance[]
}

export interface StudyData {
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

export interface UseDwvViewerResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  appRef: React.MutableRefObject<App | null>
  loading: boolean
  error: string | null
  loaded: boolean
  activeTool: typeof TOOLS[number]['id']
  activeShape: string
  showShapes: boolean
  sliceInfo: { current: number; total: number }
  seriesList: SeriesItem[]
  activeSeriesUid: string
  studyInfo: { name: string; id: string } | null
  setTool: (tool: typeof TOOLS[number]['id']) => void
  setShape: (shape: string) => void
  setSeries: (seriesUid: string) => void
  handleFiles: (files: FileList | File[] | null) => void
  reset: () => void
}

export function useDwvViewer(studyUid: string, onError?: (msg: string) => void): UseDwvViewerResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const appRef = useRef<App | null>(null)
  const studyDataRef = useRef<StudyData | null>(null)
  const loadTimeoutRef = useRef<number | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeTool, setActiveTool] = useState<typeof TOOLS[number]['id']>('Scroll')
  const [activeShape, setActiveShape] = useState('Ruler')
  const [showShapes, setShowShapes] = useState(false)
  const [sliceInfo, setSliceInfo] = useState({ current: 0, total: 0 })
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([])
  const [activeSeriesUid, setActiveSeriesUid] = useState('')
  const [studyInfo, setStudyInfo] = useState<{ name: string; id: string } | null>(null)

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current !== null) {
      window.clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }
  }

  const initApp = useCallback((containerId: string): App => {
    const viewConfig = new ViewConfig(containerId)
    viewConfig.defaultCharacterSet = 'utf-8'
    const options = new AppOptions({ '*': [viewConfig] })
    options.tools = { Scroll: {}, WindowLevel: {}, ZoomAndPan: {}, Draw: { options: DRAW_SHAPES } }
    options.viewOnFirstLoadItem = false
    const app = new App()
    app.init(options)
    return app
  }, [])

  const loadSeries = useCallback((seriesUid: string) => {
    const data = studyDataRef.current
    if (!data || !appRef.current) return

    const series = data.series.find(s => s.series_uid === seriesUid)
    if (!series || series.instances.length === 0) {
      setError('Серия не содержит инстансов')
      return
    }

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

    setLoaded(false)
    setLoading(true)
    setError(null)
    appRef.current.loadURLs(urls, options)
  }, [])

  // Init dwv App
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
      setError('Не удалось инициализировать DWV: ' + msg)
      onError?.(msg)
      return
    }

    app.addEventListener('loadstart', () => {
      setLoading(true)
      setLoaded(false)
      setError(null)
      clearLoadTimeout()
      loadTimeoutRef.current = window.setTimeout(() => {
        const msg = `Таймаут загрузки (${LOAD_TIMEOUT_MS / 1000}с). Проверьте подключение.`
        setError(msg)
        setLoading(false)
        onError?.(msg)
      }, LOAD_TIMEOUT_MS)
    })

    app.addEventListener('loadend', () => {
      clearLoadTimeout()
      setLoading(false)
      setLoaded(true)
      try {
        const vc = 'getViewController' in app ? app.getViewController() : null
        if (vc && typeof vc.getNumberOfSlices === 'function') {
          const total = vc.getNumberOfSlices()
          setSliceInfo({ current: 1, total })
        }
      } catch { console.error('DwvViewer: failed to get slice count') }
      // Восстанавливаем активный Draw shape
      if (activeTool === 'Draw') {
        try { app.setToolFeatures({ shapeName: activeShape }) } catch { console.error('DwvViewer: failed to set Draw shape') }
      }
    })

    app.addEventListener('error', (event) => {
      clearLoadTimeout()
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
      clearLoadTimeout()
      try { app.reset() } catch { console.error('DwvViewer: failed to reset') }
      appRef.current = null
      studyDataRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initApp, onError])

  // Fetch study data
  useEffect(() => {
    if (!studyUid) return

    let cancelled = false
    studyDataRef.current = null
    setSeriesList([])
    setActiveSeriesUid('')
    setStudyInfo(null)
    setLoaded(false)
    setError(null)

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

        const series: SeriesItem[] = (data.series || []).map((s: { series_uid: string; modality: string; series_description: string | null; instance_count: number; instances: SeriesInstance[] }) => ({
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

  const setTool = useCallback((tool: typeof TOOLS[number]['id']) => {
    setActiveTool(tool)
    setShowShapes(tool === 'Draw')
    try {
      appRef.current?.setTool(tool)
    } catch { console.error('DwvViewer: tool not ready') }
    if (tool === 'Draw') {
      try {
        appRef.current?.setToolFeatures({ shapeName: activeShape })
      } catch { console.error('DwvViewer: tool not initialized') }
    }
  }, [activeShape])

  const setShape = useCallback((shape: string) => {
    setActiveShape(shape)
    try {
      appRef.current?.setToolFeatures({ shapeName: shape })
    } catch { console.error('DwvViewer: tool not initialized') }
  }, [])

  const setSeries = useCallback((seriesUid: string) => {
    if (seriesUid === activeSeriesUid) return
    setActiveSeriesUid(seriesUid)
    setLoaded(false)
    loadSeries(seriesUid)
  }, [activeSeriesUid, loadSeries])

  const handleFiles = useCallback((files: FileList | File[] | null) => {
    if (!files) return
    const list = Array.from(files)
    if (list.length > 0) {
      try {
        appRef.current?.loadFiles(list)
        setLoaded(false)
        setError(null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError('Ошибка загрузки файлов: ' + msg)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const reset = useCallback(() => {
    if (!appRef.current) return
    try {
      appRef.current.reset()
      setLoaded(false)
      setSliceInfo({ current: 0, total: 0 })
      setError(null)
      // Перезагружаем текущую серию
      if (activeSeriesUid) {
        loadSeries(activeSeriesUid)
      } else if (studyUid && studyDataRef.current) {
        const first = studyDataRef.current.series[0]?.series_uid
        if (first) {
          setActiveSeriesUid(first)
          loadSeries(first)
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError('Ошибка сброса: ' + msg)
    }
  }, [activeSeriesUid, loadSeries, studyUid])

  return {
    containerRef,
    fileInputRef,
    appRef,
    loading,
    error,
    loaded,
    activeTool,
    activeShape,
    showShapes,
    sliceInfo,
    seriesList,
    activeSeriesUid,
    studyInfo,
    setTool,
    setShape,
    setSeries,
    handleFiles,
    reset,
  }
}
