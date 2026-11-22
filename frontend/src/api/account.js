import { ApiError } from './auth'

async function readAccount(url, token, signal) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

async function readPage(path, token, { limit = 20, offset = 0, signal } = {}) {
  const data = await readAccount(`${path}?${new URLSearchParams({ limit, offset })}`, token, signal)
  if (!data || !Number.isInteger(data.count) || data.count < 0 || !Number.isInteger(data.limit)
    || data.limit < 1 || !Number.isInteger(data.offset) || data.offset < 0 || !Array.isArray(data.results)
    || data.results.some((record) => !record || typeof record !== 'object' || typeof record.id !== 'string')) {
    throw new Error('Invalid account response')
  }
  return data
}

export function fetchTickets(token, options) { return readPage('/api/tickets/', token, options) }
export function fetchAdminLogs(token, options) { return readPage('/api/admin/logs/', token, options) }

export async function fetchOrganizerAnalytics(token, { signal } = {}) {
  const data = await readAccount('/api/organizer/analytics/', token, signal)
  if (!data || ['purchase_count', 'tickets_sold', 'events_with_sales', 'unpriced_purchase_count'].some((key) => !Number.isSafeInteger(data[key]) || data[key] < 0)
    || !Array.isArray(data.revenue_by_currency) || data.revenue_by_currency.some((entry) => !entry || !['EUR', 'USD', 'HUF'].includes(entry.currency)
      || typeof entry.total_amount_minor !== 'string' || !/^\d+$/.test(entry.total_amount_minor))) {
    throw new Error('Invalid analytics response')
  }
  return data
}
