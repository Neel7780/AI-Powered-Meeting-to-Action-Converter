import type { ReactNode } from "react";

const tones = {
  error: "border-red-500/25 bg-red-500/10 text-red-400",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
};

/** Inline form feedback, tinted like the landing page's status chips. */
export function Notice({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </p>
  );
}
