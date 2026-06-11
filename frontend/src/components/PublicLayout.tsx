import { Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-950">
      <Outlet />
    </div>
  )
}
