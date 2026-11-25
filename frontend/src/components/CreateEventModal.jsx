import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import { createEvent, updateEvent, uploadCover } from '../api/events'

import { CURRENCIES, parsePriceMinor } from '../lib/money'

const INITIAL_FORM = { title: '', description: '', start_at: '', end_at: '', event_type: 'physical', venue_name: '', venue_address: '', online_url: '', ticket_price: '0.00', currency: 'EUR', available_tickets: '0', continent: '', country: '', latitude: '', longitude: '', status: 'published' }
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_COVER_BYTES = 2 * 1024 * 1024 // matches the backend limit; the server re-checks both
const inputClass = 'w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60'

function Field({ label, name, error, multiline, ...props }) {
  const Input = multiline ? 'textarea' : 'input'
  return (
    <div>
      <label htmlFor={`event-${name}`} className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <Input id={`event-${name}`} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? `event-${name}-error` : undefined} className={inputClass} {...props} />
      {error && <p id={`event-${name}-error`} role="alert" className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
}

function coverProblem(file) {
  if (!file) return ''
  if (!COVER_TYPES.includes(file.type)) return 'Choose a JPEG, PNG or WebP image.'
  if (file.size > MAX_COVER_BYTES) return 'Use a photo of 2 MB or less.'
  return ''
}

function validate(form, unpriced) {
  const errors = {}
  if (!(unpriced && form.ticket_price === '') && parsePriceMinor(form.ticket_price) === null) errors.ticket_price = 'Enter a non-negative price with up to two decimal places within the supported limit.'
  if (!CURRENCIES.includes(form.currency)) errors.currency = 'Choose a supported currency.'
  if (!/^\d+$/.test(form.available_tickets) || !Number.isSafeInteger(Number(form.available_tickets))) errors.available_tickets = 'Enter a non-negative whole number within the supported limit.'
  if (!form.title.trim()) errors.title = 'Enter an event title.'
  else if (form.title.trim().length > 200) errors.title = 'Use no more than 200 characters.'
  if (form.description.length > 5000) errors.description = 'Use no more than 5000 characters.'
  const start = new Date(form.start_at).getTime()
  const end = new Date(form.end_at).getTime()
  if (!form.start_at || !Number.isFinite(start)) errors.start_at = 'Choose a valid start date and time.'
  if (!form.end_at || !Number.isFinite(end)) errors.end_at = 'Choose a valid end date and time.'
  else if (Number.isFinite(start) && end <= start) errors.end_at = 'End time must be after start time.'
  if (form.event_type === 'physical') {
    if (!form.venue_name.trim()) errors.venue_name = 'Enter a venue name.'
    else if (form.venue_name.trim().length > 200) errors.venue_name = 'Use no more than 200 characters.'
    if (!form.venue_address.trim()) errors.venue_address = 'Enter a venue address.'
    else if (form.venue_address.trim().length > 500) errors.venue_address = 'Use no more than 500 characters.'
    if ((form.latitude === '') !== (form.longitude === '')) errors.latitude = 'Provide both latitude and longitude, or leave both blank.'
    for (const [field, bound] of [['latitude', 90], ['longitude', 180]]) {
      if (form[field] !== '' && (!Number.isFinite(Number(form[field])) || Math.abs(Number(form[field])) > bound)) errors[field] = `Use a number from -${bound} to ${bound}.`
    }
  } else if (form.event_type === 'online') {
    try {
      const url = new URL(form.online_url.trim())
      if (!/^https?:\/\//i.test(form.online_url.trim()) || !['https:', 'http:'].includes(url.protocol)
        || form.online_url.trim().length > 2048) throw new Error()
    } catch {
      errors.online_url = 'Enter a valid http:// or https:// event URL (up to 2048 characters).'
    }
  }
  return errors
}

function localDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function initialForm(event) {
  if (!event) return INITIAL_FORM
  const minor = event.ticket_price_minor == null ? null : BigInt(event.ticket_price_minor)
  return { ...INITIAL_FORM, ...Object.fromEntries(Object.keys(INITIAL_FORM).filter((key) => event[key] != null).map((key) => [key, String(event[key])])),
    start_at: localDate(event.start_at), end_at: localDate(event.end_at),
    venue_address: event.address ?? '', online_url: event.stream_url ?? '',
    available_tickets: String(event.available_tickets ?? 0),
    ticket_price: minor == null ? '' : `${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`,
    latitude: event.location ? String(event.location.coordinates[1]) : '', longitude: event.location ? String(event.location.coordinates[0]) : '',
  }
}

export default function CreateEventModal({ token, event: existing, onClose, onCreated, onUnauthorized }) {
  const dialogRef = useRef(null)
  const pending = useRef(false)
  const requestRef = useRef(null)
  const [form, setForm] = useState(() => initialForm(existing))
  const [cover, setCover] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    dialog.showModal()
    return () => {
      requestRef.current?.abort()
      dialog.close()
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])

  const change = (event) => {
    const { name, value } = event.target
    setForm((previous) => ({ ...previous, [name]: value }))
    setErrors((previous) => ({ ...previous, [name]: undefined, form: undefined }))
  }
  const fieldProps = (name) => ({ name, value: form[name], onChange: change, error: errors[name], disabled: submitting })

  const submit = async (event) => {
    event.preventDefault()
    if (pending.current) return
    const unpriced = Boolean(existing && existing.ticket_price_minor == null && form.ticket_price === '')
    const validation = validate(form, unpriced)
    const problem = coverProblem(cover)
    if (problem) validation.cover = problem
    setErrors(validation)
    if (Object.keys(validation).length) {
      dialogRef.current.querySelector(`[name="${Object.keys(validation)[0]}"]`)?.focus()
      return
    }
    pending.current = true
    setSubmitting(true)
    const controller = new AbortController()
    requestRef.current = controller
    const payload = {
      ticket_price_minor: unpriced ? null : parsePriceMinor(form.ticket_price), currency: unpriced ? null : form.currency,
      ...(!existing || Number(form.available_tickets) !== existing.available_tickets ? { available_tickets: Number(form.available_tickets), ...(existing ? { expected_available_tickets: existing.available_tickets } : {}) } : {}),
      continent: form.continent.trim(), country: form.country.trim(), status: form.status,
      title: form.title.trim(), description: form.description.trim(),
      start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString(),
      event_type: form.event_type,
      ...(form.event_type === 'physical'
        ? { venue_name: form.venue_name.trim(), address: form.venue_address.trim(), location: form.latitude !== '' && form.longitude !== '' ? { type: 'Point', coordinates: [Number(form.longitude), Number(form.latitude)] } : null }
        : form.event_type === 'online' ? { stream_url: form.online_url.trim() } : {}),
    }
    try {
      const created = existing ? await updateEvent(token, existing.id, payload, controller.signal) : await createEvent(token, payload, controller.signal)
      let result = created
      let warning = ''
      if (cover) {
        // The event exists already, so a failed upload must not lose it.
        try {
          result = await uploadCover(token, created.id, cover, controller.signal)
        } catch (uploadError) {
          if (controller.signal.aborted) return
          if (uploadError instanceof ApiError && [401, 403].includes(uploadError.status)) {
            onUnauthorized()
            return
          }
          warning = 'The photo could not be uploaded.'
        }
      }
      if (!controller.signal.aborted) onCreated(result, warning)
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        onUnauthorized()
        return
      }
      const nextErrors = { form: error instanceof ApiError && typeof error.data?.error === 'string'
        ? error.data.error : 'Could not create your event. Check your connection and try again.' }
      if (error instanceof ApiError && error.data?.fields) {
        for (const [key, value] of Object.entries(error.data.fields)) {
          const field = { address: 'venue_address', stream_url: 'online_url', ticket_price_minor: 'ticket_price' }[key] ?? key
          if (field in INITIAL_FORM && typeof value === 'string') nextErrors[field] = value
        }
      }
      setErrors(nextErrors)
    } finally {
      pending.current = false
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} aria-labelledby="create-event-title" aria-describedby="create-event-description" onCancel={(event) => { event.preventDefault(); if (!pending.current) onClose() }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-primary/60">
      <div className="border-b border-border px-6 py-5">
        <h2 id="create-event-title" className="text-2xl font-extrabold tracking-[-0.03em] text-ink">{existing ? 'Edit event' : 'Create an event'}</h2>
        <p id="create-event-description" className="mt-1 text-sm text-muted">Start with the essentials.</p>
      </div>
      <form onSubmit={submit} noValidate aria-busy={submitting} className="space-y-5 p-6">
        {errors.form && <p role="alert" className="rounded-control bg-danger/10 p-3 text-sm text-danger">{errors.form}</p>}
        <Field label="Title" {...fieldProps('title')} required maxLength={200} autoFocus placeholder="Give your event a name" />
        <Field label="Description" {...fieldProps('description')} multiline rows={3} maxLength={5000} placeholder="What can guests look forward to? (optional)" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="event-continent" className="mb-1.5 block text-sm font-semibold">Continent</label><select id="event-continent" name="continent" value={form.continent} onChange={change} disabled={submitting} className={inputClass}><option value="">Not specified</option>{['Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'].map((name) => <option key={name}>{name}</option>)}</select></div>
          <Field label="Country" {...fieldProps('country')} maxLength={100} />
        </div>
        <div><label htmlFor="event-status" className="mb-1.5 block text-sm font-semibold">Status</label><select id="event-status" name="status" value={form.status} onChange={change} disabled={submitting || existing?.status === 'cancelled'} className={inputClass}><option value="published">Published</option><option value="draft">Draft</option><option value="cancelled">Cancelled</option></select><p className="mt-1 text-xs text-muted">Drafts are private. Cancellation stops bookings and admission and cannot be undone.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Ticket price" {...fieldProps('ticket_price')} inputMode="decimal" required />
          <div><label htmlFor="event-currency" className="mb-1.5 block text-sm font-medium">Currency</label><select id="event-currency" name="currency" value={form.currency} onChange={change} disabled={submitting} className={inputClass}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</select></div>
          <Field label="Tickets available" {...fieldProps('available_tickets')} inputMode="numeric" required />
        </div>
        <div>
          <label htmlFor="event-cover" className="mb-1.5 block text-sm font-semibold text-ink">Cover photo <span className="font-normal text-muted">(optional)</span></label>
          <input
            id="event-cover" name="cover" type="file" accept={COVER_TYPES.join(',')} disabled={submitting}
            aria-invalid={Boolean(errors.cover)} aria-describedby={errors.cover ? 'event-cover-error event-cover-hint' : 'event-cover-hint'}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              setCover(file)
              setErrors((previous) => ({ ...previous, cover: coverProblem(file) || undefined, form: undefined }))
            }}
            className="block w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-control file:border-0 file:bg-ink file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-ink/85 disabled:opacity-60"
          />
          <p id="event-cover-hint" className="mt-1 text-xs text-muted">JPEG, PNG or WebP, up to 2 MB. Without a photo the event gets a coloured poster.</p>
          {errors.cover && <p id="event-cover-error" role="alert" className="mt-1 text-xs text-danger">{errors.cover}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date and time" {...fieldProps('start_at')} type="datetime-local" required />
          <Field label="End date and time" {...fieldProps('end_at')} type="datetime-local" required />
        </div>
        <p className="-mt-2 text-xs text-muted">Dates and times use your local time zone.</p>
        <fieldset disabled={submitting || Boolean(existing)}>
          <legend className="mb-2 text-sm font-medium text-ink">Event type</legend>
          <div className="grid grid-cols-2 gap-3">
            {['physical', 'online'].map((type) => (
              <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-control border px-4 py-3 text-sm transition-colors ${form.event_type === type ? 'border-primary bg-canvas text-ink' : 'border-border text-muted'}`}>
                <input type="radio" name="event_type" value={type} checked={form.event_type === type} onChange={(event) => { change(event); setErrors({}) }} className="accent-accent" />
                {type === 'physical' ? 'Physical' : 'Online'}
              </label>
            ))}
          </div>
        </fieldset>
        {form.event_type === 'physical' ? (
          <div className="space-y-4 rounded-card bg-canvas p-4">
            <Field label="Venue name" {...fieldProps('venue_name')} required maxLength={200} />
            <Field label="Venue address" {...fieldProps('venue_address')} required maxLength={500} />
            <p className="text-xs text-muted">Optional coordinates make this event available in nearby search.</p>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Latitude" {...fieldProps('latitude')} inputMode="decimal" /><Field label="Longitude" {...fieldProps('longitude')} inputMode="decimal" /></div>
          </div>
        ) : form.event_type === 'online' ? <Field label="Event URL" {...fieldProps('online_url')} type="url" required maxLength={2048} placeholder="https://" /> : null}
        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-control border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50">{submitting ? 'Saving…' : existing ? 'Save changes' : 'Create event'}</button>
        </div>
      </form>
    </dialog>
  )
}
