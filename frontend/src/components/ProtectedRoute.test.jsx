import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../context/AuthContext'
import { makeToken } from '../test/authFixtures'
import ProtectedRoute from './ProtectedRoute'

function renderPrivate({ token, allowedRoles, outlet = false } = {}) {
  if (token) localStorage.setItem('access_token', token)
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route path="/login" element={<h1>Login destination</h1>} />
          <Route path="/discover" element={<h1>Discover destination</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
          <Route path="/admin-logs" element={<h1>Admin destination</h1>} />
          {outlet ? (
            <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
              <Route path="/private" element={<h1>Private content</h1>} />
            </Route>
          ) : (
            <Route path="/private" element={<ProtectedRoute allowedRoles={allowedRoles}><h1>Private content</h1></ProtectedRoute>} />
          )}
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('ProtectedRoute', () => {
  it.each([
    ['missing', undefined],
    ['malformed', 'invalid'],
    ['expired', makeToken({ exp: 1 })],
    ['unknown role', makeToken({ role: 'unsupported' })],
  ])('blocks a %s session before showing private content', (_case, token) => {
    renderPrivate({ token })
    expect(screen.getByRole('heading', { name: 'Login destination' })).toBeInTheDocument()
    expect(screen.queryByText('Private content')).not.toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it.each([false, true])('renders authenticated content (Outlet: %s)', (outlet) => {
    renderPrivate({ token: makeToken(), outlet })
    expect(screen.getByRole('heading', { name: 'Private content' })).toBeInTheDocument()
  })

  it('allows a user with the permitted role', () => {
    renderPrivate({ token: makeToken({ role: 'admin' }), allowedRoles: ['admin'] })
    expect(screen.getByRole('heading', { name: 'Private content' })).toBeInTheDocument()
  })

  it.each([
    ['attendee', 'Discover destination'],
    ['organizer', 'Dashboard destination'],
    ['admin', 'Admin destination'],
  ])('redirects a disallowed %s to its own home', (role, home) => {
    renderPrivate({ token: makeToken({ role }), allowedRoles: [role === 'admin' ? 'organizer' : 'admin'] })
    expect(screen.getByRole('heading', { name: home })).toBeInTheDocument()
    expect(screen.queryByText('Private content')).not.toBeInTheDocument()
  })

  it('removes protected content when the session expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    renderPrivate({ token: makeToken({ exp: Math.floor(Date.now() / 1000) + 2 }) })
    expect(screen.getByText('Private content')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2001))
    expect(screen.getByText('Login destination')).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('removes protected content after logout in another tab', () => {
    renderPrivate({ token: makeToken() })
    act(() => {
      localStorage.removeItem('access_token')
      window.dispatchEvent(new StorageEvent('storage', { key: 'access_token', newValue: null }))
    })
    expect(screen.getByText('Login destination')).toBeInTheDocument()
  })
})
