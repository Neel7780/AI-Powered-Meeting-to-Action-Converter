import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, ChevronDown, CheckCircle2, CircleHelp, ClipboardCheck, Mail, Menu, MessageSquare, Moon, Quote, Shield, Sun, X } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import SelectionList from "@/components/ui/SelectionList";
import { MotionConfig } from "framer-motion";
import { Cover } from "@/components/ui/cover";
import "./landing.css";
import InteractiveProductWalkthrough from "@/components/landing/InteractiveProductWalkthrough";
import LinearWorkflowShowcase from "@/components/landing/LinearWorkflowShowcase";
import InteractiveBentoFeatures from "@/components/landing/InteractiveBentoFeatures";
import InteractiveRoleMatrix from "@/components/landing/InteractiveRoleMatrix";
import LinearTrustShowcase from "@/components/landing/LinearTrustShowcase";

const repo = "https://github.com/Neel7780/AI-Powered-Meeting-to-Action-Converter";
const themeKey = "actionpulse.landing-theme";
function readTheme() {
  try { return localStorage.getItem(themeKey); } catch { return null; }
}

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
function subscribeToMotionPreference(update: () => void) {
  motionPreference.addEventListener("change", update);
  return () => motionPreference.removeEventListener("change", update);
}

const nav = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
];

function Brand() {
  return (
    <a href="#top" className="inline-flex items-center gap-2.5 text-white" aria-label="ActionPulse home">
      <img
        src={logoImg}
        alt="ActionPulse logo"
        className="size-8 rounded-full border border-white/20 object-cover shadow-sm"
      />
      <span className="text-[17px] font-semibold text-white tracking-tight">ActionPulse</span>
    </a>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="landing-heading max-w-3xl">
      <p className="mb-3 text-xs font-semibold text-neutral-400">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-[1.08]">{title}</h2>
      {description && <p className="mt-4 text-base sm:text-lg text-neutral-400 leading-relaxed font-normal">{description}</p>}
    </div>
  );
}


