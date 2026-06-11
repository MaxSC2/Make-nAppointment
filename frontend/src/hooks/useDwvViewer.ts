import { useEffect, useRef, useState, useCallback } from 'react'
import * as dwv from 'dwv'
import { getToken } from '../api/client'

export const TOOLS = [
  { id: 'Scroll', label: 'Срезы' },
  { id: 'WindowLevel', label: 'Окно' },
  { id: 'ZoomAndPan', label: 'Зум' },
  { id: 'Draw', label: 'Рис.' },
] as const

export const DRAW_SHAPES = ['Ruler', 'Circle', 'Rectangle', 'Ellipse', 'Arrow']

export const LOAD_TIMEOUT_MS = 60000

export interface SeriesInstance {
  orthanc_id: string
  sop_instance_uid: string
}

export interface SeriesItem {
  series_uid: string
  modality: string
  description: string | null
  series_description?: string | null
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
  appRef: React.MutableRefObject<dwv.App | null>
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
  const appRef = useRef<dwv.App | null>(null)
  const studyDataRef = useRef<StudyData | null>(null)
  const seriesListRef = useRef<SeriesItem[]>([])
  const activeSeriesUidRef = useRef('')
  const activeToolRef = useRef<typeof TOOLS[number]['id']>('Scroll')
  const activeShapeRef = useRef('Ruler')
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
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

  const initApp = useCallback((container: HTMLDivElement): dwv.App => {
    container.id = 'layerGroup0'
    const viewConfig = new dwv.ViewConfig('layerGroup0')
    const options = new dwv.AppOptions({ '*': [viewConfig] })
    options.tools = { Scroll: {}, WindowLevel: {}, ZoomAndPan: {}, Draw: { options: DRAW_SHAPES } }
    const app = new dwv.App()
    app.init(options)
    return app
  }, [])

  const loadSeries = useCallback(async (seriesUid: string) => {
    const data = studyDataRef.current
    if (!data || !appRef.current) return

    const series = data.series.find(s => s.series_uid === seriesUid)
    if (!series || series.instances.length === 0) {
      setError('Серия не содержит инстансов')
      return
    }

    const token = getToken() ?? localStorage.getItem('mp_access_token') ?? ''
    setLoaded(false)
    setLoading(true)
    setError(null)

    try {
      // Parallel fetch for speed
      const files = await Promise.all(
        series.instances.map(async inst => {
          const resp = await fetch(
            `/api/v1/instances/${inst.orthanc_id}/dicom`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (!resp.ok) throw new Error(`DICOM ${resp.status}`)
          return new File([await resp.arrayBuffer()], `${inst.orthanc_id}.dcm`, { type: 'application/dicom' })
        })
      )
      await appRef.current.loadFiles(files)
    } catch (e) {
      setError('Ошибка загрузки: ' + (e instanceof Error ? e.message : String(e)))
      setLoading(false)
      onErrorRef.current?.(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // Init dwv App
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    // Wait for container to have dimensions before init
    const tryInit = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) {
        requestAnimationFrame(tryInit)
        return
      }

      let app: dwv.App
      try {
        app = initApp(container)
        appRef.current = app
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError('Не удалось инициализировать DWV: ' + msg)
        onErrorRef.current?.(msg)
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
          onErrorRef.current?.(msg)
        }, LOAD_TIMEOUT_MS)
      })

      app.addEventListener('loadend', () => {
        clearLoadTimeout()
        setLoading(false)
        setLoaded(true)
        setSliceInfo({ current: 1, total: seriesListRef.current.find(s => s.series_uid === activeSeriesUidRef.current)?.instance_count || 0 })
        // Delay tool activation — DWV needs time to render first frame
        setTimeout(() => {
          try { app.setTool(activeToolRef.current) } catch { /* ignore */ }
          if (activeToolRef.current === 'Draw') {
            try { app.setToolFeatures({ shapeName: activeShapeRef.current }) } catch { /* ignore */ }
          }
        }, 200)
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
        onErrorRef.current?.(message)
      })

      app.addEventListener('positionchange', () => {
        // DWV v0.36 positionchange doesn't have reliable frame index
        // Counter is tracked manually via wheel/keyboard events
      })
    }

    tryInit()

