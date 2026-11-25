import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import AnalyticsWidget from '../components/AnalyticsWidget'
import MyTickets from './MyTickets'
import AdminLogs from './AdminLogs'
import { makeToken } from '../test/authFixtures'

const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
const page = (results = [], count = results.length, offset = 0) => ({ results, count, offset, limit: 20 })
const ticket = (title = 'Original event', stream_url = 'https://example.com/room') => ({
  id: 'receipt-123', quantity: 2, created_at: '2030-01-01T12:00:00Z',
  buyer_snapshot: { user_id: 'user-123', full_name: 'Original buyer', email: 'buyer@example.com' },
  event_snapshot: { event_id: 'deleted-event', title, organizer_id: 'organizer', event_type: 'online',
    stream_url, start_at: '2030-05-10T10:00:00Z', end_at: '2030-05-10T11:00:00Z' },
})
const log = (message = 'Server failed') => ({ id: 'log-123', level: 'ERROR', endpoint: '/api/checkout/',
  method: 'POST', status_code: 500, message, traceback: 'Traceback: exception', timestamp: '2030-01-01T12:00:00Z' })
const totals = { purchase_count: 3, tickets_sold: 9, events_with_sales: 2, unpriced_purchase_count: 3, revenue_by_currency: [] }

function mount(Component, role, fetch) {
  const token = makeToken({ role })
  localStorage.setItem('access_token', token)
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><MemoryRouter initialEntries={['/view']}><Routes>
    <Route path="/view" element={<ProtectedRoute allowedRoles={[role]}><Component /></ProtectedRoute>} />
    <Route path="/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter></AuthProvider>)
  return token
}

describe.each([
  ['tickets', MyTickets, 'attendee', '/api/tickets/', 'Loading your tickets…', 'No tickets yet', ticket],
  ['logs', AdminLogs, 'admin', '/api/admin/logs/', 'Loading logs…', 'No logs found', log],
])('%s page', (_name, Component, role, endpoint, loading, empty, record) => {
  it('shows loading, an empty result, and authenticated pagination parameters', async () => {
    let resolve
    const fetch = vi.fn().mockReturnValue(new Promise((done) => { resolve = done }))
    const token = mount(Component, role, fetch)
    expect(screen.getByText(loading)).toBeInTheDocument()
    await act(async () => resolve(json(page())))
    expect(await screen.findByText(empty)).toBeInTheDocument()
    expect(fetch.mock.calls[0][0]).toBe(`${endpoint}?limit=20&offset=0`)
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`)
  })

  it('retries failure and paginates without retaining the previous page', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(json(page([record('First page')], 21)))
      .mockResolvedValueOnce(json(page([record('Second page')], 21, 20)))
    mount(Component, role, fetch)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('First page')
    await userEvent.click(screen.getByRole('button', { name: 'Next', exact: true }))
    expect(await screen.findByText('Second page')).toBeInTheDocument()
    expect(screen.queryByText('First page')).not.toBeInTheDocument()
    expect(fetch.mock.calls.at(-1)[0]).toBe(`${endpoint}?limit=20&offset=20`)
    expect(screen.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled()
  })

  it('logs out when access is rejected', async () => {
    mount(Component, role, vi.fn().mockResolvedValue(json({ error: 'Forbidden' }, 403)))
    expect(await screen.findByText('Login destination')).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('aborts and ignores the previous account request on session changes', async () => {
    let resolveOld
    const fetch = vi.fn().mockReturnValueOnce(new Promise((done) => { resolveOld = done }))
      .mockResolvedValueOnce(json(page()))
    mount(Component, role, fetch)
    act(() => {
      const token = makeToken({ role, user_id: 'other-user' })
      localStorage.setItem('access_token', token)
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: token }))
    })
    await screen.findByText(empty)
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => resolveOld(json(page([record('Private old record')]))))
    expect(screen.queryByText('Private old record')).not.toBeInTheDocument()
  })
})

describe('receipt and log content', () => {
  it('shows a local admission QR with the original code available as a fallback', async () => {
    const code = `0123456789abcdef01234567:${'A'.repeat(43)}`
    const fetch = vi.fn().mockResolvedValue(json(page([{ ...ticket(), admission_code: code, checked_in: 1 }])))
    mount(MyTickets, 'attendee', fetch)
    const qr = await screen.findByRole('img', { name: 'Admission QR code for Original event' })
    expect(qr.getAttribute('src')).toMatch(/^data:image\/gif;base64,/)
    expect(screen.getByText(/1 of 2 admissions used/)).toBeInTheDocument()
    await userEvent.click(screen.getByText('Show text code instead'))
    expect(screen.getByText(code)).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('renders stored receipt snapshots and a safe external website link', async () => {
    mount(MyTickets, 'attendee', vi.fn().mockResolvedValue(json(page([ticket()]))))
    await screen.findByText('Original event')
    expect(screen.getByText('Original buyer')).toBeInTheDocument()
    expect(screen.getByText('buyer@example.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open event website' })).toHaveAttribute('href', 'https://example.com/room')
  })

  it('renders HTML-like event titles as text and suppresses unsafe links', async () => {
    const title = '<img src=x onerror=alert(1)>'
    mount(MyTickets, 'attendee', vi.fn().mockResolvedValue(json(page([ticket(title, 'javascript:alert(1)')]))))
    await screen.findByText(title)
    expect(screen.queryByRole('link', { name: 'Open event website' })).not.toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).toBeNull()
  })

  it('displays log table data and traceback as escaped text', async () => {
    mount(AdminLogs, 'admin', vi.fn().mockResolvedValue(json(page([log('<script>bad()</script>')]))))
    await screen.findByText('<script>bad()</script>')
    const table = screen.getByRole('table')
    expect(within(table).getByText('/api/checkout/')).toBeInTheDocument()
    expect(within(table).getByText('500')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
})

describe('AnalyticsWidget', () => {
  it('shows separate exact currency totals and excludes legacy unpriced orders', async () => {
    mount(AnalyticsWidget, 'organizer', vi.fn().mockResolvedValue(json({ ...totals, unpriced_purchase_count: 1,
      revenue_by_currency: [{ currency: 'EUR', total_amount_minor: '2500' }, { currency: 'USD', total_amount_minor: '900' }] })))
    expect(await screen.findByText(/€25\.00/)).toBeInTheDocument()
    expect(screen.getByText(/\$9\.00/)).toBeInTheDocument()
    expect(screen.getByText(/1 orders without recorded prices/)).toBeInTheDocument()
  })

  it('shows real counts and explains unavailable revenue', async () => {
    mount(AnalyticsWidget, 'organizer', vi.fn().mockResolvedValue(json(totals)))
    await screen.findByText('9')
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/not recorded/i)).toBeInTheDocument()
    expect(screen.queryByText(/\$0|€0/)).not.toBeInTheDocument()
  })

  it('retries errors and renders zero counts', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(json({ ...totals,
      purchase_count: 0, tickets_sold: 0, events_with_sales: 0, unpriced_purchase_count: 0 }))
    mount(AnalyticsWidget, 'organizer', fetch)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getAllByText('0')).toHaveLength(3))
  })
})
