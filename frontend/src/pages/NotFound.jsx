import { Link } from 'react-router-dom'
import usePageTitle from '../lib/usePageTitle'
import { buttonLg, onPaper } from '../lib/buttons'
import SiteFooter from '../components/SiteFooter'

export default function NotFound() {
  usePageTitle('Page not found')
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="mx-auto flex h-20 w-full max-w-[1440px] items-center px-6 lg:px-12">
        <Link to="/" className="text-xl font-extrabold uppercase tracking-[0.2em]">Eventify</Link>
      </header>
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-6 py-24 lg:px-12">
        <p className="text-sm font-semibold text-accent">Error 404</p>
        <h1 className="mt-4 max-w-4xl text-balance text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-7xl">We couldn’t find that page</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-secondary">The link may be out of date, or the event may have been removed by its organizer.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/discover" className={`${buttonLg} ${onPaper.primary}`}>Discover events</Link>
          <Link to="/" className={`${buttonLg} ${onPaper.secondary}`}>Go to the homepage</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
