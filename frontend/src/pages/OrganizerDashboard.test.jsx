import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import ProtectedRoute from '../components/ProtectedRoute'
import { makeToken } from '../test/authFixtures'
import OrganizerDashboard from './OrganizerDashboard'

vi.mock('../components/AnalyticsWidget', () => ({ default: () => null }))

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

const physical = {
  id: 'event-1', organizer_id: 'user-123', title: 'Community gathering', description: 'A local meetup',
  start_at: '2030-05-10T10:00:00Z', end_at: '2030-05-10T11:00:00Z',
  event_type: 'physical', venue_name: 'Town Hall', address: '1 Main Street',
}
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })

function renderDashboard(fetch) {
  const token = makeToken({ role: 'organizer' })
  localStorage.setItem('access_token', token)
  vi.stubGlobal('fetch', fetch)
  render(<AuthProvider><MemoryRouter initialEntries={['/dashboard']}><Routes>
    <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['organizer']}><OrganizerDashboard /></ProtectedRoute>} />
    <Route path="/login" element={<h1>Login destination</h1>} />
  </Routes></MemoryRouter></AuthProvider>)
  return token
}

async function openModal() {
  const user = userEvent.setup()
  await waitFor(() => expect(screen.getByRole('button', { name: 'New event' })).toBeEnabled())
  await user.click(screen.getByRole('button', { name: 'New event' }))
  return user
}

async function fillCommon(user) {
  await user.type(screen.getByLabelText(/^Title$/i), 'New community event')
  fireEvent.change(screen.getByLabelText('Start date and time'), { target: { value: '2030-05-10T10:00' } })
  fireEvent.change(screen.getByLabelText('End date and time'), { target: { value: '2030-05-10T11:00' } })
}

