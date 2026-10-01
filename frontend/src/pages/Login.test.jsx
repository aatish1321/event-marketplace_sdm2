import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { makeToken } from '../test/authFixtures'
import Login from './Login'

function Session() {
  const { userRole, isAuthenticated } = useAuth()
  return <output data-testid="session">{isAuthenticated ? userRole : 'signed out'}</output>
}

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <Session />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/discover" element={<h1>Discover destination</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
          <Route path="/admin-logs" element={<h1>Admin logs destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function submitCredentials() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^email$/i), 'person@example.com')
  await user.type(screen.getByLabelText(/^password$/i), 'correct horse battery')
  await user.click(screen.getByRole('button', { name: /log in/i }))
  return user
}

describe('Login', () => {
  it.each([
    ['attendee', 'Discover destination'],
    ['organizer', 'Dashboard destination'],
    ['admin', 'Admin logs destination'],
  ])('authenticates %s and navigates to its home', async (role, destination) => {
    const token = makeToken({ role })
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token }) })
    vi.stubGlobal('fetch', fetch)
    renderLogin()
    await submitCredentials()
    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'person@example.com', password: 'correct horse battery' }),
    })
    expect(localStorage.getItem('access_token')).toBe(token)
    expect(screen.getByTestId('session')).toHaveTextContent(role)
  })

  it('redirects an existing session without requesting credentials again', async () => {
    localStorage.setItem('access_token', makeToken({ role: 'organizer' }))
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderLogin()
    expect(await screen.findByRole('heading', { name: 'Dashboard destination' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an empty form before issuing an API request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByTestId('session')).toHaveTextContent('signed out')
  })

  it('trims the email and preserves spaces in the password sent to the API', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: makeToken() }) })
    vi.stubGlobal('fetch', fetch)
    renderLogin()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/^email$/i), '  person@example.com  ')
    await user.type(screen.getByLabelText(/^password$/i), ' password with spaces ')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    await screen.findByRole('heading', { name: 'Discover destination' })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      email: 'person@example.com', password: ' password with spaces ',
    })
  })

  it('prevents duplicate requests while login is pending', async () => {
    let resolveRequest
    const fetch = vi.fn().mockReturnValue(new Promise((resolve) => { resolveRequest = resolve }))
    vi.stubGlobal('fetch', fetch)
    renderLogin()
    const user = await submitCredentials()
    const pendingButton = screen.getByRole('button', { name: /logging in/i })
    expect(pendingButton).toBeDisabled()
    await user.click(pendingButton)
    expect(fetch).toHaveBeenCalledTimes(1)
    await act(async () => resolveRequest({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled()
  })

  it.each([
    ['unauthorized', () => Promise.resolve({ ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' }) })],
    ['offline', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['malformed token', () => Promise.resolve({ ok: true, json: async () => ({ token: 'bad-token' }) })],
    ['expired token', () => Promise.resolve({ ok: true, json: async () => ({ token: makeToken({ exp: 1 }) }) })],
    ['unknown role', () => Promise.resolve({ ok: true, json: async () => ({ token: makeToken({ role: 'superuser' }) }) })],
    ['missing token', () => Promise.resolve({ ok: true, json: async () => ({}) })],
    ['non-JSON server error', () => Promise.resolve({ ok: false, status: 500, json: async () => { throw new SyntaxError('Invalid JSON') } })],
  ])('keeps the user signed out after %s and allows retry', async (_scenario, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response))
    renderLogin()
    await submitCredentials()
    expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled())
    expect(screen.getByTestId('session')).toHaveTextContent('signed out')
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
