import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Discover from './pages/Discover'
import RoleHome from './pages/RoleHome'
import OrganizerDashboard from './pages/OrganizerDashboard'
import ProtectedRoute from './components/ProtectedRoute'
import { ROLES } from './lib/authRoutes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ATTENDEE]} />}>
          <Route path="/discover" element={<Discover />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ORGANIZER]} />}>
          <Route path="/dashboard" element={<OrganizerDashboard />} />
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
