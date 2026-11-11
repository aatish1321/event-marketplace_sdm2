import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { buildEventsUrl, fetchEvents } from '../api/events'
import { useAuth } from '../context/AuthContext'
import EventCard from '../components/EventCard'

// Stored values must match the backend exactly (case-sensitive).
const CONTINENTS = ['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America']
const TYPES = [
  { value: '', label: 'All events' },
  { value: 'physical', label: 'Physical' },
  { value: 'online', label: 'Online' },
]
const EMPTY_FILTERS = { continent: '', country: '', type: '' }
// Wait for typing to pause before querying, so each keystroke is not a request.
const DEBOUNCE_MS = 300

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'
const fieldLabel = 'block text-xs font-bold uppercase tracking-wide text-tertiary-strong'
const fieldInput = 'mt-1 w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none'

function toCardProps(event) {
  const online = event.event_type === 'online'
  const place = [event.venue_name, event.country].filter(Boolean).join(' · ')
  const tickets = event.available_tickets
  return {
    eventType: online ? 'online' : 'physical',
    category: online ? 'Online' : 'Physical',
    title: event.title,
    venue: online ? 'Online event' : place || 'Location to be announced',
    price: tickets ? `${tickets} ${tickets === 1 ? 'ticket' : 'tickets'} left` : 'Sold out',
  }
}

export default function Discover() {
  const { logout } = useAuth()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [countryInput, setCountryInput] = useState('')
  // The URL a result belongs to tells us whether it is still current.
  const [result, setResult] = useState({ url: null, events: [], failed: false })

  const url = buildEventsUrl(filters)
  const status = result.url !== url ? 'loading' : result.failed ? 'error' : 'ready'

  // Apply the typed country once the user pauses.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, country: countryInput })), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [countryInput])

  // Refetch whenever the applied filters change; cancel the previous request.
  useEffect(() => {
    const controller = new AbortController()
    const requestUrl = buildEventsUrl(filters)
    fetchEvents(filters, { signal: controller.signal })
      .then((events) => setResult({ url: requestUrl, events, failed: false }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult({ url: requestUrl, events: [], failed: true })
      })
    return () => controller.abort()
  }, [filters])

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }))
  const clearFilters = () => {
    setCountryInput('')
    setFilters(EMPTY_FILTERS)
  }
  const hasFilters = Boolean(filters.continent || filters.type || countryInput.trim())

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-ink">
      <nav className="bg-primary text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link to="/" className={`text-xl font-black uppercase tracking-widest ${focusRing}`}>Eventify</Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <span aria-current="page">Discover events</span>
            <button type="button" onClick={logout} className={`rounded-pill px-3 py-2 hover:bg-white/10 ${focusRing}`}>
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6">
        <p className="text-xs font-bold uppercase tracking-wide text-tertiary-strong">Go out. Find your people.</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-ink md:text-5xl">Discover events</h1>
        <p className="mt-3 text-base text-muted">From front-row moments to online sessions. Find what's happening near you or join from anywhere.</p>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setFilter('country', countryInput) // skip the typing delay
          }}
          className="mt-8 flex flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-card md:flex-row md:items-center"
        >
          <label className="flex-1">
            <span className={fieldLabel}>Continent</span>
            <select value={filters.continent} onChange={(e) => setFilter('continent', e.target.value)} className={fieldInput}>
              <option value="">All continents</option>
              {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="hidden h-10 w-px bg-border md:block" />
          <label className="flex-1">
            <span className={fieldLabel}>Country</span>
            <input type="text" placeholder="e.g. Hungary" value={countryInput} onChange={(e) => setCountryInput(e.target.value)} className={fieldInput} />
          </label>
          <button type="submit" className={`flex h-[44px] items-center justify-center gap-2 rounded-pill bg-coral-strong px-6 text-sm font-semibold text-white hover:bg-coral-strong/90 ${focusRing}`}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Explore events
          </button>
        </form>

        <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Event type">
          {TYPES.map((t) => {
            const active = filters.type === t.value
            return (
              <button
                key={t.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter('type', t.value)}
                className={`h-10 rounded-pill px-4 text-sm font-semibold transition-colors ${focusRing} ${
                  active ? 'bg-surface-dark text-white' : 'border border-border bg-surface text-ink hover:bg-canvas'
                }`}
              >
                {t.label}
              </button>
            )
          })}
          {hasFilters && (
            <button type="button" onClick={clearFilters} className={`h-10 rounded-pill px-4 text-sm font-semibold text-ink underline hover:bg-surface ${focusRing}`}>
              Clear filters
            </button>
          )}
        </div>

        <section className="mt-8" aria-live="polite" aria-busy={status === 'loading'}>
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-bold">Good times, coming up</h2>
            {status === 'ready' && (
              <span className="text-sm text-muted">{result.events.length} {result.events.length === 1 ? 'event' : 'events'}</span>
            )}
          </div>

          {status === 'loading' && <p className="text-sm text-muted">Loading events…</p>}
          {status === 'error' && (
            <p role="alert" className="rounded-card bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              Could not load events. Please try again.
            </p>
          )}
          {status === 'ready' && result.events.length === 0 && (
            <p className="text-sm text-muted">No events match these filters.</p>
          )}
          {status === 'ready' && result.events.length > 0 && (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {result.events.map((event) => (
                <li key={event.id}><EventCard {...toCardProps(event)} /></li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="bg-primary py-10 text-white">
        <div className="mx-auto max-w-6xl px-4 text-xl font-black uppercase tracking-widest md:px-6">Eventify</div>
      </footer>
    </div>
  )
}
