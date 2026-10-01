import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError, loginUser } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { getRoleHome } from '../lib/authRoutes'

const EMAIL_RE = /^\S+@\S+\.\S+$/

export default function Login() {
  const { login, isAuthenticated, userRole } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const home = getRoleHome(userRole)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (pending.current) return
    const validation = {}
    if (!EMAIL_RE.test(email.trim())) validation.email = 'Enter a valid email.'
    if (!password) validation.password = 'Password is required.'
    setErrors(validation)
    if (Object.keys(validation).length) return

    pending.current = true
    setSubmitting(true)
    try {
      const result = await loginUser(email.trim(), password)
      try {
        login(result?.token)
      } catch {
        setErrors({ form: 'The server returned an invalid session. Please try again.' })
      }
    } catch (error) {
      const message = error instanceof ApiError
        ? (typeof error.data?.error === 'string' && error.data.error)
          || 'Login failed. Please check your details and try again.'
        : 'Could not reach the server. Check your connection and try again.'
      setErrors({ form: message })
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  if (isAuthenticated && home) return <Navigate to={home} replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Log in</h1>
        <p className="mt-1 text-sm text-slate-500">Welcome back to the event marketplace.</p>
        <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="mt-6 space-y-4">
          {errors.form && (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.form}
            </div>
          )}
          {[
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', value: email, setter: setEmail },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', value: password, setter: setPassword },
          ].map(({ name, label, setter, ...input }) => (
            <div key={name}>
              <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
              <input
                {...input}
                id={name}
                name={name}
                required
                disabled={submitting}
                onChange={(event) => {
                  setter(event.target.value)
                  setErrors((previous) => ({ ...previous, [name]: undefined, form: undefined }))
                }}
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
                className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2 ${
                  errors[name]
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                    : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
                }`}
              />
              {errors[name] && <p id={`${name}-error`} role="alert" className="mt-1 text-xs text-red-600">{errors[name]}</p>}
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          New here? <Link to="/register" className="font-medium text-indigo-600 hover:underline">Create an account</Link>
        </p>
      </div>
    </main>
  )
}
