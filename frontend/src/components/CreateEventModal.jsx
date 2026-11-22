import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import { createEvent, uploadCover } from '../api/events'

const INITIAL_FORM = { title: '', description: '', start_at: '', end_at: '', event_type: 'physical', venue_name: '', venue_address: '', online_url: '' }
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

function validate(form) {
  const errors = {}
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
  } else {
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

export default function CreateEventModal({ token, onClose, onCreated, onUnauthorized }) {
  const dialogRef = useRef(null)
  const pending = useRef(false)
  const requestRef = useRef(null)
  const [form, setForm] = useState(INITIAL_FORM)
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
    const validation = validate(form)
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
      title: form.title.trim(), description: form.description.trim(),
      start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString(),
      event_type: form.event_type,
      ...(form.event_type === 'physical'
        ? { venue_name: form.venue_name.trim(), address: form.venue_address.trim() }
        : { stream_url: form.online_url.trim() }),
    }
    try {
      const created = await createEvent(token, payload, controller.signal)
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
          const field = { address: 'venue_address', stream_url: 'online_url' }[key] ?? key
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
        <h2 id="create-event-title" className="text-xl font-bold text-ink">Create an event</h2>
        <p id="create-event-description" className="mt-1 text-sm text-muted">Start with the essentials.</p>
      </div>
      <form onSubmit={submit} noValidate aria-busy={submitting} className="space-y-5 p-6">
        {errors.form && <p role="alert" className="rounded-control bg-danger/10 p-3 text-sm text-danger">{errors.form}</p>}
        <Field label="Title" {...fieldProps('title')} required maxLength={200} autoFocus placeholder="Give your event a name" />
        <Field label="Description" {...fieldProps('description')} multiline rows={3} maxLength={5000} placeholder="What can guests look forward to? (optional)" />
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
        <fieldset disabled={submitting}>
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
          </div>
        ) : <Field label="Event URL" {...fieldProps('online_url')} type="url" required maxLength={2048} placeholder="https://" />}
        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-control border border-border px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-control bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50">{submitting ? 'Creating…' : 'Create event'}</button>
        </div>
      </form>
    </dialog>
  )
}
