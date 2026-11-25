import { fetchAdminLogs } from '../api/account'
import { useAuth } from '../context/AuthContext'
import AccountPagination from '../components/AccountPagination'
import SiteFooter from '../components/SiteFooter'
import useAccountData from '../lib/useAccountData'
import usePageTitle from '../lib/usePageTitle'
import { pageContainer } from '../lib/layout'
import { Link } from 'react-router-dom'

export default function AdminLogs() {
  const { token, logout } = useAuth()
  usePageTitle('Admin logs')
  return <LogsSession key={token} token={token} logout={logout} />
}

function LogsSession({ token, logout }) {
  const { data, loading, error, refresh, setOffset } = useAccountData(fetchAdminLogs, token, logout)
  return <div className="flex min-h-screen flex-col bg-canvas text-ink">
    <header className="bg-primary text-white"><div className={`${pageContainer} flex h-16 items-center justify-between`}><span className="text-xl font-extrabold uppercase tracking-[0.2em]">Eventify</span><button type="button" onClick={logout} className="rounded-control px-3 py-2 text-sm hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-focus">Log out</button></div><div className={`${pageContainer} pb-12 pt-8`}><h1 className="text-5xl font-extrabold tracking-[-0.04em] sm:text-7xl">Admin logs</h1><p className="mt-5 text-lg text-white/75">Application activity and diagnostics, newest first.</p></div></header>
    <main className={`${pageContainer} flex-1 py-12`}>
      <nav aria-label="Admin tools" className="mb-8 flex gap-6 font-semibold text-accent"><Link to="/admin" className="underline">Manage users and events</Link><Link to="/account" className="underline">Account settings</Link></nav>
      <div className="mb-6 flex items-center justify-between gap-4"><h2 className="text-2xl font-bold">System logs</h2><button type="button" onClick={refresh} disabled={loading} className="rounded-control border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-focus">Refresh</button></div>
      {loading ? <p role="status" className="py-12 text-muted">Loading logs…</p>
        : error ? <div role="alert" className="rounded-card bg-danger/10 p-6 text-danger">Could not load logs. <button type="button" onClick={refresh} className="font-semibold underline">Try again</button></div>
          : <>
            {data.results.length === 0 ? <p className="rounded-card border border-border bg-surface p-12 text-center text-muted">No logs found</p>
              : <div className="overflow-x-auto rounded-card border border-border bg-surface" role="region" aria-label="System log entries" tabIndex={0}>
                <table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">System logs, newest first</caption><thead className="bg-primary/5 text-muted"><tr>{['Time', 'Level', 'Request', 'Status', 'Message'].map((heading) => <th scope="col" key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>
                  {data.results.map((entry) => <tr key={entry.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-4 py-4">{entry.timestamp && !Number.isNaN(new Date(entry.timestamp).getTime()) ? new Date(entry.timestamp).toLocaleString() : 'Time unavailable'}</td>
                    <td className="px-4 py-4"><span className={`rounded-control px-2 py-1 text-xs font-bold ${['ERROR', 'CRITICAL'].includes(entry.level) ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-ink'}`}>{entry.level || '—'}</span></td>
                    <td className="max-w-xs break-words px-4 py-4"><span className="font-semibold">{entry.method}</span> {entry.endpoint || '—'}</td>
                    <td className="px-4 py-4 tabular-nums">{entry.status_code ?? '—'}</td>
                    <td className="min-w-64 max-w-xl px-4 py-4"><p className="whitespace-pre-wrap break-words">{entry.message || '—'}</p>{entry.traceback && <details className="mt-3"><summary className="cursor-pointer font-semibold text-accent focus-visible:ring-2 focus-visible:ring-focus">View traceback</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-control bg-canvas p-3 text-xs">{entry.traceback}</pre></details>}</td>
                  </tr>)}
                </tbody></table>
              </div>}
            <AccountPagination data={data} onChange={setOffset} />
          </>}
    </main><SiteFooter compact />
  </div>
}
