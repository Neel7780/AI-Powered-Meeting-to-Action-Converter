import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Zap,
  Play,
  Server,
  Database,
  Cpu,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ArchitectureNode {
  id: string;
  stepNumber: string;
  name: string;
  category: string;
  tech: string;
  icon: LucideIcon;
  description: string;
  specs: { label: string; value: string }[];
  zeroBudgetConstraint: string;
}

const nodes: ArchitectureNode[] = [
  {
    id: "browser",
    stepNumber: "01",
    name: "Client Interface",
    category: "FRONTEND SPA",
    tech: "React 18 + Vite + Tailwind",
    icon: Monitor,
    description: "Hosted on Vercel Hobby tier. Executes client-side transcript chunking and interacts via Supabase Anon Key.",
    specs: [
      { label: "Hosting", value: "Vercel Hobby" },
      { label: "Auth Client", value: "Supabase JS (Anon Key)" },
      { label: "Bundle Size", value: "< 280 KB Gzip" },
    ],
    zeroBudgetConstraint: "Zero paid CDN costs. Strict client-side status-only mutations.",
  },
  {
    id: "api",
    stepNumber: "02",
    name: "Application Gateway",
    category: "BACKEND SERVICE",
    tech: "FastAPI / Python 3.11+",
    icon: Server,
    description: "Hosted on Render Free Tier. Enforces JWT auth, prompt injection defense, and handles privileged mutations via Service-Role Key.",
    specs: [
      { label: "Runtime", value: "Render Web Service" },
      { label: "Auth Scope", value: "Bearer JWT Validation" },
      { label: "Disk Model", value: "Ephemeral (Stateless)" },
    ],
    zeroBudgetConstraint: "Zero paid servers. Auto-sleep handling with keep-alive ping.",
  },
  {
    id: "ai",
    stepNumber: "03",
    name: "AI Extraction Engine",
    category: "LLM PROVIDER",
    tech: "Gemini 3.1 Flash-Lite",
    icon: Cpu,
    description: "Free-tier Google GenAI API extracting tasks, owners, and deadlines grounded strictly in transcript quotes.",
    specs: [
      { label: "Model", value: "gemini-3.1-flash-lite" },
      { label: "Avg Latency", value: "140ms - 220ms" },
      { label: "Fallback", value: "Sarvam 105B" },
    ],
    zeroBudgetConstraint: "100% Free tier quotas. Zero OpenAI or Anthropic commercial tokens.",
  },
  {
    id: "db",
    stepNumber: "04",
    name: "Relational Persistence",
    category: "DATA & SECURITY",
    tech: "Supabase Postgres (Mumbai)",
    icon: Database,
    description: "Postgres database with Row-Level Security, automated schema triggers, audit logs, and transaction rollback.",
    specs: [
      { label: "Engine", value: "PostgreSQL 15" },
      { label: "Security", value: "Row-Level Security (RLS)" },
      { label: "Region", value: "ap-south-1 (Mumbai)" },
    ],
    zeroBudgetConstraint: "Supabase Free Tier (500MB DB). Strict schema check constraints.",
  },
];

