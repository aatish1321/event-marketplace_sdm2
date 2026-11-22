import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

// Dark top bar and footer shared by the attendee pages (design: Designpages).
// `hero` is an optional full-width band shown between the bar and the page content.
export default function AttendeeLayout({ hero, children }) {
  const { logout } = useAuth()
  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <nav className="bg-primary text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className={`text-xl font-extrabold uppercase tracking-widest ${focusRing}`}>Eventify</Link>
          <div className="flex items-center gap-2 text-sm font-medium">
            <NavLink to="/discover" end className={`rounded-control px-3 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white ${focusRing}`}>Discover events</NavLink>
            <button type="button" onClick={logout} className={`rounded-control px-3 py-2 text-white/75 transition-colors hover:bg-white/10 hover:text-white ${focusRing}`}>
              Log out
            </button>
          </div>
        </div>
      </nav>

      {hero}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6">{children}</main>

      <footer className="bg-primary py-10 text-white">
        <div className="mx-auto max-w-6xl px-4 text-xl font-extrabold uppercase tracking-widest md:px-6">Eventify</div>
      </footer>
    </div>
  )
}
