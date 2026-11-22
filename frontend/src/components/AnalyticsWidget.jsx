import { fetchOrganizerAnalytics } from '../api/account'
import { useAuth } from '../context/AuthContext'
import useAccountData from '../lib/useAccountData'
import { formatMoney } from '../lib/money'

export default function AnalyticsWidget() {
  const { token, logout } = useAuth()
  return <AnalyticsSession key={token} token={token} logout={logout} />
}

function AnalyticsSession({ token, logout }) {
  const { data, loading, error, refresh } = useAccountData(fetchOrganizerAnalytics, token, logout)
  return (
    <section aria-labelledby="sales-overview-heading" className="mb-12">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="sales-overview-heading" className="text-3xl font-extrabold tracking-[-0.03em]">Sales overview</h2>
        <button type="button" onClick={refresh} disabled={loading} className="rounded-control border border-border px-4 py-2 text-sm font-semibold disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-focus">Refresh analytics</button>
      </div>
      {loading ? <p role="status" className="rounded-card border border-border bg-surface p-8 text-muted">Loading analytics…</p>
        : error ? <div role="alert" className="rounded-card bg-danger/10 p-6 text-danger">Could not load analytics. <button type="button" onClick={refresh} className="font-semibold underline">Try again</button></div>
          : <><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Booked revenue', data.revenue_by_currency.length ? data.revenue_by_currency.map((entry) => <span className="block" key={entry.currency}>{formatMoney(entry.total_amount_minor, entry.currency)}</span>) : data.purchase_count ? 'Amount not recorded' : 'No orders yet'], ['Tickets sold', data.tickets_sold.toLocaleString()],
              ['Orders', data.purchase_count.toLocaleString()], ['Events with sales', data.events_with_sales.toLocaleString()],
            ].map(([label, value]) => <div key={label} className="min-w-0 rounded-card border border-border bg-surface p-6"><dt className="text-sm font-semibold text-muted">{label}</dt><dd className="mt-3 break-words text-3xl font-extrabold tracking-tight tabular-nums">{value}</dd></div>)}
          </dl><p className="mt-3 text-sm text-muted">All-time recorded orders for your events, not collected payments. Currencies are shown separately.</p>{data.unpriced_purchase_count > 0 && <p className="mt-1 text-sm text-muted">{data.unpriced_purchase_count} orders without recorded prices are excluded from booked revenue.</p>}</>}
    </section>
  )
}
