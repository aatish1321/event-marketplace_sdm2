import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRoleHome } from '../lib/authRoutes'

// UI access only: API endpoints must also enforce authentication and roles.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, userRole } = useAuth()
  const home = getRoleHome(userRole)

  if (!isAuthenticated || !home) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(userRole)) return <Navigate to={home} replace />

  return children ?? <Outlet />
}
