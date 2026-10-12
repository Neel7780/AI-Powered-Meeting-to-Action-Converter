import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2, ChevronRight, CircleHelp, ClipboardCheck, Code2, FileText, Fingerprint, GitBranch, LockKeyhole, Mail, Menu, MessageSquare, Quote, Shield, ShieldCheck, Sparkles, Upload, UserRound, Users, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import SelectionList from "@/components/ui/SelectionList";
import { Cover } from "@/components/ui/cover";
import InteractiveProductWalkthrough from "@/components/landing/InteractiveProductWalkthrough";

const repo = "https://github.com/Neel7780/AI-Powered-Meeting-to-Action-Converter";
const nav = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "Architecture", href: "#architecture" },
];

function Brand() {
  return (
    <a href="#top" className="inline-flex items-center gap-2.5 text-white" aria-label="ActionPulse home">
      <span className="grid size-8 place-items-center rounded-md border border-white/20 bg-white text-black font-bold shadow-sm">
        <Zap size={17} fill="currentColor" strokeWidth={2.5} />
      </span>
      <span className="text-[17px] font-semibold text-white tracking-tight">ActionPulse</span>
    </a>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-neutral-400">{eyebrow}</p>
      <h2 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-[15px] leading-7 text-neutral-400">{description}</p>}
    </div>
  );
}


