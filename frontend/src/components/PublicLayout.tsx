import { Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
      className="bg-white dark:bg-slate-950"
    >
      <Outlet />
      {/* Diagnostic: red right-edge marker */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '4px',
          background: 'red',
          zIndex: 9999,
        }}
      />
    </div>
  )
}
