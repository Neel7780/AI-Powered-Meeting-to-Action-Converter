import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  Check,
  Mail,
  MessageSquare,
  Terminal,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { World, type Position } from "@/components/ui/globe";

// =========================================================================
// 1. SUB-COMPONENT: Animated SVG Waves Background for Card 1
// =========================================================================
function AnimatedWavesBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Soft atmospheric gradient glow behind the waves */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[220px] bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-purple-500/10 blur-3xl opacity-70" />

      {/* Layered Smooth Moving SVG Waves */}
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 800 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="bentoWave1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.05" />
            <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#818cf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="bentoWave2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.05" />
            <stop offset="45%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="80%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Wave 1: Flowing cyan/indigo spline */}
        <motion.path
          d="M0 140 C 140 80, 240 190, 390 130 C 540 70, 660 180, 800 120"
          stroke="url(#bentoWave1)"
          strokeWidth="2"
          fill="none"
          animate={{
            d: [
              "M0 140 C 140 80, 240 190, 390 130 C 540 70, 660 180, 800 120",
              "M0 120 C 140 180, 240 80, 390 150 C 540 200, 660 90, 800 150",
              "M0 140 C 140 80, 240 190, 390 130 C 540 70, 660 180, 800 120",
            ],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Wave 2: Flowing emerald/cyan spline */}
        <motion.path
          d="M0 170 C 160 210, 290 110, 460 160 C 600 200, 690 120, 800 150"
          stroke="url(#bentoWave2)"
          strokeWidth="1.5"
          fill="none"
          animate={{
            d: [
              "M0 170 C 160 210, 290 110, 460 160 C 600 200, 690 120, 800 150",
              "M0 150 C 160 100, 290 200, 460 140 C 600 90, 690 190, 800 160",
              "M0 170 C 160 210, 290 110, 460 160 C 600 200, 690 120, 800 150",
            ],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Harmonic dotted guiding wave */}
        <motion.path
          d="M0 110 C 200 60, 330 160, 500 110 C 640 70, 710 150, 800 110"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="4 6"
          fill="none"
          animate={{
            d: [
              "M0 110 C 200 60, 330 160, 500 110 C 640 70, 710 150, 800 110",
              "M0 125 C 200 150, 330 80, 500 135 C 640 170, 710 80, 800 120",
              "M0 110 C 200 60, 330 160, 500 110 C 640 70, 710 150, 800 110",
            ],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );
}

// =========================================================================
// 2. GLOBE CONFIGURATION & ARCS for Card 3
// =========================================================================
const globeConfig = {
  pointSize: 4,
  globeColor: "#062056",
  showAtmosphere: true,
  atmosphereColor: "#FFFFFF",
  atmosphereAltitude: 0.1,
  emissive: "#062056",
  emissiveIntensity: 0.1,
  shininess: 0.9,
  polygonColor: "rgba(255,255,255,0.7)",
  ambientLight: "#38bdf8",
  directionalLeftLight: "#ffffff",
  directionalTopLight: "#ffffff",
  pointLight: "#ffffff",
  arcTime: 1000,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 19.076, lng: 72.8777 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
};

const colors = ["#06b6d4", "#3b82f6", "#6366f1"];
const sampleArcs: Position[] = [
  {
    order: 1,
    startLat: -19.885592,
    startLng: -43.951191,
    endLat: -22.9068,
    endLng: -43.1729,
    arcAlt: 0.1,
    color: colors[0],
  },
  {
    order: 1,
    startLat: 28.6139,
    startLng: 77.209,
    endLat: 3.139,
    endLng: 101.6869,
    arcAlt: 0.2,
    color: colors[1],
  },
  {
    order: 1,
    startLat: -19.885592,
    startLng: -43.951191,
    endLat: -1.303396,
    endLng: 36.852443,
    arcAlt: 0.5,
    color: colors[2],
  },
  {
    order: 2,
    startLat: 1.3521,
    startLng: 103.8198,
    endLat: 35.6762,
    endLng: 139.6503,
    arcAlt: 0.2,
    color: colors[1],
  },
  {
    order: 2,
    startLat: 51.5072,
    startLng: -0.1276,
    endLat: 3.139,
    endLng: 101.6869,
    arcAlt: 0.3,
    color: colors[0],
  },
  {
    order: 2,
    startLat: -15.785493,
    startLng: -47.909029,
    endLat: 36.162809,
    endLng: -115.119411,
    arcAlt: 0.3,
    color: colors[2],
  },
  {
    order: 3,
    startLat: -33.8688,
    startLng: 151.2093,
    endLat: 22.3193,
    endLng: 114.1694,
    arcAlt: 0.3,
    color: colors[0],
  },
  {
    order: 3,
    startLat: 21.3099,
    startLng: -157.8581,
    endLat: 40.7128,
    endLng: -74.006,
    arcAlt: 0.3,
    color: colors[1],
  },
  {
    order: 3,
    startLat: -6.2088,
    startLng: 106.8456,
    endLat: 51.5072,
    endLng: -0.1276,
    arcAlt: 0.3,
    color: colors[2],
  },
  {
    order: 4,
    startLat: 11.986597,
    startLng: 8.571831,
    endLat: -15.595412,
    endLng: -56.05918,
    arcAlt: 0.5,
    color: colors[0],
  },
  {
    order: 4,
    startLat: -34.6037,
    startLng: -58.3816,
    endLat: 22.3193,
    endLng: 114.1694,
    arcAlt: 0.7,
    color: colors[1],
  },
  {
    order: 4,
    startLat: 51.5072,
    startLng: -0.1276,
    endLat: 48.8566,
    endLng: -2.3522,
    arcAlt: 0.1,
    color: colors[2],
  },
  {
    order: 5,
    startLat: 14.5995,
    startLng: 120.9842,
    endLat: 51.5072,
    endLng: -0.1276,
    arcAlt: 0.3,
    color: colors[1],
  },
  {
    order: 5,
    startLat: 1.3521,
    startLng: 103.8198,
    endLat: -33.8688,
    endLng: 151.2093,
    arcAlt: 0.2,
    color: colors[0],
  },
  {
    order: 5,
    startLat: 34.0522,
    startLng: -118.2437,
    endLat: 48.8566,
    endLng: -2.3522,
    arcAlt: 0.2,
    color: colors[2],
  },
];

// =========================================================================
// 3. MAIN COMPONENT: InteractiveBentoFeatures
// =========================================================================
export default function InteractiveBentoFeatures() {
  // Card 2 Review Gate state
  const [reviewStatus, setReviewStatus] = useState<"pending" | "approved">("pending");
  const [reviewedItems, setReviewedItems] = useState<{ [id: string]: boolean }>({
    "item-1": true,
    "item-2": false,
  });

  // Card 4 Kanban quick state
  const [kanbanTasks, setKanbanTasks] = useState([
    { id: "k-1", code: "ACT-2704", title: "Patch Safari auth session cookies", status: "todo", owner: "Rahul", tag: "Auth" },
    { id: "k-2", code: "ACT-2703", title: "Wrap transcript parser in XML delimiter guards", status: "in_progress", owner: "Priya", tag: "Security" },
    { id: "k-3", code: "ACT-1487", title: "Generate 1-tap WhatsApp wa.me action links", status: "review", owner: "Ananya", tag: "WhatsApp" },
    { id: "k-4", code: "ACT-2074", title: "Deploy FastAPI backend on Render Free tier", status: "done", owner: "Rahul", tag: "Backend" },
  ]);

  const advanceKanbanTask = (taskId: string) => {
    setKanbanTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const nextStatus =
          task.status === "todo"
            ? "in_progress"
            : task.status === "in_progress"
            ? "review"
            : task.status === "review"
            ? "done"
            : "todo";
        return { ...task, status: nextStatus };
      })
    );
  };

  return (
    <div className="mt-14 w-full select-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* =====================================================================
            CARD 1 (TOP LEFT): 1-Tap Action Dispatch (Wave Background & 3 Sub-Cards)
            Span 7 on desktop (wide card)
            ===================================================================== */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-white/10 bg-[#090a0f] p-7 sm:p-9 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          {/* Animated Background Waves */}
          <AnimatedWavesBackground />

          {/* Top Visual: 3 Floating Sub-Cards connected with circuit beam */}
          <div className="relative z-10 pt-4 pb-8 sm:py-6">
            {/* Connecting Circuit Track line */}
            <div className="absolute top-1/2 left-10 right-10 -translate-y-1/2 h-[2px] bg-gradient-to-r from-cyan-500/20 via-emerald-500/40 to-indigo-500/20 hidden sm:block">
              {/* Traveling Pulse Particle */}
              <motion.div
                className="size-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#38bdf8]"
                animate={{
                  x: [0, 480, 0],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>

            {/* 3 Floating Sub-Cards */}
            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 items-center">
              {/* Sub-Card 1: Terminal Meeting Script */}
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-white/10 bg-[#121319] p-4 text-xs font-mono shadow-xl relative backdrop-blur-sm"
              >
                <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-white/5 text-neutral-500 text-[10px]">
                  <Terminal size={11} className="text-cyan-400" />
                  <span>transcript.vtt</span>
                </div>
                <div className="space-y-1 text-[11px] text-neutral-400 leading-snug">
                  <p className="text-neutral-500">$ actionpulse ingest</p>
                  <p className="text-cyan-300">✓ 4 speakers diarized</p>
                  <p className="text-white font-medium truncate">"Patch Safari cookies"</p>
                </div>
              </motion.div>

              {/* Sub-Card 2: Gemini 3.1 Flash-Lite AI Engine */}
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-white/10 bg-[#121319] p-4 text-center shadow-xl relative backdrop-blur-sm flex flex-col items-center justify-center min-h-[110px]"
              >
                <div className="relative mb-2">
                  <div className="size-9 rounded-xl border border-emerald-500/30 bg-emerald-500/15 grid place-items-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                    <Sparkles size={18} />
                  </div>
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <span className="text-xs font-medium text-white">Gemini 3.1</span>
                <span className="text-[10px] font-mono text-emerald-400">Flash-Lite AI</span>
              </motion.div>

              {/* Sub-Card 3: 1-Tap Multi-Channel Dispatch */}
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-white/10 bg-[#121319] p-4 text-center shadow-xl relative backdrop-blur-sm flex flex-col items-center justify-center min-h-[110px]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 grid place-items-center text-emerald-400">
                    <MessageSquare size={13} />
                  </div>
                  <div className="size-7 rounded-lg bg-blue-500/20 border border-blue-500/30 grid place-items-center text-blue-400">
                    <Mail size={13} />
                  </div>
                </div>
                <span className="text-xs font-medium text-white">wa.me & SMTP</span>
                <span className="text-[10px] text-emerald-300 font-mono flex items-center gap-1 justify-center">
                  <span>dispatched in 1-tap</span>
                  <span className="text-amber-300">✨</span>
                </span>
              </motion.div>
            </div>
          </div>

          {/* Bottom Text Description (Matching Reference Layout) */}
          <div className="relative z-10 pt-6 mt-4 border-t border-white/5">
            <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white">
              One-click action dispatch
            </h3>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 leading-relaxed font-normal">
              Turn 60-minute meeting transcripts into grounded tasks, assigned owners, and zero-cost WhatsApp & email dispatches in seconds.
            </p>
          </div>
        </div>

        {/* =====================================================================
            CARD 2 (TOP RIGHT): Intuitive Review Gate (Interactive Workflow Mockup)
            Span 5 on desktop (regular card)
            ===================================================================== */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-white/10 bg-[#090a0f] p-7 sm:p-9 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300">
          {/* Top Text Description (Matching Reference Layout) */}
          <div className="relative z-10">
            <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white">
              Intuitive review gate
            </h3>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 leading-relaxed font-normal">
              With our human review workflow, easily verify owners, due dates, and evidence quotes before syncing without complex steps.
            </p>
          </div>

          {/* Bottom Visual: Interactive Dashboard Card Mockup */}
          <div className="relative z-10 mt-6 pt-3">
            <div className="rounded-2xl border border-white/10 bg-[#121319] p-4 shadow-xl">
              {/* Header inside mockup */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-medium text-white text-[13px]">Review Queue</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-neutral-300">
                    Meeting #ACT-DEMO
                  </span>
                </div>
                <span className="font-mono text-[10px] text-emerald-400">99.4% grounded</span>
              </div>

              {/* Action items in review */}
              <div className="mt-3 space-y-2">
                {/* Item 1 */}
                <div
                  onClick={() =>
                    setReviewedItems((prev) => ({ ...prev, "item-1": !prev["item-1"] }))
                  }
                  className={cn(
                    "rounded-xl border p-2.5 transition cursor-pointer flex items-center justify-between text-xs",
                    reviewedItems["item-1"]
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-black/40 text-neutral-300 hover:border-white/20"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-white truncate text-[11.5px]">
                      Patch Safari auth session cookies
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                      <span>Owner: Rahul</span>
                      <span>·</span>
                      <span>Due: Wednesday</span>
                    </div>
                  </div>
                  <span className="size-5 rounded-md border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 grid place-items-center shrink-0">
                    <Check size={11} />
                  </span>
                </div>

                {/* Item 2: Ambiguous item flagged */}
                <div
                  onClick={() =>
                    setReviewedItems((prev) => ({ ...prev, "item-2": !prev["item-2"] }))
                  }
                  className={cn(
                    "rounded-xl border p-2.5 transition cursor-pointer flex items-center justify-between text-xs",
                    reviewedItems["item-2"]
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-200 hover:border-amber-500/50"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-white truncate text-[11.5px]">
                      Deploy staging Redis cluster
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-amber-300 font-mono">
                      <AlertTriangle size={10} />
                      <span>Uncertain owner flagged</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "size-5 rounded-md border grid place-items-center shrink-0",
                      reviewedItems["item-2"]
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/20 text-amber-300"
                    )}
                  >
                    {reviewedItems["item-2"] ? <Check size={11} /> : <span className="text-[9px] font-bold">?</span>}
                  </span>
                </div>
              </div>

              {/* Approval Bar */}
              <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-neutral-500 font-mono">Evidence linked: 2/2</span>
                <button
                  type="button"
                  onClick={() => {
                    setReviewStatus("approved");
                    setReviewedItems({ "item-1": true, "item-2": true });
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1",
                    reviewStatus === "approved"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white text-black hover:bg-neutral-200"
                  )}
                >
                  {reviewStatus === "approved" ? (
                    <>
                      <Check size={11} />
                      <span>Approved</span>
                    </>
                  ) : (
                    <span>Approve to Board</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            CARD 3 (BOTTOM LEFT): Global Edge Infrastructure (3D Interactive Three.js Arc Globe)
            Span 5 on desktop (matching reference layout)
            ===================================================================== */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-white/10 bg-[#090a0f] p-7 sm:p-9 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300 min-h-[420px]">
          {/* Top Text Description */}
          <div className="relative z-20 pointer-events-none">
            <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white">
              Hosting over the edge
            </h3>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 leading-relaxed font-normal">
              With our zero-budget stack, we sync your workspaces via Supabase Postgres in Mumbai and client-side PWA edge cache.
            </p>
          </div>

          {/* Bottom Visual: 3D Interactive Three.js Arc Globe */}
          <div className="absolute inset-x-0 -bottom-16 h-[340px] sm:h-[370px] z-10">
            <World data={sampleArcs} globeConfig={globeConfig} />
          </div>

          {/* Atmospheric bottom fade gradient */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/40 to-transparent pointer-events-none z-20" />
        </div>

        {/* =====================================================================
            CARD 4 (BOTTOM RIGHT): Real-Time Kanban Board (Wide Workspace Mockup)
            Span 7 on desktop (wide card, matching reference layout)
            ===================================================================== */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-white/10 bg-[#090a0f] p-7 sm:p-9 shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300 min-h-[380px]">
          {/* Top Text Description */}
          <div className="relative z-10">
            <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white">
              Real-time Kanban orchestration
            </h3>
            <p className="mt-2 text-sm sm:text-base text-neutral-400 leading-relaxed font-normal">
              Move confirmed commitments into active sprint cycles with live Postgres sync, primary assignees, and Row-Level Security data policies.
            </p>
          </div>

          {/* Bottom Visual: Mini Live Kanban Board Preview */}
          <div className="relative z-10 mt-6 pt-2">
            <div className="rounded-2xl border border-white/10 bg-[#121319] p-4 shadow-xl">
              {/* Board mini navigation header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  <span className="font-medium text-white">Sprint 1 Board</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-neutral-400">
                    Live RLS
                  </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-500 font-mono text-[10px]">
                  <span>Click card to advance</span>
                  <RefreshCw size={10} className="text-cyan-400 animate-spin" style={{ animationDuration: "8s" }} />
                </div>
              </div>

              {/* 4 Interactive Kanban Columns */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Column 1: To Do */}
                <div className="rounded-xl border border-white/5 bg-black/40 p-2">
                  <div className="flex items-center justify-between pb-1.5 text-[10px] text-neutral-400 border-b border-white/5">
                    <span className="font-mono uppercase font-semibold">To Do</span>
                    <span className="size-3.5 rounded-full bg-white/10 text-[9px] text-neutral-300 grid place-items-center">
                      {kanbanTasks.filter((t) => t.status === "todo").length}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5 min-h-[60px]">
                    {kanbanTasks
                      .filter((t) => t.status === "todo")
                      .map((t) => (
                        <motion.div
                          key={t.id}
                          layoutId={t.id}
                          onClick={() => advanceKanbanTask(t.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="rounded-lg border border-white/10 bg-[#16171e] p-1.5 cursor-pointer hover:border-cyan-500/40 transition shadow-sm"
                        >
                          <span className="font-mono text-[9px] text-cyan-400">{t.code}</span>
                          <p className="text-[10px] font-normal text-white line-clamp-1">{t.title}</p>
                        </motion.div>
                      ))}
                  </div>
                </div>

                {/* Column 2: In Progress */}
                <div className="rounded-xl border border-white/5 bg-black/40 p-2">
                  <div className="flex items-center justify-between pb-1.5 text-[10px] text-amber-300 border-b border-white/5">
                    <span className="font-mono uppercase font-semibold">In Prog</span>
                    <span className="size-3.5 rounded-full bg-amber-500/20 text-[9px] text-amber-300 grid place-items-center">
                      {kanbanTasks.filter((t) => t.status === "in_progress").length}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5 min-h-[60px]">
                    {kanbanTasks
                      .filter((t) => t.status === "in_progress")
                      .map((t) => (
                        <motion.div
                          key={t.id}
                          layoutId={t.id}
                          onClick={() => advanceKanbanTask(t.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="rounded-lg border border-amber-500/30 bg-[#16171e] p-1.5 cursor-pointer hover:border-amber-400/50 transition shadow-sm"
                        >
                          <span className="font-mono text-[9px] text-amber-400">{t.code}</span>
                          <p className="text-[10px] font-normal text-white line-clamp-1">{t.title}</p>
                        </motion.div>
                      ))}
                  </div>
                </div>

                {/* Column 3: Review */}
                <div className="rounded-xl border border-white/5 bg-black/40 p-2">
                  <div className="flex items-center justify-between pb-1.5 text-[10px] text-purple-300 border-b border-white/5">
                    <span className="font-mono uppercase font-semibold">Review</span>
                    <span className="size-3.5 rounded-full bg-purple-500/20 text-[9px] text-purple-300 grid place-items-center">
                      {kanbanTasks.filter((t) => t.status === "review").length}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5 min-h-[60px]">
                    {kanbanTasks
                      .filter((t) => t.status === "review")
                      .map((t) => (
                        <motion.div
                          key={t.id}
                          layoutId={t.id}
                          onClick={() => advanceKanbanTask(t.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="rounded-lg border border-purple-500/30 bg-[#16171e] p-1.5 cursor-pointer hover:border-purple-400/50 transition shadow-sm"
                        >
                          <span className="font-mono text-[9px] text-purple-400">{t.code}</span>
                          <p className="text-[10px] font-normal text-white line-clamp-1">{t.title}</p>
                        </motion.div>
                      ))}
                  </div>
                </div>

                {/* Column 4: Done */}
                <div className="rounded-xl border border-white/5 bg-black/40 p-2">
                  <div className="flex items-center justify-between pb-1.5 text-[10px] text-emerald-300 border-b border-white/5">
                    <span className="font-mono uppercase font-semibold">Done</span>
                    <span className="size-3.5 rounded-full bg-emerald-500/20 text-[9px] text-emerald-300 grid place-items-center">
                      {kanbanTasks.filter((t) => t.status === "done").length}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5 min-h-[60px]">
                    {kanbanTasks
                      .filter((t) => t.status === "done")
                      .map((t) => (
                        <motion.div
                          key={t.id}
                          layoutId={t.id}
                          onClick={() => advanceKanbanTask(t.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="rounded-lg border border-emerald-500/30 bg-[#16171e] p-1.5 cursor-pointer hover:border-emerald-400/50 transition shadow-sm"
                        >
                          <span className="font-mono text-[9px] text-emerald-400">{t.code}</span>
                          <p className="text-[10px] font-normal text-white line-clamp-1">{t.title}</p>
                        </motion.div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