    // Manual slice counter via wheel
    const onWheel = (e: WheelEvent) => {
      setSliceInfo(prev => {
        if (!prev.total) return prev
        const dir = e.deltaY > 0 ? 1 : -1
        return { ...prev, current: Math.max(1, Math.min(prev.total, prev.current + dir)) }
      })
    }
    container.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      clearLoadTimeout()
      container.removeEventListener('wheel', onWheel)
      const app = appRef.current as dwv.App
      if (app) {
        try { app.reset() } catch { console.error('DwvViewer: failed to reset') }
      }
      appRef.current = null
      studyDataRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initApp])

  // Fetch study data
  useEffect(() => {
    if (!studyUid) return

    let cancelled = false
    studyDataRef.current = null
    setSeriesList([])
    setActiveSeriesUid('')
    activeSeriesUidRef.current = ''
    setStudyInfo(null)
    setLoaded(false)
    setSliceInfo({ current: 0, total: 0 })
    setError(null)
    // Clear previous DWV canvas
    try { appRef.current?.reset() } catch { /* ignore */ }

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

        const series: SeriesItem[] = (data.series || []).map(s => ({
          series_uid: s.series_uid,
          modality: s.modality,
          description: s.series_description || null,
          instance_count: s.instance_count ?? (s.instances || []).length,
          instances: s.instances || [],
        }) as SeriesItem)
        setSeriesList(series)
        seriesListRef.current = series

        if (series.length > 0) {
          const first = series[0].series_uid
          setActiveSeriesUid(first)
          activeSeriesUidRef.current = first
          loadSeries(first)
        } else {
          setError('Исследование не содержит серий')
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e)
          setError('Ошибка загрузки: ' + msg)
          onErrorRef.current?.(msg)
        }
      }
    }

    void fetchStudy()
    return () => { cancelled = true }
  }, [studyUid, loadSeries])

  const setTool = useCallback((tool: typeof TOOLS[number]['id']) => {
    if (activeToolRef.current === 'WindowLevel' || activeToolRef.current === 'Draw') {
      try { appRef.current?.setToolFeatures({}) } catch {}
    }
    setActiveTool(tool)
    activeToolRef.current = tool
    setShowShapes(tool === 'Draw')
    try { appRef.current?.setTool(tool) } catch { console.error('DwvViewer: tool not ready') }
    if (tool === 'Draw') {
      try { appRef.current?.setToolFeatures({ shapeName: activeShapeRef.current }) } catch { console.error('DwvViewer: tool not initialized') }
    }
  }, [])

  const setShape = useCallback((shape: string) => {
    setActiveShape(shape)
    activeShapeRef.current = shape
    try { appRef.current?.setToolFeatures({ shapeName: shape }) } catch { console.error('DwvViewer: tool not initialized') }
  }, [])

  const setSeries = useCallback((seriesUid: string) => {
    if (seriesUid === activeSeriesUidRef.current) return
    setActiveSeriesUid(seriesUid)
    activeSeriesUidRef.current = seriesUid
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const app = appRef.current
      if (!app) return

      const key = e.key.toLowerCase()
      // Tools
      if (key === '1') { setTool('Scroll'); e.preventDefault() }
      if (key === '2') { setTool('WindowLevel'); e.preventDefault() }
      if (key === '3') { setTool('ZoomAndPan'); e.preventDefault() }
      if (key === '4') { setTool('Draw'); e.preventDefault() }
      // Shapes (Latin + Russian keyboard layout)
      if ((key === 'r' || key === 'к') && !e.ctrlKey) { setShape('Ruler'); if (activeToolRef.current !== 'Draw') setTool('Draw'); e.preventDefault() }
      if ((key === 'c' || key === 'с') && !e.ctrlKey) { setShape('Circle'); if (activeToolRef.current !== 'Draw') setTool('Draw'); e.preventDefault() }
      if ((key === 't' || key === 'е') && !e.ctrlKey) { setShape('Rectangle'); if (activeToolRef.current !== 'Draw') setTool('Draw'); e.preventDefault() }
      if ((key === 'e' || key === 'у') && !e.ctrlKey) { setShape('Ellipse'); if (activeToolRef.current !== 'Draw') setTool('Draw'); e.preventDefault() }
      if ((key === 'a' || key === 'ф') && !e.ctrlKey) { setShape('Arrow'); if (activeToolRef.current !== 'Draw') setTool('Draw'); e.preventDefault() }
      // Arrow keys update counter (DWV handles scroll via wheel natively)
      if (key === 'arrowup') { setSliceInfo(p => p.total ? {...p, current: Math.max(1, p.current-1)} : p); e.preventDefault() }
      if (key === 'arrowdown') { setSliceInfo(p => p.total ? {...p, current: Math.min(p.total, p.current+1)} : p); e.preventDefault() }
      // Actions
      if (key === 'escape') { setTool('Scroll'); reset(); e.preventDefault() }
      if ((key === 'i' || key === 'ш') && !e.ctrlKey) { setTool('WindowLevel'); try { app.setToolFeatures({}) } catch {} }
      if (key === '0' && e.ctrlKey) { try { (app as unknown as { resetLayout: () => void }).resetLayout() } catch {}; e.preventDefault() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setTool, setShape, reset])

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
