import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash,
  MoreHorizontal,
  Plus,
  Send,
  Smile,
  AtSign,
  Mic,
  Video,
  FileCode2,
  Sparkles,
  ArrowRight,
  BarChart2,
  GitBranch,
  CheckCircle2,
  Zap,
  Check,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureTab = "agent" | "triage" | "intake" | "dispatch";

interface IssueCardData {
  id: string;
  code: string;
  title: string;
  priority: "urgent" | "high" | "medium";
  tag: string;
  tagColor: string;
  assignee: string;
  column: "backlog" | "todo" | "in_progress" | "done";
  prNumber?: string;
}

const allIssues: IssueCardData[] = [
  // Far Left Backlog (peeking from the left tail)
  {
    id: "act-910",
    code: "ACT-910",
    title: "Ingest raw Zoom & Meet audio transcripts",
    priority: "medium",
    tag: "Ingest",
    tagColor: "bg-blue-400",
    assignee: "Ananya",
    column: "backlog",
  },
  {
    id: "act-911",
    code: "ACT-911",
    title: "Parse WebVTT & SRT timestamp cues",
    priority: "medium",
    tag: "Parser",
    tagColor: "bg-indigo-400",
    assignee: "Rahul",
    column: "backlog",
  },
  {
    id: "act-912",
    code: "ACT-912",
    title: "Realtime Supabase task board channel",
    priority: "medium",
    tag: "Sync",
    tagColor: "bg-cyan-400",
    assignee: "Priya",
    column: "backlog",
  },
  {
    id: "act-913",
    code: "ACT-913",
    title: "Cache offline meeting queue in IndexedDB",
    priority: "medium",
    tag: "Offline",
    tagColor: "bg-neutral-400",
    assignee: "Aman",
    column: "backlog",
  },

  // Todo Column (Middle Left)
  {
    id: "act-2704",
    code: "ACT-2704",
    title: "Patch Safari auth session cookies",
    priority: "urgent",
    tag: "Auth",
    tagColor: "bg-blue-400",
    assignee: "Rahul",
    column: "todo",
  },
  {
    id: "act-2703",
    code: "ACT-2703",
    title: "Wrap transcript parser in XML delimiter guards",
    priority: "urgent",
    tag: "Security",
    tagColor: "bg-amber-400",
    assignee: "Priya",
    column: "todo",
  },
  {
    id: "act-926",
    code: "ACT-926",
    title: "Surface ambiguous owners for organiser review",
    priority: "medium",
    tag: "Triage",
    tagColor: "bg-rose-400",
    assignee: "Aman",
    column: "todo",
  },
  {
    id: "act-2088",
    code: "ACT-2088",
    title: "Enforce Postgres RLS on task mutations",
    priority: "medium",
    tag: "Compliance",
    tagColor: "bg-rose-400",
    assignee: "Neha",
    column: "todo",
  },
  {
    id: "act-924",
    code: "ACT-924",
    title: "Benchmark Gemini 3.1 Flash-Lite extraction",
    priority: "high",
    tag: "AI Engine",
    tagColor: "bg-purple-400",
    assignee: "Rohan",
    column: "todo",
  },

  // In Progress Column (Middle Right)
  {
    id: "act-1487",
    code: "ACT-1487",
    title: "Generate 1-tap WhatsApp wa.me action links",
    priority: "high",
    tag: "WhatsApp",
    tagColor: "bg-purple-400",
    assignee: "Ananya",
    column: "in_progress",
    prNumber: "102",
  },
  {
    id: "act-1028",
    code: "ACT-1028",
    title: "Automated SMTP daily digest email template",
    priority: "medium",
    tag: "Email",
    tagColor: "bg-cyan-400",
    assignee: "Aman",
    column: "in_progress",
  },
  {
    id: "act-2187",
    code: "ACT-2187",
    title: "Enforce human organiser approval review gate",
    priority: "high",
    tag: "Review",
    tagColor: "bg-rose-400",
    assignee: "Priya",
    column: "in_progress",
    prNumber: "108",
  },

  // Done Column (Right Tail - fades smoothly)
  {
    id: "act-2074",
    code: "ACT-2074",
    title: "Deploy FastAPI backend on Render Free tier",
    priority: "medium",
    tag: "Backend",
    tagColor: "bg-neutral-400",
    assignee: "Rahul",
    column: "done",
  },
  {
    id: "act-1912",
    code: "ACT-1912",
    title: "Ground task extraction with verbatim quotes",
    priority: "high",
    tag: "AI Engine",
    tagColor: "bg-emerald-400",
    assignee: "Priya",
    column: "done",
  },
  {
    id: "act-1951",
    code: "ACT-1951",
    title: "Multi-tenant workspace isolation RPC",
    priority: "medium",
    tag: "Database",
    tagColor: "bg-amber-400",
    assignee: "Aman",
    column: "done",
  },
  {
    id: "act-1960",
    code: "ACT-1960",
    title: "Client-side transcript chunking & upload",
    priority: "medium",
    tag: "Ingest",
    tagColor: "bg-blue-400",
    assignee: "Neha",
    column: "done",
  },
];

