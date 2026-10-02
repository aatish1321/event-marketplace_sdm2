import { Link } from 'react-router-dom';
import { ChevronRight, Ticket, LineChart, Globe } from 'lucide-react';
import { Button } from '../components/ui/button';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
              <Ticket className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold tracking-tight">Eventify</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Log in
            </Link>
            <Link to="/register">
              <Button size="sm" className="h-8 rounded-md px-3 text-xs">
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="container mx-auto max-w-7xl px-6 pt-24 pb-16 md:pt-32 md:pb-24">
          <div className="flex flex-col items-start max-w-[800px] gap-6">
            <div className="inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Eventify 2.0 is now live
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-balance">
              Curate your scene. <br />
              <span className="text-muted-foreground">Own your audience.</span>
            </h1>
            <p className="max-w-[600px] text-lg text-muted-foreground leading-relaxed">
              The modern marketplace for event organizers. Sell tickets, analyze attendance, and build your community without the friction of legacy platforms.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4">
              <Link to="/register">
                <Button size="lg" className="rounded-full px-8 h-12 text-base font-semibold">
                  Start Building <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/discover">
                <Button variant="outline" size="lg" className="rounded-full px-8 h-12 text-base font-semibold border-border">
                  Explore Events
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Bento Grid Features */}
        <section className="container mx-auto max-w-7xl px-6 py-24 border-t border-border/40">
          <div className="flex flex-col gap-4 mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Built for modern organizers</h2>
            <p className="text-muted-foreground text-lg">Everything you need, nothing you don't.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 group relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-10 hover:border-primary/50 transition-colors">
              <div className="flex flex-col h-full justify-between gap-12">
                <Ticket className="h-10 w-10 text-primary" />
                <div className="space-y-3">
                  <h3 className="font-bold text-2xl tracking-tight">Frictionless Ticketing</h3>
                  <p className="text-muted-foreground text-lg text-balance max-w-md">
                    Set up your event in seconds. Accept payments globally with instant payouts and low fees.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-10 hover:border-primary/50 transition-colors">
              <div className="flex flex-col h-full justify-between gap-12">
                <LineChart className="h-10 w-10 text-primary" />
                <div className="space-y-3">
                  <h3 className="font-bold text-2xl tracking-tight">Real-time Analytics</h3>
                  <p className="text-muted-foreground text-lg">
                    Track page views, conversions, and revenue in real-time.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-10 hover:border-primary/50 transition-colors">
              <div className="flex flex-col h-full justify-between gap-12">
                <Globe className="h-10 w-10 text-primary" />
                <div className="space-y-3">
                  <h3 className="font-bold text-2xl tracking-tight">Global Reach</h3>
                  <p className="text-muted-foreground text-lg">
                    Built-in SEO and discovery tools to help your event reach the right audience.
                  </p>
                </div>
              </div>
            </div>
            
             <div className="md:col-span-2 group relative overflow-hidden rounded-3xl border border-transparent bg-foreground text-background p-8 md:p-10">
              <div className="flex flex-col md:flex-row h-full md:items-center justify-between gap-12">
                <div className="space-y-3 max-w-md">
                  <h3 className="font-bold text-3xl tracking-tight">Ready to launch?</h3>
                  <p className="text-background/80 text-lg">
                    Join thousands of organizers who have switched to Eventify.
                  </p>
                </div>
                <div>
                   <Link to="/register">
                    <Button variant="secondary" size="lg" className="rounded-full px-8 h-12 text-base font-semibold">
                      Create an account
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            <span className="font-semibold text-foreground">Eventify</span>
          </div>
          <p>© {new Date().getFullYear()} Eventify Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
