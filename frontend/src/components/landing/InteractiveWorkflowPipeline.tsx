import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Sparkles,
  ClipboardCheck,
  ArrowRight,
  FileText,
  ShieldCheck,
  Mail,
  MessageSquare,
  Play,
  Pause,
  RotateCcw,
  Check,
  Clock,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StepConfig {
  id: string;
  stepNumber: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Upload;
  metrics: { label: string; value: string };
}

const steps: StepConfig[] = [
  {
    id: "capture",
    stepNumber: "01",
    title: "Capture",
    tagline: "Universal transcript intake",
    description: "Drag in raw transcripts (.vtt, .srt, .txt, .docx) or paste notes directly. No intrusive meeting bot required.",
    icon: Upload,
    metrics: { label: "Parser Latency", value: "< 18ms" },
  },
  {
    id: "extract",
    stepNumber: "02",
    title: "Extract",
    tagline: "Grounded AI extraction",
    description: "Gemini 3.1 Flash-Lite extracts tasks, assignees, and deadlines backed by verbatim transcript quotes.",
    icon: Sparkles,
    metrics: { label: "Hallucination Rate", value: "0.0% (Grounded)" },
  },
  {
    id: "review",
    stepNumber: "03",
    title: "Review",
    tagline: "Human-in-the-loop gate",
    description: "Organisers verify and approve suggestions. Missing owners trigger an uncertainty flag instead of guessing.",
    icon: ClipboardCheck,
    metrics: { label: "RLS Review Check", value: "Enforced" },
  },
  {
    id: "execute",
    stepNumber: "04",
    title: "Execute",
    tagline: "Instant sync & dispatch",
    description: "Approved tasks land on the workspace Kanban board. Dispatch 1-tap WhatsApp links and email digests to owners.",
    icon: ArrowRight,
    metrics: { label: "Dispatch Channels", value: "WhatsApp + Email" },
  },
];

