import { Link } from "react-router-dom";
import logoImg from "../../assets/logo.png";

/** Logo + wordmark, matching the landing page header and dashboard theme. */
export default function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="dashboard-brand inline-flex shrink-0 items-center gap-2.5 text-white" aria-label="ActionPulse home">
      <img
        src={logoImg}
        alt="ActionPulse logo"
        className="dashboard-brand-mark size-8 rounded-full border border-white/20 object-cover shadow-sm"
      />
      <span className="dashboard-brand-wordmark text-[17px] font-semibold tracking-tight">ActionPulse</span>
    </Link>
  );
}
