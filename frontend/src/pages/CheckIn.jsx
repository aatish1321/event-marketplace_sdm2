import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { writeAccount } from '../api/account'
import { ApiError } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'

export default function CheckIn() {
  const { token, logout } = useAuth()
  usePageTitle('Check in guests')
  return <CheckInSession key={token} token={token} logout={logout} />
}

function CheckInSession({ token, logout }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef(null)
  const attempt = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  const submit = async (event) => {
    event.preventDefault()
    if (request.current || result) return
    const values = new FormData(event.currentTarget)
    const code = values.get('admission_code').trim()
    const quantity = Number(values.get('quantity'))
    const key = `${code}:${quantity}`
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() }
    const controller = new AbortController()
    request.current = controller
    setBusy(true); setResult(null); setError('')
    try {
      const data = await writeAccount('/api/check-in/', token, { admission_code: code, quantity, request_id: attempt.current.id }, 'POST', controller.signal)
      if (!controller.signal.aborted) { setResult(data); attempt.current = null }
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) logout()
      else setError(failure instanceof ApiError ? failure.message : 'Could not check in. Verify the count before retrying.')
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false) }
    }
  }

  return <main className={`${pageContainer} min-h-screen py-12`}>
    <Link to="/dashboard" className="font-semibold text-accent underline">Back to organizer dashboard</Link>
    <h1 className="mt-8 text-4xl font-extrabold">Check in guests</h1>
    <p className="mt-4 text-muted">Paste the admission code from the attendee’s receipt. For group bookings, admit only the guests arriving now.</p>
    <form onSubmit={submit} className="mt-8 max-w-xl space-y-5 rounded-card border border-border bg-surface p-6">
      <label className="block font-semibold">Admission code<textarea name="admission_code" required maxLength={200} rows={3} disabled={busy || Boolean(result)} className="mt-2 block w-full rounded-control border border-border p-3 font-mono text-sm" /></label>
      <label className="block font-semibold">Guests arriving<input name="quantity" type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} defaultValue={1} required disabled={busy || Boolean(result)} className="mt-2 block w-full rounded-control border border-border p-3" /></label>
      <button disabled={busy || Boolean(result)} className="rounded-control bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Checking in…' : 'Admit guests'}</button>
      {result && <button type="button" onClick={(event) => { event.currentTarget.form.reset(); setResult(null) }} className="ml-4 rounded-control border border-border px-5 py-3 font-semibold">Check in another group</button>}
    </form>
    {error && <p role="alert" className="mt-6 text-danger">{error}</p>}
    {result && <p role="status" className="mt-6 text-success">{result.event_title}: {result.checked_in} of {result.quantity} guests checked in.</p>}
  </main>
}
