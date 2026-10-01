import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Register from './pages/Register'
import Login from './pages/Login'
import RoleHome from './pages/RoleHome'
import ProtectedRoute from './components/ProtectedRoute'
import { ROLES } from './lib/authRoutes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ATTENDEE]} />}>
          <Route path="/discover" element={<RoleHome title="Discover events" description="Event discovery will be available here soon." />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ORGANIZER]} />}>
          <Route path="/dashboard" element={<RoleHome title="Organizer dashboard" description="Event management will be available here soon." />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin-logs" element={<RoleHome title="Admin logs" description="Audit logs will be available here soon." />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
