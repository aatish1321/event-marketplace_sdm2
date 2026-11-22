import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import EventCard from '../components/EventCard';
import afterglowImg from '../assets/afterglow.jpg';
import foodFestivalImg from '../assets/food_festival.jpg';
import designingTmrwImg from '../assets/desgining-tmrw.jpg';
import createEventImg from '../assets/create_the_event.jpg';

const events = [
  {
    category: 'Concert',
    date: 'Fri, Oct 9 · 8:00 PM',
    title: 'Solange: Notes From the Deep',
    venue: 'Radio City Music Hall · New York, NY',
    price: 'From $74',
    imageUrl: afterglowImg,
  },
  {
    category: 'Food & drink',
    date: 'Sat, Oct 10 · 12:00 PM',
    title: 'The New City Food Festival',
    venue: 'Industry City Courtyard · Brooklyn, NY',
    price: 'From $32',
    imageUrl: foodFestivalImg,
  },
  {
    category: 'Talks',
    date: 'Thu, Oct 15 · 6:30 PM',
    title: 'Designing Tomorrow: Live',
    venue: 'The Shed · New York, NY',
    price: 'From $45',
    imageUrl: designingTmrwImg,
  },
];

const forAttendees = [
  { title: 'Search your way', body: 'Browse by date, neighborhood, category, or the artists you already love.' },
  { title: 'Book with confidence', body: 'See clear pricing, choose your ticket, and check out securely in seconds.' },
  { title: 'Show up and enjoy', body: 'Your mobile ticket is ready when you are, with reminders before doors open.' },
];

const forOrganizers = [
  { title: 'Build your page', body: 'Create ticket types, add your story, and publish a beautiful event page.' },
  { title: 'Reach the right crowd', body: 'Share anywhere or tap into Eventify discovery and promotion tools.' },
  { title: 'Run it from one place', body: 'Scan guests, monitor sales, message attendees, and receive fast payouts.' },
];

