import { useEffect, useState } from 'react'
import { ApiError } from '../api/auth'
import { listEvents } from '../api/events'
import { useAuth } from '../context/AuthContext'
import CreateEventModal from '../components/CreateEventModal'

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
  const created = (event) => {
    setEvents((previous) => sortEvents([event, ...previous.filter((item) => item.id !== event.id)]))
    setCreating(false)
    setNotice(`“${event.title}” was created successfully.`)
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <span className="text-lg font-semibold tracking-tight">Event marketplace<span className="ml-3 hidden text-xs font-medium uppercase tracking-widest text-indigo-600 sm:inline">Organizer</span></span>
          <button type="button" onClick={logout} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Log out</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-600">Your events, all in one place</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Organizer dashboard</h1>
            <p className="mt-3 text-sm text-slate-500">Create memorable experiences and keep track of what’s next.</p>
          </div>
          <button type="button" onClick={() => setCreating(true)} disabled={loading || Boolean(error)} className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Create New Event</button>
        </div>
        {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
        <section aria-labelledby="your-events-heading" className="mt-10">
          <div className="mb-5 flex items-center gap-3">
            <h2 id="your-events-heading" className="text-lg font-semibold">Your events</h2>
            {!loading && !error && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-600">{events.length}</span>}
          </div>
          {loading ? <p role="status" className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading your events…</p>
            : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><p className="text-sm text-red-700">{error}</p><button type="button" onClick={retry} className="mt-4 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700">Try again</button></div>
              : events.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><div aria-hidden="true" className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl text-indigo-500">+</div><h3 className="text-xl font-semibold">Your next event starts here</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">You haven’t created any events yet. Select Create New Event to bring your first idea to life.</p></div>
                : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {events.map((event) => {
                    const url = safeUrl(event.stream_url)
                    return <article key={event.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <span className={`self-start rounded-full px-3 py-1 text-xs font-medium ${event.event_type === 'online' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>{event.event_type === 'online' ? 'Online' : event.event_type === 'physical' ? 'Physical' : 'Event'}</span>
                      <h3 className="mt-4 break-words text-xl font-semibold">{event.title}</h3>
                      {event.description && <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-slate-500">{event.description}</p>}
                      <dl className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-sm">
                        <div><dt className="text-xs font-medium text-slate-400">Starts</dt><dd className="mt-1"><time dateTime={event.start_at}>{formatDate(event.start_at)}</time></dd></div>
                        <div><dt className="text-xs font-medium text-slate-400">Ends</dt><dd className="mt-1"><time dateTime={event.end_at}>{formatDate(event.end_at)}</time></dd></div>
                        {event.event_type === 'online' ? <div><dt className="text-xs font-medium text-slate-400">Event link</dt><dd className="mt-1 break-words">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Open event website ↗</a> : 'Link unavailable'}</dd></div>
                          : event.event_type === 'physical' ? <div><dt className="text-xs font-medium text-slate-400">Venue</dt><dd className="mt-1 break-words">{event.venue_name || 'Venue unavailable'}<span className="mt-1 block text-slate-500">{event.address}</span></dd></div> : null}
                      </dl>
                    </article>
                  })}
                </div>}
        </section>
      </div>
      {creating && <CreateEventModal token={token} onClose={() => setCreating(false)} onCreated={created} onUnauthorized={logout} />}
    </main>
  )
}
