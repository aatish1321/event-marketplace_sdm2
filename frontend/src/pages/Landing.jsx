import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Heart, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import afterglowImg from '../assets/afterglow.jpg';
import foodFestivalImg from '../assets/food_festival.jpg';
import designingTmrwImg from '../assets/desgining-tmrw.jpg';
import createEventImg from '../assets/create_the_event.jpg';

const events = [
  {
    category: 'CONCERT',
    date: 'FRI, OCT 9 • 8:00 PM',
    title: 'Solange: Notes From the Deep',
    location: 'Radio City Music Hall • New York, NY',
    price: '$74',
    image: 'https://picsum.photos/seed/event1/800/600'
  },
  {
    category: 'FOOD & DRINK',
    date: 'SAT, OCT 10 • 12:00 PM',
    title: 'The New City Food Festival',
    location: 'Industry City Courtyard • Brooklyn, NY',
    price: '$32',
    image: foodFestivalImg
  },
  {
    category: 'TALKS',
    date: 'THU, OCT 15 • 6:30 PM',
    title: 'Designing Tomorrow: Live',
    location: 'The Shed • New York, NY',
    price: '$45',
    image: designingTmrwImg
  }
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-[#FDFDFD] text-zinc-950 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Navigation + Hero Wrapper */}
      <div className="bg-[#F8F7F4] relative overflow-hidden lg:overflow-visible">
        {/* Navigation */}
        <nav className="w-full relative z-30">
          <div className="flex h-24 items-center justify-between px-6 lg:px-12 max-w-[1600px] mx-auto">
            <Link to="/" className="text-2xl font-black tracking-widest uppercase text-zinc-950">
              EVENTIFY
            </Link>
            <div className="flex items-center gap-6 md:gap-8">
              <Link to="/organizer" className="text-sm font-medium hover:text-zinc-600 hidden sm:block text-zinc-800">
                For organizers
              </Link>
              <Link to="/login" className="text-sm font-medium hover:text-zinc-600 text-zinc-800">
                Sign in
              </Link>
              <Link to="/register">
                <Button className="rounded-full px-6 py-5 bg-[#1A1A1A] hover:bg-black text-white font-medium shadow-sm">
                  Create event
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-4 pb-24 lg:pt-10 lg:pb-32">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
              <div className="grid lg:grid-cols-[52%_1fr] gap-12 lg:gap-16 items-center">
                
                <div className="w-full flex flex-col items-center text-center relative z-10 lg:pr-8 py-8 lg:py-16">
                  <h1 className="text-[11vw] sm:text-[5.5rem] lg:text-[6.5rem] xl:text-[7.5rem] font-black leading-[0.95] tracking-tight mb-8 uppercase text-[#1A1A1A]">
                    DON'T LET THE<br />
                    <span className="whitespace-nowrap">WEEKEND</span><br />
                    <span className="whitespace-nowrap">SLIP AWAY</span>
                  </h1>
                  <p className="text-[1.1rem] text-zinc-500 font-medium mb-12 max-w-lg leading-relaxed">
                    Discover concerts, comedy, sports, talks, and one-of-a-kind experiences. Book in seconds—or bring your own event to life with tools built for organizers.
                  </p>
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-zinc-500 mr-2">Popular:</span>
                    <span className="text-sm font-semibold px-4 py-2 border border-zinc-200/80 bg-white/50 rounded-full cursor-pointer hover:bg-white transition-colors text-zinc-600 shadow-sm">Live music</span>
                    <span className="text-sm font-semibold px-4 py-2 border border-zinc-200/80 bg-white/50 rounded-full cursor-pointer hover:bg-white transition-colors text-zinc-600 shadow-sm">This weekend</span>
                    <span className="text-sm font-semibold px-4 py-2 border border-zinc-200/80 bg-white/50 rounded-full cursor-pointer hover:bg-white transition-colors text-zinc-600 shadow-sm">Comedy</span>
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
                 <div className="w-5 h-1.5 bg-white rounded-full"></div>
                 <div className="w-5 h-1.5 bg-white/30 rounded-full"></div>
              </div>
              <div className="absolute top-8 left-8 bg-white px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-30">
                 <div className="w-2 h-2 rounded-full bg-[#FF5238]"></div>
                 <span className="text-[10px] font-black uppercase tracking-wider text-zinc-950">Trending Now</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-white z-30">
                <p className="text-xs font-bold text-[#FF5238] uppercase mb-2 tracking-widest">Sat, Oct 17 • 7:30 PM</p>
                <h3 className="text-3xl lg:text-4xl font-medium mb-1">Afterglow Festival</h3>
                <p className="text-white/70 text-sm font-medium">Brooklyn Mirage • New York</p>
              </div>
            </div>
          </section>
        </div>

        <main>
        {/* Event List Section */}
        <section className="bg-[#2D2D2D] text-white py-24 px-6 lg:px-12">
          <div className="max-w-[1600px] mx-auto">
            <p className="text-[#FF5238] text-xs font-bold tracking-widest uppercase mb-4">Editors' Picks</p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-4">Worth leaving the house for.</h2>
            <p className="text-zinc-400 text-lg mb-12">Standout events selected by local tastemakers, updated every week.</p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, idx) => (
                <div key={idx} className="bg-white rounded-2xl overflow-hidden text-zinc-950 flex flex-col group cursor-pointer hover:shadow-xl transition-shadow">
                  <div className="relative h-64 lg:h-56 overflow-hidden">
                    <img src={event.image} alt={event.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wider">
                      {event.category}
                    </div>
                    <button className="absolute top-4 right-4 p-2 bg-white rounded-full hover:scale-110 transition-transform shadow-sm text-zinc-400 hover:text-red-500">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <p className="text-[#FF5238] text-xs font-bold uppercase tracking-wider mb-2">{event.date}</p>
                    <h3 className="text-xl font-medium mb-1 line-clamp-1 group-hover:text-[#FF5238] transition-colors">{event.title}</h3>
                    <div className="flex items-start gap-1 text-zinc-500 text-sm mb-6">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                    <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center justify-between">
                      <p className="text-zinc-500 text-sm">From <span className="text-zinc-950 font-semibold">{event.price}</span></p>
                      <button className="text-[#FF5238] font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                        Get tickets <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Organizers Section */}
        <section className="py-24 px-6 lg:px-12 bg-[#EBEBEB]">
          <div className="max-w-[1600px] mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <div className="rounded-2xl overflow-hidden aspect-[4/3] lg:aspect-[4/3] w-full">
               <img 
                 src={createEventImg} 
                 alt="Organizer" 
                 className="w-full h-full object-cover grayscale opacity-90 hover:grayscale-0 transition-all duration-700"
               />
            </div>
            <div className="max-w-xl">
              <p className="text-[#FF5238] text-xs font-bold tracking-widest uppercase mb-4">For Organizers</p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tight leading-[1.1] mb-6 text-zinc-900">
                Create the event. We'll help fill the room.
              </h2>
              <p className="text-lg text-zinc-600 mb-10 leading-relaxed">
                Everything you need to publish, promote, sell, scan, and understand your event—without stitching together five different tools.
              </p>
              
              <div className="space-y-8 mb-10 text-zinc-900">
                <div>
                  <h4 className="font-medium mb-1">Launch a polished event page</h4>
                  <p className="text-zinc-600 text-sm">Add tickets, schedules, media, and custom checkout questions in minutes.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Know what's working</h4>
                  <p className="text-zinc-600 text-sm">Track sales, conversion, payouts, and channel performance in real time.</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Grow your audience</h4>
                  <p className="text-zinc-600 text-sm">Reach relevant local buyers with built-in discovery and targeted promotion.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button className="rounded-full px-8 py-6 bg-[#FF5238] hover:bg-[#e0452e] text-white font-semibold text-base flex items-center gap-2">
                  Create an event <ArrowUpRight className="w-4 h-4" />
                </Button>
                <Button className="rounded-full px-8 py-6 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 font-semibold text-base">
                  Explore organizer tools
                </Button>
                <span className="text-sm text-zinc-500 ml-2">Free to publish</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-6 lg:px-12 bg-[#F6F5F4]">
          <div className="max-w-[1600px] mx-auto">
            <p className="text-[#FF5238] text-xs font-bold tracking-widest uppercase mb-4">Simple by design</p>
            <h2 className="text-5xl md:text-6xl font-medium tracking-tight leading-[1.1] mb-6 max-w-2xl text-zinc-900">
              One marketplace. Two easy journeys.
            </h2>
            <p className="text-lg text-zinc-600 mb-16 max-w-xl">
              Whether you're finding Friday night plans or producing them, Eventify keeps the path clear.
            </p>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Card 1 */}
              <div className="bg-white rounded-3xl p-10 md:p-12 border border-zinc-100 shadow-sm">
                <p className="text-[#FF5238] text-xs font-bold tracking-widest uppercase mb-4">Find your next favorite night</p>
                <h3 className="text-3xl font-medium mb-12">For event-goers</h3>
                
                <div className="space-y-10">
                  <div className="flex gap-6 pb-10 border-b border-zinc-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium mb-2">Search your way</h4>
                      <p className="text-zinc-500 text-sm">Browse by date, neighborhood, category, or the artists you already love.</p>
                    </div>
                    <span className="text-xs font-medium text-zinc-400 pt-1">01</span>
                  </div>
                  <div className="flex gap-6 pb-10 border-b border-zinc-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium mb-2">Book with confidence</h4>
                      <p className="text-zinc-500 text-sm">See clear pricing, choose your ticket, and check out securely in seconds.</p>
                    </div>
                    <span className="text-xs font-medium text-zinc-400 pt-1">02</span>
                  </div>
                  <div className="flex gap-6 pb-10 border-b border-zinc-100 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium mb-2">Show up and enjoy</h4>
                      <p className="text-zinc-500 text-sm">Your mobile ticket is ready when you are, with reminders before doors open.</p>
                    </div>
                    <span className="text-xs font-medium text-zinc-400 pt-1">03</span>
                  </div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#1A1A1A] text-white rounded-3xl p-10 md:p-12">
                <p className="text-[#FF5238] text-xs font-bold tracking-widest uppercase mb-4">Turn an idea into a full room</p>
                <h3 className="text-3xl font-medium mb-12">For organizers</h3>
                
                <div className="space-y-10">
                  <div className="flex gap-6 pb-10 border-b border-zinc-800 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium mb-2">Build your page</h4>
                      <p className="text-zinc-400 text-sm">Create ticket types, add your story, and publish a beautiful event page.</p>
                    </div>
                    <span className="text-xs font-medium text-zinc-600 pt-1">01</span>
                  </div>
                  <div className="flex gap-6 pb-10 border-b border-zinc-800 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium mb-2">Reach the right crowd</h4>
                      <p className="text-zinc-400 text-sm">Share anywhere or tap into Eventify discovery and promotion tools.</p>
                    </div>
                    <span className="text-xs font-medium text-zinc-600 pt-1">02</span>
                  </div>
                  <div className="flex gap-6 pb-10 border-b border-zinc-800 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <h4 className="text-lg font-medium mb-2">Run it from one place</h4>
                      <p className="text-zinc-400 text-sm">Scan guests, monitor sales, message attendees, and receive fast payouts.</p>
                    </div>
                    <span className="text-xs font-medium text-zinc-600 pt-1">03</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to action section */}
        <section className="py-24 px-6 lg:px-12 bg-[#F6F5F4]">
          <div className="max-w-[1600px] mx-auto bg-[#FF5238] rounded-[2.5rem] p-12 md:p-20 text-white flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12">
            <div className="max-w-2xl">
              <p className="text-white/80 text-xs font-bold tracking-widest uppercase mb-4">Make a night of it</p>
              <h2 className="text-5xl md:text-6xl font-medium tracking-tight leading-[1.1] mb-6">
                Something unforgettable is happening nearby.
              </h2>
              <p className="text-white/90 text-lg">
                Find your seat, your people, and your next favorite story—or create the event everyone talks about tomorrow.
              </p>
            </div>
            <div className="flex flex-col gap-4 shrink-0 w-full lg:w-auto">
              <Button className="rounded-full px-8 py-7 bg-white text-zinc-950 hover:bg-zinc-100 font-semibold text-lg flex items-center justify-between gap-4 w-full">
                Find an event <ArrowUpRight className="w-5 h-5" />
              </Button>
              <Button className="rounded-full px-8 py-7 bg-zinc-950 text-white hover:bg-zinc-800 font-semibold text-lg flex items-center justify-between gap-4 w-full">
                Create your event <ArrowUpRight className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2 mt-2 text-xs font-medium text-white/90 justify-center">
                <CheckCircle2 className="w-4 h-4" />
                Free to join. Free to publish.
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#1A1A1A] text-white py-16 px-6 lg:px-12">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-end gap-12">
          <div className="text-2xl font-black tracking-widest uppercase">
            Eventify
          </div>
          
          <div className="max-w-md w-full">
            <p className="text-sm font-medium mb-1">The good stuff, once a week.</p>
            <p className="text-xs text-zinc-400 mb-4">New events, local favorites, and smart ideas for organizers. No noise.</p>
            <div className="relative">
              <input 
                type="email" 
                placeholder="Email address" 
                className="w-full h-12 bg-zinc-800/50 border border-zinc-700 rounded-full pl-6 pr-32 focus:outline-none focus:border-zinc-500 text-sm"
              />
              <button className="absolute right-1 top-1 bottom-1 px-6 bg-[#FF5238] hover:bg-[#e0452e] rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                Subscribe <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
