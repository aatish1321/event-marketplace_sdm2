import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import EventCard from '../components/EventCard';
import SiteFooter from '../components/SiteFooter';
import usePageTitle from '../lib/usePageTitle';
import { pageContainer } from '../lib/layout';
import { buttonLg, buttonMd, onDark, onPaper } from '../lib/buttons';
import afterglowImg from '../assets/afterglow.jpg';
import foodFestivalImg from '../assets/food_festival.jpg';
import designingTmrwImg from '../assets/desgining-tmrw.jpg';
import createEventImg from '../assets/create_the_event.jpg';

// Dates use the same format as the app (see lib/dates.js).
const events = [
  {
    category: 'Concert',
    date: 'Fri 9 Oct · 20:00',
    title: 'Solange: Notes From the Deep',
    venue: 'Radio City Music Hall · New York, NY',
    price: 'From $74',
    imageUrl: afterglowImg,
  },
  {
    category: 'Food & drink',
    date: 'Sat 10 Oct · 12:00',
    title: 'The New City Food Festival',
    venue: 'Industry City Courtyard · Brooklyn, NY',
    price: 'From $32',
    imageUrl: foodFestivalImg,
  },
  {
    category: 'Talks',
    date: 'Thu 15 Oct · 18:30',
    title: 'Designing Tomorrow: Live',
    venue: 'The Shed · New York, NY',
    price: 'From $45',
    imageUrl: designingTmrwImg,
  },
];

