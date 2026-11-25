import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Globe, MapPin, Minus, Plus } from 'lucide-react'
import { ApiError } from '../api/auth'
import { checkout, fetchEvent } from '../api/events'
import { fetchTickets } from '../api/account'
import { useAuth } from '../context/AuthContext'
import { formatEventDate } from '../lib/dates'
import { dateParts, tileColor } from '../lib/tiles'
import AttendeeLayout, { focusRing } from '../components/AttendeeLayout'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'
import { CURRENCIES, formatMoney } from '../lib/money'

// User-facing text for each checkout error status (see backend checkout contract).
const CHECKOUT_ERRORS = {
  400: 'Something went wrong with your order. Please try again.',
  403: 'Only attendee accounts can buy tickets. Please log in again.',
  404: 'This event no longer exists.',
  409: 'Could not complete this booking. Review the event and try again.',
}

const stepButton = `flex h-11 w-11 items-center justify-center rounded-control border border-border bg-surface text-ink transition-colors hover:border-ink/25 disabled:opacity-40 ${focusRing}`

function ticketsLabel(count) {
  return `${count} ${count === 1 ? 'ticket' : 'tickets'}`
}

export default function EventDetails() {
  const { eventId } = useParams()
  const { token } = useAuth()
  return <EventSession key={`${token}:${eventId}`} eventId={eventId} token={token} />
}