export default function ActionPulseLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const [theme, setTheme] = useState(readTheme);
  const light = theme === "light";
  const [demoLight, setDemoLight] = useState(theme !== "dark");
  const reduceMotion = useSyncExternalStore(subscribeToMotionPreference, () => motionPreference.matches);

  function toggleTheme() {
    const next = light ? "dark" : "light";
    setTheme(next);
    setDemoLight(next === "light");
    try { localStorage.setItem(themeKey, next); } catch { /* Keep the in-memory preference. */ }
  }

  return (
    <MotionConfig reducedMotion="user">
    <div id="top" data-landing-theme={light ? "light" : "dark"} className="product-landing min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand/>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            {nav.map(item => (
              <a key={item.href} href={item.href} className="landing-nav-link text-sm text-neutral-300 transition-colors hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={toggleTheme}
              aria-label={`Switch landing page to ${light ? "dark" : "light"} mode`}
              title={`Switch to ${light ? "dark" : "light"} mode`}>
              {light ? <Moon aria-hidden="true"/> : <Sun aria-hidden="true"/>}
            </Button>
            <div className="hidden items-center gap-3 md:flex">
              {user ? (
                <Button size="sm" asChild>
                  <Link to="/dashboard">Dashboard <ArrowRight/></Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/signup">Get started <ArrowRight/></Link>
                  </Button>
                </>
              )}
            </div>
            <Button variant="ghost" size="icon" className="md:hidden text-white" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X/> : <Menu/>}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav aria-label="Mobile navigation" className="border-t border-white/10 bg-black px-4 py-3 md:hidden">
            {nav.map(item => (
              <a key={item.href} onClick={() => setMenuOpen(false)} href={item.href} className="block py-2.5 text-sm text-neutral-400 hover:text-white">
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-white/10 pt-3">
              {user ? (
                <Button asChild className="w-full">
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup" onClick={() => setMenuOpen(false)}>Get started</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="bg-black">
        {/* Hero Section */}
        <section className="landing-hero relative isolate overflow-hidden border-b border-white/10 bg-black px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:pb-24 lg:px-8">
          {/* Linear Minimal Atmosphere Grid */}
          <div aria-hidden="true" className="hero-atmosphere pointer-events-none absolute inset-0 -z-10"/>

          <div className="landing-intro mx-auto max-w-5xl text-center">
            <h1 className="landing-title text-white">
              Turn meeting conversations into {reduceMotion
                ? <span className="landing-cover-static">accountable actions.</span>
                : <Cover>accountable actions.</Cover>}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-neutral-300 sm:text-lg">
              Extract tasks, owners, and deadlines from meeting transcripts. Review the suggestions and send approved work to your team.
            </p>
            <div className="landing-actions mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <a href="#demo">Try the demo <ArrowDown/></a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to={user ? "/dashboard" : "/signup"}>{user ? "Go to Dashboard" : "Get started"} <ArrowRight/></Link>
              </Button>
            </div>
          </div>

          {/* Linear-Style 3D Stage & Centerpiece Demo */}
          <div className="relative mx-auto mt-12 max-w-7xl linear-stage-container sm:mt-16">
            {/* Minimal Pedestal Spotlight Floor Glow directly inspired by Linear */}
            <div aria-hidden="true" className="linear-pedestal-glow" />
            <div aria-hidden="true" className="hero-horizon absolute -top-8 left-1/2 h-px w-[min(90%,950px)] -translate-x-1/2"/>

            <InteractiveProductWalkthrough isLight={demoLight} onToggleTheme={() => setDemoLight(!demoLight)}/>

            <div className="relative z-10 mt-10 grid border-y border-white/10 sm:grid-cols-3">
              <div className="flex items-center gap-3 border-b border-white/10 py-4 sm:border-b-0 sm:border-r sm:px-5">
                <Quote size={17} className="shrink-0 text-white"/>
                <div>
                  <p className="text-xs font-medium text-white">Evidence attached</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Every suggestion links to a quote</p>
                </div>
              </div>
              <div className="flex items-center gap-3 border-b border-white/10 py-4 sm:border-b-0 sm:border-r sm:px-5">
                <CircleHelp size={17} className="shrink-0 text-amber-400"/>
                <div>
                  <p className="text-xs font-medium text-white">Uncertainty surfaced</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Missing details stay unresolved</p>
                </div>
              </div>
              <div className="flex items-center gap-3 py-4 sm:px-5">
                <ClipboardCheck size={17} className="shrink-0 text-emerald-400"/>
                <div>
                  <p className="text-xs font-medium text-white">Approval required</p>
                  <p className="mt-1 text-[11px] text-neutral-500">A person makes the final call</p>
                </div>
              </div>
            </div>

            <details className="landing-stack relative z-10 mx-auto mt-6 text-center">
              <summary className="inline-flex items-center gap-1.5 rounded text-sm text-neutral-400">
                Technology behind ActionPulse <ChevronDown size={14} aria-hidden="true"/>
              </summary>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-neutral-400 font-semibold tracking-tight text-sm">
                <span>React + Vite</span>
                <span>FastAPI</span>
                <span>Supabase Postgres</span>
                <span>Amazon Nova Lite on Amazon Bedrock</span>
                <span>Row-Level Security</span>
              </div>
            </details>
          </div>
        </section>

        {/* How it works (Linear Intake & Workflow) */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-white/10 bg-black py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <LinearWorkflowShowcase />
          </div>
        </section>

        {/* Core Capabilities */}
        <section id="features" className="scroll-mt-20 mx-auto max-w-7xl bg-black px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <SectionHeading eyebrow="Core capabilities" title="Everything has a reason to be here." description="Keep the context, clarify the owner, and give your team a place to move the work forward."/>
          <InteractiveBentoFeatures />
        </section>

        {/* Direct Notifications & Assignee Dispatch */}
        <section id="notifications" className="scroll-mt-20 border-b border-white/10 bg-[#040407] py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8">
            <div>
              <SectionHeading
                eyebrow="Instant notification dispatch"
                title="Send notifications directly from the app."
                description="No manual copying or lost action items. Once extracted tasks are confirmed, select assignees and dispatch multi-channel notifications directly from ActionPulse."
              />

              <div className="mt-8 space-y-4">
                <div className="flex gap-4 rounded-lg border border-white/10 bg-[#08080c] p-4 transition hover:border-white/20">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md border border-indigo-500/25 bg-indigo-500/10 text-indigo-400">
                    <Mail size={17} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium tracking-tight text-white sm:text-base">Automated Email Task Digests</h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      Delivers clean HTML summaries with verbatim meeting excerpts, deadlines, and direct Kanban board links.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 rounded-lg border border-white/10 bg-[#08080c] p-4 transition hover:border-white/20">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                    <MessageSquare size={17} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium tracking-tight text-white sm:text-base">1-Tap WhatsApp Action Links</h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      Instantly generates zero-cost pre-filled <span className="font-mono text-emerald-400">wa.me</span> links to share tasks and deadlines directly to team chats.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 rounded-lg border border-white/10 bg-[#08080c] p-4 transition hover:border-white/20">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md border border-amber-500/25 bg-amber-500/10 text-amber-400">
                    <Bell size={17} />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium tracking-tight text-white sm:text-base">Workspace Board Push & Bell</h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      Real-time updates notify primary task owners the moment an organiser confirms the review gate.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Selection List Card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-[#0a0a0f] to-[#040406] p-4 sm:p-10 shadow-2xl relative">
              <div className="mb-6 flex items-center justify-between w-full max-w-[268px]">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  Assignee notification roster
                </span>
                <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" title="Live component" />
              </div>

              {/* Bencho Liquid Selection List */}
              <SelectionList rows={4} />

              <p className="mt-5 text-center text-[11px] text-neutral-500 max-w-[268px]">
                Choose the teammates to notify, then select <span className="text-neutral-300 font-medium">Send request</span>.
              </p>
            </div>
          </div>
        </section>

        {/* AI that shows its work */}
        <section className="border-y border-white/10 bg-black py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20 lg:px-8">
            <div>
              <SectionHeading eyebrow="AI that shows its work" title="Grounded, reviewable AI extraction." description="Every AI-generated action is tied to a verbatim transcript quote and requires human approval before becoming a task."/>
              <div className="mt-8 space-y-3 text-sm">
                <p className="flex items-center gap-3 text-neutral-300"><span className="font-mono text-xs text-white">01</span> AI proposes.</p>
                <p className="flex items-center gap-3 text-neutral-300"><span className="font-mono text-xs text-emerald-400">02</span> Evidence explains.</p>
                <p className="flex items-center gap-3 text-neutral-300"><span className="font-mono text-xs text-amber-400">03</span> Human decides.</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/15 bg-[#060608] p-5 sm:p-7 shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <span className="font-mono text-[10px] uppercase text-neutral-500">Extracted action</span>
              </div>
              <h3 className="mt-5 text-xl font-medium tracking-tight text-white sm:text-2xl">Prepare revised onboarding flow</h3>
              <p className="mt-3 text-sm text-neutral-400">Suggested owner <span className="text-white font-medium">Aman Shah</span> <span className="mx-2 text-neutral-600">·</span> Due <span className="text-white font-medium">Friday</span></p>
              <div className="mt-6 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-4">
                <p className="font-mono text-[10px] uppercase text-emerald-400">Verbatim source excerpt</p>
                <blockquote className="mt-3 font-mono text-xs leading-6 text-white">“Aman: Sure, I'll have the onboarding flow ready by Friday.”</blockquote>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 size={13}/> Quote linked
                </span>
                <span className="inline-flex items-center gap-1.5 rounded border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400">
                  <Shield size={13}/> Human approval required
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Workspace access */}
        <section className="mx-auto max-w-7xl bg-black px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <SectionHeading eyebrow="Workspace access" title="The right controls for every role." description="A shared space with clear responsibilities, not a one-size-fits-all permission model."/>
          <InteractiveRoleMatrix />
        </section>

        {/* Security & privacy */}
        <section id="security" className="scroll-mt-20 border-y border-white/10 bg-black py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Security & privacy" title="Trust is built into the workflow." description="Human oversight and careful data boundaries are part of the product design, not an afterthought."/>
            <div className="mt-12">
              <LinearTrustShowcase />
            </div>
          </div>
        </section>


        {/* Closing CTA */}
        <section className="border-t border-white/10 bg-black py-20 text-center sm:py-24">
          <div className="mx-auto max-w-2xl px-4">
            <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider">Make the follow-through count</span>
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-[1.08]">Turn your next meeting into action.</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-400 sm:text-base">
              Stop losing valuable commitments in meeting notes. Extract, review, and deliver with ActionPulse.
            </p>
            <div className="landing-actions mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to={user ? "/dashboard" : "/signup"}>{user ? "Go to Dashboard" : "Get started"} <ArrowRight/></Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#demo">Explore the demo <ArrowUpRight/></a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-8">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
          <div>
            <Brand/>
            <p className="mt-2 text-xs text-neutral-500">AI-Powered Meeting-to-Action Converter</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-400">
            {nav.map(item => (
              <a key={item.href} href={item.href} className="hover:text-white transition-colors">{item.label}</a>
            ))}
            <a href={repo} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Documentation</a>
            <a href={repo} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">GitHub</a>
          </nav>
          <p className="text-xs text-neutral-500 lg:text-right">
            IT314 Software Engineering<br/>Team G-10
          </p>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}
