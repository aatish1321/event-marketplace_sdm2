import { Link } from 'react-router-dom'
import afterglowImg from '../assets/afterglow.jpg'

// Shared frame for log in and register: a photo panel beside the form (hidden on small screens).
export default function AuthShell({ wide = false, children }) {
  return (
    <div className="flex min-h-screen bg-canvas selection:bg-primary selection:text-white">
      <aside className="relative isolate hidden w-5/12 shrink-0 flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <img src={afterglowImg} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[65%_60%]" />
        {/* Neutral scrim so the wordmark and line stay legible over the photo */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-primary/90 via-primary/25 to-primary/55" />
        <Link to="/" className="text-xl font-extrabold uppercase tracking-widest">Eventify</Link>
        <p className="max-w-md text-balance text-4xl font-extrabold leading-[1.1] tracking-tight">Find a night out, or run one</p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10 md:px-8">
        <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-[440px]'}`}>
          <Link to="/" className="mb-10 block text-xl font-extrabold uppercase tracking-widest text-primary lg:hidden">Eventify</Link>
          {children}
        </div>
      </main>
    </div>
  )
}