describe('Organizer dashboard and creation', () => {
  it('shows loading then an empty organizer list with a bearer request', async () => {
    let resolve
    const fetch = vi.fn().mockReturnValue(new Promise((done) => { resolve = done }))
    const token = renderDashboard(fetch)
    expect(screen.getByText('Loading your events…')).toBeInTheDocument()
    await act(async () => resolve(response([])))
    expect(await screen.findByText('Your next event starts here')).toBeInTheDocument()
    expect(fetch.mock.calls[0][0]).toBe('/api/events/?mine=1')
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`)
  })

  it('renders physical and online events returned by the API', async () => {
    renderDashboard(vi.fn().mockResolvedValue(response([physical, {
      ...physical, id: 'event-2', title: 'Online workshop', event_type: 'online',
      stream_url: 'https://events.example.com/workshop',
    }])))
    expect(await screen.findByText('Community gathering')).toBeInTheDocument()
    expect(screen.getByText('Online workshop')).toBeInTheDocument()
    expect(screen.getByText(/Town Hall/)).toBeInTheDocument()
  })

  const fillPhysical = async (user) => {
    await fillCommon(user)
    await user.type(screen.getByLabelText('Venue name'), 'Town Hall')
    await user.type(screen.getByLabelText('Venue address'), '1 Main Street')
  }
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'cover.png', { type: 'image/png' })

  it('creates an event with an exact decimal price, currency and stock', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ ...physical, title: 'New community event' }, 201))
    renderDashboard(fetch)
    const user = await openModal()
    await fillPhysical(user)
    await user.clear(screen.getByLabelText('Ticket price'))
    await user.type(screen.getByLabelText('Ticket price'), '0.29')
    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    await user.clear(screen.getByLabelText('Tickets available'))
    await user.type(screen.getByLabelText('Tickets available'), '25')
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    await screen.findByText('New community event')
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ ticket_price_minor: 29, currency: 'USD', available_tickets: 25 })
  })

  it('rejects fractional inventory and prices with excess decimal places before posting', async () => {
    const fetch = vi.fn().mockResolvedValue(response([]))
    renderDashboard(fetch)
    const user = await openModal()
    await fillPhysical(user)
    fireEvent.change(screen.getByLabelText('Ticket price'), { target: { value: '1.005' } })
    fireEvent.change(screen.getByLabelText('Tickets available'), { target: { value: '1.5' } })
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(await screen.findByText(/Enter a non-negative price/)).toBeInTheDocument()
    expect(screen.getByText(/Enter a non-negative whole number/)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('uploads the chosen cover photo after creating the event and shows it', async () => {
    const created = { ...physical, id: 'created', title: 'New community event', cover_url: null }
    const withCover = { ...created, cover_url: '/api/events/created/cover/?v=1' }
    const fetch = vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(created, 201))
      .mockResolvedValueOnce(response(withCover))
    const token = renderDashboard(fetch)
    const user = await openModal()
    await fillPhysical(user)
    const file = png()
    await user.upload(screen.getByLabelText(/Cover photo/i), file)
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(await screen.findByText('New community event')).toBeInTheDocument()
    const [url, options] = fetch.mock.calls[2]
    expect(url).toBe('/api/events/created/cover/')
    expect(options.method).toBe('PUT')
    expect(options.body).toBe(file)
    expect(options.headers.Authorization).toBe(`Bearer ${token}`)
    expect(document.querySelector('img[src="/api/events/created/cover/?v=1"]')).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('was created successfully.')
  })

  it('keeps the new event and warns when only the photo upload fails', async () => {
    const created = { ...physical, id: 'created', title: 'New community event' }
    const fetch = vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(created, 201))
      .mockResolvedValueOnce(response({ error: 'Cover photo must be 2 MB or smaller.' }, 413))
    renderDashboard(fetch)
    const user = await openModal()
    await fillPhysical(user)
    await user.upload(screen.getByLabelText(/Cover photo/i), png())
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(await screen.findByText('New community event')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The photo could not be uploaded.')
  })

  it('does not create anything when the chosen file is too large or not an image', async () => {
    const fetch = vi.fn().mockResolvedValue(response([]))
    renderDashboard(fetch)
    const user = await openModal()
    await fillPhysical(user)
    const input = screen.getByLabelText(/Cover photo/i)
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })] } })
    expect(await screen.findByText('Use a photo of 2 MB or less.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(fetch).toHaveBeenCalledTimes(1) // only the initial list request
    fireEvent.change(input, { target: { files: [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })] } })
    expect(await screen.findByText('Choose a JPEG, PNG or WebP image.')).toBeInTheDocument()
  })

  it('creates an event without a photo exactly as before', async () => {
    const created = { ...physical, id: 'created', title: 'New community event' }
    const fetch = vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(created, 201))
    renderDashboard(fetch)
    const user = await openModal()
    await fillPhysical(user)
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(await screen.findByText('New community event')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2) // list + create, no upload
  })

  it('retries a failed list request', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(response([]))
    renderDashboard(fetch)
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Your next event starts here')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([401, 403])('logs out when the server rejects the session (%s)', async (status) => {
    renderDashboard(vi.fn().mockResolvedValue(response({ error: 'Forbidden.' }, status)))
    expect(await screen.findByText('Login destination')).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it.each(['physical', 'online'])('creates a %s event and displays the returned record', async (type) => {
    const created = { ...physical, id: 'created', title: 'New community event', event_type: type }
    const fetch = vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(response(created, 201))
    const token = renderDashboard(fetch)
    const user = await openModal()
    await fillCommon(user)
    if (type === 'physical') {
      await user.type(screen.getByLabelText('Venue name'), 'Town Hall')
      await user.type(screen.getByLabelText('Venue address'), '1 Main Street')
    } else {
      await user.type(screen.getByLabelText('Venue name'), 'Discarded venue')
      await user.click(screen.getByRole('radio', { name: 'Online' }))
      expect(screen.queryByLabelText('Venue name')).not.toBeInTheDocument()
      await user.type(screen.getByLabelText('Event URL'), 'https://events.example.com/room')
    }
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(await screen.findByText('New community event')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const options = fetch.mock.calls.find(([, init]) => init.method === 'POST')[1]
    const body = JSON.parse(options.body)
    expect(options.headers.Authorization).toBe(`Bearer ${token}`)
    expect(body).toMatchObject({ title: 'New community event', event_type: type,
      start_at: new Date('2030-05-10T10:00').toISOString(), end_at: new Date('2030-05-10T11:00').toISOString() })
    expect(body).not.toHaveProperty('organizer_id')
    if (type === 'physical') {
      expect(body).toMatchObject({ venue_name: 'Town Hall', address: '1 Main Street' })
      expect(body).not.toHaveProperty('stream_url')
    } else {
      expect(body.stream_url).toBe('https://events.example.com/room')
      expect(body).not.toHaveProperty('venue_name')
    }
  })

  it('validates required fields and chronological dates before posting', async () => {
    const fetch = vi.fn().mockResolvedValue(response([]))
    renderDashboard(fetch)
    const user = await openModal()
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(fetch).toHaveBeenCalledTimes(1)
    await fillCommon(user)
    fireEvent.change(screen.getByLabelText('End date and time'), { target: { value: '2030-05-10T09:00' } })
    await user.type(screen.getByLabelText('Venue name'), 'Hall')
    await user.type(screen.getByLabelText('Venue address'), 'Street')
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('End date and time')).toHaveAttribute('aria-invalid', 'true')
  })

  it('keeps input after failed creation and disables duplicate submission while pending', async () => {
    let resolve
    const fetch = vi.fn().mockResolvedValueOnce(response([]))
      .mockReturnValueOnce(new Promise((done) => { resolve = done }))
    renderDashboard(fetch)
    const user = await openModal()
    await fillCommon(user)
    await user.click(screen.getByRole('radio', { name: 'Online' }))
    await user.type(screen.getByLabelText('Event URL'), 'https://events.example.com/room')
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    const button = screen.getByRole('button', { name: 'Creating…' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(fetch).toHaveBeenCalledTimes(2)
    await act(async () => resolve(response({ error: 'Please choose a different title.' }, 400)))
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Please choose a different title.')
    expect(screen.getByLabelText(/^Title$/i)).toHaveValue('New community event')
    expect(screen.getByRole('button', { name: 'Create event', exact: true })).toBeEnabled()
  })

  it('resets a cancelled draft on reopening', async () => {
    renderDashboard(vi.fn().mockResolvedValue(response([])))
    const user = await openModal()
    await user.type(screen.getByLabelText(/^Title$/i), 'Cancelled draft')
    await user.click(screen.getByRole('button', { name: 'Cancel', exact: true }))
    await openModal()
    expect(screen.getByLabelText(/^Title$/i)).toHaveValue('')
    expect(screen.getByRole('radio', { name: 'Physical' })).toBeChecked()
  })

  it('rejects an unsafe online URL then hides it when switching back to physical', async () => {
    const fetch = vi.fn().mockResolvedValue(response([]))
    renderDashboard(fetch)
    const user = await openModal()
    await fillCommon(user)
    await user.click(screen.getByRole('radio', { name: 'Online' }))
    await user.type(screen.getByLabelText('Event URL'), 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: 'Create event', exact: true }))
    expect(screen.getByLabelText('Event URL')).toHaveAttribute('aria-invalid', 'true')
    expect(fetch).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('radio', { name: 'Physical' }))
    expect(screen.queryByLabelText('Event URL')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Venue address')).toBeInTheDocument()
  })

  it('clears another organizer’s list and draft when the stored session changes', async () => {
    let resolveSecond
    const fetch = vi.fn().mockResolvedValueOnce(response([physical]))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve }))
    renderDashboard(fetch)
    await screen.findByText('Community gathering')
    await openModal()
    act(() => {
      const token = makeToken({ role: 'organizer', user_id: 'different-organizer' })
      localStorage.setItem('access_token', token)
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: token }))
    })
    expect(screen.queryByText('Community gathering')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New event' })).toBeDisabled()
    await act(async () => resolveSecond(response([])))
    expect(await screen.findByText('Your next event starts here')).toBeInTheDocument()
  })

  it('ignores an old organizer’s list response after a session switch', async () => {
    let resolveOld
    const fetch = vi.fn().mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce(response([]))
    renderDashboard(fetch)
    act(() => {
      const token = makeToken({ role: 'organizer', user_id: 'different-organizer' })
      localStorage.setItem('access_token', token)
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: token }))
    })
    await screen.findByText('Your next event starts here')
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => resolveOld(response([physical])))
    expect(screen.queryByText('Community gathering')).not.toBeInTheDocument()
    expect(screen.getByText('Your next event starts here')).toBeInTheDocument()
  })
})
