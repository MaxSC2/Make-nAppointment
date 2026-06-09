import { useState, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { useDwvViewer, TOOLS, DRAW_SHAPES } from '../hooks/useDwvViewer'
import { DicomSearch } from './DicomSearch'

interface DwvViewerProps {
  studyUid: string
  onError?: (message: string) => void
}

export function DwvViewer({ studyUid, onError }: DwvViewerProps) {
  const v = useDwvViewer(studyUid, onError)
  const [showSearch, setShowSearch] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      v.handleFiles(files)
    }
  }, [v])

  const onFileInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    v.handleFiles(e.target.files)
  }, [v])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-800 text-white text-sm select-none">
        <div className="flex items-center gap-1">
          {TOOLS.map(tool => (
            <div key={tool.id} className="relative">
              <button
                onClick={() => v.setTool(tool.id)}
                className={
                  'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ' +
                  (v.activeTool === tool.id
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700')
                }
              >
                {tool.label}
              </button>
              {tool.id === 'Draw' && v.showShapes && (
                <div className="absolute top-full left-0 mt-1 bg-slate-700 rounded shadow-lg z-10 flex flex-wrap gap-0.5 p-1 min-w-[160px]">
                  {DRAW_SHAPES.map(shape => (
                    <button
                      key={shape}
                      onClick={() => v.setShape(shape)}
                      className={
                        'px-2 py-0.5 rounded text-xs cursor-pointer ' +
                        (v.activeShape === shape
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

          {v.seriesList.length > 1 && <span className="mx-2 w-px h-4 bg-slate-600" />}

          {v.seriesList.length > 1 && (
            <select
              value={v.activeSeriesUid}
              onChange={e => v.setSeries(e.target.value)}
              className="bg-slate-600 text-white text-xs rounded px-1.5 py-0.5 border border-slate-500 cursor-pointer max-w-[200px]"
            >
              {v.seriesList.map(s => (
                <option key={s.series_uid} value={s.series_uid}>
                  {s.modality}
                  {s.description ? ' - ' + s.description : ''}
                  {' (' + s.instance_count + ')'}
                </option>
              ))}
            </select>
          )}

          <span className="mx-2 w-px h-4 bg-slate-600" />

          <button
            onClick={v.reset}
            disabled={!v.appRef.current}
            title="Сбросить viewer (очистить рисунки и перезагрузить)"
            className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
          >
            Сброс
          </button>

          <button
            onClick={() => setShowSearch(s => !s)}
            className={
              'px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ' +
              (showSearch
                ? 'bg-brand-600 text-white'
                : 'text-slate-300 hover:bg-slate-700')
            }
            title="Поиск DICOM-исследований в PACS"
          >
            PACS
          </button>
        </div>

        <div className="flex items-center gap-3">
          {v.loaded && v.sliceInfo.total > 0 && (
            <span className="text-xs text-slate-400">
              Cрез {v.sliceInfo.current}/{v.sliceInfo.total}
            </span>
          )}
          {v.loading && <span className="text-xs text-blue-300">Загрузка...</span>}
        </div>
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-700 text-white text-xs">
        <span className="text-slate-300 truncate">
          {v.studyInfo && (v.studyInfo.name + ' · ' + v.studyInfo.id)}
        </span>
        <label className="text-slate-300 hover:text-white cursor-pointer flex items-center gap-1 flex-shrink-0">
          <input
            ref={v.fileInputRef}
            type="file"
            accept=".dcm,.dicom,application/dicom"
            multiple
            onChange={onFileInput}
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
      {v.error && (
        <div className="px-2 py-1.5 bg-red-900 text-red-100 text-xs">
          {v.error}
        </div>
      )}

      {/* PACS Search drawer */}
      {showSearch && (
        <div className="bg-slate-100 border-b border-slate-300 max-h-72 overflow-y-auto">
          <DicomSearch onClose={() => setShowSearch(false)} />
        </div>
      )}

      {/* DICOM container with drag-and-drop */}
      <div className="flex-1 flex min-h-0">
        <div
          ref={v.containerRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={'flex-1 bg-black relative min-h-[400px] ' +
            (isDragging ? 'outline outline-4 outline-brand-500 outline-dashed' : '')}
        >
          {isDragging && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none z-10">
              <div className="bg-slate-900/80 text-white px-6 py-4 rounded-lg text-lg font-medium">
                Отпустите файл для загрузки
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
