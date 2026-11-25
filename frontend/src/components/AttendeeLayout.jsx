import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SiteFooter from './SiteFooter'
import { pageContainer } from '../lib/layout'

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

// Dark top bar and compact footer shared by the signed-in attendee pages.
// `hero` is an optional full-width band shown between the bar and the page content.
export default function AttendeeLayout({ hero, children }) {
  const { logout } = useAuth()
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <nav className="bg-primary text-white">
        <div className={`${pageContainer} flex min-h-16 flex-wrap items-center justify-between gap-2 py-3`}>
          <Link to="/" className={`text-lg font-extrabold uppercase tracking-[0.14em] sm:text-xl sm:tracking-[0.2em] ${focusRing}`}>Eventify</Link>
          <div className="flex items-center gap-1 whitespace-nowrap text-sm font-medium sm:gap-2">
            <NavLink to="/discover" end className={`rounded-control px-3 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white ${focusRing}`}><span className="sm:hidden">Events</span><span className="hidden sm:inline">Discover events</span></NavLink>
            <NavLink to="/my-tickets" className={`rounded-control px-2 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white ${focusRing}`}>My tickets</NavLink>
            <NavLink to="/account" className={`rounded-control px-2 py-2 text-white/75 ${focusRing}`}>Account</NavLink>
            <button type="button" onClick={logout} className={`rounded-control px-3 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}>
              Log out
            </button>
          </div>
        </div>
      </nav>

      {hero}

      <main className={`${pageContainer} flex-1 py-12`}>{children}</main>

      <SiteFooter compact />
    </div>
  )
}
