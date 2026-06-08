import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import QueuePage from './pages/QueuePage'
import RegistrationPage from './pages/RegistrationPage'
import DoctorPage from './pages/DoctorPage'
import OrdersPage from './pages/OrdersPage'
import StudiesPage from './pages/StudiesPage'
import ViewerPage from './pages/ViewerPage'
import ProtocolPage from './pages/ProtocolPage'
import PatientsPage from './pages/PatientsPage'
import PatientCardPage from './pages/PatientCardPage'

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-slate-400 text-sm">Загрузка...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && user) {
    const has = user.role_codes.some((r) => roles.includes(r)) || user.is_superuser
    if (!has) {
      return (
        <div className="max-w-md mx-auto mt-12 p-6 bg-amber-50 border border-amber-200 rounded-lg">
          <h2 className="text-lg font-semibold text-amber-900">Недостаточно прав</h2>
          <p className="text-sm text-amber-700 mt-1">
            Требуется одна из ролей: {roles.join(', ')}
          </p>
        </div>
      )
    }
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<QueuePage />} />
        <Route
          path="/register"
          element={
            <ProtectedRoute roles={['registrar', 'admin']}>
              <RegistrationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor"
          element={
            <ProtectedRoute roles={['doctor', 'technician', 'admin']}>
              <DoctorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute roles={['doctor', 'admin', 'viewer']}>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studies"
          element={
            <ProtectedRoute roles={['doctor', 'admin', 'viewer']}>
              <StudiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/viewer/:studyUid"
          element={
            <ProtectedRoute roles={['doctor', 'admin', 'viewer']}>
              <ViewerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/protocol/:orderId"
          element={
            <ProtectedRoute roles={['doctor', 'admin']}>
              <ProtocolPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute roles={['doctor', 'admin', 'registrar', 'viewer']}>
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id"
          element={
            <ProtectedRoute roles={['doctor', 'admin', 'registrar', 'viewer']}>
              <PatientCardPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
