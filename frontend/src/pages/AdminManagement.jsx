import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminEvents, fetchAdminUsers, writeAccount } from '../api/account'
import { ApiError } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import useAccountData from '../lib/useAccountData'
import AccountPagination from '../components/AccountPagination'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'

export default function AdminManagement() {
  const { token, logout } = useAuth()
  const [view, setView] = useState('users')
  usePageTitle('Administration')
  return <main className={`${pageContainer} min-h-screen py-12`}>
    <nav className="flex gap-6 font-semibold text-accent" aria-label="Admin tools"><Link to="/admin-logs" className="underline">System logs</Link><Link to="/account" className="underline">Account settings</Link><button onClick={logout} className="underline">Log out</button></nav>
    <h1 className="mt-8 text-4xl font-extrabold">Administration</h1>
    <div className="mt-8 flex gap-4" role="group" aria-label="Manage"><button onClick={() => setView('users')} aria-pressed={view === 'users'} className="rounded-control border border-border px-5 py-3 font-semibold aria-pressed:bg-primary aria-pressed:text-white">Users</button><button onClick={() => setView('events')} aria-pressed={view === 'events'} className="rounded-control border border-border px-5 py-3 font-semibold aria-pressed:bg-primary aria-pressed:text-white">Events</button></div>
    <ManagementList key={`${token}:${view}`} token={token} logout={logout} view={view} />
  </main>
}

function ManagementList({ token, logout, view }) {
  const { data, loading, error, refresh, setOffset } = useAccountData(view === 'users' ? fetchAdminUsers : fetchAdminEvents, token, logout)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const request = useRef(null)
  useEffect(() => () => request.current?.abort(), [])
  const change = async (record) => {
    if (request.current) return
    const payload = view === 'users' ? { active: !record.active } : { moderation_blocked: !record.moderation_blocked }
    const action = view === 'users' ? record.active ? 'Suspend this account and invalidate its sessions?' : 'Restore this account?'
      : record.moderation_blocked ? 'Restore this event to its previous visibility?' : 'Hide this event and stop new bookings and check-ins?'
    if (!window.confirm(action)) return
    setBusy(true); setNotice('')
    const controller = new AbortController()
    request.current = controller
    try {
      await writeAccount(`/api/admin/${view}/${encodeURIComponent(record.id)}/`, token, payload, 'PUT', controller.signal)
      if (controller.signal.aborted) return
      setNotice('Change saved.'); refresh()
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) logout()
      else setNotice(failure instanceof ApiError ? failure.message : 'Could not save this change. Try again.')
    } finally { if (!controller.signal.aborted) { request.current = null; setBusy(false) } }
  }

  return <section className="mt-8" aria-label={view === 'users' ? 'User management' : 'Event moderation'}>
    {notice && <p role="status" className="mb-6">{notice}</p>}
    {loading ? <p role="status">Loading {view}…</p> : error ? <div role="alert">Could not load {view}. <button onClick={refresh} className="underline">Try again</button></div> : <>
      {data.results.length === 0 ? <p>No {view} found.</p> : <ul className="space-y-4">{data.results.map((record) => <li key={record.id} className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface p-6">
        <div><h2 className="text-lg font-bold">{view === 'users' ? record.full_name || record.email : record.title}</h2><p className="mt-1 break-all text-sm text-muted">{view === 'users' ? `${record.email} · ${record.role} · ${record.active ? 'Active' : 'Suspended'}` : `${record.status || 'published'} · ${record.moderation_blocked ? 'Hidden by admin' : 'Visible according to status'}`}</p></div>
        <button type="button" disabled={busy || view === 'users' && record.role === 'admin'} onClick={() => change(record)} className="rounded-control border border-border px-4 py-2 font-semibold disabled:opacity-40">{view === 'users' ? record.active ? 'Suspend account' : 'Restore account' : record.moderation_blocked ? 'Restore event' : 'Hide event'}</button>
      </li>)}</ul>}
      <AccountPagination data={data} onChange={setOffset} />
    </>}
  </section>
}
