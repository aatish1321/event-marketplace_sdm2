import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Globe, MapPin, Minus, Plus } from 'lucide-react'
import { ApiError } from '../api/auth'
import { checkout, fetchEvent } from '../api/events'
import { useAuth } from '../context/AuthContext'
import { formatEventDate } from '../lib/dates'
import { dateParts, tileColor } from '../lib/tiles'
import AttendeeLayout, { focusRing } from '../components/AttendeeLayout'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'

// User-facing text for each checkout error status (see backend checkout contract).
const CHECKOUT_ERRORS = {
  400: 'Something went wrong with your order. Please try again.',
  403: 'Only attendee accounts can buy tickets. Please log in again.',
  404: 'This event no longer exists.',
  409: 'Not enough tickets left. We updated the count, so please choose again.',
}

const stepButton = `flex h-11 w-11 items-center justify-center rounded-control border border-border bg-surface text-ink transition-colors hover:border-ink/25 disabled:opacity-40 ${focusRing}`

function ticketsLabel(count) {
  return `${count} ${count === 1 ? 'ticket' : 'tickets'}`
}

export default function EventDetails() {
  const { eventId } = useParams()
  const { token } = useAuth()
  // Bumping the version re-reads the event, which keeps the ticket count live.
  const [version, setVersion] = useState(0)
  const [loaded, setLoaded] = useState({ key: null, event: null, error: null })
  const [quantity, setQuantity] = useState(1)
  const [order, setOrder] = useState({ status: 'idle', purchase: null, message: '' })

  const key = `${eventId}:${version}`
  const refresh = () => setVersion((v) => v + 1)

  useEffect(() => {
    const controller = new AbortController()
    const requestKey = `${eventId}:${version}`
    fetchEvent(eventId, { signal: controller.signal })
      .then((event) => setLoaded({ key: requestKey, event, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return
        const notFound = error instanceof ApiError && error.status === 404
        setLoaded((prev) => ({ key: requestKey, event: notFound ? null : prev.event, error: notFound ? 'notfound' : 'failed' }))
      })
    return () => controller.abort()
  }, [eventId, version])

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
  const buying = order.status === 'buying'
  // Clamp so a refreshed, lower count can never leave an impossible quantity selected.
  const qty = Math.min(Math.max(quantity, 1), Math.max(available, 1))
  const place = online ? 'Online event' : [event.venue_name, event.address, event.country].filter(Boolean).join(' · ')
  const date = formatEventDate(event.start_at)

  const buy = async () => {
    if (buying || soldOut) return
    setOrder({ status: 'buying', purchase: null, message: '' })
    try {
      const purchase = await checkout(token, event.id, qty)
      setOrder({ status: 'done', purchase, message: '' })
      setQuantity(1)
    } catch (error) {
      const message = error instanceof ApiError
        ? CHECKOUT_ERRORS[error.status] ?? CHECKOUT_ERRORS[400]
        : 'Could not reach the server. Check your connection and try again.'
      setOrder({ status: 'error', purchase: null, message })
    } finally {
      refresh() // the count changed either way: our purchase, or someone else's
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
            <p className="mt-3 text-base font-medium text-muted">Bring your ticket confirmation. Organizer cancellation policies apply.</p>
          </section>
        </div>

        <aside aria-label="Buy tickets" className="order-first rounded-card border border-border bg-surface p-6 shadow-card md:order-none md:sticky md:top-6">
          <p aria-live="polite" className={`text-3xl font-bold ${soldOut ? 'text-danger' : 'text-ink'}`}>
            {soldOut ? 'Sold out' : `${ticketsLabel(available)} left`}
          </p>
          <p className="mt-1 text-sm font-medium text-muted">General admission · Digital ticket</p>

          {!soldOut && (
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
                <span className="font-bold">{ticketsLabel(qty)}</span>
              </p>
            </>
          )}

          <button
            type="button"
            onClick={buy}
            disabled={soldOut || buying}
            className={`mt-6 flex h-11 w-full items-center justify-center rounded-control bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            {soldOut ? 'Sold out' : buying ? 'Buying…' : `Buy ${ticketsLabel(qty)}`}
          </button>

          {order.status === 'done' && (
            <p role="status" className="mt-4 flex gap-2 rounded-card bg-success/10 px-4 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              You bought {ticketsLabel(order.purchase.quantity)} for {order.purchase.event_snapshot?.title ?? event.title}.
            </p>
          )}
          {order.status === 'error' && (
            <p role="alert" className="mt-4 rounded-card bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{order.message}</p>
          )}
        </aside>
      </div>
    </AttendeeLayout>
  )
}
