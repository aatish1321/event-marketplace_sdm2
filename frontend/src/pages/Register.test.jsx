import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { makeToken } from '../test/authFixtures'
import Register from './Register'

function renderRegister() {
  return render(<AuthProvider><MemoryRouter><Register /></MemoryRouter></AuthProvider>)
}

async function fillAccount(user) {
  await user.type(screen.getByLabelText('Full name'), '  Test Person  ')
  await user.type(screen.getByLabelText('Email'), 'person@example.com')
  await user.type(screen.getByLabelText('Password'), ' password with spaces ')
  await user.type(screen.getByLabelText('Confirm password'), ' password with spaces ')
}

function registrationResponse() {
  return { ok: true, json: async () => ({ full_name: 'Test Person' }) }
}

describe('Register', () => {
  it.each([
    ['attendee', '/discover'],
    ['organizer', '/dashboard'],
  ])('registers a %s and signs in to the correct home', async (role, destination) => {
    const token = makeToken({ role })
    const fetch = vi.fn()
      .mockResolvedValueOnce(registrationResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token }) })
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await fillAccount(user)
    const payload = {
      full_name: 'Test Person', email: 'person@example.com',
      password: ' password with spaces ', role,
    }
    if (role === 'organizer') {
      await user.click(screen.getByRole('radio', { name: 'Register as Organizer' }))
      await user.type(screen.getByLabelText('Organization name'), '  Example Events  ')
      await user.type(screen.getByLabelText('Organization email'), 'contact@example.com')
      await user.type(screen.getByLabelText('Organization ID'), '  org-123  ')
      payload.organizer_profile = {
        name: 'Example Events', contact_email: 'contact@example.com', organization_id: 'org-123',
      }
    }
    await user.click(screen.getByRole('button', { name: role === 'organizer' ? 'Register as Organizer' : 'Create profile' }))
    expect(await screen.findByRole('heading', { name: "You're in!" })).toBeInTheDocument()
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/register/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: expect.any(String),
    })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(payload)
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/login/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: payload.email, password: payload.password }),
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem('access_token')).toBe(token)
    expect(screen.getByRole('link', { name: 'Start Exploring' })).toHaveAttribute('href', destination)
  })

  it('rejects missing fields, short passwords, and mismatched confirmation before making requests', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Full name is required.')
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email.')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password must be at least 8 characters.')
    await fillAccount(user)
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'different password')
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(screen.getByLabelText('Confirm password')).toHaveAccessibleDescription('Passwords do not match.')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('requires organization details only for organizers', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await fillAccount(user)
    await user.click(screen.getByRole('radio', { name: 'Register as Organizer' }))
    await user.click(screen.getByRole('button', { name: 'Register as Organizer' }))
    for (const label of ['Organization name', 'Organization email', 'Organization ID']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true')
    }
    expect(fetch).not.toHaveBeenCalled()
    await user.click(screen.getByRole('radio', { name: 'Register as Attendee' }))
    expect(screen.queryByLabelText('Organization name')).not.toBeInTheDocument()
  })

  it.each([
    ['duplicate email', { status: 409, error: 'An account with this email already exists.' }, 'Email', 'An account with this email already exists.'],
    ['field validation', { status: 400, error: 'Invalid registration data.', fields: { full_name: 'Name is too long.' } }, 'Full name', 'Name is too long.'],
    ['organization validation', { status: 400, fields: { organizer_profile: { contact_email: 'Invalid contact email.' } } }, 'Organization email', 'Invalid contact email.'],
  ])('shows %s errors beside the right field', async (_scenario, response, label, message) => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: response.status, json: async () => response })
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await fillAccount(user)
    if (label === 'Organization email') {
      await user.click(screen.getByRole('radio', { name: 'Register as Organizer' }))
      await user.type(screen.getByLabelText('Organization name'), 'Example Events')
      await user.type(screen.getByLabelText('Organization email'), 'contact@example.com')
      await user.type(screen.getByLabelText('Organization ID'), 'org-123')
    }
    await user.click(screen.getByRole('button', { name: label === 'Organization email' ? 'Register as Organizer' : 'Create profile' }))
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it.each(['offline', 'non-JSON server error'])('allows retry after %s', async (scenario) => {
    const fetch = vi.fn()
    if (scenario === 'offline') fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    else fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new SyntaxError('Invalid JSON') } })
    fetch.mockResolvedValueOnce(registrationResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: makeToken() }) })
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(await screen.findByRole('heading', { name: "You're in!" })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('keeps registration successful when automatic login fails', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(registrationResponse())
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(await screen.findByRole('heading', { name: "You're in!" })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login')
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('prevents duplicate registration requests while waiting for the server', async () => {
    let resolveRequest
    const fetch = vi.fn().mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    vi.stubGlobal('fetch', fetch)
    renderRegister()
    const user = userEvent.setup()
    await fillAccount(user)
    await user.click(screen.getByRole('button', { name: 'Create profile' }))
    const pending = screen.getByRole('button', { name: 'Creating account…' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => resolveRequest({ ok: false, status: 409, json: async () => ({ error: 'Already registered.' }) }))
    expect(await screen.findByText('Already registered.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create profile' })).toBeEnabled()
  })
})
