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

const h2 = 'text-3xl font-extrabold leading-[1.1] tracking-tight md:text-5xl';
const button = 'inline-flex h-12 items-center justify-center gap-2 rounded-control px-6 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';
const buttonPrimary = `${button} bg-accent text-white hover:bg-accent/90`;

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas font-sans text-primary selection:bg-primary selection:text-white">
      {/* Navigation + Hero Wrapper */}
      <div className="relative overflow-hidden bg-[#D8DAE0] lg:overflow-visible">
        {/* Navigation */}
        <nav className="w-full relative z-30">
          <div className="flex h-24 items-center justify-between px-6 lg:px-12 max-w-[1600px] mx-auto">
            <Link to="/" className="text-2xl font-black tracking-widest uppercase text-primary">
              EVENTIFY
            </Link>
            <div className="flex items-center gap-6 md:gap-8">
              <Link to="/login" className="text-sm font-medium hover:text-[#243B53] text-primary">
                Log in
              </Link>
              <Link to="/register" className="inline-flex h-[44px] items-center justify-center whitespace-nowrap rounded-full bg-primary px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
                Sign up
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-4 pb-24 lg:pt-10 lg:pb-32">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
              <div className="grid lg:grid-cols-[52%_1fr] gap-12 lg:gap-16 items-center">
                
                <div className="w-full flex flex-col items-center text-center relative z-10 lg:pr-8 py-8 lg:py-16">
                  {/* Floating Emojis */}
                  <div className="absolute top-10 left-0 md:left-10 text-4xl animate-float motion-reduce:animate-none hover:scale-125 hover:-rotate-12 transition-transform cursor-pointer z-0 opacity-80">🎟️</div>
                  <div className="absolute top-20 right-0 md:right-10 text-5xl animate-float-delayed motion-reduce:animate-none hover:scale-125 hover:rotate-12 transition-transform cursor-pointer z-0 opacity-80">🎪</div>
                  <div className="absolute bottom-20 left-4 md:left-20 text-5xl animate-float-slow motion-reduce:animate-none hover:scale-125 hover:-rotate-12 transition-transform cursor-pointer z-0 opacity-80">🎸</div>
                  <div className="absolute bottom-32 right-8 md:right-24 text-4xl animate-float motion-reduce:animate-none hover:scale-125 hover:rotate-12 transition-transform cursor-pointer z-0 opacity-80">🎭</div>
                  <div className="absolute top-48 left-[15%] text-3xl animate-float-delayed motion-reduce:animate-none hover:scale-125 hover:-rotate-12 transition-transform cursor-pointer z-0 opacity-60 hidden md:block">🎵</div>
                  <div className="absolute bottom-16 right-[20%] text-3xl animate-float-slow motion-reduce:animate-none hover:scale-125 hover:rotate-12 transition-transform cursor-pointer z-0 opacity-60 hidden md:block">🍻</div>
                  
                  {/* Additional emojis closer to the text */}
                  <div className="absolute top-[25%] left-[30%] text-4xl animate-float motion-reduce:animate-none hover:scale-125 hover:rotate-12 transition-transform cursor-pointer z-20 opacity-90 hidden md:block">🎉</div>
                  <div className="absolute top-[35%] right-[28%] text-5xl animate-float-slow motion-reduce:animate-none hover:scale-125 hover:-rotate-12 transition-transform cursor-pointer z-0 opacity-70 hidden md:block">🎤</div>
                  <div className="absolute bottom-[30%] left-[28%] text-4xl animate-float-delayed motion-reduce:animate-none hover:scale-125 hover:rotate-12 transition-transform cursor-pointer z-0 opacity-80 hidden md:block">💃</div>
                  <div className="absolute bottom-[20%] right-[35%] text-3xl animate-float motion-reduce:animate-none hover:scale-125 hover:-rotate-12 transition-transform cursor-pointer z-20 opacity-90 hidden md:block">🍕</div>
                  <div className="absolute top-[5%] left-[45%] text-4xl animate-float-slow motion-reduce:animate-none hover:scale-125 hover:-rotate-12 transition-transform cursor-pointer z-0 opacity-70">🎇</div>
                  <div className="absolute bottom-[5%] left-[55%] text-5xl animate-float-delayed motion-reduce:animate-none hover:scale-125 hover:rotate-12 transition-transform cursor-pointer z-0 opacity-60">🥂</div>

                  <h1 className="text-[11vw] sm:text-[5.5rem] lg:text-[6.5rem] xl:text-[7.5rem] font-black leading-[0.95] tracking-tight mb-8 uppercase text-primary relative z-10">
                    DON'T LET THE<br />
                    <span className="whitespace-nowrap">WEEKEND</span><br />
                    <span className="whitespace-nowrap">SLIP AWAY</span>
                  </h1>
                  <p className="text-[1.1rem] text-[#243B53] font-medium mb-12 max-w-lg leading-relaxed">
                    Discover concerts, comedy, sports, talks, and one-of-a-kind experiences. Book in seconds—or bring your own event to life with tools built for organizers.
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-[#243B53] mr-2">Popular:</span>
                    <span className="text-sm font-semibold px-4 py-2 border border-[#C3C6CD]/80 bg-[#ECEEF3]/50 rounded-full cursor-pointer hover:bg-[#ECEEF3] transition-colors text-[#243B53] shadow-sm">Live music</span>
                    <span className="text-sm font-semibold px-4 py-2 border border-[#C3C6CD]/80 bg-[#ECEEF3]/50 rounded-full cursor-pointer hover:bg-[#ECEEF3] transition-colors text-[#243B53] shadow-sm">This weekend</span>
                    <span className="text-sm font-semibold px-4 py-2 border border-[#C3C6CD]/80 bg-[#ECEEF3]/50 rounded-full cursor-pointer hover:bg-[#ECEEF3] transition-colors text-[#243B53] shadow-sm">Comedy</span>
                  </div>
                </div>
                
              </div>
            </div>
            
            <div className="lg:absolute lg:top-6 lg:bottom-24 lg:right-0 lg:w-[48%] xl:w-[48%] relative w-full h-[60vh] lg:h-auto rounded-[2rem] lg:rounded-none lg:rounded-l-[2rem] overflow-hidden group mx-6 lg:mx-0 w-[calc(100%-3rem)] lg:w-auto z-20 shadow-2xl">
              <img 
                src={afterglowImg} 
                alt="Festival" 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute top-8 right-8 flex gap-1.5 z-30">
                 <div className="w-5 h-1.5 bg-[#ECEEF3] rounded-full"></div>
                 <div className="w-5 h-1.5 bg-[#ECEEF3]/30 rounded-full"></div>
              </div>
              <div className="absolute top-8 left-8 bg-[#ECEEF3] px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-30">
                 <div className="w-2 h-2 rounded-full bg-[#C85A17]"></div>
                 <span className="text-[10px] font-black uppercase tracking-wider text-primary">Trending Now</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white z-30">
                <p className="text-xs font-bold text-[#C85A17] uppercase mb-2 tracking-widest">Sat, Oct 17 • 7:30 PM</p>
                <h3 className="text-3xl lg:text-4xl font-medium mb-1">Afterglow Festival</h3>
                <p className="text-white/70 text-sm font-medium">Brooklyn Mirage • New York</p>
              </div>
            </div>
          </section>
        </div>

      <main>
        {/* Event list */}
        <section className="bg-primary px-6 py-24 text-white lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <p className="mb-3 text-sm font-semibold text-white/70">Editors' picks</p>
            <h2 className={h2}>Worth leaving the house for</h2>
            <p className="mb-12 mt-4 max-w-xl text-lg font-medium text-white/75">Standout events selected by local tastemakers, updated every week.</p>

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
              <p className="mb-3 text-sm font-semibold text-muted">For organizers</p>
              <h2 className={`${h2} mb-6`}>Create the event and we'll help fill the room</h2>
              <p className="mb-10 text-lg font-medium leading-7 text-secondary">
                Everything you need to publish, promote, sell, scan, and understand your event, without stitching together five different tools.
              </p>

              <ul className="mb-10 space-y-6">
                <li>
                  <h3 className="mb-1 font-semibold">Launch a polished event page</h3>
                  <p className="text-sm font-medium text-secondary">Add tickets, schedules, media, and custom checkout questions in minutes.</p>
                </li>
                <li>
                  <h3 className="mb-1 font-semibold">Know what's working</h3>
                  <p className="text-sm font-medium text-secondary">Track sales, conversion, payouts, and channel performance in real time.</p>
                </li>
                <li>
                  <h3 className="mb-1 font-semibold">Grow your audience</h3>
                  <p className="text-sm font-medium text-secondary">Reach relevant local buyers with built-in discovery and targeted promotion.</p>
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link to="/register" className={buttonPrimary}>
                  Create an event <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                </Link>
                <Link to="/register" className="text-sm font-semibold underline underline-offset-4 transition-colors hover:text-accent">Explore organizer tools</Link>
                <span className="text-sm text-muted">Free to publish</span>
              </div>
            </div>
          </div>
        </section>

        {/* Two journeys */}
        <section className="px-6 pb-24 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <p className="mb-3 text-sm font-semibold text-muted">Simple by design</p>
            <h2 className={`${h2} mb-6 max-w-2xl`}>One marketplace, two ways in</h2>
            <p className="mb-12 max-w-xl text-lg font-medium text-secondary">
              Whether you're finding Friday night plans or producing them, Eventify keeps the path clear.
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface p-8 lg:p-10">
                <p className="mb-2 text-sm font-semibold text-muted">Find your next favorite night</p>
                <h3 className="mb-8 text-2xl font-bold">For event-goers</h3>
                <ol className="divide-y divide-border">
                  {forAttendees.map((item, index) => (
                    <li key={item.title} className="flex gap-6 py-6 first:pt-0 last:pb-0">
                      <span className="w-6 pt-1 font-mono text-xs tabular-nums text-muted">{String(index + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <h4 className="mb-1 text-lg font-semibold">{item.title}</h4>
                        <p className="text-sm font-medium text-secondary">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-2xl bg-primary p-8 text-white lg:p-10">
                <p className="mb-2 text-sm font-semibold text-white/70">Turn an idea into a full room</p>
                <h3 className="mb-8 text-2xl font-bold">For organizers</h3>
                <ol className="divide-y divide-white/10">
                  {forOrganizers.map((item, index) => (
                    <li key={item.title} className="flex gap-6 py-6 first:pt-0 last:pb-0">
                      <span className="w-6 pt-1 font-mono text-xs tabular-nums text-white/60">{String(index + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <h4 className="mb-1 text-lg font-semibold">{item.title}</h4>
                        <p className="text-sm font-medium text-white/75">{item.body}</p>
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
          <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-12 rounded-2xl bg-accent p-8 text-white md:p-16 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <h2 className={`${h2} mb-6`}>Find a night out, or run one</h2>
              <p className="text-lg font-medium text-white/90">
                Find your seat, your people, and your next favorite story, or create the event everyone talks about tomorrow.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
              <Link to="/discover" className={`${button} justify-between bg-surface text-primary hover:bg-white`}>
                Find an event <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <Link to="/register" className={`${button} justify-between bg-primary text-white hover:bg-primary/90`}>
                Create your event <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              </Link>
              <p className="mt-1 text-center text-sm font-medium text-white/90">Free to join. Free to publish.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-primary px-6 py-16 text-white lg:px-12">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-12 lg:flex-row lg:items-end">
          <div className="text-xl font-extrabold uppercase tracking-widest">Eventify</div>

          <div className="w-full max-w-md">
            <p className="mb-1 text-sm font-semibold">The good stuff, once a week</p>
            <p className="mb-4 text-sm text-white/70">New events, local favorites, and smart ideas for organizers. No noise.</p>
            <div className="relative">
              <input
                type="email"
                aria-label="Email address"
                placeholder="Email address"
                className="h-12 w-full rounded-control border border-white/15 bg-white/5 pl-4 pr-32 text-sm placeholder:text-white/50 focus:border-white/40 focus:outline-none"
              />
              <button className="absolute bottom-1 right-1 top-1 flex items-center gap-1 rounded-md bg-white px-4 text-sm font-semibold text-primary transition-colors hover:bg-white/90">
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
