import { useAuth } from '../context/AuthContext'

// Landing views until event discovery, management and audit features are built.
export default function RoleHome({ title, description }) {
  const { userRole, logout } = useAuth()
  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-card border border-border bg-surface p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-primary">{title}</h1>
          <button type="button" onClick={logout} className="rounded-control border border-border px-4 py-2 text-sm font-medium text-secondary transition-colors hover:border-ink/30">Log out</button>
        </div>
        <p className="mt-4 text-sm text-secondary">You are logged in as {userRole}.</p>
        <p className="mt-2 text-sm text-secondary">{description}</p>
      </div>
    </main>
  )
}