export default function ActionPulseLanding() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div id="top" className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Brand/>
          <nav aria-label="Main navigation" className="hidden items-center gap-7 md:flex">
            {nav.map(item => (
              <a key={item.href} href={item.href} className="text-[13px] text-neutral-400 transition-colors hover:text-white">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/signup">Get started <ArrowRight/></Link>
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden text-white" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X/> : <Menu/>}
          </Button>
        </div>
        {menuOpen && (
          <nav aria-label="Mobile navigation" className="border-t border-white/10 bg-black px-4 py-3 md:hidden">
            {nav.map(item => (
              <a key={item.href} onClick={() => setMenuOpen(false)} href={item.href} className="block py-2.5 text-sm text-neutral-400 hover:text-white">
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-white/10 pt-3">
              <Button variant="outline" asChild>
                <Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/signup" onClick={() => setMenuOpen(false)}>Get started</Link>
              </Button>
            </div>
          </nav>
        )}
      </header>

      <main className="bg-black">
        {/* Hero Section */}
        <section className="relative isolate overflow-hidden border-b border-white/10 bg-black px-4 pb-24 pt-16 sm:px-6 sm:pt-24 lg:pb-32 lg:px-8">
          {/* Linear Minimal Atmosphere Grid */}
          <div aria-hidden="true" className="hero-atmosphere pointer-events-none absolute inset-0 -z-10"/>

          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] font-medium uppercase text-neutral-300">
              <Sparkles size={12}/> AI-powered meeting intelligence
            </span>
            <h1 className="mt-7 text-[42px] font-semibold leading-[1.12] tracking-tight text-white sm:text-6xl">
              Turn meeting conversations into <Cover>accountable actions.</Cover>
            </h1>
            <p className="mx-auto mt-6 max-w-[620px] text-[15px] leading-7 text-neutral-400 sm:text-base">
              Extract tasks, owners, and deadlines from meeting transcripts, review every AI suggestion, and move approved actions into your team’s workspace.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-400">
              {["Grounded in source quotes", "Human approval", "Workspace-based"].map(value => (
                <span key={value} className="inline-flex items-center gap-1.5">
                  <Check size={13} className="text-emerald-400"/>
                  {value}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <a href="#demo">Try the demo <ArrowDown/></a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/signup">Get started <ArrowRight/></Link>
              </Button>
            </div>
          </div>

          {/* Linear-Style 3D Stage & Centerpiece Demo */}
          <div className="relative mx-auto mt-20 max-w-7xl linear-stage-container">
            {/* Minimal Pedestal Spotlight Floor Glow directly inspired by Linear */}
            <div aria-hidden="true" className="linear-pedestal-glow" />
            <div aria-hidden="true" className="hero-horizon absolute -top-8 left-1/2 h-px w-[min(90%,950px)] -translate-x-1/2"/>

            <div className="relative z-10 mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-mono text-[10px] uppercase text-neutral-400 font-medium tracking-wider">From conversation to commitment</p>
                <p className="mt-1 text-xs text-neutral-500">Live interactive product demonstration</p>
              </div>
              <p className="font-mono text-[10px] text-neutral-500">SAMPLE MEETING / NOT SAVED</p>
            </div>

            <InteractiveProductWalkthrough/>

            <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 font-mono text-[10px] uppercase text-neutral-500">
              <span>01 Transcript</span>
              <ArrowRight size={12}/>
              <span>02 Evidence</span>
              <ArrowRight size={12}/>
              <span>03 Human decision</span>
              <ArrowRight size={12}/>
              <span>04 Shared work</span>
            </div>

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

            {/* Linear-style Ecosystem & Architecture Strip directly from screenshot */}
            <div className="relative z-10 mt-16 pt-8 border-t border-white/10 text-center">
              <p className="font-mono text-[10px] tracking-widest uppercase text-neutral-500 mb-6">
                Engineered for High-Reliability Production Workspaces
              </p>
              <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 text-neutral-400 font-semibold tracking-tight text-sm">
                <span className="flex items-center gap-2 hover:text-white transition-colors">
                  <span className="text-white text-base">⚛</span> React 18 + Vite
                </span>
                <span className="flex items-center gap-2 hover:text-white transition-colors">
                  <span className="text-white font-mono text-xs">⚡</span> FastAPI
                </span>
                <span className="flex items-center gap-2 hover:text-white transition-colors">
                  <span className="text-white font-mono text-xs">❖</span> Supabase Postgres
                </span>
                <span className="flex items-center gap-2 hover:text-white transition-colors">
                  <Sparkles size={14} className="text-white"/> Gemini 3.1 Flash-Lite
                </span>
                <span className="flex items-center gap-2 hover:text-white transition-colors">
                  <ShieldCheck size={15} className="text-white"/> Row-Level Security
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-white/10 bg-black py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="The workflow" title="From raw conversation to real progress." description="A clear handoff from AI-assisted extraction to human judgment and shared execution."/>
            <div className="mt-12 grid gap-0 border-y border-white/10 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {n:"01", title:"Capture", text:"Paste notes or upload .txt, .vtt, .srt, or .docx transcripts.", icon:Upload},
                {n:"02", title:"Extract", text:"AI identifies tasks, deadlines, and potential owners from the transcript.", icon:Sparkles},
                {n:"03", title:"Review", text:"Organisers verify, edit, approve, or reject every suggestion.", icon:ClipboardCheck},
                {n:"04", title:"Execute", text:"Approved tasks move to the shared Kanban board and can notify assignees.", icon:ArrowRight}
              ].map((step,i) => (
                <div key={step.n} className={`relative px-5 py-7 bg-black ${i > 0 ? "border-t border-white/10 sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "sm:border-t lg:border-t-0" : ""}`}>
                  <div className="mb-8 flex items-center justify-between">
                    <span className="font-mono text-xs text-neutral-400">{step.n} / 04</span>
                    <step.icon size={17} className="text-neutral-500"/>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section id="features" className="scroll-mt-20 mx-auto max-w-7xl bg-black px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <SectionHeading eyebrow="Core capabilities" title="Everything has a reason to be here." description="Keep the context, clarify the owner, and give your team a place to move the work forward."/>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="product-panel rounded-lg border border-white/10 bg-[#060608] p-6 md:col-span-2">
              <div className="flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white">
                <Quote size={18}/>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-white">Grounded action extraction</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-400">Task, owner, and deadline are surfaced alongside the exact words that support the suggestion.</p>
              <div className="mt-6 grid gap-2 rounded-md border border-white/10 bg-black p-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div>
                  <p className="font-mono text-[10px] uppercase text-neutral-500">Transcript</p>
                  <p className="mt-2 text-xs leading-5 text-neutral-400">“I will fix the login bug on Safari by Wednesday.”</p>
                </div>
                <ArrowRight size={15} className="hidden text-white sm:block"/>
                <div className="border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                  <p className="font-mono text-[10px] uppercase text-neutral-500">Structured action</p>
                  <p className="mt-2 text-xs text-white">Fix Safari login bug <span className="text-neutral-500">· Rahul · Wednesday</span></p>
                </div>
              </div>
            </div>

            <div className="product-panel rounded-lg border border-white/10 bg-[#060608] p-6">
              <div className="flex size-9 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <UserRound size={18}/>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-white">Zero-guess ownership</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">Unclear or missing names stay unassigned until a person resolves them.</p>
              <div className="mt-8 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 font-mono text-xs text-amber-400">
                owner: null <span className="ml-2 text-neutral-500">→ review required</span>
              </div>
            </div>

            <div className="product-panel rounded-lg border border-white/10 bg-[#060608] p-6">
              <div className="flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white">
                <FileText size={18}/>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-white">Flexible input</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">Bring the transcript you already have. No meeting bot required.</p>
              <div className="mt-8 flex flex-wrap gap-2">
                {["Paste", "TXT", "VTT", "SRT", "DOCX"].map(type => (
                  <span key={type} className="rounded border border-white/15 bg-black px-2.5 py-1.5 font-mono text-[10px] text-neutral-300">{type}</span>
                ))}
              </div>
            </div>

            <div className="product-panel rounded-lg border border-white/10 bg-[#060608] p-6 md:col-span-2">
              <div className="flex size-9 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <GitBranch size={18}/>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-white">Shared Kanban workspace</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">After approval, work has a visible place to live, with task sharing and notifications.</p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {name:"To do",task:"Prepare onboarding flow"},
                  {name:"In progress",task:"Fix Safari login bug"},
                  {name:"Blocked",task:"Review vendor invoice"},
                  {name:"Done",task:"Draft demo agenda"}
                ].map(col => (
                  <div key={col.name} className="min-w-0 rounded border border-white/10 bg-black p-2.5">
                    <p className="mb-3 font-mono text-[10px] uppercase text-neutral-500">{col.name}</p>
                    <div className="min-h-12 rounded border border-white/10 bg-[#0c0c0e] p-2 text-[11px] leading-4 text-neutral-400">{col.task}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Direct Notifications & Assignee Dispatch */}
        <section id="notifications" className="scroll-mt-20 border-b border-white/10 bg-[#040407] py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8">
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
                    <h4 className="text-sm font-semibold text-white">Automated Email Task Digests</h4>
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
                    <h4 className="text-sm font-semibold text-white">1-Tap WhatsApp Action Links</h4>
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
                    <h4 className="text-sm font-semibold text-white">Workspace Board Push & Bell</h4>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      Real-time updates notify primary task owners the moment an organiser confirms the review gate.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Selection List Card */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-b from-[#0a0a0f] to-[#040406] p-8 sm:p-10 shadow-2xl relative">
              <div className="mb-6 flex items-center justify-between w-full max-w-[268px]">
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  Try it: Assignee Notification Roster
                </span>
                <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" title="Live component" />
              </div>

              {/* Bencho Liquid Selection List */}
              <SelectionList rows={4} />

              <p className="mt-5 text-center text-[11px] text-neutral-500 max-w-[268px]">
                Select teammates above to see liquid-gooey metaball feedback, then click <span className="text-neutral-300 font-medium">Send request</span>.
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
                <Sparkles size={16} className="text-white"/>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Prepare revised onboarding flow</h3>
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
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {name:"Admin", icon:ShieldCheck, text:"Manage the workspace, members, permissions, and policies."},
              {name:"Organiser", icon:ClipboardCheck, text:"Create meetings, process transcripts, review suggestions, and approve tasks."},
              {name:"Member", icon:Users, text:"View relevant meetings, manage assigned work, and update task status."}
            ].map(role => (
              <div key={role.name} className="product-panel rounded-lg border border-white/10 bg-[#060608] p-6">
                <role.icon size={19} className="text-white"/>
                <h3 className="mt-7 text-lg font-semibold text-white">{role.name}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{role.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-neutral-500">
            <Fingerprint size={14}/> Workspace permissions are designed around Postgres Row-Level Security.
          </p>
        </section>

        {/* Security & privacy */}
        <section id="security" className="scroll-mt-20 border-y border-white/10 bg-black py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Security & privacy" title="Trust is built into the workflow." description="Human oversight and careful data boundaries are part of the product design, not an afterthought."/>
            <div className="mt-12 grid gap-x-10 gap-y-0 sm:grid-cols-2">
              {[
                {icon:ClipboardCheck, title:"Human approval gate", text:"AI suggestions cannot become board tasks without explicit approval."},
                {icon:LockKeyhole, title:"Verified task commits", text:"Task commits are designed to pass through verified server endpoints and data policies."},
                {icon:Shield, title:"Untrusted input boundaries", text:"Meeting transcripts are treated as untrusted input, separate from system instructions."},
                {icon:Fingerprint, title:"No-AI privacy mode", text:"Confidential meetings can bypass external AI processing."}
              ].map(item => (
                <div key={item.title} className="flex gap-4 border-t border-white/10 py-6">
                  <div className="grid size-9 shrink-0 place-items-center rounded-md border border-white/10 bg-[#080808] text-white">
                    <item.icon size={17}/>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* System Architecture */}
        <section id="architecture" className="scroll-mt-20 mx-auto max-w-7xl bg-black px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionHeading eyebrow="System architecture" title="Built for your stack. Ready to scale." description="A deliberate separation of the interface, application logic, data, and AI provider layer."/>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href="#architecture-diagram">View architecture spec <ArrowDown/></a>
              </Button>
              <Button variant="outline" asChild>
                <a href={repo} target="_blank" rel="noreferrer">View on GitHub <ArrowUpRight/></a>
              </Button>
            </div>
          </div>
          <div id="architecture-diagram" className="mt-12 grid gap-4 border border-white/10 bg-[#060608] p-4 sm:p-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
            {[
              {step:"01 / INTERFACE", name:"Browser", detail:"React frontend", icon:Code2},
              {step:"02 / API", name:"Application", detail:"FastAPI backend", icon:GitBranch},
              {step:"03 / DATA", name:"Workspace data", detail:"Postgres · Auth · Storage · RLS", icon:LockKeyhole},
              {step:"04 / AI", name:"Provider adapter", detail:"Gemini / Sarvam", icon:Sparkles}
            ].map((item,i) => (
              <div key={item.name} className="contents">
                <div className="rounded-md border border-white/10 bg-black p-5">
                  <item.icon size={18} className="text-white"/>
                  <p className="mt-6 font-mono text-[10px] text-neutral-500">{item.step}</p>
                  <h3 className="mt-2 text-sm font-semibold text-white">{item.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">{item.detail}</p>
                </div>
                {i < 3 && <ChevronRight size={18} className="mx-auto hidden self-center text-neutral-600 lg:block"/>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            Planned supporting services: email notifications · web push · WhatsApp sharing · audit logging · retention rules
          </p>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-white/10 bg-black py-20 text-center sm:py-24">
          <div className="mx-auto max-w-2xl px-4">
            <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider">Make the follow-through count</span>
            <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">Turn your next meeting into action.</h2>
            <p className="mt-4 text-sm leading-7 text-neutral-400 sm:text-base">
              Stop losing valuable commitments in meeting notes. Extract, review, and deliver with ActionPulse.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to="/signup">Get started <ArrowRight/></Link>
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
  );
}
