import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ClipboardCheck,
  Users,
  Check,
  X,
  Lock,
  Code2,
  Fingerprint,
} from "lucide-react";
import { CardSpotlight } from "@/components/landing/CardSpotlight";
import { cn } from "@/lib/utils";

type RoleType = "admin" | "organiser" | "member";

interface RoleDetails {
  id: RoleType;
  title: string;
  badge: string;
  summary: string;
  icon: typeof ShieldCheck;
  accentColor: string;
  capabilities: {
    label: string;
    allowed: boolean;
    rlsNote: string;
  }[];
  sqlPolicy: string;
}

const roles: RoleDetails[] = [
  {
    id: "admin",
    title: "Workspace Admin",
    badge: "FULL GOVERNANCE",
    summary: "Complete governance over workspace settings, membership invitations, audit trails, and data retention.",
    icon: ShieldCheck,
    accentColor: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
    capabilities: [
      { label: "Create & configure workspaces via database RPC", allowed: true, rlsNote: "create_workspace() security definer" },
      { label: "Invite & remove workspace members", allowed: true, rlsNote: "workspace_members admin policy" },
      { label: "Upload transcripts & trigger AI extraction", allowed: true, rlsNote: "Storage bucket RLS path match" },
      { label: "Approve / reject extracted action items", allowed: true, rlsNote: "Review gate check constraint" },
      { label: "Drag cards & update task status", allowed: true, rlsNote: "Assignee / workspace member policy" },
    ],
    sqlPolicy: `CREATE POLICY "Admins manage workspace members"
ON public.workspace_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
  )
);`,
  },
  {
    id: "organiser",
    title: "Meeting Organiser",
    badge: "WORKFLOW GATEWAY",
    summary: "Creates meetings, uploads raw transcripts, runs Gemini AI extractions, and serves as the human-in-the-loop review gate.",
    icon: ClipboardCheck,
    accentColor: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    capabilities: [
      { label: "Create & configure workspaces via database RPC", allowed: false, rlsNote: "Admins only" },
      { label: "Invite & remove workspace members", allowed: false, rlsNote: "Admins only" },
      { label: "Upload transcripts & trigger AI extraction", allowed: true, rlsNote: "Storage policy: role in ('admin', 'organiser')" },
      { label: "Approve / reject extracted action items", allowed: true, rlsNote: "reviewed_by stamp enforced" },
      { label: "Drag cards & update task status", allowed: true, rlsNote: "Workspace member policy" },
    ],
    sqlPolicy: `CREATE POLICY "Organisers manage meeting transcripts"
ON public.transcripts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = transcripts.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('admin', 'organiser')
  )
);`,
  },
  {
    id: "member",
    title: "Workspace Member",
    badge: "TASK EXECUTION",
    summary: "Participates in team workspaces, views meeting decisions, and updates assigned task progress directly on the Kanban board.",
    icon: Users,
    accentColor: "border-blue-500/30 text-blue-400 bg-blue-500/10",
    capabilities: [
      { label: "Create & configure workspaces via database RPC", allowed: false, rlsNote: "Admins only" },
      { label: "Invite & remove workspace members", allowed: false, rlsNote: "Admins only" },
      { label: "Upload transcripts & trigger AI extraction", allowed: false, rlsNote: "Organisers / Admins only" },
      { label: "Approve / reject extracted action items", allowed: false, rlsNote: "Review gate requires organiser" },
      { label: "Drag cards & update task status", allowed: true, rlsNote: "task_assignees user_id = auth.uid()" },
    ],
    sqlPolicy: `CREATE POLICY "Members update their assigned task status"
ON public.tasks
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignees ta
    WHERE ta.task_id = tasks.id
      AND ta.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Column-level security revokes title/deadline modification
  true
);`,
  },
];

