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
  column: "todo" | "in_progress" | "done";
  prNumber?: string;
}

const initialIssues: IssueCardData[] = [
  // Todo
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
    title: "Patch Safari auth cookies",
    priority: "high",
    tag: "Security",
    tagColor: "bg-emerald-400",
    assignee: "Rahul",
    column: "todo",
  },

  // In Progress
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

  // Done
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
];

export default function LinearWorkflowShowcase() {
  const [activeTab, setActiveTab] = useState<FeatureTab>("agent");
  const [highlightedCode, setHighlightedCode] = useState<string | null>("ACT-2703");
  const [issues] = useState<IssueCardData[]>(initialIssues);
  const [customInput, setCustomInput] = useState("");
  const [simulatedExtraItem, setSimulatedExtraItem] = useState(false);

  const todoIssues = issues.filter((i) => i.column === "todo");
  const inProgressIssues = issues.filter((i) => i.column === "in_progress");
  const doneIssues = issues.filter((i) => i.column === "done");

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
      {/* 1. Header Row (Linear typography style) */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start lg:gap-16">
        <div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.06]">
            Intake and<br />workflow
          </h2>
        </div>
        <div className="max-w-xl md:pt-2">
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
            Automatically turn conversations and meeting transcripts into actionable issues that are instantly routed, grounded in quotes, and prioritized for the right team.
          </p>
          <a
            href="#demo"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white transition-colors group"
          >
            <span>Learn more</span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>

      {/* 2. Linear Showcase Stage */}
      <div className="relative mt-12 overflow-hidden rounded-2xl border border-white/10 bg-[#08090C] p-3 sm:p-6 lg:p-8 shadow-2xl">
        {/* Subtle Background Ambiance Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-blue-600/10 blur-[120px]"
        />

        {/* Outer Stage Frame with Desktop Layout */}
        <div className="relative min-h-[580px] w-full overflow-hidden rounded-xl border border-white/5 bg-[#0A0B0E]">
          {/* BACKGROUND LAYER: Full Linear-Style Kanban Board */}
          <div className="absolute inset-0 flex select-none overflow-hidden pl-4 sm:pl-8 lg:pl-16 pt-5">
            {/* Column 1: Todo */}
            <div className="w-64 sm:w-72 shrink-0 pr-4">
              {/* Column Header */}
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

              {/* Todo Cards Stack */}
              <div className="space-y-2.5">
                {simulatedExtraItem && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      highlightedCode === "ACT-3105"
                        ? "border-emerald-500/60 bg-emerald-500/10 shadow-lg ring-1 ring-emerald-500/40"
                        : "border-white/10 bg-[#121418]"
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
                          : "border-white/[0.07] bg-[#121418] hover:border-white/20"
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                        <span>{issue.code}</span>
                        <span className="size-4 rounded-full bg-white/10 text-[9px] text-neutral-300 grid place-items-center">
                          {issue.assignee[0]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-white line-clamp-1">{issue.title}</p>
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

            {/* Column 2: In Progress */}
            <div className="w-64 sm:w-72 shrink-0 pr-4">
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
                    className="rounded-lg border border-white/[0.07] bg-[#121418] p-3 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                      <span>{issue.code}</span>
                      <span className="size-4 rounded-full bg-white/10 text-[9px] text-neutral-300 grid place-items-center">
                        {issue.assignee[0]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-white line-clamp-1">{issue.title}</p>
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

            {/* Column 3: Done (Subtly faded for depth as in Linear screenshot) */}
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
                    className="rounded-lg border border-white/[0.05] bg-[#121418]/60 p-3"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                      <span>{issue.code}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-neutral-400 line-clamp-1">{issue.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Soft Edge Fade Gradient on Right */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0A0B0E] to-transparent" />
          </div>

          {/* FOREGROUND LAYER: The Floating Chat / Intake Thread Modal (Left Layer) */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="relative z-20 m-3 sm:m-6 w-full max-w-[370px] sm:max-w-[420px] rounded-2xl border border-white/15 bg-[#121316]/95 backdrop-blur-xl p-4 sm:p-5 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.06)]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Hash size={14} className="text-neutral-400" />
                <span>Thread</span>
                <span className="font-mono text-neutral-400">#product</span>
              </div>
              <button
                type="button"
                className="text-neutral-400 hover:text-white transition-colors"
                aria-label="Thread options"
              >
                <MoreHorizontal size={15} />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="mt-4 space-y-4 text-xs">
              {/* Message 1: Andreas */}
              <div className="flex items-start gap-3">
                <div className="size-7 shrink-0 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-black font-bold text-[10px] grid place-items-center">
                  A
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-white">andreas</span>
                    <span className="font-mono text-[10px] text-neutral-500">4:31 PM</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-neutral-300">
                    Feels like we could render sooner and load the rest in the background. Probably also worth tracking startup timing so we know how often this happens!
                  </p>
                </div>
              </div>

              {/* Message 2: Karri */}
              <div className="flex items-start gap-3">
                <div className="size-7 shrink-0 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 text-white font-bold text-[10px] grid place-items-center">
                  K
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-white">karri</span>
                    <span className="font-mono text-[10px] text-neutral-500">4:48 PM</span>
                  </div>
                  <p className="mt-1 text-neutral-200">
                    <span className="text-blue-400 font-medium">@ActionPulse</span> create issues and assign to me
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
                    <span className="rounded bg-white/10 px-1 py-0.2 font-mono text-[9px] uppercase text-neutral-300 font-bold">
                      APP
                    </span>
                    <span className="font-mono text-[10px] text-neutral-500 ml-1">4:48 PM</span>
                  </div>

                  <p className="mt-1.5 text-neutral-300">Created 2 issues:</p>

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
                        • <strong className="text-white">ACT-2703</strong> Faster app launch
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
                        • <strong className="text-white">ACT-2704</strong> Track iOS startup performance
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
                          • <strong className="text-white">ACT-3105</strong> Optimize database RPC latency
                        </span>
                        <Check size={11} className="text-emerald-400 shrink-0 ml-1" />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Input & Rich Bar (Linear screenshot style) */}
            <div className="mt-5 rounded-xl border border-white/10 bg-[#0C0D10] p-2.5">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Reply or paste transcript note..."
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

                {/* Grammatical / Assistant Indicator Badge as in screenshot */}
                <span className="size-5 shrink-0 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 text-[10px] font-bold grid place-items-center">
                  G
                </span>
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
                  <button type="button" className="hover:text-white transition" aria-label="Voice clip">
                    <Mic size={13} />
                  </button>
                  <button type="button" className="hover:text-white transition" aria-label="Meeting link">
                    <Video size={13} />
                  </button>
                  <button type="button" className="hover:text-white transition" aria-label="Transcript format">
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
                      className="rounded bg-white/10 px-2 py-1 text-[10px] text-neutral-300 hover:bg-white/20 hover:text-white font-mono flex items-center gap-1"
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

        {/* 3. Bottom Features Switcher Row (From Linear screenshot) */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 text-xs sm:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 sm:col-span-1 text-neutral-500 font-mono text-[11px] uppercase tracking-wider self-center">
            Features
          </div>

          {/* Tab 1 */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("agent");
              setHighlightedCode("ACT-2703");
            }}
            className={cn(
              "flex items-center justify-between rounded-lg border p-2.5 text-left transition",
              activeTab === "agent"
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/5 bg-transparent text-neutral-400 hover:border-white/15 hover:text-white"
            )}
          >
            <span className="font-medium">ActionPulse Agent</span>
            <span className="text-neutral-500 font-mono">+</span>
          </button>

          {/* Tab 2 */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("triage");
              setHighlightedCode("ACT-926");
            }}
            className={cn(
              "flex items-center justify-between rounded-lg border p-2.5 text-left transition",
              activeTab === "triage"
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/5 bg-transparent text-neutral-400 hover:border-white/15 hover:text-white"
            )}
          >
            <span className="font-medium">Triage & Review</span>
            <span className="text-neutral-500 font-mono">+</span>
          </button>

          {/* Tab 3 */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("intake");
              setHighlightedCode("ACT-924");
            }}
            className={cn(
              "flex items-center justify-between rounded-lg border p-2.5 text-left transition",
              activeTab === "intake"
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/5 bg-transparent text-neutral-400 hover:border-white/15 hover:text-white"
            )}
          >
            <span className="font-medium">Customer Requests</span>
            <span className="text-neutral-500 font-mono">+</span>
          </button>

          {/* Tab 4 */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("dispatch");
              setHighlightedCode("ACT-1487");
            }}
            className={cn(
              "flex items-center justify-between rounded-lg border p-2.5 text-left transition",
              activeTab === "dispatch"
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/5 bg-transparent text-neutral-400 hover:border-white/15 hover:text-white"
            )}
          >
            <span className="font-medium">Linear Asks</span>
            <span className="text-neutral-500 font-mono">+</span>
          </button>
        </div>

        {/* Dynamic Detail Pill when a tab is selected */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-4 py-2.5 text-xs text-neutral-400"
          >
            <div className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>
                {activeTab === "agent" && "ActionPulse Agent parses thread mentions and extracts structured tasks with verbatim source quotes."}
                {activeTab === "triage" && "Organiser human review gate verifies owner assignments and uncertainty flags before syncing."}
                {activeTab === "intake" && "Universal intake accepts transcripts from Google Meet, Slack threads, Zoom, and voice memos."}
                {activeTab === "dispatch" && "Instant multi-channel dispatch delivers 1-tap WhatsApp links (wa.me) and SMTP digest emails."}
              </span>
            </div>
            <span className="font-mono text-[10px] text-neutral-500">Postgres RLS Protected</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
