export default function AccountPagination({ data, onChange }) {
  const { count, limit, offset, results } = data
  const button = 'rounded-control border border-border bg-surface px-4 py-2 text-sm font-semibold hover:border-ink/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus'
  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-muted">{count === 0 ? '0 results' : !results.length ? 'No results on this page' : `${offset + 1}–${offset + results.length} of ${count}`}</p>
      <div className="flex gap-2">
        <button type="button" className={button} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>Previous</button>
        <button type="button" className={button} disabled={offset + limit >= count} onClick={() => onChange(offset + limit)}>Next</button>
      </div>
    </nav>
  )
}