const organizerPoints = [
  { title: 'Launch a polished event page', body: 'Add tickets, schedules, media, and custom checkout questions in minutes.' },
  { title: 'Know what’s working', body: 'Track sales, conversion, payouts, and channel performance in real time.' },
  { title: 'Grow your audience', body: 'Reach relevant local buyers with built-in discovery and targeted promotion.' },
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

const display = 'font-extrabold leading-[0.92] tracking-[-0.045em]';
const sectionTitle = `text-5xl md:text-7xl ${display}`;

// One audience's three steps. Light card on paper, or the dark ink card beside it.
function Journey({ eyebrow, title, steps, dark = false }) {
  return (
    <div className={`rounded-2xl p-8 lg:p-12 ${dark ? 'bg-ink text-white' : 'border border-border bg-surface text-ink'}`}>
      <p className={`text-sm font-semibold ${dark ? 'text-white/60' : 'text-muted'}`}>{eyebrow}</p>
      <h3 className="mt-3 text-4xl font-extrabold tracking-[-0.035em]">{title}</h3>
      <ol className="mt-10 space-y-8">
        {steps.map((step, index) => (
          <li key={step.title} className={`grid grid-cols-[4rem_1fr] gap-4 border-t pt-6 ${dark ? 'border-white/15' : 'border-border'}`}>
            <span className={`text-4xl font-extrabold leading-none tracking-[-0.04em] tabular-nums ${dark ? 'text-white/40' : 'text-accent'}`}>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h4 className="text-lg font-semibold">{step.title}</h4>
              <p className={`mt-1 text-base leading-7 ${dark ? 'text-white/75' : 'text-secondary'}`}>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

const Landing = () => {
  const navigate = useNavigate();
  usePageTitle(null);

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink selection:bg-ink selection:text-white">
      {/* Navigation */}
      <header className={`${pageContainer} flex h-20 items-center justify-between`}>
        <Link to="/" className="text-xl font-extrabold uppercase tracking-[0.2em]">Eventify</Link>
        <nav aria-label="Main" className="flex items-center gap-2 sm:gap-6">
          <Link to="/discover" className="hidden text-sm font-semibold text-secondary transition-colors hover:text-ink sm:inline">Discover events</Link>
          <Link to="/login" className="px-2 text-sm font-semibold text-secondary transition-colors hover:text-ink">Log in</Link>
          <Link to="/register" className={`${buttonMd} bg-ink text-white hover:bg-ink/85`}>Sign up</Link>
        </nav>
      </header>

      {/* Hero: headline on paper, festival photo to the right edge, the featured ticket breaking across its edge */}
      <section className="mx-auto grid max-w-[1440px] lg:min-h-[calc(100svh-5rem)] lg:grid-cols-12">
        <div className="flex flex-col justify-center px-6 pb-16 pt-8 lg:col-span-7 lg:px-12 lg:py-20">
          <p className="text-sm font-semibold text-accent">Concerts · Comedy · Sports · Talks</p>
          {/* Chat-bubble headline: ink bubble, even padding, tight bottom-left corner with a small tail */}
          <h1 className="relative mt-6 self-start rounded-[1.75rem] rounded-bl-md bg-ink px-6 py-5 text-[2.25rem] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] text-white after:absolute after:left-0 after:top-full after:h-5 after:w-7 after:bg-ink after:[clip-path:polygon(0_0,100%_0,0_100%)] sm:rounded-[2.25rem] sm:rounded-bl-lg sm:px-9 sm:py-7 sm:text-6xl xl:px-10 xl:py-8 xl:text-[5.25rem]">
            {/* Fixed lines so the bubble hugs its widest line and the padding stays even */}
            <span className="block">Tickets for</span>{' '}
            <span className="block">what’s on</span>{' '}
            <span className="block">this weekend</span>
          </h1>
          <p className="mt-12 max-w-xl text-lg leading-8 text-secondary sm:text-xl">
            Book in seconds, or publish your own event with tools built for organizers.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link to="/discover" className={`${buttonLg} ${onPaper.primary}`}>
              Browse events <ArrowRight className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
            </Link>
            <Link to="/register" className={`${buttonLg} ${onPaper.secondary}`}>Create an event</Link>
          </div>
        </div>

        <div className="relative min-h-[560px] lg:col-span-5 lg:min-h-0">
          <img
            src={afterglowImg}
            alt="A crowd in front of a lit festival stage at night"
            className="absolute inset-0 h-full w-full object-cover object-[62%_50%]"
          />
          <article className="absolute bottom-6 left-6 right-6 rounded-card bg-surface text-ink shadow-2xl sm:right-auto sm:w-[380px] lg:-left-24 lg:bottom-16">
            <div className="p-6">
              <p className="text-xs font-semibold text-accent">Featured</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">Afterglow Festival</h2>
              <p className="mt-1 text-sm font-medium text-muted">Brooklyn Mirage · New York</p>
            </div>
            <div className="mx-6 flex items-center justify-between border-t border-dashed border-ink/25 py-4">
              <p className="text-sm font-semibold tabular-nums text-muted">Sat 17 Oct · 19:30</p>
              <Link to="/discover" className="inline-flex items-center gap-1 text-sm font-semibold text-ink transition-colors hover:text-accent">
                Get tickets <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <main>
        {/* Editors' picks */}
        <section className="bg-ink text-white">
          <div className={`${pageContainer} py-24 lg:py-32`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/60">Editors’ picks</p>
                <h2 className={`mt-4 max-w-3xl ${sectionTitle}`}>Worth leaving the house for</h2>
              </div>
              <p className="max-w-sm text-lg leading-8 text-white/70">Standout events selected by local tastemakers, updated every week.</p>
            </div>
            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.title} {...event} href="/discover" onTicketsClick={() => navigate('/discover')} />
              ))}
            </div>
          </div>
        </section>

        {/* Organizers: photo to the left edge, copy on paper */}
        <section className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
          <div className="relative min-h-[420px] lg:min-h-[760px]">
            <img src={createEventImg} alt="A venue set with tables and stage lights for an evening event" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center px-6 py-20 lg:px-20 lg:py-24">
            <p className="text-sm font-semibold text-accent">For organizers</p>
            <h2 className={`mt-4 max-w-xl text-balance ${sectionTitle}`}>Create the event. We’ll help fill the room</h2>
            <p className="mt-8 max-w-lg text-lg leading-8 text-secondary">
              Everything you need to publish, promote, sell, scan, and understand your event, without stitching together five different tools.
            </p>
            <ul className="mt-10 max-w-lg">
              {organizerPoints.map((point) => (
                <li key={point.title} className="border-t border-border py-5">
                  <h3 className="text-lg font-semibold">{point.title}</h3>
                  <p className="mt-1 text-base leading-7 text-secondary">{point.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link to="/register" className={`${buttonLg} ${onPaper.primary}`}>
                Create an event <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <span className="text-sm font-medium text-muted">Free to publish</span>
            </div>
          </div>
        </section>

        {/* Two journeys: cards on the page grid, paper around them, so no colour block meets another */}
        <section className="py-24 lg:py-32">
          <div className={pageContainer}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-accent">Simple by design</p>
                <h2 className={`mt-4 max-w-3xl ${sectionTitle}`}>One marketplace, two ways in</h2>
              </div>
              <p className="max-w-sm text-lg leading-8 text-secondary">
                Whether you’re finding Friday night plans or producing them, Eventify keeps the path clear.
              </p>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-2">
              <Journey eyebrow="Find your next favorite night" title="For event-goers" steps={forAttendees} />
              <Journey eyebrow="Turn an idea into a full room" title="For organizers" steps={forOrganizers} dark />
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="bg-accent text-white">
          <div className={`${pageContainer} flex flex-col gap-12 py-24 lg:flex-row lg:items-end lg:justify-between lg:py-32`}>
            <div className="max-w-4xl">
              <h2 className={`text-balance ${sectionTitle}`}>Find a night out, or run one</h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/90 sm:text-xl">
                Find your seat, your people, and your next favorite story, or create the event everyone talks about tomorrow.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto">
              <Link to="/discover" className={`${buttonLg} ${onDark.primary} justify-between sm:min-w-[260px]`}>
                Find an event <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <Link to="/register" className={`${buttonLg} bg-ink text-white hover:bg-ink/85 justify-between sm:min-w-[260px]`}>
                Create your event <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <p className="mt-1 text-center text-sm font-medium text-white/90">Free to join. Free to publish.</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Landing;
