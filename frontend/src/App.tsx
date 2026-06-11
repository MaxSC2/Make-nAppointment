import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
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
import OrderEntryPage from './pages/OrderEntryPage'
import MonitoringPage from './pages/MonitoringPage'

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
        <div className="max-w-md mx-auto mt-12 p-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-400">Недостаточно прав</h2>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
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
        path="/viewer/:studyUid"
        element={
          <ProtectedRoute roles={['doctor', 'admin', 'viewer']}>
            <ViewerPage />
          </ProtectedRoute>
        }
      />
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
          path="/orders/new"
          element={
            <ProtectedRoute roles={['doctor', 'technician', 'admin']}>
              <OrderEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute roles={['admin', 'doctor', 'registrar']}>
              <MonitoringPage />
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
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
