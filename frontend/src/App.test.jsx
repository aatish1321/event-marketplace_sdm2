import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { makeToken } from './test/authFixtures'

describe('application auth routes', () => {
  it.each(['/discover', '/dashboard', '/admin-logs'])('guards direct navigation to %s', (path) => {
    window.history.replaceState({}, '', path)
    render(<AuthProvider><App /></AuthProvider>)
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it.each([
    ['attendee', '/discover', 'Discover events'],
    ['organizer', '/dashboard', 'Organizer dashboard'],
    ['admin', '/admin-logs', 'Admin logs'],
  ])('logs in a %s, displays its real destination, and logs out', async (role, path, heading) => {
    window.history.replaceState({}, '', '/login')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: makeToken({ role }) }) }))
    render(<AuthProvider><App /></AuthProvider>)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/^email$/i), 'user@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'password')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
    await user.click(screen.getByRole('button', { name: /log out/i }))
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})
