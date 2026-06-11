import { Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="w-screen h-dvh bg-slate-50 dark:bg-slate-950 overflow-hidden">
      <Outlet />
    </div>
  )
}
