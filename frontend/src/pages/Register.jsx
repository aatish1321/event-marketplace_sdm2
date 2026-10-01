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
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
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
        className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm outline-none transition focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-200'
        }`}
        {...rest}
      />
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-600">
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-semibold text-slate-900">You're registered!</h1>
          <p className="mt-2 text-sm text-slate-600">
            Welcome, {registered.full_name}. Your {registered.role} account has been created.
          </p>
          {isAuthenticated ? (
            <>
              <p className="mt-4 text-sm text-slate-600">
                Logged in as <span className="font-medium text-indigo-600">{userRole}</span>.
              </p>
              <Link to={getRoleHome(userRole) ?? '/login'} className="mt-6 block font-medium text-indigo-600 hover:underline">
                Continue to your home
              </Link>
              <button
                type="button"
                onClick={logout}
                className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to login
            </Link>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Create an account</h1>
        <p className="mt-1 text-sm text-slate-500">Choose how you'll use the platform.</p>

        {/* Role toggle */}
        <div
          role="radiogroup"
          aria-label="Account type"
          className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
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
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-white text-indigo-600 shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {errors.form && (
            <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errors.form}
            </div>
          )}

          <Field label="Full name" name="full_name" value={form.full_name} onChange={handleChange} error={errors.full_name} autoComplete="name" />
          <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} autoComplete="email" />
          <Field label="Password" name="password" type="password" value={form.password} onChange={handleChange} error={errors.password} autoComplete="new-password" />
          <Field label="Confirm password" name="confirm_password" type="password" value={form.confirm_password} onChange={handleChange} error={errors.confirm_password} autoComplete="new-password" />

          {isOrganizer && (
            <fieldset className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
              <legend className="px-1 text-sm font-semibold text-indigo-700">Organization details</legend>
              <Field label="Organization name" name="organization_name" value={form.organization_name} onChange={handleChange} error={errors.organization_name} autoComplete="organization" />
              <Field label="Organization email" name="organization_email" type="email" value={form.organization_email} onChange={handleChange} error={errors.organization_email} />
              <Field label="Organization ID" name="organization_id" value={form.organization_id} onChange={handleChange} error={errors.organization_id} hint="Your company or registration number, e.g. org-123." />
            </fieldset>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating account…' : isOrganizer ? 'Register as Organizer' : 'Register as Attendee'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered? <Link to="/login" className="font-medium text-indigo-600 hover:underline">Log in</Link>
        </p>
      </div>
    </main>
  )
}
