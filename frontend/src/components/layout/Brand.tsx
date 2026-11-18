import { Link } from "react-router-dom";
import logoImg from "../../assets/logo.png";

/** Logo + wordmark, matching the landing page header. */
export default function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-2.5 text-white" aria-label="ActionPulse home">
      <img
        src={logoImg}
        alt="ActionPulse logo"
        className="size-8 rounded-full border border-white/20 object-cover shadow-sm"
      />
      <span className="text-[17px] font-semibold tracking-tight">ActionPulse</span>
    </Link>
  );
}
