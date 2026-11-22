import { Link } from 'react-router-dom'
import { pageContainer } from '../lib/layout'

const linkClass = 'text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'

// Full footer for public pages; `compact` (signed-in pages) keeps just the brand line.
export default function SiteFooter({ compact = false }) {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-ink text-white">
      <div className={`${pageContainer} py-12`}>
        {!compact && (
          <div className="flex flex-col gap-12 pb-12 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <Link to="/" className="text-xl font-extrabold uppercase tracking-[0.2em]">Eventify</Link>
              <p className="mt-4 text-sm leading-6 text-white/60">Tickets for concerts, comedy, sports, talks and online events, and the tools to sell your own.</p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 text-sm">
              <div>
                <p className="font-semibold">Attend</p>
                <ul className="mt-4 space-y-3">
                  <li><Link to="/discover" className={linkClass}>Discover events</Link></li>
                  <li><Link to="/login" className={linkClass}>Log in</Link></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold">Organize</p>
                <ul className="mt-4 space-y-3">
                  <li><Link to="/register" className={linkClass}>Create an account</Link></li>
                  <li><Link to="/dashboard" className={linkClass}>Organizer dashboard</Link></li>
                </ul>
              </div>
            </nav>
          </div>
        )}
        <div className={`flex items-center justify-between gap-4 text-sm text-white/50 ${compact ? '' : 'border-t border-white/10 pt-8'}`}>
          {compact ? <Link to="/" className="text-lg font-extrabold uppercase tracking-[0.2em] text-white">Eventify</Link> : <span />}
          <p className="tabular-nums">© {year} Eventify</p>
        </div>
      </div>
    </footer>
  )
}
