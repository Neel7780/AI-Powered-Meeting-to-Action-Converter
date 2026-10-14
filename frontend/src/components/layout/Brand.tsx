import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

/** Logo + wordmark, matching the landing page header. */
export default function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-2.5 text-white" aria-label="ActionPulse home">
      <span className="grid size-8 place-items-center rounded-md border border-white/20 bg-white text-black shadow-sm">
        <Zap size={17} fill="currentColor" strokeWidth={2.5} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight">ActionPulse</span>
    </Link>
  );
}