const container = 'mx-auto w-full max-w-[1440px] px-6 lg:px-12';
const h2 = 'text-3xl font-medium leading-[1.1] tracking-[-0.02em] md:text-5xl';
const button = 'inline-flex h-12 items-center justify-center gap-2 rounded-control px-6 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
const buttonPrimary = `${button} bg-accent text-white hover:bg-accent/90`;
const buttonOnDark = `${button} bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/15`;

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas font-sans text-primary selection:bg-primary selection:text-white">
      {/* Navigation + hero scene */}
      <header className="relative isolate bg-primary text-white">
        <img
          src={afterglowImg}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_62%]"
        />
        {/* Neutral scrim so the headline sits on calm, dark space */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-primary/90 via-primary/45 to-transparent" />

        <nav className={`${container} flex h-16 items-center justify-between`}>
          <Link to="/" className="text-lg font-semibold tracking-tight">Eventify</Link>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-sm text-white/80 transition-colors hover:text-white">Log in</Link>
            <Link to="/register" className="inline-flex h-9 items-center rounded-control bg-white/10 px-4 text-sm font-medium ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/15">
              Sign up
            </Link>
          </div>
        </nav>

        <div className={`${container} relative flex min-h-[600px] flex-col pb-16 pt-16 lg:min-h-[calc(100svh-4rem)] lg:pb-0 lg:pt-28`}>
          <div className="max-w-2xl">
            <h1 className="max-w-xl text-balance text-[2.5rem] font-medium leading-[1.05] tracking-[-0.03em] sm:text-6xl lg:text-[4rem]">
              Tickets for what's on this weekend
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-white/75">
              Concerts, comedy, sports and talks near you. Book in seconds, or publish your own event with tools built for organizers.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/discover" className={buttonPrimary}>Browse events</Link>
              <Link to="/register" className={buttonOnDark}>Create an event</Link>
            </div>
          </div>

          {/* Product view: a ticket for the featured event, rising past the hero edge */}
          <article className="relative z-10 mt-12 w-full max-w-sm rounded-card bg-surface text-ink shadow-xl lg:absolute lg:bottom-0 lg:right-12 lg:mt-0 lg:w-[400px] lg:translate-y-8">
            <div className="p-5">
              <h2 className="text-xl font-medium">Afterglow Festival</h2>
              <p className="mt-1 text-sm text-muted">Brooklyn Mirage · New York</p>
            </div>
            <div className="mx-5 flex items-center justify-between border-t border-dashed border-ink/25 py-4">
              <p className="font-mono text-xs tabular-nums text-muted">Sat, Oct 17 · 7:30 PM</p>
              <Link to="/discover" className="inline-flex items-center gap-1 text-sm font-medium text-ink transition-colors hover:text-accent">
                Get tickets <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </header>

      <main>
        {/* Event list */}
        <section className="bg-primary px-6 pb-24 pt-24 text-white lg:px-12 lg:pt-32">
          <div className="mx-auto max-w-[1440px]">
            <p className="mb-3 text-sm text-white/60">Editors' picks</p>
            <h2 className={h2}>Worth leaving the house for</h2>
            <p className="mb-12 mt-4 max-w-xl text-lg text-white/70">Standout events selected by local tastemakers, updated every week.</p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.title} {...event} href="/discover" onTicketsClick={() => navigate('/discover')} />
              ))}
            </div>
          </div>
        </section>

        {/* Organizers */}
        <section className="px-6 py-24 lg:px-12">
          <div className="mx-auto grid max-w-[1440px] items-center gap-16 lg:grid-cols-2">
            <img src={createEventImg} alt="A venue set for an evening event" className="aspect-[4/3] w-full rounded-2xl object-cover" />
            <div className="max-w-xl">
              <p className="mb-3 text-sm text-muted">For organizers</p>
              <h2 className={`${h2} mb-6`}>Create the event and we'll help fill the room</h2>
              <p className="mb-10 text-lg leading-7 text-secondary">
                Everything you need to publish, promote, sell, scan, and understand your event, without stitching together five different tools.
              </p>

              <ul className="mb-10 space-y-6">
                <li>
                  <h3 className="mb-1 font-medium">Launch a polished event page</h3>
                  <p className="text-sm text-secondary">Add tickets, schedules, media, and custom checkout questions in minutes.</p>
                </li>
                <li>
                  <h3 className="mb-1 font-medium">Know what's working</h3>
                  <p className="text-sm text-secondary">Track sales, conversion, payouts, and channel performance in real time.</p>
                </li>
                <li>
                  <h3 className="mb-1 font-medium">Grow your audience</h3>
                  <p className="text-sm text-secondary">Reach relevant local buyers with built-in discovery and targeted promotion.</p>
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link to="/register" className={buttonPrimary}>
                  Create an event <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </Link>
                <Link to="/register" className="text-sm font-medium underline underline-offset-4 transition-colors hover:text-accent">Explore organizer tools</Link>
                <span className="text-sm text-muted">Free to publish</span>
              </div>
            </div>
          </div>
        </section>

        {/* Two journeys */}
        <section className="px-6 pb-24 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <p className="mb-3 text-sm text-muted">Simple by design</p>
            <h2 className={`${h2} mb-6 max-w-2xl`}>One marketplace, two ways in</h2>
            <p className="mb-12 max-w-xl text-lg text-secondary">
              Whether you're finding Friday night plans or producing them, Eventify keeps the path clear.
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-8 lg:p-10">
                <p className="mb-2 text-sm text-muted">Find your next favorite night</p>
                <h3 className="mb-8 text-2xl font-medium">For event-goers</h3>
                <ol className="divide-y divide-border">
                  {forAttendees.map((item, index) => (
                    <li key={item.title} className="flex gap-6 py-6 first:pt-0 last:pb-0">
                      <span className="w-6 pt-1 font-mono text-xs tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <h4 className="mb-1 text-lg font-medium">{item.title}</h4>
                        <p className="text-sm text-secondary">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl bg-primary p-8 text-white lg:p-10">
                <p className="mb-2 text-sm text-white/60">Turn an idea into a full room</p>
                <h3 className="mb-8 text-2xl font-medium">For organizers</h3>
                <ol className="divide-y divide-white/10">
                  {forOrganizers.map((item, index) => (
                    <li key={item.title} className="flex gap-6 py-6 first:pt-0 last:pb-0">
                      <span className="w-6 pt-1 font-mono text-xs tabular-nums text-white/60">{String(index + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <h4 className="mb-1 text-lg font-medium">{item.title}</h4>
                        <p className="text-sm text-white/70">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="px-6 pb-24 lg:px-12">
          <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-12 rounded-2xl bg-primary p-8 text-white md:p-16 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className={`${h2} mb-6`}>Find a night out, or run one</h2>
              <p className="text-lg text-white/75">
                Find your seat, your people, and your next favorite story, or create the event everyone talks about tomorrow.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
              <Link to="/discover" className={`${buttonPrimary} justify-between`}>
                Find an event <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <Link to="/register" className={`${buttonOnDark} justify-between`}>
                Create your event <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <p className="mt-1 text-center text-sm text-white/60">Free to join. Free to publish.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary px-6 py-16 text-white lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-12 lg:flex-row lg:items-end">
          <div className="text-lg font-semibold tracking-tight">Eventify</div>

          <div className="w-full max-w-md">
            <p className="mb-1 text-sm font-medium">The good stuff, once a week</p>
            <p className="mb-4 text-sm text-white/70">New events, local favorites, and smart ideas for organizers. No noise.</p>
            <div className="relative">
              <input
                type="email"
                aria-label="Email address"
                placeholder="Email address"
                className="h-12 w-full rounded-control border border-white/15 bg-white/5 pl-4 pr-32 text-sm placeholder:text-white/50 focus:border-white/40 focus:outline-none"
              />
              <button className="absolute bottom-1 right-1 top-1 flex items-center gap-1 rounded-md bg-white px-4 text-sm font-medium text-primary transition-colors hover:bg-white/90">
                Subscribe <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
