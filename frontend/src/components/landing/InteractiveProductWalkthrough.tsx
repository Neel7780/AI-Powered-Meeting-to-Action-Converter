import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Sparkles,
  Check,
  CheckCircle2,
  X,
  Pencil,
  CircleHelp,
  UserRound,
  Play,
  Pause,
  RotateCcw,
  MousePointer,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActionItem {
  id: string;
  title: string;
  owner: string;
  due: string;
  source: string;
  status: "review" | "approved" | "rejected";
}

const initialActions: ActionItem[] = [
  {
    id: "onboarding",
    title: "Prepare revised onboarding flow",
    owner: "Aman Shah",
    due: "Friday",
    source: "Aman: Sure, I'll have the onboarding flow ready by Friday.",
    status: "review",
  },
  {
    id: "safari",
    title: "Fix Safari login bug",
    owner: "Rahul Mehta",
    due: "Wednesday",
    source: "Rahul: I will fix the login bug on Safari by Wednesday.",
    status: "review",
  },
  {
    id: "readme",
    title: "Update the README documentation",
    owner: "",
    due: "",
    source: "Priya: Someone should update the README at some point.",
    status: "review",
  },
];

const transcript = [
  { speaker: "Priya", time: "00:08", text: "The client demo is next Thursday.", id: "context" },
  { speaker: "Rahul", time: "00:24", text: "I will fix the login bug on Safari by Wednesday.", id: "safari" },
  { speaker: "Priya", time: "00:41", text: "Aman, can you prepare the revised onboarding flow by Friday?", id: "request" },
  { speaker: "Aman", time: "00:49", text: "Sure, I'll have the onboarding flow ready by Friday.", id: "onboarding" },
  { speaker: "Priya", time: "01:12", text: "Someone should update the README at some point.", id: "readme" },
  { speaker: "Rahul", time: "01:28", text: "The vendor will send the invoice by the 5th.", id: "invoice" },
];

/**
 * Custom Notion-style oversized blue cursor with click ripples and operator badge
 */
