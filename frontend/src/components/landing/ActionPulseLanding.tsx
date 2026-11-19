import { Link } from 'react-router-dom';
import { ArrowRight, Check, ClipboardCheck, Quote, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Cover } from '@/components/ui/cover';

const steps = [
  ['Submit a transcript', 'Create a meeting in your workspace and paste or upload its transcript.'],
  ['Review grounded suggestions', 'With consent and AI configured, extract actions and decisions with source quotes. Resolve missing owners and dates.'],
  ['Approve and track work', 'An organiser approves the candidates. Confirmed actions become tasks with assignees and prerequisites.'],
  ['Share the follow-up', 'Review a draft, send email when configured, or open a WhatsApp sharing link.'],
];

export default function ActionPulseLanding() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10 px-4 sm:px-6">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 py-5">
          <Link to="/" className="text-lg font-semibold">ActionPulse</Link>
          <div className="flex items-center gap-5 text-sm">
            <a href="#workflow" className="text-neutral-400 hover:text-white">How it works</a>
            <Link to="/login">Sign in</Link>
            <Button size="sm" asChild><Link to="/signup">Get started <ArrowRight /></Link></Button>
          </div>
        </nav>
      </header>
      <main>
        <section className="relative isolate overflow-hidden border-b border-white/10 px-4 py-24 sm:px-6 lg:py-32">
          <div aria-hidden="true" className="hero-atmosphere pointer-events-none absolute inset-0 -z-10" />
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-neutral-300"><Sparkles size={12} /> AI-powered meeting intelligence</span>
            <h1 className="mt-7 text-4xl font-medium leading-tight tracking-tight sm:text-6xl">Turn meeting conversations into <Cover>accountable actions.</Cover></h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-neutral-400">Extract tasks, owners, and deadlines from meeting transcripts, review every AI suggestion, and move approved actions into your team’s workspace.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-5 text-xs text-neutral-400">
              {['Grounded in source quotes', 'Human approval', 'Workspace access controls'].map(value => <span key={value} className="inline-flex items-center gap-1.5"><Check size={13} className="text-emerald-400" />{value}</span>)}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild><Link to="/signup">Create your workspace <ArrowRight /></Link></Button>
              <Button variant="outline" size="lg" asChild><a href="#workflow">How it works</a></Button>
            </div>
          </div>
        </section>
        <section id="workflow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <p className="text-xs uppercase tracking-widest text-neutral-500">From conversation to commitment</p>
          <h2 className="mt-3 text-3xl font-medium">Your meeting, your evidence, your decisions.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {steps.map(([title, description], index) => <article key={title} className="rounded-xl border border-white/10 bg-white/[0.02] p-7"><span className="font-mono text-xs text-neutral-500">0{index + 1}</span><h3 className="mt-4 text-lg font-medium">{title}</h3><p className="mt-3 text-sm leading-6 text-neutral-400">{description}</p></article>)}
          </div>
        </section>
        <section className="border-y border-white/10 px-4 py-16 sm:px-6">
          <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-3">
            <article><Quote className="text-neutral-400" /><h2 className="mt-4 font-medium">Evidence attached</h2><p className="mt-3 text-sm leading-6 text-neutral-400">Every candidate includes its source excerpt. Missing details stay visible for review.</p></article>
            <article><ClipboardCheck className="text-neutral-400" /><h2 className="mt-4 font-medium">Approval required</h2><p className="mt-3 text-sm leading-6 text-neutral-400">Organisers review suggestions before actions enter the board. Track task progress and dependencies with your team.</p></article>
            <article><ShieldCheck className="text-neutral-400" /><h2 className="mt-4 font-medium">Control AI processing</h2><p className="mt-3 text-sm leading-6 text-neutral-400">AI processing requires meeting consent and a configured provider. WhatsApp sharing opens a link for you to send.</p></article>
          </div>
        </section>
        <section className="px-4 py-20 text-center"><h2 className="text-3xl font-medium">Start with your next meeting.</h2><Button className="mt-7" asChild><Link to="/signup">Get started <ArrowRight /></Link></Button></section>
      </main>
      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-neutral-500">ActionPulse · Meeting-to-action workspace</footer>
    </div>
  );
}
