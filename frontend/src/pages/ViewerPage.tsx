import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DwvViewer } from '../components/DwvViewer'

export default function ViewerPage() {
  const { studyUid = '' } = useParams<{ studyUid: string }>()
  const [error, setError] = useState<string | null>(null)

  // Clear error when studyUid changes
  useEffect(() => { setError(null) }, [studyUid])

  return (
    <div className="h-screen flex flex-col bg-[#060a10] text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/studies" className="text-xs text-slate-400 hover:text-slate-200 transition">
            &larr; К списку исследований
          </Link>
          <span className="w-px h-3 bg-slate-700" />
          <span className="text-xs font-semibold text-blue-400 tracking-wide uppercase">MedPlatform DICOM</span>
        </div>
        {studyUid && (
          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[300px]">
            {studyUid}
          </span>
        )}
      </div>

      {!studyUid && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl text-slate-600 mb-3">⬡</div>
            <div className="text-slate-400 font-medium mb-1">Не выбран Study UID</div>
            <div className="text-slate-600 text-sm">Выберите исследование из списка</div>
            <Link to="/studies" className="inline-block mt-4 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition">
              К списку исследований
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-900/50 border-b border-red-800 text-red-200 text-xs flex-shrink-0">
          {error}
        </div>
      )}

      {studyUid && (
        <DwvViewer studyUid={studyUid} onError={setError} />
      )}
    </div>
  )
}
