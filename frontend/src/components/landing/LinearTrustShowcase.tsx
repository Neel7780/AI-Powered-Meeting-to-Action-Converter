import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  LockKeyhole,
  Shield,
  Fingerprint,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const securityPillars = [
  {
    id: "approval",
    icon: ClipboardCheck,
    title: "Human approval gate",
    summary: "AI proposals cannot become tasks without explicit signoff.",
    detail: "Every extracted action item must be reviewed and accepted by a workspace organiser. No autonomous writes or unconfirmed state mutations.",
    badge: "Organizer Review Gate",
  },
  {
    id: "commits",
    icon: LockKeyhole,
    title: "Verified task commits",
    summary: "Server-side mutation boundary via FastAPI Service-Role key.",
    detail: "Direct task creation from client browsers is blocked by Supabase Row-Level Security. Tasks are only committed after backend validation.",
    badge: "Backend-Only Mutation",
  },
  {
    id: "boundaries",
    icon: Shield,
    title: "Untrusted input boundaries",
    summary: "Transcripts isolated with strict prompt-injection guards.",
    detail: "Meeting audio transcripts and speaker notes are delimited within XML boundaries and instructed as untrusted user content to block jailbreak prompts.",
    badge: "Prompt Injection Defense",
  },
  {
    id: "privacy",
    icon: Fingerprint,
    title: "No-AI privacy mode",
    summary: "Confidential executive syncs bypass external LLM providers.",
    detail: "Enable privacy mode on sensitive meetings to store transcripts purely for manual review and playback without external API token transmission.",
    badge: "Zero-Retention Option",
  },
];

export default function LinearTrustShowcase() {
  const [activePillar, setActivePillar] = useState<string | null>(null);

  return (
    <div className="w-full">
      {/* 2 Big Linear-style Reference Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.32fr_1fr] gap-4 sm:gap-5">
        {/* =====================================================================
            CARD 1 (LEFT): Icy Lavender / Light Ice Blue (#D4E5FF -> #E9E4FF)
            ===================================================================== */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative min-h-[380px] sm:min-h-[420px] rounded-2xl sm:rounded-[22px] bg-gradient-to-br from-[#d4e5ff] via-[#dce8ff] to-[#e9e4ff] p-8 sm:p-10 lg:p-12 flex flex-col justify-between overflow-hidden shadow-xl"
        >
          {/* Faint Subtle Geometric SVG Watermark (matching reference OpenAI flower watermark) */}
          <div
            aria-hidden="true"
            className="absolute -right-12 top-1/2 -translate-y-1/2 w-[380px] h-[380px] pointer-events-none select-none text-black/[0.045]"
          >
            <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-full">
              <circle cx="100" cy="100" r="90" strokeDasharray="3 3" />
              <circle cx="100" cy="100" r="68" />
              <path d="M100 10 C 60 60, 60 140, 100 190" />
              <path d="M100 10 C 140 60, 140 140, 100 190" />
              <path d="M10 100 C 60 60, 140 60, 190 100" />
              <path d="M10 100 C 60 140, 140 140, 190 100" />
              <circle cx="100" cy="100" r="28" fill="currentColor" fillOpacity="0.03" />
            </svg>
          </div>

          {/* Top Quote */}
          <div className="relative z-10 max-w-xl">
            <blockquote className="text-2xl sm:text-3xl lg:text-[32px] font-medium tracking-tight text-black leading-[1.22]">
              “You’ll deliver commitments with absolute clarity, just because of the rigor that ActionPulse infuses into post-meeting execution.”
            </blockquote>
          </div>

          {/* Bottom Author Row */}
          <div className="relative z-10 mt-8 flex items-center gap-3.5">
            {/* Minimalist Logo Mark */}
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-black text-white shadow-sm">
              <ShieldCheck size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-sm font-medium tracking-tight text-black">Arjun Mehta</div>
              <div className="text-xs text-neutral-600">Staff Platform Engineer, DevCore</div>
            </div>
          </div>
        </motion.div>

        {/* =====================================================================
            CARD 2 (RIGHT): Electric Neon Lime-Yellow (#E4F222)
            ===================================================================== */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative min-h-[380px] sm:min-h-[420px] rounded-2xl sm:rounded-[22px] bg-[#e4f222] p-8 sm:p-10 lg:p-12 flex flex-col justify-between overflow-hidden shadow-xl"
        >
          {/* Top Quote */}
          <div className="relative z-10">
            <blockquote className="text-2xl sm:text-3xl lg:text-[32px] font-medium tracking-tight text-black leading-[1.22]">
              “Our follow-through speed doubled, and our security leads love that transcripts stay strictly isolated.”
            </blockquote>
          </div>

          {/* Bottom Author Row */}
          <div className="relative z-10 mt-8 flex items-center gap-3.5">
            {/* Minimalist Ramp-style curved logo mark */}
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-black text-[#e4f222] shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4 17C8.5 17 12 13.5 14 9L19 4L20 5L15 10C13 15 9 19 4 19V17Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <div>
              <div className="text-sm font-medium tracking-tight text-black">Sarah Lin</div>
              <div className="text-xs text-neutral-800">Head of Engineering, HyperScale</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Sub-bar below cards (matching Linear reference image layout) */}
      <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-neutral-400 px-1">
        <p>
          ActionPulse secures follow-through across <span className="text-white font-medium">10,000+ meeting commitments</span>. From agile squads to multi-tenant workspaces.
        </p>
        <button
          onClick={() => setActivePillar(activePillar ? null : "approval")}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-neutral-300 hover:text-white transition font-medium self-start sm:self-auto cursor-pointer"
        >
          <span>{activePillar ? "Hide security architecture" : "Explore security architecture"}</span>
          <ArrowRight size={14} className={cn("transition-transform", activePillar && "rotate-90")} />
        </button>
      </div>

      {/* Interactive 4 Security Pillars Grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {securityPillars.map((item) => {
          const isSelected = activePillar === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActivePillar(isSelected ? null : item.id)}
              className={cn(
                "group relative rounded-xl border p-5 cursor-pointer transition-all duration-200 select-none",
                isSelected
                  ? "border-[#e4f222] bg-[#10120d] shadow-lg shadow-[#e4f222]/5"
                  : "border-white/10 bg-[#090a0f] hover:border-white/20 hover:bg-[#0c0d14]"
              )}
            >
              {/* Pillar Header */}
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "grid size-8 place-items-center rounded-lg border transition",
                    isSelected
                      ? "border-[#e4f222]/40 bg-[#e4f222]/15 text-[#e4f222]"
                      : "border-white/10 bg-white/5 text-neutral-300 group-hover:text-white"
                  )}
                >
                  <item.icon size={16} />
                </div>
                <span
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                    isSelected
                      ? "border-[#e4f222]/30 bg-[#e4f222]/10 text-[#e4f222]"
                      : "border-white/10 bg-white/5 text-neutral-400"
                  )}
                >
                  {item.badge}
                </span>
              </div>

              {/* Title & Summary */}
              <h4 className="mt-3.5 text-sm font-medium tracking-tight text-white group-hover:text-white">
                {item.title}
              </h4>
              <p className="mt-1 text-xs leading-5 text-neutral-400">
                {item.summary}
              </p>

              {/* Expandable Detail */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="mt-3 pt-3 border-t border-white/10 text-[11px] leading-relaxed text-neutral-300 font-normal">
                      {item.detail}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