export default function InteractiveRoleMatrix() {
  const [selectedRole, setSelectedRole] = useState<RoleType>("organiser");
  const [showSql, setShowSql] = useState(false);

  const activeRoleData = roles.find((r) => r.id === selectedRole) || roles[1];
  const Icon = activeRoleData.icon;

  return (
    <div className="mt-12 rounded-2xl border border-white/10 bg-[#060608] p-5 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Interactive Role-Based Access Control
          </span>
          <h3 className="mt-1 text-lg font-medium tracking-tight text-white sm:text-xl">
            Postgres Row-Level Security Enforced at Every Boundary
          </h3>
        </div>

        {/* Role Switcher Tabs */}
        <div className="flex rounded-xl border border-white/15 bg-black p-1">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedRole(r.id)}
              className={cn(
                "relative rounded-lg px-3.5 py-1.5 font-mono text-xs font-medium transition",
                selectedRole === r.id ? "text-white" : "text-neutral-400 hover:text-white"
              )}
            >
              {selectedRole === r.id && (
                <motion.div
                  layoutId="activeRoleTab"
                  className="absolute inset-0 rounded-lg bg-white/15 border border-white/20"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{r.title.replace("Workspace ", "")}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Role Summary & Permissions Inspector */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeRoleData.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]"
        >
          {/* Left Column: Role Details & Live Capability Checkmarks */}
          <CardSpotlight
            spotlightColor="rgba(255, 255, 255, 0.08)"
            spotlightSize={400}
            className="p-5 sm:p-6 border-white/10 bg-[#040406]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("grid size-10 place-items-center rounded-xl border", activeRoleData.accentColor)}>
                  <Icon size={20} />
                </div>
                <div>
                  <h4 className="text-base font-medium tracking-tight text-white sm:text-lg">{activeRoleData.title}</h4>
                  <span className="font-mono text-[10px] text-neutral-400">{activeRoleData.badge}</span>
                </div>
              </div>

              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-neutral-300">
                <Fingerprint size={12} className="text-emerald-400" />
                RLS Scoped
              </span>
            </div>

            <p className="mt-4 text-xs leading-6 text-neutral-300 sm:text-neutral-400">{activeRoleData.summary}</p>

            {/* Permission Checklist */}
            <div className="mt-6 space-y-2.5 border-t border-white/10 pt-5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                Live Capability Matrix
              </p>
              {activeRoleData.capabilities.map((cap) => (
                <div
                  key={cap.label}
                  className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-black/40 p-2.5 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    {cap.allowed ? (
                      <span className="grid size-4 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
                        <Check size={11} />
                      </span>
                    ) : (
                      <span className="grid size-4 place-items-center rounded-full bg-rose-500/20 text-rose-400 mt-0.5 shrink-0">
                        <X size={11} />
                      </span>
                    )}
                    <span className={cap.allowed ? "text-neutral-200" : "text-neutral-500"}>
                      {cap.label}
                    </span>
                  </div>

                  <span className="font-mono text-[10px] text-neutral-500 shrink-0 text-right">
                    {cap.rlsNote}
                  </span>
                </div>
              ))}
            </div>
          </CardSpotlight>

          {/* Right Column: Interactive UI Simulation + RLS Policy Viewer */}
          <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#040406] p-5 sm:p-6">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-mono text-[11px] text-neutral-400 uppercase">
                  Simulated Workspace Actions
                </span>
                <button
                  type="button"
                  onClick={() => setShowSql((prev) => !prev)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-400 hover:text-emerald-300"
                >
                  <Code2 size={12} />
                  {showSql ? "Hide SQL Policy" : "View SQL Policy"}
                </button>
              </div>

              {/* Action Buttons Mockup */}
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black p-3 text-xs">
                  <div>
                    <p className="font-medium text-white">Upload New Transcript (.vtt)</p>
                    <p className="text-[11px] text-neutral-500">Requires organiser or admin role</p>
                  </div>
                  {activeRoleData.id === "member" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 font-mono text-[10px] text-rose-400">
                      <Lock size={10} /> Denied (403)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-400">
                      <Check size={10} /> Permitted
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black p-3 text-xs">
                  <div>
                    <p className="font-medium text-white">Approve Action Item #104</p>
                    <p className="text-[11px] text-neutral-500">FastAPI backend review gate endpoint</p>
                  </div>
                  {activeRoleData.id === "member" ? (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-1 font-mono text-[10px] text-rose-400">
                      <Lock size={10} /> Denied (403)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-400">
                      <Check size={10} /> Permitted
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black p-3 text-xs">
                  <div>
                    <p className="font-medium text-white">Drag Kanban Card to 'In Progress'</p>
                    <p className="text-[11px] text-neutral-500">Client-side status column update</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-400">
                    <Check size={10} /> Permitted (All)
                  </span>
                </div>
              </div>

              {/* RLS SQL Policy Modal / Drawer */}
              {showSql && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 rounded-lg border border-emerald-500/25 bg-black p-3"
                >
                  <p className="font-mono text-[10px] uppercase text-emerald-400 mb-1.5">
                    Source: schema.sql Policy
                  </p>
                  <pre className="font-mono text-[10px] leading-4 text-neutral-300 overflow-x-auto">
                    {activeRoleData.sqlPolicy}
                  </pre>
                </motion.div>
              )}
            </div>

            <div className="mt-5 border-t border-white/10 pt-4 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>FastAPI Backend Verification</span>
              <span className="text-emerald-400">Zero Privilege Leak</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
