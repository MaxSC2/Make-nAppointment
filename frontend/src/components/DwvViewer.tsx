import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { useDwvViewer } from '../hooks/useDwvViewer'
import { TOOLS, DRAW_SHAPES, ToolIcon } from './DwvIcons'
import { DicomSearch } from './DicomSearch'

interface DwvViewerProps {
  studyUid: string
  onError?: (message: string) => void
}

export function DwvViewer({ studyUid, onError }: DwvViewerProps) {
  const v = useDwvViewer(studyUid, onError)
  const [showSearch, setShowSearch] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activePanel, setActivePanel] = useState<'series' | 'info'>('series')

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true)
  }, [])
  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
  }, [])
  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    if (e.dataTransfer.files.length > 0) v.handleFiles(e.dataTransfer.files)
  }, [v])
  const onFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    v.handleFiles(e.target.files)
  }, [v])

  return (
    <div className="flex flex-col h-full bg-[#060a10] text-slate-200">
      {/* ═══ TOOLBAR ═══ */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-900 border-b border-slate-800 text-xs select-none flex-shrink-0">
        <div className="flex items-center gap-1">
          {TOOLS.map(tool => (
            <div key={tool.id} className="relative">
              <button
                onClick={() => v.setTool(tool.id)}
                title={tool.description}
                className={
                  'flex items-center gap-1 px-2 py-1 rounded font-medium transition cursor-pointer ' +
                  (v.activeTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')
                }
              >
                <ToolIcon id={tool.id} className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tool.label}</span>
              </button>
              {tool.id === 'Draw' && v.showShapes && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-700 rounded shadow-xl z-20 grid grid-cols-2 gap-0.5 p-1 min-w-[180px]">
                  {DRAW_SHAPES.map(shape => (
                    <button
                      key={shape.id}
                      onClick={() => v.setShape(shape.id)}
                      title={shape.description}
                      className={
                        'flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer ' +
                        (v.activeShape === shape.id
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700')
                      }
                    >
                      <ToolIcon id={shape.id} className="w-3 h-3" />
                      <span>{shape.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <span className="mx-1 w-px h-4 bg-slate-700" />

          <button onClick={v.reset} disabled={!v.appRef.current}
            title="Сброс" className="flex items-center gap-1 px-2 py-1 rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30 transition cursor-pointer">
            <ToolIcon id="Reset" className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowSearch(s => !s)}
            title="Поиск в PACS"
            className={'flex items-center gap-1 px-2 py-1 rounded transition cursor-pointer ' +
              (showSearch ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}
          >
            <ToolIcon id="Search" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PACS</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {v.loaded && v.sliceInfo.total > 0 && (
            <span className="text-slate-500">Срез {v.sliceInfo.current}/{v.sliceInfo.total}</span>
          )}
          {v.loading && (
            <span className="flex items-center gap-1 text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" /> Загрузка...
            </span>
          )}
        </div>
      </div>

      {/* ═══ INFO BAR ═══ */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-800/50 border-b border-slate-800 text-xs flex-shrink-0">
        <span className="text-slate-400 truncate">
          {v.studyInfo ? `${v.studyInfo.name} · ${v.studyInfo.id}` : studyUid}
        </span>
        <label className="text-slate-400 hover:text-white cursor-pointer flex items-center gap-1 flex-shrink-0 transition">
          <input ref={v.fileInputRef} type="file" accept=".dcm,.dicom,application/dicom" multiple
            onChange={onFileInput} className="hidden" />
          <ToolIcon id="Upload" className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Загрузить</span>
        </label>
      </div>

      {/* ═══ ERROR ═══ */}
      {v.error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/50 border-b border-red-800 text-red-200 text-xs flex-shrink-0">
          <ToolIcon id="Alert" className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{v.error}</span>
        </div>
      )}

      {/* ═══ PACS SEARCH ═══ */}
      {showSearch && (
        <div className="bg-slate-100 border-b border-slate-300 max-h-72 overflow-y-auto flex-shrink-0">
          <DicomSearch onClose={() => setShowSearch(false)} />
        </div>
      )}

      {/* ═══ MAIN: VIEWPORT + SIDEBAR ═══ */}
      <div className="flex-1 flex min-h-0">
        {/* Viewport */}
        <div className="flex-1 flex min-w-0">
          <div
            ref={v.containerRef}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            className={'flex-1 bg-black relative ' +
              (isDragging ? 'outline outline-3 outline-blue-500 outline-dashed outline-offset-[-3px]' : '')}
          >
            {isDragging && (
              <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
                <div className="bg-slate-900/90 text-white px-6 py-4 rounded-lg text-lg font-medium">
                  Отпустите для загрузки DICOM
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 text-xs">
          {/* Tabs */}
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => setActivePanel('series')}
              className={'flex-1 py-1.5 text-center font-medium transition ' +
                (activePanel === 'series' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300')}
            >Серии</button>
            <button
              onClick={() => setActivePanel('info')}
              className={'flex-1 py-1.5 text-center font-medium transition ' +
                (activePanel === 'info' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300')}
            >Детали</button>
          </div>

          {activePanel === 'series' && (
            <div className="flex-1 overflow-y-auto">
              {/* Patient */}
              {v.studyInfo && (
                <div className="p-3 border-b border-slate-800">
                  <div className="font-medium text-slate-200">{v.studyInfo.name}</div>
                  <div className="text-slate-500 mt-0.5 text-[10px] font-mono truncate">{v.studyInfo.id}</div>
                </div>
              )}

              {/* Series list */}
              {v.seriesList.length === 0 && (
                <div className="p-4 text-center text-slate-600">Нет серий</div>
              )}
              {v.seriesList.map(s => (
                <button
                  key={s.series_uid}
                  onClick={() => v.setSeries(s.series_uid)}
                  className={
                    'w-full text-left p-2.5 border-b border-slate-800/50 transition hover:bg-slate-800/50 flex items-start gap-2 ' +
                    (v.activeSeriesUid === s.series_uid
                      ? 'bg-blue-900/20 border-l-2 border-l-blue-500 pl-2'
                      : 'border-l-2 border-l-transparent pl-2.5')
                  }
                >
                  <div className="w-10 h-10 bg-slate-800 rounded flex-shrink-0 flex items-center justify-center text-slate-600 text-[9px]">
                    {s.instance_count}
                  </div>
                  <div className="min-w-0">
                    <div className="text-slate-200 font-medium truncate">
                      {s.modality || '—'}{s.description ? ` · ${s.description}` : ''}
                    </div>
                    <div className="text-slate-500 mt-0.5">{s.instance_count} срезов</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {activePanel === 'info' && (
            <div className="flex-1 overflow-y-auto p-3">
              {v.studyInfo ? (
                <div className="space-y-2">
                  <div><span className="text-slate-500">Пациент</span><div className="text-slate-200">{v.studyInfo.name}</div></div>
                  <div><span className="text-slate-500">Study UID</span><div className="text-slate-400 font-mono text-[10px] truncate">{v.studyInfo.id}</div></div>
                  <div><span className="text-slate-500">Состояние</span><div className="text-slate-200">{v.loaded ? '✓ Загружено' : v.loading ? 'Загрузка...' : '—'}</div></div>
                  {v.sliceInfo.total > 0 && (
                    <div><span className="text-slate-500">Срезов</span><div className="text-slate-200">{v.sliceInfo.total}</div></div>
                  )}
                  <div><span className="text-slate-500">Серий</span><div className="text-slate-200">{v.seriesList.length}</div></div>
                  <div><span className="text-slate-500">Инструмент</span><div className="text-slate-200">{TOOLS.find(t => t.id === v.activeTool)?.label || v.activeTool}</div></div>
                </div>
              ) : (
                <div className="text-slate-600 text-center py-8">Загрузите исследование</div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="flex items-center gap-3 px-3 py-0.5 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-500 flex-shrink-0">
        <span>Study UID: <span className="text-slate-400 font-mono">{studyUid.substring(0, 16)}...</span></span>
        <span className="w-px h-3 bg-slate-700" />
        <span>Серия: <span className="text-slate-400">{v.activeSeriesUid ? v.activeSeriesUid.substring(0, 12) + '...' : '—'}</span></span>
        <span className="w-px h-3 bg-slate-700" />
        <span>Срезов: <span className="text-slate-400">{v.sliceInfo.total || '—'}</span></span>
        <span className="w-px h-3 bg-slate-700" />
        <span>MedPlatform DICOM · DWV 0.36</span>
      </div>
    </div>
  )
}
