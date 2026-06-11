import type { ReactNode } from 'react'

export const TOOLS = [
  { id: 'Scroll', label: 'Срезы', description: 'Прокрутка срезов (1, ↑↓, колесо)' },
  { id: 'WindowLevel', label: 'Контраст', description: 'Яркость и контраст (2, drag)' },
  { id: 'ZoomAndPan', label: 'Масштаб', description: 'Масштаб и перемещение (3, Ctrl+колесо)' },
  { id: 'Draw', label: 'Рисование', description: 'Аннотации и измерения (4)' },
] as const

export const DRAW_SHAPES = [
  { id: 'Ruler', label: 'Линейка', description: 'Измерение расстояния (R/К)' },
  { id: 'Circle', label: 'Круг', description: 'Круговая аннотация (C/С)' },
  { id: 'Rectangle', label: 'Прямоугольник', description: 'Прямоугольная область (T/Е)' },
  { id: 'Ellipse', label: 'Эллипс', description: 'Эллиптическая область (E/У)' },
  { id: 'Arrow', label: 'Стрелка', description: 'Стрелочная аннотация (A/Ф)' },
] as const

export function ToolIcon({ id, className = 'w-4 h-4' }: { id: string; className?: string }): ReactNode {
  const props = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (id) {
    case 'Scroll':
      return (
        <svg {...props}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <line x1="12" y1="7" x2="12" y2="11" />
          <line x1="12" y1="13" x2="12" y2="17" />
        </svg>
      )
    case 'WindowLevel':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
          <circle cx="8" cy="9" r="2" fill="currentColor" />
        </svg>
      )
    case 'ZoomAndPan':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16" y2="16" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="11" y1="8" x2="11" y2="14" />
        </svg>
      )
    case 'Draw':
      return (
        <svg {...props}>
          <path d="M3 21l3-3 11-11a2.5 2.5 0 0 1 3.5 3.5L9 21.5l-6-1z" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      )
    case 'Ruler':
      return (
        <svg {...props}>
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="6" x2="3" y2="9" />
          <line x1="7" y1="7" x2="7" y2="9" />
          <line x1="11" y1="6" x2="11" y2="9" />
          <line x1="15" y1="7" x2="15" y2="9" />
          <line x1="19" y1="6" x2="19" y2="9" />
        </svg>
      )
    case 'Circle':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" strokeDasharray="2 2" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      )
    case 'Rectangle':
      return (
        <svg {...props}>
          <rect x="4" y="6" width="16" height="12" strokeDasharray="2 2" />
        </svg>
      )
    case 'Ellipse':
      return (
        <svg {...props}>
          <ellipse cx="12" cy="12" rx="9" ry="6" strokeDasharray="2 2" />
        </svg>
      )
    case 'FreeHand':
      return (
        <svg {...props}>
          <path d="M3 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
        </svg>
      )
    case 'Arrow':
      return (
        <svg {...props}>
          <line x1="4" y1="20" x2="18" y2="6" />
          <polyline points="11 6 18 6 18 13" />
        </svg>
      )
    case 'Angle':
      return (
        <svg {...props}>
          <line x1="4" y1="20" x2="20" y2="20" />
          <line x1="4" y1="20" x2="18" y2="6" />
          <path d="M9 20 a4 4 0 0 0 1 -3" />
        </svg>
      )
    case 'Reset':
      return (
        <svg {...props}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <polyline points="3 3 3 8 8 8" />
        </svg>
      )
    case 'Search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16" y2="16" />
        </svg>
      )
    case 'Upload':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )
    case 'Close':
      return (
        <svg {...props}>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      )
    case 'Alert':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
    case 'Dicom':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 3v18" />
        </svg>
      )
    default:
      return null
  }
}