export default function InteractiveWorkflowPipeline() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [demoApproved, setDemoApproved] = useState(false);

  // Auto-cycle through steps if playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % steps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeStep = steps[activeStepIndex];

  return (
    <div className="mt-12 rounded-2xl border border-white/10 bg-[#060608] p-4 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Background glow behind active stage */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl transition-all duration-700"
      />

      {/* Top Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Automated Lifecycle Visualizer
          </span>
          <h3 className="mt-1 text-lg font-semibold text-white sm:text-xl">
            Watch the handoff from conversation to execution
          </h3>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-neutral-300 transition hover:bg-white/10 hover:text-white"
            aria-label={isPlaying ? "Pause workflow auto-play" : "Start workflow auto-play"}
          >
            {isPlaying ? (
              <>
                <Pause size={13} className="text-amber-400" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-emerald-400" />
                <span>Auto-play</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveStepIndex(0);
              setDemoApproved(false);
            }}
            className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Restart pipeline demo"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Pipeline Stepper Bar */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((step, idx) => {
          const isActive = idx === activeStepIndex;
          const isPassed = idx < activeStepIndex;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setActiveStepIndex(idx);
                setIsPlaying(false);
              }}
              className={cn(
                "group relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all duration-200",
                isActive
                  ? "border-emerald-500/40 bg-emerald-500/[0.07] ring-1 ring-emerald-500/30"
                  : isPassed
                  ? "border-white/15 bg-white/[0.02] text-neutral-300 hover:border-white/25 hover:bg-white/[0.04]"
                  : "border-white/5 bg-transparent text-neutral-500 hover:border-white/10 hover:text-neutral-400"
              )}
            >
              {/* Top Row: Number & Icon */}
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    "font-mono text-[11px] font-semibold tracking-wider",
                    isActive ? "text-emerald-400" : isPassed ? "text-neutral-300" : "text-neutral-500"
                  )}
                >
                  {step.stepNumber}
                </span>
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-md border text-xs transition",
                    isActive
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : isPassed
                      ? "border-white/20 bg-white/5 text-neutral-300"
                      : "border-transparent text-neutral-600"
                  )}
                >
                  <Icon size={13} />
                </span>
              </div>

              {/* Title & Tagline */}
              <p
                className={cn(
                  "mt-2 text-sm font-semibold transition",
                  isActive ? "text-white" : isPassed ? "text-neutral-200" : "text-neutral-400"
                )}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-400 line-clamp-1">{step.tagline}</p>

              {/* Active step progress bar at bottom */}
              {isActive && isPlaying && (
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4.5, ease: "linear" }}
                  className="absolute bottom-0 left-0 h-[2px] rounded-full bg-emerald-400"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage for the Active Step */}
      <div className="mt-6 rounded-xl border border-white/10 bg-[#040406] p-5 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="grid gap-6 lg:grid-cols-[1fr_1.25fr] lg:items-center"
          >
            {/* Left: Step Explainer & Telemetry */}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Stage {activeStep.stepNumber} of 04
                </span>
                <span className="font-mono text-[11px] text-neutral-500">
                  {activeStep.metrics.label}: <strong className="text-white">{activeStep.metrics.value}</strong>
                </span>
              </div>

              <h4 className="mt-3 text-xl font-semibold text-white sm:text-2xl">{activeStep.title}: {activeStep.tagline}</h4>
              <p className="mt-3 text-sm leading-6 text-neutral-300 sm:text-neutral-400">{activeStep.description}</p>

              {/* Step Key Highlights */}
              <div className="mt-6 space-y-2.5 border-t border-white/10 pt-5 text-xs text-neutral-300">
                {activeStepIndex === 0 && (
                  <>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Client-side multi-format parser for VTT, SRT, DOCX & TXT.
                    </p>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Preserves speaker segments & timestamps with zero data loss.
                    </p>
                  </>
                )}
                {activeStepIndex === 1 && (
                  <>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Verbatim <code className="font-mono text-emerald-400">source_excerpt</code> captured for 100% auditability.
                    </p>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Protected by XML prompt-injection shields on FastAPI backend.
                    </p>
                  </>
                )}
                {activeStepIndex === 2 && (
                  <>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Organiser verification gate: prevents unvetted AI hallucinations.
                    </p>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Postgres check constraint ensures <code className="font-mono text-neutral-300">reviewed_by</code> stamp.
                    </p>
                  </>
                )}
                {activeStepIndex === 3 && (
                  <>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Zero-cost <code className="font-mono text-emerald-400">wa.me</code> links for 1-tap WhatsApp team dispatch.
                    </p>
                    <p className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-400" />
                      Free SMTP email digest delivered to assigned workspace members.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Right: Dynamic Interactive Simulation for this stage */}
            <div className="relative rounded-xl border border-white/10 bg-[#09090d] p-4 sm:p-5">
              {/* STAGE 01: Capture Simulator */}
              {activeStepIndex === 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-[11px] text-neutral-400">INPUT SOURCE SIMULATOR</span>
                    <span className="font-mono text-[10px] text-emerald-400">● READY FOR DROP</span>
                  </div>

                  <div className="rounded-lg border-2 border-dashed border-white/20 bg-black/40 p-5 text-center">
                    <FileText className="mx-auto size-8 text-neutral-400 animate-pulse" />
                    <p className="mt-2 text-xs font-semibold text-white">sprint-planning-march.vtt</p>
                    <p className="mt-1 text-[11px] text-neutral-500">14 KB · Parsed 24 speaker cues · 0 errors</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-400">
                    <div className="rounded border border-white/10 bg-black p-2">
                      <span className="text-neutral-500">CUE 00:01:24</span>
                      <p className="text-neutral-300 truncate">Rahul: Safari login fix</p>
                    </div>
                    <div className="rounded border border-white/10 bg-black p-2">
                      <span className="text-neutral-500">CUE 00:03:10</span>
                      <p className="text-neutral-300 truncate">Sneha: Auth refactor</p>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 02: Extraction Simulator */}
              {activeStepIndex === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-[11px] text-neutral-400">GEMINI 3.1 FLASH-LITE ENGINE</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                      <Sparkles size={11} /> 142ms LATENCY
                    </span>
                  </div>

                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3.5">
                    <p className="font-mono text-[10px] uppercase text-emerald-400">Verbatim Grounded Excerpt</p>
                    <blockquote className="mt-1.5 font-mono text-xs leading-5 text-white">
                      “Rahul: I will patch the Safari authentication cookies by Wednesday before sprint demo.”
                    </blockquote>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black p-3 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-neutral-400">
                      <span>task_title:</span>
                      <span className="text-white font-medium">Patch Safari auth cookies</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>detected_owner:</span>
                      <span className="text-emerald-400">Rahul Verma</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>deadline:</span>
                      <span className="text-amber-300">Wednesday</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>grounding_confidence:</span>
                      <span className="text-emerald-400">99.2%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 03: Review Simulator */}
              {activeStepIndex === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-[11px] text-neutral-400">ORGANISER APPROVAL GATE</span>
                    <span className="font-mono text-[10px] text-amber-400">AWAITING DECISION</span>
                  </div>

                  <div className="rounded-lg border border-white/15 bg-black p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
                          EXTRACTED #104
                        </span>
                        <h5 className="mt-1.5 text-sm font-semibold text-white">Patch Safari auth cookies</h5>
                        <p className="text-xs text-neutral-400">Owner: Rahul Verma · Due: Wednesday</p>
                      </div>
                      <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDemoApproved(true)}
                        className={cn(
                          "flex-1 rounded-md py-2 font-mono text-xs font-semibold transition",
                          demoApproved
                            ? "bg-emerald-500 text-black font-bold"
                            : "bg-white text-black hover:bg-neutral-200"
                        )}
                      >
                        {demoApproved ? "✓ Approved (Committed)" : "Approve & Push to Board"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDemoApproved(false)}
                        className="rounded-md border border-white/20 bg-white/5 px-3 py-2 font-mono text-xs text-neutral-300 hover:bg-white/10"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <p className="font-mono text-[10px] text-neutral-500">
                    RLS Policy: Only <code className="text-neutral-300">role in ('admin', 'organiser')</code> can trigger mutation.
                  </p>
                </div>
              )}

              {/* STAGE 04: Execute Simulator */}
              {activeStepIndex === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-[11px] text-neutral-400">KANBAN + DISPATCH PIPELINE</span>
                    <span className="font-mono text-[10px] text-emerald-400">● SYNCED</span>
                  </div>

                  {/* Mini Kanban Task Card */}
                  <div className="rounded-lg border border-emerald-500/30 bg-black p-3.5">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-mono text-emerald-400">KANBAN / TO DO</span>
                      <span className="flex items-center gap-1 font-mono text-neutral-400">
                        <Clock size={11} /> Due Wed
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-white">Patch Safari auth cookies</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
                      <UserCheck size={13} className="text-emerald-400" />
                      <span>Rahul Verma (Primary Assignee)</span>
                    </div>
                  </div>

                  {/* Dispatch triggers */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 rounded border border-white/10 bg-[#06060a] p-2.5">
                      <MessageSquare size={14} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-white">wa.me ready</p>
                        <p className="text-[10px] text-neutral-500">1-tap WhatsApp</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded border border-white/10 bg-[#06060a] p-2.5">
                      <Mail size={14} className="text-indigo-400 shrink-0" />
                      <div>
                        <p className="font-semibold text-white">SMTP sent</p>
                        <p className="text-[10px] text-neutral-500">Email digest</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
