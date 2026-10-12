import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Quote,
  UserRound,
  FileText,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MoveRight,
} from "lucide-react";
import { CardSpotlight } from "@/components/landing/CardSpotlight";
import { cn } from "@/lib/utils";

// --- Tile 1: Grounded Quote Samples ---
interface QuoteSample {
  id: string;
  label: string;
  speaker: string;
  quote: string;
  highlightWords: string;
  actionTitle: string;
  owner: string;
  due: string;
  confidence: string;
}

const quoteSamples: QuoteSample[] = [
  {
    id: "safari",
    label: "Safari Auth",
    speaker: "Rahul",
    quote: "I will fix the login bug on Safari by Wednesday before the sprint demo.",
    highlightWords: "fix the login bug on Safari by Wednesday",
    actionTitle: "Fix login bug on Safari",
    owner: "Rahul Verma",
    due: "Wednesday",
    confidence: "99.4%",
  },
  {
    id: "prompt",
    label: "Security Guard",
    speaker: "Priya",
    quote: "I can wrap the transcript parser in XML delimiter guards by tomorrow afternoon.",
    highlightWords: "wrap the transcript parser in XML delimiter guards",
    actionTitle: "Wrap transcript parser in XML guards",
    owner: "Priya Patel",
    due: "Tomorrow, 2:00 PM",
    confidence: "98.8%",
  },
  {
    id: "smtp",
    label: "Email SMTP",
    speaker: "Aman",
    quote: "I'll configure the Gmail App Password SMTP digest sender by Friday morning.",
    highlightWords: "configure the Gmail App Password SMTP digest sender",
    actionTitle: "Configure Gmail App Password SMTP digest",
    owner: "Aman Shah",
    due: "Friday morning",
    confidence: "99.1%",
  },
];

// --- Tile 3: Transcript Format Samples ---
interface FormatSample {
  format: string;
  extension: string;
  name: string;
  preview: string;
  parsedCues: number;
}

const formatSamples: FormatSample[] = [
  {
    format: "VTT",
    extension: ".vtt",
    name: "WebVTT Caption",
    preview: "WEBVTT\n\n00:01:14.200 --> 00:01:18.900\n<v Rahul>I will patch the Safari auth cookies by Wednesday.",
    parsedCues: 38,
  },
  {
    format: "SRT",
    extension: ".srt",
    name: "SubRip Subtitle",
    preview: "1\n00:02:10,000 --> 00:02:14,500\nPriya: Wrap the LLM prompt in XML tags to stop prompt injection.",
    parsedCues: 42,
  },
  {
    format: "TXT",
    extension: ".txt",
    name: "Plain Text Notes",
    preview: "Meeting: Sprint 1 Sync\nRahul: I'll finish the auth task.\nAman: I will take the SMTP integration.",
    parsedCues: 18,
  },
  {
    format: "DOCX",
    extension: ".docx",
    name: "Word Document",
    preview: "[Word Document stream]\nExtracting text paragraphs...\nFound 3 action candidate discussions.",
    parsedCues: 26,
  },
];

// --- Tile 4: Mini Kanban State ---
interface MiniTask {
  id: string;
  title: string;
  owner: string;
  priority: "High" | "Med" | "Low";
  column: "todo" | "in_progress" | "blocked" | "done";
}

const initialTasks: MiniTask[] = [
  { id: "1", title: "Patch Safari login bug", owner: "Rahul", priority: "High", column: "in_progress" },
  { id: "2", title: "Wrap LLM in XML delimiters", owner: "Priya", priority: "High", column: "todo" },
  { id: "3", title: "Setup Brevo SMTP credentials", owner: "Aman", priority: "Med", column: "blocked" },
  { id: "4", title: "Draft Sprint 1 demo agenda", owner: "Karan", priority: "Low", column: "done" },
];

