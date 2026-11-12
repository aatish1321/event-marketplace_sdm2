import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/auth'
import { createEvent } from '../api/events'

const INITIAL_FORM = { title: '', description: '', start_at: '', end_at: '', event_type: 'physical', venue_name: '', venue_address: '', online_url: '' }
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60'

function Field({ label, name, error, multiline, ...props }) {
  const Input = multiline ? 'textarea' : 'input'
  return (
    <div>
      <label htmlFor={`event-${name}`} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <Input id={`event-${name}`} name={name} aria-invalid={Boolean(error)} aria-describedby={error ? `event-${name}-error` : undefined} className={inputClass} {...props} />
      {error && <p id={`event-${name}-error`} role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
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
      if (!controller.signal.aborted) onCreated(created)
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
    <dialog ref={dialogRef} aria-labelledby="create-event-title" aria-describedby="create-event-description" onCancel={(event) => { event.preventDefault(); if (!pending.current) onClose() }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50">
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 id="create-event-title" className="text-xl font-semibold text-slate-900">Create an event</h2>
        <p id="create-event-description" className="mt-1 text-sm text-slate-500">Bring people together. Start with the essentials.</p>
      </div>
      <form onSubmit={submit} noValidate aria-busy={submitting} className="space-y-5 p-6">
        {errors.form && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errors.form}</p>}
        <Field label="Title" {...fieldProps('title')} required maxLength={200} autoFocus placeholder="Give your event a name" />
        <Field label="Description" {...fieldProps('description')} multiline rows={3} maxLength={5000} placeholder="What can guests look forward to? (optional)" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date and time" {...fieldProps('start_at')} type="datetime-local" required />
          <Field label="End date and time" {...fieldProps('end_at')} type="datetime-local" required />
        </div>
        <p className="-mt-2 text-xs text-slate-500">Dates and times use your local time zone.</p>
        <fieldset disabled={submitting}>
          <legend className="mb-2 text-sm font-medium text-slate-700">Event type</legend>
          <div className="grid grid-cols-2 gap-3">
            {['physical', 'online'].map((type) => (
              <label key={type} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm ${form.event_type === type ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>
                <input type="radio" name="event_type" value={type} checked={form.event_type === type} onChange={(event) => { change(event); setErrors({}) }} className="accent-indigo-600" />
                {type === 'physical' ? 'Physical' : 'Online'}
              </label>
            ))}
          </div>
        </fieldset>
        {form.event_type === 'physical' ? (
          <div className="space-y-4 rounded-xl bg-slate-50 p-4">
            <Field label="Venue name" {...fieldProps('venue_name')} required maxLength={200} />
            <Field label="Venue address" {...fieldProps('venue_address')} required maxLength={500} />
          </div>
        ) : <Field label="Event URL" {...fieldProps('online_url')} type="url" required maxLength={2048} placeholder="https://" />}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Creating…' : 'Create event'}</button>
        </div>
      </form>
    </dialog>
  )
}
