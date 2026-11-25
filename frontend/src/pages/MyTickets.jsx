import { Link } from 'react-router-dom'
import { fetchTickets } from '../api/account'
import { useAuth } from '../context/AuthContext'
import AttendeeLayout, { focusRing } from '../components/AttendeeLayout'
import AccountPagination from '../components/AccountPagination'
import useAccountData from '../lib/useAccountData'
import usePageTitle from '../lib/usePageTitle'
import { formatMoney } from '../lib/money'

function date(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Date unavailable'
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null } catch { return null }
}

export default function MyTickets() {
  const { token, logout } = useAuth()
  usePageTitle('My tickets')
  return <TicketsSession key={token} token={token} logout={logout} />
}

function TicketsSession({ token, logout }) {
  const { data, loading, error, refresh, setOffset } = useAccountData(fetchTickets, token, logout)
  return <AttendeeLayout>
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-5xl font-extrabold tracking-[-0.04em]">My tickets</h1><p className="mt-4 text-muted">Your booking receipts, saved as they were when you booked.</p></div>
      <button type="button" onClick={refresh} disabled={loading} className={`rounded-control border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40 ${focusRing}`}>Refresh</button>
    </div>
    {loading ? <p role="status" className="py-12 text-muted">Loading your tickets…</p>
      : error ? <div role="alert" className="rounded-card bg-danger/10 p-6 text-danger">Could not load your tickets. <button type="button" onClick={refresh} className="font-semibold underline">Try again</button></div>
        : <>
          {data.results.length === 0 ? <div className="rounded-card border border-dashed border-border bg-surface p-12 text-center"><h2 className="text-2xl font-bold">No tickets yet</h2><p className="mt-3 text-muted">Find your next experience and your receipt will appear here.</p><Link to="/discover" className={`mt-5 inline-block font-semibold text-accent underline ${focusRing}`}>Discover events</Link></div>
            : <div className="grid gap-6 lg:grid-cols-2">{data.results.map((ticket) => {
              const event = ticket.event_snapshot ?? {}
              const buyer = ticket.buyer_snapshot ?? {}
              const url = safeUrl(event.stream_url)
              return <article key={ticket.id} className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
                <div className="flex items-start justify-between gap-4 bg-primary p-6 text-white"><div><p className="text-xs font-semibold uppercase tracking-widest text-white/70">Booking receipt</p><h2 className="mt-2 break-words text-2xl font-bold">{event.title || 'Event unavailable'}</h2></div><span className="shrink-0 rounded-control bg-white/15 px-3 py-2 text-sm font-bold">{ticket.quantity} {ticket.quantity === 1 ? 'ticket' : 'tickets'}</span></div>
                <dl className="grid gap-4 p-6 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2"><dt className="font-semibold text-muted">Booking status</dt><dd className="mt-1">{ticket.event_status === 'cancelled' ? 'Event cancelled — admission is disabled.' : ticket.event_status === 'unavailable' ? 'Event unavailable — contact the organizer.' : 'Simulated booking — no payment collected.'}</dd></div>
                  <div><dt className="font-semibold text-muted">Starts</dt><dd className="mt-1">{date(event.start_at)}</dd></div>
                  <div><dt className="font-semibold text-muted">Ends</dt><dd className="mt-1">{date(event.end_at)}</dd></div>
                  <div className="sm:col-span-2"><dt className="font-semibold text-muted">{event.event_type === 'online' ? 'Online event' : 'Venue'}</dt><dd className="mt-1 break-words">{event.event_type === 'online' ? url ? <a href={url} target="_blank" rel="noopener noreferrer" className={`text-accent underline ${focusRing}`}>Open event website</a> : 'Link unavailable' : [event.venue_name, event.address].filter(Boolean).join(' · ') || 'Location unavailable'}</dd></div>
                  <div><dt className="font-semibold text-muted">Booked by</dt><dd className="mt-1 break-words">{buyer.full_name || buyer.email || 'Attendee'}{buyer.full_name && buyer.email && <span className="block text-muted">{buyer.email}</span>}</dd></div>
                  <div><dt className="font-semibold text-muted">Booked on</dt><dd className="mt-1">{date(ticket.created_at)}</dd></div>
                  <div><dt className="font-semibold text-muted">Unit price</dt><dd className="mt-1">{formatMoney(ticket.unit_price_minor, ticket.currency)}</dd></div>
                  <div><dt className="font-semibold text-muted">Order total</dt><dd className="mt-1 font-bold">{formatMoney(ticket.total_amount_minor, ticket.currency)}</dd></div>
                  <div className="border-t border-dashed border-border pt-4 sm:col-span-2"><dt className="font-semibold text-muted">Receipt ID</dt><dd className="mt-1 break-all font-mono text-xs">{ticket.id}</dd></div>
                  {ticket.admission_code && <div className="sm:col-span-2"><dt className="font-semibold text-muted">Admission code</dt><dd className="mt-1"><p className="break-all rounded-control bg-canvas p-3 font-mono text-xs select-all">{ticket.admission_code}</p><p className="mt-2 text-muted">Show this code to the organizer. Keep it private. {ticket.checked_in ?? 0} of {ticket.quantity} admissions used.</p></dd></div>}
                </dl>
              </article>
            })}</div>}
          <AccountPagination data={data} onChange={setOffset} />
        </>}
  </AttendeeLayout>
}
