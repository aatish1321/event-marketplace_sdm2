import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SiteFooter from '../components/SiteFooter'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'

// Placeholder home for roles whose tools are not built yet (currently admin logs).
export default function RoleHome({ title, description }) {
  const { userRole, logout } = useAuth()
  usePageTitle(title)
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="bg-ink text-white">
        <div className={`${pageContainer} flex h-16 items-center justify-between gap-4`}>
          <Link to="/" className="text-xl font-extrabold uppercase tracking-[0.2em]">Eventify</Link>
          <button type="button" onClick={logout} className="rounded-control px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white">Log out</button>
        </div>
        <div className={`${pageContainer} pb-14 pt-12`}>
          <p className="text-sm font-semibold capitalize text-white/60">{userRole}</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-[0.92] tracking-[-0.045em] sm:text-7xl">{title}</h1>
        </div>
      </header>
      <main className={`${pageContainer} flex-1 py-12`}>
        <div className="max-w-2xl rounded-card border border-dashed border-ink/25 bg-surface px-8 py-12">
          <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Coming soon</h2>
          <p className="mt-2 text-base leading-7 text-muted">{description}</p>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  )
}
