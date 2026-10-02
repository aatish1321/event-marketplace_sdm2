import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, CalendarDays, Search, Star } from 'lucide-react';
import { Button } from '../components/ui/button';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex h-16 items-center justify-between px-6 lg:px-12">
          <Link to="/" className="text-xl font-bold tracking-tighter uppercase">
            Eventify
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link to="/discover" className="hover:text-muted-foreground transition-colors">Discover</Link>
            <Link to="/trending" className="hover:text-muted-foreground transition-colors">Trending</Link>
            <Link to="/cities" className="hover:text-muted-foreground transition-colors">Cities</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium hover:underline underline-offset-4 hidden sm:block">
              Log in
            </Link>
            <Link to="/register">
              <Button className="rounded-full px-6 font-semibold">
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6 lg:px-12 min-h-[85vh] flex flex-col justify-center">
          <div className="max-w-[90vw] md:max-w-5xl mx-auto w-full">
            <h1 className="text-[12vw] sm:text-[8vw] md:text-8xl lg:text-9xl font-black leading-[0.85] tracking-tighter uppercase mb-8">
              Don't let <br />
              <span className="text-muted-foreground">the weekend</span> <br />
              slip away.
            </h1>
            
            <div className="grid md:grid-cols-2 gap-12 items-end mt-12 md:mt-24">
              <p className="text-xl md:text-2xl font-medium text-balance leading-snug">
                Discover the best underground gigs, art shows, and cultural events happening in your city right now.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 md:justify-end">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search events, artists, venues..." 
                    className="w-full h-14 pl-12 pr-4 rounded-full border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-foreground transition-all"
                  />
                </div>
                <Link to="/discover">
                  <Button size="lg" className="h-14 rounded-full px-8 w-full sm:w-auto text-base">
                    Explore
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Trending Events (Consumer Focus) */}
        <section className="py-24 px-6 lg:px-12 bg-foreground text-background">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase">Trending Now</h2>
                <p className="text-background/70 mt-2 text-lg">Curated picks for you.</p>
              </div>
              <Link to="/discover" className="hidden md:flex items-center gap-2 font-medium hover:opacity-70 transition-opacity">
                See all <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Event Card 1 */}
              <Link to="/register" className="group relative block aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-900">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/40 to-purple-900/80 group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute top-4 left-4 bg-background text-foreground text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
                  Selling Fast
                </div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                  <div className="text-white space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <CalendarDays className="w-4 h-4" /> Fri, Oct 24 • 10:00 PM
                    </div>
                    <h3 className="text-2xl font-bold leading-tight group-hover:underline underline-offset-4">
                      Midnight Warehouse Project
                    </h3>
                    <div className="flex items-center justify-between pt-2">
                      <span className="flex items-center gap-1 text-sm text-white/70"><MapPin className="w-4 h-4" /> Brooklyn, NY</span>
                      <span className="font-bold">From $25</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Event Card 2 */}
              <Link to="/register" className="group relative block aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-900">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/40 to-red-900/80 group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                  <div className="text-white space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <CalendarDays className="w-4 h-4" /> Sat, Oct 25 • 2:00 PM
                    </div>
                    <h3 className="text-2xl font-bold leading-tight group-hover:underline underline-offset-4">
                      Independent Zine & Art Fair
                    </h3>
                    <div className="flex items-center justify-between pt-2">
                      <span className="flex items-center gap-1 text-sm text-white/70"><MapPin className="w-4 h-4" /> Downtown Arts District</span>
                      <span className="font-bold">Free</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Event Card 3 */}
              <Link to="/register" className="group relative block aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-900 sm:hidden lg:block">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/40 to-teal-900/80 group-hover:scale-105 transition-transform duration-700"></div>
                <div className="absolute top-4 left-4 bg-background text-foreground text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> Top Pick
                </div>
                <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                  <div className="text-white space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                      <CalendarDays className="w-4 h-4" /> Sun, Oct 26 • 7:30 PM
                    </div>
                    <h3 className="text-2xl font-bold leading-tight group-hover:underline underline-offset-4">
                      Rooftop Jazz Collective
                    </h3>
                    <div className="flex items-center justify-between pt-2">
                      <span className="flex items-center gap-1 text-sm text-white/70"><MapPin className="w-4 h-4" /> The Highline Hotel</span>
                      <span className="font-bold">From $40</span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
            <div className="mt-8 md:hidden">
              <Link to="/discover">
                <Button variant="outline" className="w-full h-14 rounded-full border-background text-background hover:bg-background hover:text-foreground">
                  See all events
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Social Proof / Call to action */}
        <section className="py-32 px-6 lg:px-12 text-center border-t border-border/40">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase">
              Get off the couch.
            </h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of others discovering their next favorite artist, venue, and community.
            </p>
            <div className="pt-8">
              <Link to="/register">
                <Button size="lg" className="h-16 rounded-full px-10 text-lg font-bold">
                  Create your free profile
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-2xl font-black tracking-tighter uppercase">
            Eventify
          </div>
          <div className="flex gap-6 text-sm font-medium text-muted-foreground">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Eventify.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
