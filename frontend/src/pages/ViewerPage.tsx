import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { DwvViewer } from '../components/DwvViewer'

export default function ViewerPage() {
  const { studyUid = '' } = useParams<{ studyUid: string }>()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div>
          <Link to="/studies" className="text-sm text-slate-500 hover:text-slate-700">
            &larr; K списку исследований
          </Link>
          <h2 className="text-xl font-semibold text-slate-900 mt-1">DICOM Viewer</h2>
        </div>
      </div>

      {!studyUid && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-6 flex-shrink-0">
          <div className="font-medium mb-1">Не выбран study UID</div>
          <div className="text-sm">Выберите исследование из списка.</div>
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-6 flex-shrink-0">
          <div className="font-medium mb-1">Не удалось открыть исследование</div>
          <div className="text-sm">{error}</div>
        </div>
      )}

      {studyUid && (
        <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden min-h-0">
          <DwvViewer studyUid={studyUid} onError={setError} />
        </div>
      )}
    </div>
  )
}
