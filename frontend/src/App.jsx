import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Discover from './pages/Discover'
import EventDetails from './pages/EventDetails'
import MyTickets from './pages/MyTickets'
import AdminLogs from './pages/AdminLogs'
import OrganizerDashboard from './pages/OrganizerDashboard'
import AccountSettings from './pages/AccountSettings'
import CheckIn from './pages/CheckIn'
import AdminManagement from './pages/AdminManagement'
import ProtectedRoute from './components/ProtectedRoute'
import NotFound from './pages/NotFound'
import { ROLES } from './lib/authRoutes'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}><Route path="/account" element={<AccountSettings />} /></Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ATTENDEE]} />}>
          <Route path="/discover" element={<Discover />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/events/:eventId" element={<EventDetails />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ORGANIZER]} />}>
          <Route path="/dashboard" element={<OrganizerDashboard />} />
          <Route path="/check-in" element={<CheckIn />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin-logs" element={<AdminLogs />} />
          <Route path="/admin" element={<AdminManagement />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
