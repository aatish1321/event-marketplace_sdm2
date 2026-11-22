import { useEffect, useState } from 'react'
import { CalendarPlus, Globe, MapPin } from 'lucide-react'
import { ApiError } from '../api/auth'
import { listEvents } from '../api/events'
import { useAuth } from '../context/AuthContext'
import CreateEventModal from '../components/CreateEventModal'
import { dateParts, tileColor } from '../lib/tiles'

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function eventTime(value) {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isFinite(time) ? time : Infinity
}

function sortEvents(records) {
  return [...records].sort((left, right) => eventTime(left.start_at) - eventTime(right.start_at)
    || String(left.id).localeCompare(String(right.id)))
}

function safeUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export default function OrganizerDashboard() {
  const { token, logout } = useAuth()
  // A new account/session must never inherit another organizer's visible data,
  // pending dialog or requests, including sessions changed in another tab.
  return <DashboardSession key={token} token={token} logout={logout} />
}

function DashboardSession({ token, logout }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    listEvents(token, controller.signal).then((records) => {
      if (!controller.signal.aborted) setEvents(sortEvents(records))
    }).catch((failure) => {
      if (controller.signal.aborted) return
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) logout()
      else setError('We couldn’t load your events. Please try again.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [token, logout, attempt])

  const retry = () => { setError(''); setLoading(true); setAttempt((previous) => previous + 1) }
  const created = (event, warning = '') => {
    setEvents((previous) => sortEvents([event, ...previous.filter((item) => item.id !== event.id)]))
    setCreating(false)
    setNotice(`“${event.title}” was created successfully.${warning ? ` ${warning}` : ''}`)
  }

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <header className="bg-primary text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <span className="text-xl font-extrabold uppercase tracking-widest">Eventify<span className="ml-3 hidden text-sm font-normal normal-case tracking-normal text-white/60 sm:inline">Organizer</span></span>
          <button type="button" onClick={logout} className="rounded-control px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white">Log out</button>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-6 px-5 pb-12 pt-10 sm:flex-row sm:items-end sm:px-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Organizer dashboard</h1>
            <p className="mt-3 text-lg font-medium text-white/80">Events you’ve created, in start order.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} disabled={loading || Boolean(error)} className="h-12 shrink-0 rounded-control bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50">New event</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-12">
        {notice && <p role="status" className="mb-8 rounded-card bg-success/10 px-4 py-3 text-sm font-medium text-success">{notice}</p>}
        <section aria-labelledby="your-events-heading">
          <div className="mb-5 flex items-baseline gap-3">
            <h2 id="your-events-heading" className="text-2xl font-bold">Your events</h2>
            {!loading && !error && <span className="font-mono text-xs tabular-nums text-muted">{events.length}</span>}
          </div>
          {loading ? <p role="status" className="rounded-card border border-border bg-surface p-12 text-center text-sm text-muted">Loading your events…</p>
            : error ? <div role="alert" className="rounded-card bg-danger/10 p-8 text-center"><p className="text-sm text-danger">{error}</p><button type="button" onClick={retry} className="mt-4 h-10 rounded-control border border-danger/30 bg-surface px-4 text-sm font-medium text-danger transition-colors hover:border-danger">Try again</button></div>
              : events.length === 0 ? <div className="rounded-card border border-dashed border-ink/25 bg-surface px-6 py-16 text-center"><CalendarPlus aria-hidden="true" strokeWidth={1.5} className="mx-auto mb-4 h-6 w-6 text-muted" /><h3 className="text-xl font-bold">Your next event starts here</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">You haven’t created any events yet. Select New event to create your first one.</p></div>
                : <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {events.map((event) => {
                    const url = safeUrl(event.stream_url)
                    const online = event.event_type === 'online'
                    const physical = event.event_type === 'physical'
                    const TypeIcon = online ? Globe : MapPin
                    const parts = dateParts(event.start_at)
                    return <article key={event.id} className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm">
                      <div className={`relative h-40 overflow-hidden ${event.cover_url ? 'bg-canvas' : tileColor(event.id)}`}>
                        {event.cover_url
                          ? <img src={event.cover_url} alt="" className="h-full w-full object-cover" />
                          : parts && <div className="absolute bottom-3 left-5 flex items-end gap-3 text-white"><span className="text-6xl font-extrabold leading-[0.85] tabular-nums">{parts.day}</span><span className="pb-0.5 text-base font-bold leading-tight">{parts.month}<span className="block font-medium text-white/80">{parts.weekday}</span></span></div>}
                        <span className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${event.cover_url ? 'bg-surface text-ink' : 'bg-white/20 text-white'}`}>{(online || physical) && <TypeIcon aria-hidden="true" strokeWidth={1.5} className="h-4 w-4" />}{online ? 'Online' : physical ? 'Physical' : 'Event'}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h3 className="break-words text-xl font-bold leading-snug">{event.title}</h3>
                        {event.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted">{event.description}</p>}
                        <dl className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
                          <div><dt className="text-xs font-semibold text-muted">Starts</dt><dd className="mt-1"><time dateTime={event.start_at}>{formatDate(event.start_at)}</time></dd></div>
                          <div><dt className="text-xs font-semibold text-muted">Ends</dt><dd className="mt-1"><time dateTime={event.end_at}>{formatDate(event.end_at)}</time></dd></div>
                          {online ? <div><dt className="text-xs font-semibold text-muted">Event link</dt><dd className="mt-1 break-words">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">Open event website ↗</a> : 'Link unavailable'}</dd></div>
                            : physical ? <div><dt className="text-xs font-semibold text-muted">Venue</dt><dd className="mt-1 break-words">{event.venue_name || 'Venue unavailable'}<span className="mt-1 block text-muted">{event.address}</span></dd></div> : null}
                        </dl>
                      </div>
                    </article>
                  })}
                </div>}
        </section>
      </div>
      {creating && <CreateEventModal token={token} onClose={() => setCreating(false)} onCreated={created} onUnauthorized={logout} />}
    </main>
  )
}