export default function LinearWorkflowShowcase() {
  const [activeTab, setActiveTab] = useState<FeatureTab>("agent");
  const [highlightedCode, setHighlightedCode] = useState<string | null>("ACT-2703");
  const [customInput, setCustomInput] = useState("");
  const [simulatedExtraItem, setSimulatedExtraItem] = useState(false);

  const backlogIssues = allIssues.filter((i) => i.column === "backlog");
  const todoIssues = allIssues.filter((i) => i.column === "todo");
  const inProgressIssues = allIssues.filter((i) => i.column === "in_progress");
  const doneIssues = allIssues.filter((i) => i.column === "done");

  const handleSimulateNewIssue = () => {
    setSimulatedExtraItem(true);
    setHighlightedCode("ACT-3105");
  };

  const handleResetSimulation = () => {
    setSimulatedExtraItem(false);
    setHighlightedCode("ACT-2703");
  };

  return (
    <div className="relative mx-auto max-w-7xl">
      {/* 1. Header Row (Linear typography style, unboxed) */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start lg:gap-16">
        <div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-white leading-[1.08]">
            Meeting intake &<br />action extraction
          </h2>
        </div>
        <div className="max-w-xl md:pt-2">
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed font-normal">
            Automatically turn meeting transcripts and conversation notes into verified team tasks that are grounded in verbatim quotes, reviewed by organisers, and dispatched in one tap.
          </p>
          <a
            href="#demo"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors group font-normal"
          >
            <span>Explore live demo</span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>

      {/* 2. Open Canvas Stage (NOT in a card box; edge-faded tails on all sides) */}
      <div className="relative mt-12 sm:mt-16 w-full select-none overflow-hidden min-h-[560px] sm:min-h-[620px]">
        {/* Soft Centerpiece Light Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/3 top-1/4 h-[350px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.04] blur-[140px]"
        />

        {/* BACKGROUND KANBAN BOARD WITH TAIL FADING */}
        <div
          className="relative flex w-full select-none pl-2 sm:pl-8 lg:pl-12 pt-3"
          style={{
            maskImage:
              "radial-gradient(ellipse 92% 78% at 48% 46%, black 50%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 92% 78% at 48% 46%, black 50%, transparent 100%)",
          }}
        >
          {/* Column 0: Far Left Backlog (peeking behind thread modal) */}
          <div className="w-56 shrink-0 pr-3 opacity-40">
            <div className="mb-3 flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full border border-neutral-500" />
                <span className="font-medium text-neutral-300">Backlog</span>
                <span className="text-neutral-500">18</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-600">
                <Plus size={13} />
                <MoreHorizontal size={13} />
              </div>
            </div>

            <div className="space-y-2.5">
              {backlogIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-white/[0.06] bg-[#121316] p-3 text-neutral-400"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                    <span>{issue.code}</span>
                    <span className="size-4 rounded-full bg-white/5 text-[9px] text-neutral-400 grid place-items-center">
                      {issue.assignee[0]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-400 line-clamp-1">{issue.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Column 1: Todo Column */}
          <div className="w-64 sm:w-72 shrink-0 pr-3 sm:pr-4">
            <div className="mb-3 flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full border border-neutral-400" />
                <span className="font-medium text-neutral-200">Todo</span>
                <span className="text-neutral-500">{todoIssues.length + (simulatedExtraItem ? 1 : 0)}</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-500">
                <Plus size={13} className="hover:text-white cursor-pointer" />
                <MoreHorizontal size={13} className="hover:text-white cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2.5">
              {simulatedExtraItem && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "rounded-lg border p-3 transition-all",
                    highlightedCode === "ACT-3105"
                      ? "border-emerald-500/60 bg-emerald-500/10 shadow-lg ring-1 ring-emerald-500/40"
                      : "border-white/10 bg-[#121316]"
                  )}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>ACT-3105</span>
                    <span className="size-4 rounded-full bg-cyan-500/30 text-[9px] text-cyan-300 grid place-items-center">
                      A
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-white">Configure Gmail SMTP digest alerts</p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px]">
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300 font-bold">!</span>
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-neutral-300">
                      <span className="size-1.5 rounded-full bg-cyan-400" /> Email
                    </span>
                  </div>
                </motion.div>
              )}

              {todoIssues.map((issue) => {
                const isHighlighted = highlightedCode === issue.code;
                return (
                  <div
                    key={issue.id}
                    className={cn(
                      "rounded-lg border p-3 transition-all duration-300",
                      isHighlighted
                        ? "border-blue-500/60 bg-blue-500/10 shadow-lg ring-1 ring-blue-500/40 translate-x-1"
                        : "border-white/[0.07] bg-[#121316] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>{issue.code}</span>
                      <span className="size-4 rounded-full bg-white/10 text-[9px] text-neutral-300 grid place-items-center">
                        {issue.assignee[0]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-normal text-neutral-200 line-clamp-1">{issue.title}</p>
                    <div className="mt-2.5 flex items-center gap-1.5 text-[10px]">
                      {issue.priority === "urgent" && (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300 font-bold">!</span>
                      )}
                      {issue.priority === "medium" && (
                        <BarChart2 size={12} className="text-neutral-500" />
                      )}
                      {issue.priority === "high" && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300 font-bold">!</span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-neutral-300">
                        <span className={cn("size-1.5 rounded-full", issue.tagColor)} />
                        {issue.tag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: In Progress Column */}
          <div className="w-64 sm:w-72 shrink-0 pr-3 sm:pr-4">
            <div className="mb-3 flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full border border-amber-400 bg-amber-400/30" />
                <span className="font-medium text-neutral-200">In Progress</span>
                <span className="text-neutral-500">{inProgressIssues.length}</span>
              </div>
              <div className="flex items-center gap-1 text-neutral-500">
                <Plus size={13} className="hover:text-white cursor-pointer" />
                <MoreHorizontal size={13} className="hover:text-white cursor-pointer" />
              </div>
            </div>

            <div className="space-y-2.5">
              {inProgressIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-white/[0.07] bg-[#121316] p-3 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                    <span>{issue.code}</span>
                    <span className="size-4 rounded-full bg-white/10 text-[9px] text-neutral-300 grid place-items-center">
                      {issue.assignee[0]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-normal text-neutral-200 line-clamp-1">{issue.title}</p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px]">
                    <BarChart2 size={12} className="text-neutral-500" />
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-neutral-300">
                      <span className={cn("size-1.5 rounded-full", issue.tagColor)} />
                      {issue.tag}
                    </span>
                    {issue.prNumber && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 font-mono">
                        <GitBranch size={10} /> {issue.prNumber}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Done Column (Tail fades into black) */}
          <div className="w-64 sm:w-72 shrink-0 pr-4 opacity-50">
            <div className="mb-3 flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={12} className="text-blue-400" />
                <span className="font-medium text-neutral-200">Done</span>
                <span className="text-neutral-500">{doneIssues.length}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {doneIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-white/[0.05] bg-[#121316]/60 p-3"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                    <span>{issue.code}</span>
                  </div>
                  <p className="mt-1 text-xs font-normal text-neutral-400 line-clamp-1">{issue.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CINEMATIC TAIL FADE OVERLAYS (Gradient Vignette Dissolve) */}
        {/* Left tail fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-28 sm:w-48 bg-gradient-to-r from-black via-black/80 to-transparent z-10"
        />
        {/* Right tail fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-44 sm:w-72 bg-gradient-to-l from-black via-black/90 to-transparent z-10"
        />
        {/* Bottom tail fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/85 to-transparent z-10"
        />
        {/* Top edge subtle fade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/60 to-transparent z-10"
        />

        {/* FOREGROUND ELEVATED LAYER: The Floating Thread Modal */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute left-2 sm:left-6 lg:left-8 top-3 z-20 w-[min(94%,410px)] rounded-2xl border border-white/15 bg-[#121316] p-4 sm:p-5 shadow-[0_25px_80px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.06)]"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <Hash size={14} className="text-neutral-400" />
              <span className="font-semibold">Meeting Sync</span>
              <span className="text-neutral-400 font-normal">#weekly-standup</span>
            </div>
            <button
              type="button"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="Thread options"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="mt-4 space-y-4 text-xs">
            {/* Message 1: Rahul */}
            <div className="flex items-start gap-3">
              <div className="size-7 shrink-0 rounded-full bg-neutral-700 overflow-hidden ring-1 ring-white/10">
                <div className="size-full bg-gradient-to-tr from-blue-700 to-indigo-500 text-white font-bold text-[10px] grid place-items-center">
                  R
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white">rahul</span>
                  <span className="font-mono text-[10px] text-neutral-500">4:31 PM</span>
                </div>
                <p className="mt-1 leading-relaxed text-neutral-300 font-normal">
                  I will patch the Safari auth cookie refresh bug before Wednesday’s demo. Priya, let's wrap the transcript parser in XML delimiter guards so prompt injections can't hijack our Gemini model.
                </p>
              </div>
            </div>

            {/* Message 2: Priya */}
            <div className="flex items-start gap-3">
              <div className="size-7 shrink-0 rounded-full bg-neutral-700 overflow-hidden ring-1 ring-white/10">
                <div className="size-full bg-gradient-to-tr from-purple-700 to-pink-500 text-white font-bold text-[10px] grid place-items-center">
                  P
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white">priya</span>
                  <span className="font-mono text-[10px] text-neutral-500">4:48 PM</span>
                </div>
                <p className="mt-1 text-neutral-200">
                  <span className="text-emerald-400 font-medium">@ActionPulse</span> extract action items with verbatim quotes
                </p>
              </div>
            </div>

            {/* Message 3: ActionPulse Bot Reply */}
            <div className="flex items-start gap-3">
              <div className="size-7 shrink-0 rounded-lg border border-white/20 bg-white text-black font-bold text-[10px] grid place-items-center shadow-md">
                <Zap size={13} fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">ActionPulse</span>
                  <span className="rounded bg-emerald-500/20 px-1 py-0.2 font-mono text-[9px] uppercase text-emerald-300 font-bold">
                    AI AGENT
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500 ml-1">4:48 PM</span>
                </div>

                <p className="mt-1.5 text-neutral-300 font-normal">Extracted 2 candidate actions:</p>

                <div className="mt-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setHighlightedCode("ACT-2703")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border p-2 text-left font-mono text-[11px] transition",
                      highlightedCode === "ACT-2703"
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-black/40 text-neutral-300 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <span className="truncate">
                      • <strong className="text-white">ACT-2703</strong> Wrap transcript parser in XML guards
                    </span>
                    <ArrowRight size={11} className="text-emerald-400 shrink-0 ml-1" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setHighlightedCode("ACT-2704")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border p-2 text-left font-mono text-[11px] transition",
                      highlightedCode === "ACT-2704"
                        ? "border-blue-500/50 bg-blue-500/15 text-blue-200"
                        : "border-white/10 bg-black/40 text-neutral-300 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <span className="truncate">
                      • <strong className="text-white">ACT-2704</strong> Patch Safari auth session cookies
                    </span>
                    <ArrowRight size={11} className="text-blue-400 shrink-0 ml-1" />
                  </button>

                  {simulatedExtraItem && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex w-full items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 font-mono text-[11px] text-emerald-300"
                    >
                      <span className="truncate">
                        • <strong className="text-white">ACT-3105</strong> Configure Gmail SMTP digest alerts
                      </span>
                      <Check size={11} className="text-emerald-400 shrink-0 ml-1" />
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Input & Rich Bar (Linear screenshot style) */}
          <div className="mt-5 rounded-xl border border-white/10 bg-[#16171b] p-2.5">
            <div className="flex items-center justify-between">
              <input
                type="text"
                placeholder="Ask @ActionPulse or add meeting note..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customInput.trim()) {
                    handleSimulateNewIssue();
                    setCustomInput("");
                  }
                }}
                className="w-full bg-transparent text-xs text-white placeholder-neutral-500 outline-none"
              />

              {/* Grammar/Assistant Indicator Badge */}
              <div className="flex items-center gap-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-emerald-400 text-[9px] font-bold">
                <span>✦</span>
                <span>AI</span>
              </div>
            </div>

            {/* Rich Actions Toolbar */}
            <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2 text-neutral-400">
              <div className="flex items-center gap-2">
                <button type="button" className="hover:text-white transition" aria-label="Add attachment">
                  <Plus size={13} />
                </button>
                <button type="button" className="hover:text-white transition font-mono text-[11px]" aria-label="Format text">
                  Aa
                </button>
                <button type="button" className="hover:text-white transition" aria-label="Insert emoji">
                  <Smile size={13} />
                </button>
                <button type="button" className="hover:text-white transition" aria-label="Mention teammate">
                  <AtSign size={13} />
                </button>
                <button type="button" className="hover:text-white transition" aria-label="Meeting link">
                  <Video size={13} />
                </button>
                <button type="button" className="hover:text-white transition" aria-label="Voice clip">
                  <Mic size={13} />
                </button>
                <button type="button" className="hover:text-white transition" aria-label="Code format">
                  <FileCode2 size={13} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {simulatedExtraItem ? (
                  <button
                    type="button"
                    onClick={handleResetSimulation}
                    className="rounded p-1 text-neutral-500 hover:text-white"
                    title="Reset simulation"
                  >
                    <RotateCcw size={12} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSimulateNewIssue}
                    className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-neutral-300 hover:bg-white/20 hover:text-white font-mono flex items-center gap-1"
                  >
                    <Sparkles size={10} className="text-emerald-400" />
                    <span>Simulate</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (customInput.trim()) {
                      handleSimulateNewIssue();
                      setCustomInput("");
                    }
                  }}
                  className="size-6 rounded-md bg-white text-black grid place-items-center hover:bg-neutral-200 transition"
                  aria-label="Send message"
                >
                  <Send size={11} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Bottom Features Switcher Row (Unboxed on page canvas) */}
      <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-6 pt-4 text-xs font-normal">
        {/* Left 'Features' label */}
        <span className="text-neutral-500 font-normal text-xs">Capabilities</span>

        {/* Feature Groups separated with vertical divider */}
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          {/* Group 1 */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("agent");
                setHighlightedCode("ACT-2703");
              }}
              className={cn(
                "flex items-center gap-1.5 text-left transition text-xs",
                activeTab === "agent" ? "text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <span>ActionPulse AI</span>
              <span className="text-neutral-500 font-light text-[11px]">+</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("triage");
                setHighlightedCode("ACT-926");
              }}
              className={cn(
                "flex items-center gap-1.5 text-left transition text-xs",
                activeTab === "triage" ? "text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <span>Organiser Triage</span>
              <span className="text-neutral-500 font-light text-[11px]">+</span>
            </button>
          </div>

          {/* Thin Vertical Separator Line */}
          <div className="h-10 w-px bg-white/10 hidden sm:block" />

          {/* Group 2 */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("intake");
                setHighlightedCode("ACT-924");
              }}
              className={cn(
                "flex items-center gap-1.5 text-left transition text-xs",
                activeTab === "intake" ? "text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <span>Universal Ingest</span>
              <span className="text-neutral-500 font-light text-[11px]">+</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("dispatch");
                setHighlightedCode("ACT-1487");
              }}
              className={cn(
                "flex items-center gap-1.5 text-left transition text-xs",
                activeTab === "dispatch" ? "text-white font-medium" : "text-neutral-400 hover:text-neutral-200"
              )}
            >
              <span>Instant Dispatch</span>
              <span className="text-neutral-500 font-light text-[11px]">+</span>
            </button>
          </div>
        </div>

        {/* Dynamic Context Pill */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            className="ml-auto hidden xl:flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-[11px] text-neutral-400"
          >
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span>
              {activeTab === "agent" && "Gemini 3.1 Flash-Lite grounds extraction with verbatim quotes and zero hallucinated owners."}
              {activeTab === "triage" && "Organiser human review gate verifies owner assignments and uncertainty flags before syncing."}
              {activeTab === "intake" && "Universal intake parses Google Meet, Zoom, Teams, VTT, SRT, DOCX, and raw transcript audio."}
              {activeTab === "dispatch" && "1-tap WhatsApp wa.me action links and automated SMTP email digests notify assignees instantly."}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