export default function InteractiveArchitectureFlow() {
  const [selectedNodeId, setSelectedNodeId] = useState("api");
  const [tracingStep, setTracingStep] = useState<number | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[1];

  const runRequestTrace = () => {
    setTracingStep(0);
    const stepTimes = [700, 1500, 2400, 3200];
    stepTimes.forEach((delay, idx) => {
      setTimeout(() => {
        setTracingStep(idx);
        if (idx === stepTimes.length - 1) {
          setTimeout(() => setTracingStep(null), 1800);
        }
      }, delay);
    });
  };

  return (
    <div className="mt-12 rounded-2xl border border-white/10 bg-[#060608] p-5 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Top Header & Simulation Action */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            End-to-End System Topology
          </span>
          <h3 className="mt-1 text-lg font-medium tracking-tight text-white sm:text-xl">
            Zero-Budget, Backend-First Architecture
          </h3>
        </div>

        <button
          type="button"
          onClick={runRequestTrace}
          disabled={tracingStep !== null}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition shadow-lg",
            tracingStep !== null
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-white text-black hover:bg-neutral-200"
          )}
        >
          {tracingStep !== null ? (
            <>
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Tracing Node {tracingStep + 1}/04...</span>
            </>
          ) : (
            <>
              <Play size={13} fill="currentColor" />
              <span>Trace Request Lifecycle</span>
            </>
          )}
        </button>
      </div>

      {/* 4 Architecture Nodes in Horizontal Pipeline */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((node, idx) => {
          const isSelected = node.id === selectedNodeId;
          const isCurrentlyTraced = tracingStep === idx;
          const NodeIcon = node.icon;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNodeId(node.id)}
              className={cn(
                "group relative rounded-xl border p-4 text-left transition-all duration-300",
                isSelected
                  ? "border-emerald-500/40 bg-emerald-500/[0.07] ring-1 ring-emerald-500/30"
                  : "border-white/10 bg-[#040406] hover:border-white/20 hover:bg-white/[0.03]",
                isCurrentlyTraced && "ring-2 ring-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
              )}
            >
              {/* Header inside node */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-neutral-400">{node.stepNumber} / 04</span>
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-lg border text-xs transition",
                    isSelected
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 bg-white/5 text-neutral-400 group-hover:text-white"
                  )}
                >
                  <NodeIcon size={14} />
                </span>
              </div>

              {/* Node Title & Category */}
              <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                {node.category}
              </p>
              <h4 className="mt-0.5 text-sm font-medium tracking-tight text-white">{node.name}</h4>
              <p className="mt-1 text-xs text-neutral-400 font-mono">{node.tech}</p>

              {/* Pulsing indicator if active in trace */}
              {isCurrentlyTraced && (
                <div className="absolute top-2 right-2 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Node Deep-Dive Inspector */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedNode.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-6 rounded-xl border border-white/10 bg-[#040406] p-5 sm:p-6"
        >
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            {/* Left: Deep Dive & Specs */}
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400">
                  Node {selectedNode.stepNumber} Specification
                </span>
                <span className="font-mono text-[11px] text-neutral-400">{selectedNode.tech}</span>
              </div>

              <h4 className="mt-2 text-xl font-medium tracking-tight text-white">{selectedNode.name}</h4>
              <p className="mt-2 text-xs leading-6 text-neutral-300 sm:text-neutral-400">{selectedNode.description}</p>

              {/* Node Specs Table */}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-xs font-mono">
                {selectedNode.specs.map((spec) => (
                  <div key={spec.label} className="rounded border border-white/5 bg-black/60 p-2">
                    <span className="text-[10px] text-neutral-400 block">{spec.label}</span>
                    <span className="text-white font-medium text-xs mt-0.5 block truncate">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Security & Zero-Budget Guard Card */}
            <div className="rounded-xl border border-white/10 bg-black/80 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <span className="font-mono text-[10px] uppercase text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Architecture Rule
                </span>
                <span className="font-mono text-[10px] text-neutral-400">Zero-Budget Safe</span>
              </div>

              <p className="text-neutral-300 text-xs leading-5">
                {selectedNode.zeroBudgetConstraint}
              </p>

              <div className="rounded-lg border border-white/5 bg-[#06060a] p-2.5 font-mono text-[11px] text-neutral-400">
                <span className="text-neutral-400">Protocol: </span>
                {selectedNode.id === "browser" && "HTTPS / TLS 1.3 via Vercel Edge"}
                {selectedNode.id === "api" && "REST endpoints / OpenAPI 3.1"}
                {selectedNode.id === "ai" && "google-genai Python SDK"}
                {selectedNode.id === "db" && "PostgreSQL 15 via Supabase RPC"}
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-neutral-400">
        <p className="flex items-center gap-2">
          <Zap size={13} className="text-amber-400" />
          <span>Planned services: free SMTP email digests, one-tap WhatsApp links, and client PWA push.</span>
        </p>
        <span className="font-mono text-[11px] text-neutral-500">FastAPI + Supabase RLS</span>
      </div>
    </div>
  );
}
