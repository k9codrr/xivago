import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Shared dark shell for the /niche category flow pages (matches the niche page). */
export function FlowPage({
  backHref,
  crumbs,
  title,
  subtitle,
  children,
}: {
  backHref: string;
  crumbs: { label: string; href: string }[];
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className="relative min-h-dvh bg-black pb-24 text-white antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Inter, system-ui, sans-serif' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
        <div className="absolute -left-24 -top-32 h-[320px] w-[320px] rounded-full bg-[#0A84FF]/20 blur-[120px]" />
      </div>

      <header className="relative px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Link
          href={backHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] backdrop-blur-2xl"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mt-5 flex flex-wrap items-center gap-1 text-[13px] text-[#EBEBF5]/60">
            {crumbs.map((c, i) => (
              <span key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <Link href={c.href} className="hover:text-white">
                  {c.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.025em]">{title}</h1>
        {subtitle && <div className="mt-1 text-[15px] text-[#EBEBF5]/60">{subtitle}</div>}
      </header>

      {children}
    </main>
  );
}

/** Tappable card used for sub category / provider / problem lists. */
export function FlowCard({ href, id, children }: { href: string; id?: string; children: ReactNode }) {
  return (
    <Link
      id={id}
      href={href}
      className="block scroll-mt-6 rounded-[20px] border border-white/[0.06] bg-[#1C1C1E] p-4 transition-colors hover:bg-[#2C2C2E] target:border-[#0A84FF]"
    >
      {children}
    </Link>
  );
}

export const tagHref = (tag: string) => `/categories?tag=${encodeURIComponent(tag)}`;
export const industryHref = (industry: string) => `/categories?industry=${encodeURIComponent(industry)}`;
