import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { buildEventsUrl, fetchEvents } from '../api/events'
import { formatEventDate } from '../lib/dates'
import AttendeeLayout, { focusRing } from '../components/AttendeeLayout'
import EventCard from '../components/EventCard'
import heroImg from '../assets/afterglow.jpg'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'

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

const fieldLabel = 'block text-xs font-semibold text-muted'
const fieldInput = 'mt-1 w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none'

function toCardProps(event) {
  const online = event.event_type === 'online'
  const place = [event.venue_name, event.country].filter(Boolean).join(' · ')
  const tickets = event.available_tickets
  return {
    eventType: online ? 'online' : 'physical',
    category: online ? 'Online' : 'Physical',
    title: event.title,
    imageUrl: event.cover_url ?? undefined,
    startAt: event.start_at,
    eventKey: event.id,
    date: formatEventDate(event.start_at),
    href: `/events/${event.id}`,
    venue: online ? 'Online event' : place || 'Location to be announced',
    price: tickets ? `${tickets} ${tickets === 1 ? 'ticket' : 'tickets'} left` : 'Sold out',
  }
}

export default function Discover() {
  const navigate = useNavigate()
  usePageTitle('Discover events')
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

  const hero = (
    <section className="relative isolate bg-primary text-white">
      <img src={heroImg} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_60%]" />
      {/* Neutral scrim so the headline sits on calm, dark space */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/90 via-primary/65 to-primary/35" />
      <div className={`${pageContainer} pb-12 pt-16`}>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.92] tracking-[-0.045em] md:text-7xl">Discover events</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-white/80 sm:text-xl">Physical and online events. Filter by continent or country.</p>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            setFilter('country', countryInput) // skip the typing delay
          }}
          className="mt-10 flex flex-col gap-4 rounded-card bg-surface p-4 text-ink shadow-2xl md:flex-row md:items-center md:pl-6"
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
          <button type="submit" className={`flex h-11 items-center justify-center gap-2 rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent/90 ${focusRing}`}>
            <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            Explore events
          </button>
        </form>
      </div>
    </section>
  )

  return (
    <AttendeeLayout hero={hero}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Event type">
        {TYPES.map((t) => {
          const active = filters.type === t.value
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter('type', t.value)}
              className={`h-10 rounded-control px-4 text-sm font-semibold transition-colors ${focusRing} ${
                active ? 'bg-surface-dark text-white' : 'border border-border bg-surface text-ink hover:border-ink/25'
              }`}
            >
              {t.label}
            </button>
          )
        })}
        {hasFilters && (
          <button type="button" onClick={clearFilters} className={`h-10 rounded-control px-4 text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-ink ${focusRing}`}>
            Clear filters
          </button>
        )}
      </div>

      <section className="mt-8" aria-live="polite" aria-busy={status === 'loading'}>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-3xl font-extrabold tracking-[-0.03em]">Events</h2>
          {status === 'ready' && (
            <span className="text-sm font-semibold tabular-nums text-muted">{result.events.length} {result.events.length === 1 ? 'event' : 'events'}</span>
          )}
        </div>

        {status === 'loading' && (
          <>
            <p className="sr-only">Loading events…</p>
            <ul aria-hidden="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <li key={item} className="overflow-hidden rounded-card border border-border bg-surface">
                  <div className="aspect-[4/3] animate-pulse bg-ink/5 motion-reduce:animate-none" />
                  <div className="space-y-3 p-5">
                    <div className="h-5 w-3/4 rounded bg-ink/5" />
                    <div className="h-4 w-1/2 rounded bg-ink/5" />
                    <div className="h-10 w-full rounded-control bg-ink/5" />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
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
              <li key={event.id}>
                <EventCard {...toCardProps(event)} onTicketsClick={() => navigate(`/events/${event.id}`)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AttendeeLayout>
  )
}
