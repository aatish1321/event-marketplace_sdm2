import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchProfile, writeAccount } from '../api/account'
import { ApiError } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { getRoleHome } from '../lib/authRoutes'
import useAccountData from '../lib/useAccountData'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'

const input = 'mt-2 block w-full rounded-control border border-border bg-surface p-3'

export default function AccountSettings() {
  const { token, logout, userRole } = useAuth()
  usePageTitle('Account settings')
  return <AccountSession key={token} token={token} logout={logout} role={userRole} />
}

function AccountSession({ token, logout, role }) {
  const { data, loading, error, refresh } = useAccountData(fetchProfile, token, logout)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])

  const submit = async (event, password = false) => {
    event.preventDefault()
    if (request.current) return
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    if (password && values.new_password !== values.confirm_password) { setNotice('Passwords do not match.'); return }
    const payload = password ? { current_password: values.current_password, new_password: values.new_password }
      : { full_name: values.full_name, ...(role === 'organizer' ? { organizer_profile: { name: values.name, contact_email: values.contact_email, organization_id: values.organization_id } } : {}) }
    setBusy(true)
    setNotice('')
    const controller = new AbortController()
    request.current = controller
    try {
      await writeAccount(password ? '/api/account/password/' : '/api/account/', token, payload, password ? 'POST' : 'PUT', controller.signal)
      if (controller.signal.aborted) return
      if (password) { logout(); return }
      setNotice('Profile saved.')
      refresh()
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) logout()
      else setNotice(failure instanceof ApiError ? failure.message : 'Could not save changes. Try again.')
    } finally { if (!controller.signal.aborted) { request.current = null; setBusy(false) } }
  }

  return <main className={`${pageContainer} min-h-screen py-12`}>
    <Link to={getRoleHome(role)} className="font-semibold text-accent underline">Back to your dashboard</Link>
    <h1 className="mt-8 text-4xl font-extrabold">Account settings</h1>
    {notice && <p role="status" className="mt-6 rounded-card border border-border p-4">{notice}</p>}
    {loading ? <p role="status" className="mt-8">Loading profile…</p> : error ? <div role="alert" className="mt-8">Could not load your profile. <button onClick={refresh} className="underline">Try again</button></div> : <form onSubmit={submit} className="mt-8 max-w-xl space-y-5 rounded-card border border-border bg-surface p-6">
      <h2 className="text-2xl font-bold">Your profile</h2>
      <p>Email: {data.email}</p><p className="text-sm text-muted">Email changes and account recovery will be available with email verification.</p>
      <label className="block">Full name<input name="full_name" defaultValue={data.full_name ?? ''} required maxLength={200} autoComplete="name" className={input} /></label>
      {role === 'organizer' && <>
        <label className="block">Organization name<input name="name" defaultValue={data.organizer_profile?.name ?? ''} required maxLength={200} className={input} /></label>
        <label className="block">Organization contact email<input type="email" name="contact_email" defaultValue={data.organizer_profile?.contact_email ?? ''} required className={input} /></label>
        <label className="block">Organization ID<input name="organization_id" defaultValue={data.organizer_profile?.organization_id ?? ''} required maxLength={200} className={input} /></label>
      </>}
      <button disabled={busy} className="rounded-control bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50">Save profile</button>
    </form>}
    <form onSubmit={(event) => submit(event, true)} className="mt-8 max-w-xl space-y-5 rounded-card border border-border bg-surface p-6">
      <h2 className="text-2xl font-bold">Change password</h2>
      <p className="text-sm text-muted">Changing your password signs you out on every device.</p>
      <label className="block">Current password<input name="current_password" type="password" required autoComplete="current-password" className={input} /></label>
      <label className="block">New password<input name="new_password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={input} /></label>
      <label className="block">Confirm new password<input name="confirm_password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={input} /></label>
      <button disabled={busy || loading || error} className="rounded-control bg-accent px-5 py-3 font-semibold text-white disabled:opacity-50">Change password and sign out</button>
    </form>
  </main>
}
