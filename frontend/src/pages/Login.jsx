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
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 selection:bg-primary selection:text-white">
      <Link to="/" className="absolute left-8 top-8 hidden text-lg font-semibold tracking-tight text-primary md:block">
        Eventify
      </Link>
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-8 md:p-12">
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-primary">Log in</h1>
        <p className="mt-3 text-base text-secondary">Use your email and password.</p>
        <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="mt-8 space-y-5">
          {errors.form && (
            <div role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {errors.form}
            </div>
          )}
          {[
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', value: email, setter: setEmail },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', value: password, setter: setPassword },
          ].map(({ name, label, setter, ...input }) => (
            <div key={name}>
              <label htmlFor={name} className="mb-2 block text-sm font-medium text-primary">{label}</label>
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
                className={`h-11 w-full rounded-control border bg-surface px-3 text-sm outline-none transition-colors focus:ring-2 ${
                  errors[name]
                    ? 'border-danger/50 focus:border-danger focus:ring-danger/15'
                    : 'border-border focus:border-primary focus:ring-primary/15'
                }`}
              />
              {errors[name] && <p id={`${name}-error`} role="alert" className="mt-2 text-xs font-medium text-danger">{errors[name]}</p>}
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 h-11 w-full rounded-control bg-accent px-4 text-base font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-secondary">
          New here? <Link to="/register" className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-accent">Create an account</Link>
        </p>
      </div>
    </main>
  )
}