function NotionCursor({
  x,
  y,
  visible,
  clicking,
  label,
  role = "AI Reviewer",
}: {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
  label?: string;
  role?: string;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: 1,
            scale: clicking ? 0.88 : 1,
            x,
            y,
          }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{
            x: { type: "spring", damping: 28, stiffness: 220, mass: 0.8 },
            y: { type: "spring", damping: 28, stiffness: 220, mass: 0.8 },
            scale: { duration: 0.15 },
            opacity: { duration: 0.25 },
          }}
          className="pointer-events-none absolute z-50 select-none"
          style={{ top: 0, left: 0 }}
        >
          {/* Click Ripple Effect */}
          {clicking && (
            <motion.span
              initial={{ scale: 0.4, opacity: 0.85 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="absolute -left-3.5 -top-3.5 size-9 rounded-full border-2 border-blue-400 bg-blue-500/20"
            />
          )}

          {/* Oversized Blue Pointer Arrow (Notion style) */}
          <div className="relative">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              className="filter drop-shadow-[0_4px_10px_rgba(37,99,235,0.45)]"
            >
              <path
                d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
                fill="#2563EB"
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>

            {/* Operator Pill Tag */}
            {label && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-blue-400/40 bg-blue-600/95 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl backdrop-blur-md whitespace-nowrap"
              >
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">{role}:</span>
                <span className="text-blue-100">{label}</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function InteractiveProductWalkthrough() {
  const [actions, setActions] = useState<ActionItem[]>(initialActions);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>("onboarding");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"transcript" | "actions">("actions");
  const [errorId, setErrorId] = useState<string | null>(null);

  // Autoplay State Machine
  const [isAutoplay, setIsAutoplay] = useState<boolean>(true);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 300, y: 150 });
  const [isCursorClicking, setIsCursorClicking] = useState<boolean>(false);
  const [cursorLabel, setCursorLabel] = useState<string>("Scanning transcript");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  // DOM Refs for dynamic coordinate resolution
  const containerRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLElement>(null);
  const approveBtn1Ref = useRef<HTMLButtonElement>(null);
  const card3Ref = useRef<HTMLElement>(null);
  const editBtn3Ref = useRef<HTMLButtonElement>(null);
  const approveBtn3Ref = useRef<HTMLButtonElement>(null);
  const transcriptCardRef = useRef<HTMLDivElement>(null);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User Action Handlers
  const updateAction = useCallback((id: string, patch: Partial<ActionItem>) => {
    setActions((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const approveAction = useCallback((item: ActionItem) => {
    if (!item.owner.trim()) {
      setEditingId(item.id);
      setErrorId(item.id);
      return;
    }
    updateAction(item.id, { status: "approved" });
    setEditingId(null);
    setErrorId(null);
  }, [updateAction]);

  const resetToInitial = useCallback(() => {
    setActions(initialActions);
    setActiveQuoteId("onboarding");
    setEditingId(null);
    setErrorId(null);
    setProgressPercent(0);
  }, []);

  // Enter Interactive Mode on user mouse enter / interaction
  const enterInteractiveMode = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsAutoplay(false);
  };

  // Schedule auto-resumption when mouse leaves
  const handleMouseLeave = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      resetToInitial();
      setIsAutoplay(true);
    }, 8000);
  };

  // Dynamic coordinate calculator
  const getElementCenter = useCallback((el: HTMLElement | null) => {
    if (!el || !containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    return {
      x: elRect.left - containerRect.left + elRect.width * 0.5,
      y: elRect.top - containerRect.top + elRect.height * 0.5,
    };
  }, []);

  // Choreographed Walkthrough Storyline Loop (12 seconds)
  useEffect(() => {
    if (!isAutoplay) return;

    let stepTimer: ReturnType<typeof setTimeout>;
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => (prev >= 100 ? 0 : prev + 100 / 120));
    }, 100);

    const runStoryline = () => {
      // Step 0 (0s): Introduce scan on transcript
      setCursorLabel("Analyzing transcript");
      setActiveQuoteId("onboarding");
      setEditingId(null);

      const transcriptCoord = getElementCenter(transcriptCardRef.current);
      if (transcriptCoord) {
        setCursorPos({ x: transcriptCoord.x, y: transcriptCoord.y + 40 });
      } else {
        setCursorPos({ x: 180, y: 160 });
      }

      // Step 1 (2.2s): Move to Card 1 and inspect
      stepTimer = setTimeout(() => {
        setCursorLabel("Grounded action verified");
        setActiveQuoteId("onboarding");
        const card1Coord = getElementCenter(card1Ref.current);
        if (card1Coord) {
          setCursorPos({ x: card1Coord.x + 30, y: card1Coord.y });
        } else {
          setCursorPos({ x: 500, y: 140 });
        }

        // Step 2 (3.8s): Hover and Click Approve on Card 1
        stepTimer = setTimeout(() => {
          setCursorLabel('Clicking "Approve"');
          const btnCoord = getElementCenter(approveBtn1Ref.current);
          if (btnCoord) {
            setCursorPos({ x: btnCoord.x, y: btnCoord.y });
          } else {
            setCursorPos({ x: 620, y: 220 });
          }

          stepTimer = setTimeout(() => {
            setIsCursorClicking(true);
            setTimeout(() => {
              setIsCursorClicking(false);
              updateAction("onboarding", { status: "approved" });
            }, 250);

            // Step 3 (5.8s): Move to Card 3 (Uncertainty Notice)
            stepTimer = setTimeout(() => {
              setCursorLabel("Uncertainty flagged: missing owner");
              setActiveQuoteId("readme");
              const card3Coord = getElementCenter(card3Ref.current);
              if (card3Coord) {
                setCursorPos({ x: card3Coord.x, y: card3Coord.y - 15 });
              } else {
                setCursorPos({ x: 500, y: 360 });
              }

              // Step 4 (7.8s): Click Edit on Card 3 and assign owner
              stepTimer = setTimeout(() => {
                setCursorLabel('Assigning owner: "Priya Patel"');
                const editBtnCoord = getElementCenter(editBtn3Ref.current);
                if (editBtnCoord) {
                  setCursorPos({ x: editBtnCoord.x, y: editBtnCoord.y });
                }

                stepTimer = setTimeout(() => {
                  setIsCursorClicking(true);
                  setTimeout(() => {
                    setIsCursorClicking(false);
                    setEditingId("readme");
                    updateAction("readme", { owner: "Priya Patel", due: "Next sprint" });
                  }, 250);

                  // Step 5 (9.8s): Click Approve on Card 3
                  stepTimer = setTimeout(() => {
                    setCursorLabel('Committing to Kanban');
                    const approve3Coord = getElementCenter(approveBtn3Ref.current);
                    if (approve3Coord) {
                      setCursorPos({ x: approve3Coord.x, y: approve3Coord.y });
                    }

                    stepTimer = setTimeout(() => {
                      setIsCursorClicking(true);
                      setTimeout(() => {
                        setIsCursorClicking(false);
                        updateAction("readme", { status: "approved" });
                        setEditingId(null);
                      }, 250);

                      // Step 6 (11.8s): Reset and Loop
                      stepTimer = setTimeout(() => {
                        resetToInitial();
                        runStoryline();
                      }, 2000);
                    }, 400);
                  }, 1200);
                }, 400);
              }, 1800);
            }, 1800);
          }, 400);
        }, 1600);
      }, 2000);
    };

    runStoryline();

    return () => {
      clearTimeout(stepTimer);
      clearInterval(progressInterval);
    };
  }, [isAutoplay, getElementCenter, resetToInitial, updateAction]);

  return (
    <div
      id="demo"
      ref={containerRef}
      onMouseEnter={enterInteractiveMode}
      onMouseLeave={handleMouseLeave}
      className="scroll-mt-24 linear-3d-card relative overflow-hidden rounded-xl border border-white/15 border-t-white/30 bg-[#060608] shadow-2xl transition-all duration-300"
    >
      <div className="linear-rim-light" />

      {/* Notion-Style Animated Blue Cursor (Visible during Autoplay) */}
      <NotionCursor
        x={cursorPos.x}
        y={cursorPos.y}
        visible={isAutoplay}
        clicking={isCursorClicking}
        label={cursorLabel}
        role="ActionPulse AI"
      />

      {/* Window Titlebar & Controls */}
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 bg-[#0a0a0d] px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex shrink-0 gap-1.5">
            <i className="size-2 rounded-full bg-neutral-700" />
            <i className="size-2 rounded-full bg-neutral-700" />
            <i className="size-2 rounded-full bg-neutral-700" />
          </span>
          <span className="h-4 w-px shrink-0 bg-white/10" />
          <span className="truncate text-xs font-medium text-neutral-300">
            Live Preview <span className="text-neutral-600">/</span> Grounded Extraction Engine
          </span>
        </div>

        {/* Center / Right Control Hub */}
        <div className="flex items-center gap-2">
          {/* Autoplay / Interactive Mode Pill Badge */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono transition-colors ${
              isAutoplay
                ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {isAutoplay ? (
              <>
                <span className="size-1.5 rounded-full bg-blue-400 animate-ping" />
                <Play size={10} className="fill-current" />
                <span>Autoplay Demo</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-emerald-400" />
                <MousePointer size={10} />
                <span>Interactive Mode</span>
              </>
            )}
          </div>

          {/* Autoplay Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isAutoplay) {
                setIsAutoplay(false);
              } else {
                resetToInitial();
                setIsAutoplay(true);
              }
            }}
            className="h-7 px-2.5 text-xs text-neutral-300 hover:text-white border border-white/10 hover:bg-white/5"
          >
            {isAutoplay ? (
              <>
                <Pause size={11} className="mr-1 text-blue-400" /> Pause
              </>
            ) : (
              <>
                <Play size={11} className="mr-1 text-emerald-400" /> Play Video
              </>
            )}
          </Button>

          {/* Reset Demo Button */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset demo"
            onClick={resetToInitial}
            className="size-7 text-neutral-400 hover:text-white border border-white/10 hover:bg-white/5"
          >
            <RotateCcw size={11} />
          </Button>

          <span className="shrink-0 rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] uppercase text-white font-medium">
            Grounded v1.0
          </span>
        </div>
      </div>

      {/* Subtle Walkthrough Timeline Progress Bar */}
      {isAutoplay && (
        <div className="h-0.5 w-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex border-b border-white/10 lg:hidden" role="tablist" aria-label="Demo panels">
        <Button
          variant="ghost"
          role="tab"
          aria-selected={tab === "transcript"}
          onClick={() => {
            enterInteractiveMode();
            setTab("transcript");
          }}
          className={`h-11 w-1/2 rounded-none border-b-2 ${
            tab === "transcript"
              ? "border-white text-white"
              : "border-transparent text-neutral-400"
          }`}
        >
          Transcript
        </Button>
        <Button
          variant="ghost"
          role="tab"
          aria-selected={tab === "actions"}
          onClick={() => {
            enterInteractiveMode();
            setTab("actions");
          }}
          className={`h-11 w-1/2 rounded-none border-b-2 ${
            tab === "actions"
              ? "border-white text-white"
              : "border-transparent text-neutral-400"
          }`}
        >
          Extracted actions
        </Button>
      </div>

      {/* Two-Column Stage */}
      <div className="grid lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        {/* Left: Transcript Ingestion Panel */}
        <div
          ref={transcriptCardRef}
          className={`${
            tab === "transcript" ? "block" : "hidden"
          } lg:block lg:border-r border-white/10 bg-black`}
          role="tabpanel"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#08080a]">
            <div>
              <p className="font-mono text-[10px] uppercase text-neutral-500">01 / Input</p>
              <h3 className="mt-1 text-sm font-semibold text-white">Meeting transcript</h3>
            </div>
            <FileText size={17} className="text-neutral-500" />
          </div>

          <div className="min-h-[440px] space-y-1 p-3 sm:p-4 lg:min-h-[515px]">
            {transcript.map((line) => {
              const isMatched = activeQuoteId === line.id;
              return (
                <div
                  key={line.id}
                  className={`rounded-md border px-3 py-3 transition-all duration-300 ${
                    isMatched
                      ? "border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-950/20 ring-1 ring-emerald-500/30 -translate-y-0.5"
                      : "border-transparent hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{line.speaker}</span>
                    <span className="font-mono text-[10px] text-neutral-500">{line.time}</span>
                    {isMatched && (
                      <span className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase text-emerald-400 font-semibold bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                        <ShieldCheck size={10} /> Source matched
                      </span>
                    )}
                  </div>
                  <p className={`text-[13px] leading-5 ${isMatched ? "text-neutral-200" : "text-neutral-400"}`}>
                    “{line.text}”
                  </p>
                </div>
              );
            })}
          </div>

          <div className="border-t border-white/10 px-5 py-3 font-mono text-[10px] text-neutral-500 bg-[#08080a] flex items-center justify-between">
            <span>6 SEGMENTS · SAMPLE TRANSCRIPT</span>
            <span className="text-neutral-600">UNTRUSTED USER INPUT BOUNDARY</span>
          </div>
        </div>

        {/* Right: Extracted Actions & Review Panel */}
        <div
          className={`${
            tab === "actions" ? "block" : "hidden"
          } lg:block bg-[#08080a]`}
          role="tabpanel"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-[#0a0a0d]">
            <div>
              <p className="font-mono text-[10px] uppercase text-neutral-500">02 / Human review</p>
              <h3 className="mt-1 text-sm font-semibold text-white">AI extracted actions</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/10 bg-white/5 font-mono text-[10px] text-neutral-300">
                <Sparkles size={11} className="text-white" /> Grounded Triplet
              </span>
              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-mono text-[10px] text-amber-400 font-medium">
                {actions.filter((a) => a.status === "review").length} to review
              </span>
            </div>
          </div>

          <div className="space-y-3 p-3 sm:p-4 lg:min-h-[515px]">
            {actions.map((item) => {
              const isCard1 = item.id === "onboarding";
              const isCard3 = item.id === "readme";
              const isActive = activeQuoteId === item.id;
              const isEditing = editingId === item.id;

              return (
                <article
                  key={item.id}
                  ref={
                    isCard1 ? (card1Ref as any) : isCard3 ? (card3Ref as any) : null
                  }
                  onMouseEnter={() => {
                    enterInteractiveMode();
                    setActiveQuoteId(item.id);
                  }}
                  onMouseLeave={() => {
                    if (!isAutoplay) setActiveQuoteId(null);
                  }}
                  className={`relative rounded-lg border p-4 transition-all duration-300 ${
                    isActive
                      ? "border-white/50 bg-[#0f0f14] shadow-2xl shadow-black -translate-y-1 ring-1 ring-white/15"
                      : item.status === "approved"
                      ? "border-emerald-500/40 bg-[#0a0c0a]"
                      : item.id === "readme" && item.status === "review"
                      ? "border-amber-500/35 bg-[#0c0a06]"
                      : "border-white/10 bg-[#0a0a0c] hover:border-white/25 hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          aria-label="Task title"
                          value={item.title}
                          onChange={(e) => updateAction(item.id, { title: e.target.value })}
                          className="w-full rounded border border-white/20 bg-black px-2 py-1 text-sm text-white outline-none focus:border-white"
                        />
                      ) : (
                        <h4 className="text-[13px] font-semibold text-white sm:text-sm">{item.title}</h4>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded px-2 py-1 font-mono text-[9px] uppercase transition-colors ${
                        item.status === "approved"
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold"
                          : item.status === "rejected"
                          ? "bg-red-500/10 border border-red-500/30 text-red-400"
                          : "bg-amber-500/10 border border-amber-500/30 text-amber-400"
                      }`}
                    >
                      {item.status === "review" ? "Needs review" : item.status}
                    </span>
                  </div>

                  {/* Owner & Due Date Meta */}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    <label className="flex items-center gap-1.5 text-neutral-400">
                      <UserRound size={12} className="text-neutral-500" /> Owner:{" "}
                      {isEditing ? (
                        <input
                          aria-label="Owner"
                          placeholder="Assign owner"
                          value={item.owner}
                          onChange={(e) => {
                            updateAction(item.id, { owner: e.target.value });
                            setErrorId(null);
                          }}
                          className="w-28 rounded border border-white/20 bg-black px-1.5 py-1 text-white outline-none focus:border-white text-xs"
                        />
                      ) : (
                        <span className={item.owner ? "text-white font-medium" : "text-amber-400 font-semibold"}>
                          {item.owner || "Unassigned"}
                        </span>
                      )}
                    </label>
                    <label className="flex items-center gap-1.5 text-neutral-400">
                      <span className="font-mono text-[11px] text-neutral-500">↳</span> Due:{" "}
                      {isEditing ? (
                        <input
                          aria-label="Deadline"
                          placeholder="Set deadline"
                          value={item.due}
                          onChange={(e) => updateAction(item.id, { due: e.target.value })}
                          className="w-24 rounded border border-white/20 bg-black px-1.5 py-1 text-white outline-none focus:border-white text-xs"
                        />
                      ) : (
                        <span className="text-white">{item.due || "Not specified"}</span>
                      )}
                    </label>
                  </div>

                  {/* Uncertainty Banner (FR-08) */}
                  {!item.owner && item.status === "review" && (
                    <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                      <CircleHelp size={12} className="shrink-0" />
                      {errorId === item.id
                        ? "Assign an owner before approving"
                        : "Owner could not be determined from transcript (Uncertainty flagged)"}
                    </p>
                  )}

                  {/* Grounded Source Excerpt (FR-07) */}
                  <div className="mt-3 border-l-2 border-emerald-500/40 pl-2.5 text-[11px] leading-5 text-neutral-400">
                    <span className="mr-1 font-mono text-[10px] text-emerald-400 font-semibold">SOURCE</span> “{item.source}”
                  </div>

                  {/* Review Actions Bar */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                    {item.status === "review" ? (
                      <>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-neutral-400 hover:text-red-400"
                            onClick={() => {
                              enterInteractiveMode();
                              updateAction(item.id, { status: "rejected" });
                              setEditingId(null);
                            }}
                          >
                            Reject
                          </Button>
                          <Button
                            ref={isCard3 ? approveBtn3Ref : null}
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-neutral-400 hover:text-white"
                            onClick={() => {
                              enterInteractiveMode();
                              setEditingId(isEditing ? null : item.id);
                              setErrorId(null);
                            }}
                          >
                            <Pencil size={12} className="mr-1" />
                            {isEditing ? "Cancel" : "Edit"}
                          </Button>
                        </div>
                        <Button
                          ref={isCard1 ? approveBtn1Ref : isCard3 ? editBtn3Ref : null}
                          size="sm"
                          className="h-7 px-3 bg-white text-black hover:bg-neutral-200 font-medium transition-all"
                          onClick={() => {
                            enterInteractiveMode();
                            approveAction(item);
                          }}
                        >
                          <Check size={13} className="mr-1" />
                          {!item.owner ? "Assign & approve" : "Approve"}
                        </Button>
                      </>
                    ) : (
                      <span
                        className={`flex items-center gap-1.5 text-xs font-medium ${
                          item.status === "approved" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {item.status === "approved" ? (
                          <>
                            <CheckCircle2 size={14} /> Committed to Kanban{" "}
                            <span className="text-neutral-500 font-normal">· Synced to workspace</span>
                          </>
                        ) : (
                          <>
                            <X size={14} /> Suggestion rejected
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Interactive Prompt Helper */}
      <div className="border-t border-white/10 bg-[#08080a] px-4 py-2.5 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          {isAutoplay ? (
            <span className="flex items-center gap-1.5 text-blue-400 font-mono text-[11px]">
              <span className="size-2 rounded-full bg-blue-400 animate-ping" />
              Notion-style animated preview active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
              <span className="size-2 rounded-full bg-emerald-400" />
              You have control · Click or edit any action card
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-neutral-500 font-mono text-[10px]">
            {isAutoplay ? "Hover anywhere to interact" : "Idle for 8s resumes preview"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (isAutoplay) {
                enterInteractiveMode();
              } else {
                resetToInitial();
                setIsAutoplay(true);
              }
            }}
            className="h-6 px-2 text-[11px] text-neutral-300 hover:text-white"
          >
            {isAutoplay ? "Take control" : "Restart preview"} <ArrowRight size={10} className="ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
