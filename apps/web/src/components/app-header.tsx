"use client";

import { useRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SideMenu, type SideMenuUser } from "@/components/side-menu";
import { NotificationBell } from "@/components/notification-bell";
import { useSearchDrawer } from "@/components/fast-scroll-search";
import { Glass, type GlassOptics } from "@samasante/liquid-glass";

const IOS26_BTN_OPTICS: Partial<GlassOptics> = {
  strength: 0.14,
  depth: 0.3,
  curvature: 0.55,
  bend: 0.25,
  bendWidth: 0.08,
  dispersion: 0.2,
  specular: 1,
  sheenAngle: 50,
  sheen: 0.95,
  sheenWidth: 2,
  glow: 0.15,
  frost: 2,
  saturate: 1.85,
  brightness: 0.04,
};

/* Liquid-glass surface shared by the floating nav controls */
const GLASS =
  "border border-white/[0.14] bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl backdrop-saturate-[1.8]";

const LOGO_URL = "/logo/xivago-transparent-favicon.png";

/**
 * Top bar: avatar (opens side menu) · centred logo · search + notifications.
 * Tapping search, or a double fast pull-down from the top of the page, grows the
 * search button into the search drawer.
 */
export function AppHeader({ user, className }: { user: SideMenuUser; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const search = useSearchDrawer(rootRef);

  return (
    <div ref={rootRef} className={cn("relative flex items-center justify-between", className)}>
      <div className={`flex h-11 w-11 items-center justify-center rounded-full ${GLASS} [&>button]:hover:bg-transparent`}>
        <SideMenu user={user} />
      </div>

      {/* Absolutely centred so the wider right-hand group doesn't push it off-centre */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_URL}
        alt="xivago"
        data-ptr-anchor
        className="pointer-events-none absolute left-1/2 h-[30px] w-[30px] -translate-x-1/2 bg-transparent object-contain opacity-95"
      />

      <div className="flex items-center gap-2">
        <Glass
          radius={22}
          optics={IOS26_BTN_OPTICS}
          className="rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.12)" }}
        >
          <button
            type="button"
            onClick={search.open}
            aria-label="Search"
            data-search-origin="header"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 active:scale-90"
          >
            <Search className="h-[20px] w-[20px] text-white" strokeWidth={2} />
          </button>
        </Glass>
        <Glass
          radius={22}
          optics={IOS26_BTN_OPTICS}
          className="rounded-full"
          style={{ background: "rgba(255, 255, 255, 0.12)" }}
        >
          <NotificationBell />
        </Glass>
      </div>

      {search.drawer}
    </div>
  );
}
