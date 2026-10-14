import type { ReactNode } from "react";
import Brand from "../layout/Brand";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered card on the landing hero's grid backdrop; used by sign-in, sign-up and invite pages. */
export default function AuthShell({ eyebrow, title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-black px-4 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="hero-atmosphere pointer-events-none absolute inset-0 -z-10" />

      <header className="mx-auto flex h-16 w-full max-w-7xl items-center">
        <Brand />
      </header>

      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight text-white">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-neutral-400">{subtitle}</p>}
          </div>

          <div className="panel p-6 shadow-2xl sm:p-7">{children}</div>

          {footer && <p className="mt-6 text-center text-sm text-neutral-500">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