function EventSession({ eventId, token }) {
  const purchaseRequest = useRef(null)
  useEffect(() => () => purchaseRequest.current?.abort(), [])
  // Bumping the version re-reads the event, which keeps the ticket count live.
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState({ key: null, event: null, error: null })
  const [quantity, setQuantity] = useState(1)
  const [order, setOrder] = useState({ status: 'idle', purchase: null, message: '' })
  const [booking, setBooking] = useState('loading')

  const key = `${eventId}:${version}`
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${eventId}:${version}`
    fetchEvent(eventId, { signal: controller.signal })
      .then((event) => { if (!controller.signal.aborted) setLoaded({ key: requestKey, event, error: null }) })
      .catch((error) => {
        if (controller.signal.aborted || error.name === 'AbortError') return
        const notFound = error instanceof ApiError && error.status === 404
        setLoaded((prev) => ({ key: requestKey, event: notFound ? null : prev.event, error: notFound ? 'notfound' : 'failed' }))
      })
    return () => controller.abort()
  }, [eventId, version])

  useEffect(() => {
    const controller = new AbortController()
    fetchTickets(token, { eventId, limit: 1, signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setBooking(data.count > 0 ? 'owned' : 'available') })
      .catch(() => { if (!controller.signal.aborted) setBooking('error') })
    return () => controller.abort()
  }, [token, eventId, version])

  usePageTitle(loaded.event?.id === eventId ? loaded.event.title : 'Event')

  // Keep showing the current event while its count refreshes in the background.
  const event = loaded.event?.id === eventId ? loaded.event : null
  if (!event) {
    const settled = loaded.key === key
    return (
      <AttendeeLayout>
        <Link to="/discover" className={`inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink ${focusRing}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Back to events
        </Link>
        {!settled && <p className="mt-8 text-sm text-muted">Loading event…</p>}
        {settled && loaded.error === 'notfound' && <h1 className="mt-8 text-2xl font-bold">Event not found</h1>}
        {settled && loaded.error === 'failed' && (
          <p role="alert" className="mt-8 rounded-card bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
            Could not load this event. Please try again.
          </p>
        )}
      </AttendeeLayout>
    )
  }

  const online = event.event_type === 'online'
  const PlaceIcon = online ? Globe : MapPin
  const available = Math.max(0, event.available_tickets ?? 0)
  const soldOut = available === 0
  const unavailable = event.moderation_blocked || ['draft', 'cancelled'].includes(event.status) || event.end_at && new Date(event.end_at).getTime() <= Date.now()
  const buying = order.status === 'buying'
  const hasTicket = booking === 'owned' || order.status === 'done'
  // Clamp so a refreshed, lower count can never leave an impossible quantity selected.
  const qty = Math.min(Math.max(quantity, 1), Math.max(available, 1))
  const priced = Number.isSafeInteger(event.ticket_price_minor) && event.ticket_price_minor >= 0 && CURRENCIES.includes(event.currency)
  const place = online ? 'Online event' : [event.venue_name, event.address, event.country].filter(Boolean).join(' · ')
  const date = formatEventDate(event.start_at)

  const buy = async () => {
    if (booking !== 'available' || hasTicket || buying || soldOut || unavailable || purchaseRequest.current) return
    const controller = new AbortController()
    purchaseRequest.current = controller
    setOrder({ status: 'buying', purchase: null, message: '' })
    try {
      const purchase = await checkout(token, event.id, qty, {
        expected_unit_price_minor: priced ? event.ticket_price_minor : null,
        expected_currency: priced ? event.currency : null,
      }, { signal: controller.signal })
      if (controller.signal.aborted) return
      setOrder({ status: 'done', purchase, message: '' })
      setQuantity(1)
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof ApiError && error.data?.code === 'event_unavailable'
        ? 'This event is no longer available for booking.'
        : error instanceof ApiError && error.data?.code === 'price_changed'
        ? 'The ticket price changed. Review the updated price and try again.'
        : error instanceof ApiError && error.data?.code === 'insufficient_stock'
        ? 'Not enough tickets left. We updated the count, so please choose again.'
        : error instanceof ApiError && error.status === 409 && typeof error.data?.error === 'string'
        ? error.data.error
        : error instanceof ApiError
        ? CHECKOUT_ERRORS[error.status] ?? CHECKOUT_ERRORS[400]
        : 'Could not reach the server. Check your connection and try again.'
      setOrder({ status: 'error', purchase: null, message })
    } finally {
      purchaseRequest.current = null
      if (!controller.signal.aborted) refresh()
    }
  }

  // Cover photo behind the title, or the event's poster colour (with its big date) when there is none.
  const parts = dateParts(event.start_at)
  const hero = (
    <section className={`relative isolate overflow-hidden text-white ${event.cover_url ? 'bg-primary' : tileColor(event.id)}`}>
      {event.cover_url && (
        <>
          <img src={event.cover_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-primary/90 via-primary/60 to-primary/55" />
        </>
      )}
      <div className={`${pageContainer} relative pb-24 pt-8 md:pb-28`}>
        {!event.cover_url && parts && (
          <div aria-hidden="true" className="absolute right-6 top-16 hidden items-end gap-4 md:flex lg:right-12">
            <span className="text-[9rem] font-extrabold leading-[0.8] tracking-tight tabular-nums">{parts.day}</span>
            <span className="pb-2 text-3xl font-bold leading-tight">
              {parts.month}
              <span className="block font-medium text-white/80">{parts.weekday}</span>
            </span>
          </div>
        )}
        <Link to="/discover" className={`inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-white ${focusRing}`}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" /> Back to events
        </Link>
        <p className="mt-10 text-sm font-semibold text-white/85">{online ? 'Online event' : 'Physical event'}</p>
        <h1 className="mt-3 max-w-4xl text-balance text-5xl font-extrabold leading-[0.95] tracking-[-0.04em] md:text-7xl">{event.title}</h1>
        {date && <p className="mt-5 text-base font-semibold tabular-nums text-white/90"><time dateTime={event.start_at}>{date}</time></p>}
      </div>
    </section>
  )

  return (
    <AttendeeLayout hero={hero}>
      <div className="grid gap-8 md:-mt-24 md:grid-cols-[1fr_320px] md:items-start">
        <div className="space-y-8 md:pt-24">
          <section>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">About this experience</h2>
            <p className="mt-3 whitespace-pre-line text-base font-medium text-muted">{event.description || 'The organizer has not added a description yet.'}</p>
          </section>
          <section>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Where you’ll be</h2>
            <p className="mt-3 flex items-center gap-2 text-base text-muted">
              <PlaceIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden="true" /> {place || 'Location to be announced'}
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-extrabold tracking-[-0.03em]">Before you go</h2>
            <p className="mt-3 text-base font-medium text-muted">Show the admission code in My tickets when you arrive. This is a booking demo; no payment is collected.</p>
          </section>
        </div>

        <aside aria-label="Book tickets" className="order-first rounded-card border border-border bg-surface p-6 shadow-card md:order-none md:sticky md:top-6">
          <p aria-live="polite" className={`text-3xl font-bold ${soldOut ? 'text-danger' : 'text-ink'}`}>
            {soldOut ? 'Sold out' : `${ticketsLabel(available)} left`}
          </p>
          <p className="mt-1 text-sm font-medium text-muted">General admission · Digital ticket</p>
          <p className="mt-3 text-sm font-semibold">Unit price: {formatMoney(event.ticket_price_minor, event.currency)}</p>

          {unavailable && <p role="status" className="mt-4 font-semibold text-danger">{event.status === 'cancelled' ? 'Event cancelled' : 'Booking closed'}</p>}
          <p className="mt-3 text-sm text-muted">Simulated booking. No payment will be collected.</p>
          {!hasTicket && booking === 'available' && !soldOut && !unavailable && (
            <>
              <div className="mt-6 flex items-center justify-between">
                <span id="quantity-label" className="text-sm font-semibold">Quantity</span>
                <div className="flex items-center gap-3" role="group" aria-labelledby="quantity-label">
                  <button type="button" className={stepButton} aria-label="Fewer tickets" disabled={qty <= 1 || buying} onClick={() => setQuantity(qty - 1)}>
                    <Minus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                  <span aria-live="polite" className="w-8 text-center text-lg font-bold tabular-nums">{qty}</span>
                  <button type="button" className={stepButton} aria-label="More tickets" disabled={qty >= available || buying} onClick={() => setQuantity(qty + 1)}>
                    <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <p className="mt-4 flex justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted">Total</span>
                <span className="font-bold">{priced ? formatMoney(BigInt(event.ticket_price_minor) * BigInt(qty), event.currency) : 'Amount not recorded'}</span>
              </p>
            </>
          )}

          {hasTicket ? <>
            <p className="mt-6 font-semibold">You already have a ticket for this event.</p>
            <Link to={`/my-tickets?event_id=${encodeURIComponent(eventId)}`} className={`mt-4 flex h-11 w-full items-center justify-center rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent/90 ${focusRing}`}>Show ticket</Link>
          </> : <button
            type="button"
            onClick={buy}
            disabled={booking !== 'available' || soldOut || buying || Boolean(unavailable)}
            className={`mt-6 flex h-11 w-full items-center justify-center rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            {unavailable ? 'Booking closed' : soldOut ? 'Sold out' : booking === 'loading' ? 'Checking tickets…' : booking === 'error' ? 'Booking unavailable' : buying ? 'Booking…' : `Book ${ticketsLabel(qty)}`}
          </button>}
          {!hasTicket && booking === 'error' && <p role="alert" className="mt-4 text-sm text-danger">Could not check your existing tickets. <button type="button" onClick={() => { setBooking('loading'); refresh() }} className="font-semibold underline">Try again</button></p>}

          {order.status === 'done' && (
            <p role="status" className="mt-4 flex gap-2 rounded-card bg-success/10 px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              You booked {ticketsLabel(order.purchase.quantity)} for {order.purchase.event_snapshot?.title ?? event.title}. No payment was collected.
            </p>
          )}
          {order.status === 'error' && !hasTicket && (
            <p role="alert" className="mt-4 rounded-card bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{order.message}</p>
          )}
          {order.status === 'done' && <p className="mt-3 text-sm">Order total: {formatMoney(order.purchase.total_amount_minor, order.purchase.currency)}</p>}
          {order.status === 'done' && order.purchase.confirmation_email_status === 'sent' && <p className="mt-3 text-sm text-success">Your ticket and QR code have been emailed to your registered address.</p>}
          {order.status === 'done' && order.purchase.confirmation_email_status === 'failed' && <p role="status" className="mt-3 text-sm text-danger">Your ticket is saved, but the confirmation email could not be sent. Use Show ticket to open it here.</p>}
          {order.status === 'done' && order.purchase.confirmation_email_status === 'not_configured' && <p className="mt-3 text-sm text-muted">Email confirmations are not configured yet. Use Show ticket to open your ticket.</p>}
        </aside>
      </div>
    </AttendeeLayout>
  )
}
