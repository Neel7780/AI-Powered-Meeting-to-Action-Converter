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
  // Far Left Backlog (peeking from the left tail as in Linear screenshot)
  {
    id: "act-910",
    code: "ACT-910",
    title: "vehicle_state_sync every time...",
    priority: "medium",
    tag: "Sync",
    tagColor: "bg-blue-400",
    assignee: "Andreas",
    column: "backlog",
  },
  {
    id: "act-911",
    code: "ACT-911",
    title: "Optimized socket streams",
    priority: "medium",
    tag: "Core",
    tagColor: "bg-indigo-400",
    assignee: "Karri",
    column: "backlog",
  },
  {
    id: "act-912",
    code: "ACT-912",
    title: "Realtime client telemetry sync",
    priority: "medium",
    tag: "Telemetry",
    tagColor: "bg-cyan-400",
    assignee: "Liam",
    column: "backlog",
  },
  {
    id: "act-913",
    code: "ACT-913",
    title: "Dynamic websocket rerouting",
    priority: "medium",
    tag: "Network",
    tagColor: "bg-neutral-400",
    assignee: "Elena",
    column: "backlog",
  },

  // Todo Column (Middle Left)
  {
    id: "act-2704",
    code: "ACT-2704",
    title: "Track iOS startup performance",
    priority: "urgent",
    tag: "Analytics",
    tagColor: "bg-blue-400",
    assignee: "Andreas",
    column: "todo",
  },
  {
    id: "act-2703",
    code: "ACT-2703",
    title: "Faster app launch",
    priority: "urgent",
    tag: "Performance",
    tagColor: "bg-amber-400",
    assignee: "Karri",
    column: "todo",
  },
  {
    id: "act-926",
    code: "ACT-926",
    title: "Remove UI inconsistencies",
    priority: "medium",
    tag: "Bug",
    tagColor: "bg-rose-400",
    assignee: "Priya",
    column: "todo",
  },
  {
    id: "act-2088",
    code: "ACT-2088",
    title: "TypeError: Cannot read properties",
    priority: "medium",
    tag: "Bug",
    tagColor: "bg-rose-400",
    assignee: "Aman",
    column: "todo",
  },
  {
    id: "act-924",
    code: "ACT-924",
    title: "Upgrade to Claude Opus 5",
    priority: "high",
    tag: "AI",
    tagColor: "bg-purple-400",
    assignee: "Rahul",
    column: "todo",
  },

  // In Progress Column (Middle Right)
  {
    id: "act-1487",
    code: "ACT-1487",
    title: "Remove contentData from GraphQL API",
    priority: "high",
    tag: "Backend",
    tagColor: "bg-purple-400",
    assignee: "Elena",
    column: "in_progress",
    prNumber: "61039",
  },
  {
    id: "act-1028",
    code: "ACT-1028",
    title: "Launch page assets",
    priority: "medium",
    tag: "Design",
    tagColor: "bg-cyan-400",
    assignee: "Sora",
    column: "in_progress",
  },
  {
    id: "act-2187",
    code: "ACT-2187",
    title: "Prevent duplicate ride requests on poor...",
    priority: "high",
    tag: "Bug",
    tagColor: "bg-rose-400",
    assignee: "Dev",
    column: "in_progress",
    prNumber: "62048",
  },

  // Done Column (Right Tail - fades smoothly)
  {
    id: "act-2074",
    code: "ACT-2074",
    title: "Clean up deprecated endpoints",
    priority: "medium",
    tag: "API",
    tagColor: "bg-neutral-400",
    assignee: "Liam",
    column: "done",
  },
  {
    id: "act-1912",
    code: "ACT-1912",
    title: "Reduce latency on Gemini prompt",
    priority: "high",
    tag: "AI",
    tagColor: "bg-emerald-400",
    assignee: "Priya",
    column: "done",
  },
  {
    id: "act-1951",
    code: "ACT-1951",
    title: "Reduce ETA calculation lag",
    priority: "medium",
    tag: "Performance",
    tagColor: "bg-amber-400",
    assignee: "Andreas",
    column: "done",
  },
  {
    id: "act-1960",
    code: "ACT-1960",
    title: "Improve fallback offline queue",
    priority: "medium",
    tag: "Offline",
    tagColor: "bg-blue-400",
    assignee: "Karri",
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
            Intake and<br />integrations
          </h2>
        </div>
        <div className="max-w-xl md:pt-2">
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed font-normal">
            Automatically turn conversations and customer feedback into actionable issues that are instantly routed, labeled, and prioritized for the right team.
          </p>
          <a
            href="#demo"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors group font-normal"
          >
            <span>Learn more</span>
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
                    <span className="size-4 rounded-full bg-indigo-500/30 text-[9px] text-indigo-300 grid place-items-center">
                      R
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-white">Optimize database RPC latency</p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px]">
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-rose-300 font-bold">!</span>
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-neutral-300">
                      <span className="size-1.5 rounded-full bg-emerald-400" /> Database
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
              <span className="font-semibold">Thread</span>
              <span className="text-neutral-400 font-normal">#product</span>
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
            {/* Message 1: Andreas */}
            <div className="flex items-start gap-3">
              <div className="size-7 shrink-0 rounded-full bg-neutral-700 overflow-hidden ring-1 ring-white/10">
                <div className="size-full bg-gradient-to-tr from-amber-700 to-amber-500 text-black font-bold text-[10px] grid place-items-center">
                  A
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white">andreas</span>
                  <span className="font-mono text-[10px] text-neutral-500">4:31 PM</span>
                </div>
                <p className="mt-1 leading-relaxed text-neutral-300 font-normal">
                  Feels like we could render sooner and load the rest in the background. Probably also worth tracking startup timing so we know how often this happens!
                </p>
              </div>
            </div>

            {/* Message 2: Karri */}
            <div className="flex items-start gap-3">
              <div className="size-7 shrink-0 rounded-full bg-neutral-700 overflow-hidden ring-1 ring-white/10">
                <div className="size-full bg-gradient-to-tr from-blue-700 to-cyan-500 text-white font-bold text-[10px] grid place-items-center">
                  K
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-white">karri</span>
                  <span className="font-mono text-[10px] text-neutral-500">4:48 PM</span>
                </div>
                <p className="mt-1 text-neutral-200">
                  <span className="text-blue-400 font-medium">@Linear</span> create issues and assign to me
                </p>
              </div>
            </div>

            {/* Message 3: Linear Bot Reply */}
            <div className="flex items-start gap-3">
              <div className="size-7 shrink-0 rounded-lg border border-white/20 bg-white text-black font-bold text-[10px] grid place-items-center shadow-md">
                <Zap size={13} fill="currentColor" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">Linear</span>
                  <span className="rounded bg-white/10 px-1 py-0.2 font-mono text-[9px] uppercase text-neutral-300 font-bold">
                    APP
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500 ml-1">4:48 PM</span>
                </div>

                <p className="mt-1.5 text-neutral-300 font-normal">Created 2 issues:</p>

                <div className="mt-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setHighlightedCode("ACT-2703")}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border p-2 text-left font-mono text-[11px] transition",
                      highlightedCode === "ACT-2703"
                        ? "border-blue-500/50 bg-blue-500/15 text-blue-200"
                        : "border-white/10 bg-black/40 text-neutral-300 hover:border-white/20 hover:text-white"
                    )}
                  >
                    <span className="truncate">
                      • <strong className="text-white">ENG-2703</strong> Faster app launch
                    </span>
                    <ArrowRight size={11} className="text-blue-400 shrink-0 ml-1" />
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
                      • <strong className="text-white">ENG-2704</strong> Track iOS startup performance
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
                        • <strong className="text-white">ENG-3105</strong> Optimize database RPC latency
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
                placeholder="Reply..."
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

              {/* Grammar/Assistant Indicator Badge as in Linear screenshot */}
              <div className="flex items-center gap-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-1.5 py-0.5 text-emerald-400 text-[9px] font-bold">
                <span>✦</span>
                <span>G</span>
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

      {/* 3. Bottom Features Switcher Row (Directly matching Linear screenshot, unboxed on page canvas) */}
      <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-6 pt-4 text-xs font-normal">
        {/* Left 'Features' label */}
        <span className="text-neutral-500 font-normal text-xs">Features</span>

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
              <span>Linear Agent</span>
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
              <span>Triage</span>
              <span className="text-neutral-500 font-light text-[11px]">+</span>
            </button>
          </div>

          {/* Thin Vertical Separator Line as in Linear screenshot */}
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
              <span>Customer Requests</span>
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
              <span>Linear Asks</span>
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
            <span className="size-1.5 rounded-full bg-blue-400" />
            <span>
              {activeTab === "agent" && "Agent extracts tasks from conversational threads directly into issues."}
              {activeTab === "triage" && "Triage review gate verifies assignees before moving into active sprint cycles."}
              {activeTab === "intake" && "Universal intake converts client chats, transcripts, and tickets."}
              {activeTab === "dispatch" && "Linear Asks connects team communication channels to product tracking."}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
