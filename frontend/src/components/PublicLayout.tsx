import { Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-950">
      <Outlet />
    </div>
  )
}