export default function InteractiveBentoFeatures() {
  // Tile 1 state
  const [selectedQuoteId, setSelectedQuoteId] = useState("safari");
  const activeQuote = quoteSamples.find((q) => q.id === selectedQuoteId) || quoteSamples[0];

  // Tile 2 state (Uncertainty toggle)
  const [uncertaintyMode, setUncertaintyMode] = useState<"clear" | "ambiguous">("ambiguous");

  // Tile 3 state (Format tab)
  const [activeFormat, setActiveFormat] = useState("VTT");
  const currentFormat = formatSamples.find((f) => f.format === activeFormat) || formatSamples[0];

  // Tile 4 state (Kanban board)
  const [kanbanTasks, setKanbanTasks] = useState<MiniTask[]>(initialTasks);

  const moveTaskNext = (taskId: string) => {
    const sequence: MiniTask["column"][] = ["todo", "in_progress", "blocked", "done"];
    setKanbanTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const currentIdx = sequence.indexOf(t.column);
        const nextCol = sequence[(currentIdx + 1) % sequence.length];
        return { ...t, column: nextCol };
      })
    );
  };

  return (
    <div className="mt-12 grid gap-5 md:grid-cols-3">
      {/* TILE 1: Grounded Action Extraction (2 cols on md/lg) */}
      <CardSpotlight
        spotlightColor="rgba(16, 185, 129, 0.12)"
        spotlightSize={500}
        className="p-6 md:col-span-2 border-white/10 bg-[#060608]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
              <Quote size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white sm:text-lg">Grounded Action Extraction</h3>
              <p className="text-xs text-neutral-400">Verbatim quote anchoring with zero hallucination</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] text-emerald-400">
            <Sparkles size={11} /> Grounded in quotes
          </span>
        </div>

        {/* Interactive Quote Switcher Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          {quoteSamples.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedQuoteId(item.id)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-xs transition",
                selectedQuoteId === item.id
                  ? "border border-emerald-500/40 bg-emerald-500/15 text-white"
                  : "border border-white/10 bg-white/5 text-neutral-400 hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Dynamic Quote-to-Action Comparison */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeQuote.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="mt-4 grid gap-3 rounded-xl border border-white/10 bg-[#040406] p-4 sm:grid-cols-[1.1fr_auto_1fr] sm:items-center"
          >
            {/* Left: Verbatim Transcript Quote */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-neutral-400">Raw Transcript Snippet</span>
                <span className="font-mono text-[10px] text-neutral-400">Speaker: {activeQuote.speaker}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-300">
                “{activeQuote.speaker}:{" "}
                <mark className="rounded bg-emerald-500/25 px-1 py-0.5 text-emerald-300">
                  {activeQuote.highlightWords}
                </mark>
                ”
              </p>
            </div>

            <ArrowRight size={16} className="hidden text-emerald-400 sm:block mx-auto" />

            {/* Right: Extracted Structured Item */}
            <div className="border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase text-emerald-400">Extracted Action</span>
                <span className="font-mono text-[10px] text-emerald-400">{activeQuote.confidence} Match</span>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-white">{activeQuote.actionTitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-neutral-300">
                  Owner: {activeQuote.owner}
                </span>
                <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-neutral-300">
                  Due: {activeQuote.due}
                </span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </CardSpotlight>

      {/* TILE 2: Zero-Guess Ownership & Uncertainty Detection (1 col) */}
      <CardSpotlight
        spotlightColor="rgba(245, 158, 11, 0.12)"
        spotlightSize={400}
        className="p-6 border-white/10 bg-[#060608] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="grid size-9 place-items-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
              <UserRound size={18} />
            </div>
            <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider">
              Zero-Guess Policy
            </span>
          </div>

          <h3 className="mt-4 text-base font-semibold text-white sm:text-lg">Uncertainty Surfaced</h3>
          <p className="mt-1.5 text-xs leading-5 text-neutral-400">
            Never hallucinate an assignee. If a task has no clear owner, ActionPulse flags it for organiser review.
          </p>

          {/* Interactive Toggle */}
          <div className="mt-4 flex rounded-lg border border-white/10 bg-black p-1 text-xs">
            <button
              type="button"
              onClick={() => setUncertaintyMode("ambiguous")}
              className={cn(
                "flex-1 rounded-md py-1.5 font-mono text-[11px] transition",
                uncertaintyMode === "ambiguous"
                  ? "bg-amber-500/20 text-amber-300 font-semibold"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              Ambiguous Owner
            </button>
            <button
              type="button"
              onClick={() => setUncertaintyMode("clear")}
              className={cn(
                "flex-1 rounded-md py-1.5 font-mono text-[11px] transition",
                uncertaintyMode === "clear"
                  ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                  : "text-neutral-400 hover:text-white"
              )}
            >
              Explicit Owner
            </button>
          </div>

          {/* Dynamic Payload preview */}
          <div className="mt-4 rounded-lg border border-white/10 bg-[#040406] p-3 text-xs font-mono">
            {uncertaintyMode === "ambiguous" ? (
              <div className="space-y-1.5 text-amber-300/90">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <AlertTriangle size={13} />
                  <span>uncertainty_flag: true</span>
                </div>
                <p className="text-neutral-400 text-[11px]">“Someone needs to run the smoke tests”</p>
                <p className="text-[11px] text-neutral-300">owner_user_id: <span className="text-amber-400">null</span></p>
                <p className="text-[10px] text-neutral-500">→ Blocked from board until assigned</p>
              </div>
            ) : (
              <div className="space-y-1.5 text-emerald-300/90">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 size={13} />
                  <span>uncertainty_flag: false</span>
                </div>
                <p className="text-neutral-400 text-[11px]">“Rahul: I will patch the bug”</p>
                <p className="text-[11px] text-neutral-300">owner_user_id: <span className="text-emerald-400">uuid-4912</span></p>
                <p className="text-[10px] text-neutral-500">→ Ready for 1-click organiser approval</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-[11px] text-neutral-500 font-mono">
          Strict FR-08 Grounding standard enforced
        </p>
      </CardSpotlight>

      {/* TILE 3: Flexible Multi-Format Input (1 col) */}
      <CardSpotlight
        spotlightColor="rgba(59, 130, 246, 0.12)"
        spotlightSize={400}
        className="p-6 border-white/10 bg-[#060608] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="grid size-9 place-items-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400">
              <FileText size={18} />
            </div>
            <span className="font-mono text-[10px] text-blue-400 uppercase tracking-wider">
              Universal Ingestion
            </span>
          </div>

          <h3 className="mt-4 text-base font-semibold text-white sm:text-lg">Flexible Input Formats</h3>
          <p className="mt-1.5 text-xs leading-5 text-neutral-400">
            Bring transcripts from Google Meet, Teams, Zoom, or voice memos. No browser extension required.
          </p>

          {/* Format Tabs */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {formatSamples.map((fmt) => (
              <button
                key={fmt.format}
                type="button"
                onClick={() => setActiveFormat(fmt.format)}
                className={cn(
                  "rounded px-2 py-1 font-mono text-[11px] transition",
                  activeFormat === fmt.format
                    ? "border border-blue-500/40 bg-blue-500/20 text-white"
                    : "border border-white/10 bg-white/5 text-neutral-400 hover:text-white"
                )}
              >
                {fmt.extension}
              </button>
            ))}
          </div>

          {/* Format syntax preview box */}
          <div className="mt-4 rounded-lg border border-white/10 bg-[#040406] p-3 text-xs font-mono">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mb-2">
              <span>{currentFormat.name}</span>
              <span className="text-emerald-400">✓ Parsed {currentFormat.parsedCues} cues</span>
            </div>
            <pre className="text-[11px] leading-5 text-neutral-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
              {currentFormat.preview}
            </pre>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
          <span>Client-side chunking</span>
          <span>Zero-loss timestamps</span>
        </div>
      </CardSpotlight>

      {/* TILE 4: Shared Interactive Kanban Board (2 cols on md/lg) */}
      <CardSpotlight
        spotlightColor="rgba(16, 185, 129, 0.12)"
        spotlightSize={500}
        className="p-6 md:col-span-2 border-white/10 bg-[#060608]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
              <GitBranch size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white sm:text-lg">Interactive Kanban Board</h3>
              <p className="text-xs text-neutral-400">Click any card to advance its state across the lifecycle</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400">
            <MoveRight size={13} className="text-emerald-400" />
            Click card to advance status
          </span>
        </div>

        {/* 4 Interactive Kanban Columns */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(["todo", "in_progress", "blocked", "done"] as const).map((colKey) => {
            const colLabels = {
              todo: "To do",
              in_progress: "In progress",
              blocked: "Blocked",
              done: "Done",
            };
            const colTasks = kanbanTasks.filter((t) => t.column === colKey);

            return (
              <div key={colKey} className="rounded-xl border border-white/10 bg-[#040406] p-2.5 flex flex-col min-h-44">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="font-mono text-[10px] uppercase font-semibold text-neutral-400">
                    {colLabels[colKey]}
                  </span>
                  <span className="rounded-full bg-white/10 px-1.5 font-mono text-[9px] text-neutral-300">
                    {colTasks.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2">
                  {colTasks.map((task) => (
                    <motion.button
                      layout
                      layoutId={task.id}
                      key={task.id}
                      type="button"
                      onClick={() => moveTaskNext(task.id)}
                      className="group w-full rounded-lg border border-white/10 bg-black p-2.5 text-left transition hover:border-emerald-500/40 hover:bg-white/[0.03]"
                    >
                      <p className="text-xs font-medium text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {task.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-neutral-400">
                          {task.owner}
                        </span>
                        <span
                          className={cn(
                            "font-mono font-medium",
                            task.priority === "High"
                              ? "text-rose-400"
                              : task.priority === "Med"
                              ? "text-amber-400"
                              : "text-neutral-400"
                          )}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </motion.button>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="grid h-24 place-items-center rounded border border-dashed border-white/10 text-[11px] text-neutral-600">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>RLS Column Boundary: Assignees can update status column only.</span>
          </div>
          <span className="font-mono text-[11px] text-neutral-500">Live Postgres Sync</span>
        </div>
      </CardSpotlight>
    </div>
  );
}
