import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ROLES, useAuth } from '../context/AuthContext'
import { ApiError, loginUser, registerUser } from '../api/auth'
import { getRoleHome } from '../lib/authRoutes'

const ROLE_OPTIONS = [
  { value: ROLES.ATTENDEE, label: 'Register as Attendee' },
  { value: ROLES.ORGANIZER, label: 'Register as Organizer' },
]

const INITIAL_FORM = {
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
  organization_name: '',
  organization_email: '',
  organization_id: '',
}

const EMAIL_RE = /^\S+@\S+\.\S+$/

// Backend organizer_profile keys -> our form field names
const PROFILE_FIELD_MAP = {
  name: 'organization_name',
  contact_email: 'organization_email',
  organization_id: 'organization_id',
}

function Field({ label, name, type = 'text', value, onChange, error, hint, ...rest }) {
  const describedBy = [error && `${name}-error`, hint && `${name}-hint`].filter(Boolean).join(' ')
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium text-primary">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`h-11 w-full rounded-control border bg-surface px-3 text-sm outline-none transition-colors focus:ring-2 ${
          error
            ? 'border-danger/50 focus:border-danger focus:ring-danger/15'
            : 'border-border focus:border-focus focus:ring-focus/20'
        }`}
        {...rest}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-2 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Turn a backend error into { fieldName: message, form: message }.
 * The backend returns { error: "..." } and, for model validation errors,
 * { error, fields: { email: "...", organizer_profile: { contact_email: "..." } } }.
 */
function errorsFromApi(err) {
  if (!(err instanceof ApiError)) {
    return { form: 'Could not reach the server. Check your connection and try again.' }
  }
  if (err.status === 409) {
    return { email: err.data?.error || 'An account with this email already exists.' }
  }

  const out = {}
  const fields = err.data?.fields
  if (fields && typeof fields === 'object') {
    for (const [key, val] of Object.entries(fields)) {
      if (key === 'organizer_profile' && val && typeof val === 'object') {
        for (const [sub, msg] of Object.entries(val)) {
          out[PROFILE_FIELD_MAP[sub] ?? 'form'] = String(msg)
        }
      } else if (key in INITIAL_FORM) {
        out[key] = String(val)
      } else {
        out.form = String(val)
      }
    }
  }
  if (!Object.keys(out).length) {
    out.form = err.data?.error || 'Registration failed. Please check your details and try again.'
  }
  return out
}

export default function Register() {
  const { login, logout, isAuthenticated, userRole } = useAuth()
  const [role, setRole] = useState(ROLES.ATTENDEE)
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState(null) // backend response on success

  const isOrganizer = role === ROLES.ORGANIZER

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }))
  }

  const handleRoleChange = (value) => {
    setRole(value)
    setErrors({})
  }

  const validate = () => {
    const errs = {}
    if (!form.full_name.trim()) errs.full_name = 'Full name is required.'
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email.'
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.'
    if (form.password !== form.confirm_password) errs.confirm_password = 'Passwords do not match.'
    if (isOrganizer) {
      if (!form.organization_name.trim()) errs.organization_name = 'Organization name is required.'
      if (!EMAIL_RE.test(form.organization_email.trim()))
        errs.organization_email = 'Enter a valid organization email.'
      if (!form.organization_id.trim()) errs.organization_id = 'Organization ID is required.'
    }
    return errs
  }

  // Shape required by POST /api/auth/register/ (backend/README.md)
  const buildPayload = () => ({
    email: form.email.trim(),
    password: form.password, // sent as typed: the backend preserves whitespace
    full_name: form.full_name.trim(),
    role,
    // Organizer-only data is omitted entirely for attendees
    ...(isOrganizer && {
      organizer_profile: {
        name: form.organization_name.trim(),
        contact_email: form.organization_email.trim(),
        organization_id: form.organization_id.trim(),
      },
    }),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length) return

    const payload = buildPayload()
    setSubmitting(true)
    try {
      const created = await registerUser(payload)

      // Registration returns no token, so log in with the same credentials
      // to store the JWT in AuthContext. If that fails, the account still
      // exists and the user can log in manually.
      try {
        const { token } = await loginUser(payload.email, payload.password)
        login(token)
      } catch {
        /* fall through to the success screen with a "Log in" link */
      }

      setRegistered(created)
      setForm(INITIAL_FORM)
    } catch (err) {
      setErrors(errorsFromApi(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (registered) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 selection:bg-primary selection:text-white">
        <Link to="/" className="absolute left-8 top-8 hidden text-lg font-semibold tracking-tight text-primary md:block">
          Eventify
        </Link>
        <div className="w-full max-w-[440px] rounded-2xl border border-border bg-surface p-8 text-center md:p-12">
          <h1 className="text-3xl font-medium tracking-[-0.02em] text-primary">Account created</h1>
          <p className="mt-3 text-base text-secondary">
            {registered.full_name}, your account is ready.
          </p>
          {isAuthenticated ? (
            <>
              <Link to={getRoleHome(userRole) ?? '/login'} className="mt-8 flex h-11 w-full items-center justify-center rounded-control bg-accent px-4 text-base font-medium text-white transition-colors hover:bg-accent/90">
                Continue
              </Link>
              <button
                type="button"
                onClick={logout}
                className="mt-4 h-11 w-full rounded-control border border-border bg-surface px-4 text-sm font-medium text-primary transition-colors hover:border-primary/30"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="mt-8 flex h-11 w-full items-center justify-center rounded-control bg-accent px-4 text-base font-medium text-white transition-colors hover:bg-accent/90"
            >
              Go to login
            </Link>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 selection:bg-primary selection:text-white">
      <Link to="/" className="absolute left-8 top-8 hidden text-lg font-semibold tracking-tight text-primary md:block">
        Eventify
      </Link>
      <div className={`w-full ${isOrganizer ? 'max-w-4xl' : 'max-w-[440px]'} rounded-2xl border border-border bg-surface p-8 md:p-12`}>
        <h1 className="text-3xl font-medium tracking-[-0.02em] text-primary">Create your account</h1>
        <p className="mt-3 text-base text-secondary">Book events, or publish your own.</p>

        {/* Role toggle */}
        <div
          role="radiogroup"
          aria-label="Account type"
          className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1"
        >
          {ROLE_OPTIONS.map((r) => {
            const active = role === r.value
            return (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handleRoleChange(r.value)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
          {errors.form && (
            <div role="alert" className="rounded-control bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {errors.form}
            </div>
          )}

          <div className={`grid grid-cols-1 gap-8 ${isOrganizer ? 'md:grid-cols-2' : ''}`}>
            {/* Left Column */}
            <div className="space-y-5">
              <Field label="Full name" name="full_name" value={form.full_name} onChange={handleChange} error={errors.full_name} autoComplete="name" />
              <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} autoComplete="email" />
              <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} error={errors.password} autoComplete="new-password" />
              <Field label="Confirm password" name="confirm_password" type="password" value={form.confirm_password} onChange={handleChange} error={errors.confirm_password} autoComplete="new-password" />
            </div>

            {/* Right Column */}
            {isOrganizer && (
              <div className="space-y-5 h-full">
                <fieldset className="space-y-5 rounded-card border border-border bg-surface p-6 h-full min-h-[320px]">
                  <legend className="px-2 text-sm font-medium text-primary">Organization details</legend>
                  <Field label="Organization name" name="organization_name" value={form.organization_name} onChange={handleChange} error={errors.organization_name} autoComplete="organization" />
                  <Field label="Organization email" name="organization_email" type="email" value={form.organization_email} onChange={handleChange} error={errors.organization_email} />
                  <Field label="Organization ID" name="organization_id" value={form.organization_id} onChange={handleChange} error={errors.organization_id} hint="Your company or registration number, e.g. org-123." />
                </fieldset>
              </div>
            )}
          </div>

          <div className={`${isOrganizer ? 'md:w-1/2 md:pr-4' : ''}`}>
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-11 w-full rounded-control bg-accent px-4 text-base font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating account…' : isOrganizer ? 'Register as Organizer' : 'Create profile'}
            </button>
          </div>
        </form>
        <div className={`${isOrganizer ? 'md:w-1/2 md:pr-4' : ''}`}>
          <p className="mt-8 text-center text-sm text-secondary">
            Already registered? <Link to="/login" className="font-medium text-primary underline underline-offset-4 transition-colors hover:text-accent">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
