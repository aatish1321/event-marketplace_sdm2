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
    <main className="flex min-h-screen items-center justify-center bg-neutral px-4 py-10 selection:bg-primary selection:text-white">
      <Link to="/" className="absolute top-8 left-8 text-xl font-black tracking-widest uppercase text-primary hidden md:block">
        Eventify
      </Link>
      <div className="w-full max-w-[440px] rounded-[2.5rem] bg-white p-10 md:p-12 shadow-xl shadow-primary/5">
        <h1 className="text-4xl font-medium tracking-tight text-primary">Welcome back</h1>
        <p className="mt-3 text-base text-secondary font-medium">Pick up right where you left off.</p>
        <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="mt-8 space-y-5">
          {errors.form && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {errors.form}
            </div>
          )}
          {[
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', value: email, setter: setEmail },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', value: password, setter: setPassword },
          ].map(({ name, label, setter, ...input }) => (
            <div key={name}>
              <label htmlFor={name} className="mb-2 block text-sm font-semibold text-primary">{label}</label>
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
                className={`w-full rounded-xl border bg-white px-4 py-3.5 text-sm outline-none transition focus:ring-4 ${
                  errors[name]
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : 'border-border focus:border-primary focus:ring-primary/10'
                }`}
              />
              {errors[name] && <p id={`${name}-error`} role="alert" className="mt-2 text-xs font-medium text-red-600">{errors[name]}</p>}
            </div>
          ))}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 mt-4 rounded-full bg-tertiary-strong hover:bg-tertiary-strong/90 px-4 text-base font-semibold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 shadow-sm"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm font-medium text-secondary">
          New here? <Link to="/register" className="text-primary font-semibold hover:text-tertiary transition-colors">Create an account</Link>
        </p>
      </div>
    </main>
  )
}
