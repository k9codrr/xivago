"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  CreditCard,
  Flag,
  Sparkles,
  ShieldCheck,
  UserCog,
  UsersRound,
  LogOut,
  Shield,
  Lock,
  Zap,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const NAV_GROUPS = [
  {
    label: "General",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/demands", label: "Posts", icon: Package },
      { href: "/admin/roles", label: "Request roles", icon: UserCog },
      { href: "/admin/payments", label: "Payments", icon: CreditCard },
      { href: "/admin/privacy", label: "Privacy logs", icon: Lock },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/forum", label: "Feed", icon: Flag },
      { href: "/admin/communities", label: "Communities", icon: UsersRound },
      { href: "/admin/featured", label: "Featured", icon: Sparkles },
      { href: "/admin/boosting", label: "Boosting", icon: Zap },
      { href: "/admin/trust", label: "Trust", icon: ShieldCheck },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof Users;
  active: boolean;
  badge?: number;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={badge ? `${label} (${badge} waiting)` : label} className="h-9">
        <Link href={href} onClick={() => isMobile && setOpenMobile(false)}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge className="bg-red-600 text-white peer-hover/menu-button:text-white" aria-label={`${badge} waiting`}>
          {badge > 99 ? "99+" : badge}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}

const REFUND_POLL_MS = 60_000;

/** Open refund requests, refreshed every minute and when the tab regains focus. */
function usePendingRefundCount(pathname: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/admin/refund-requests?count=1")
        .then((res) => (res.ok ? res.json() : { count: 0 }))
        .then((data) => !cancelled && setCount(data.count ?? 0))
        .catch(() => {});
    load();
    const timer = setInterval(load, REFUND_POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [pathname]); // refresh after handling one on the payments page
  return count;
}

export function AdminShell({ defaultOpen, children }: { defaultOpen: boolean; children: React.ReactNode }) {
  const pathname = usePathname() || "/admin";
  const current = ALL_ITEMS.find((i) => isActive(pathname, i.href));
  const pendingRefunds = usePendingRefundCount(pathname);

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <Sidebar collapsible="icon">
          <SidebarHeader className="pt-[max(env(safe-area-inset-top),0.5rem)]">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild size="lg" tooltip="xivago Admin">
                  <Link href="/admin">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Shield className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold">xivago</span>
                      <span className="truncate text-xs text-muted-foreground">Admin console</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <SidebarContent>
            {NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        {...item}
                        active={isActive(pathname, item.href)}
                        badge={item.href === "/admin/payments" ? pendingRefunds : undefined}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Exit admin" className="h-9 text-muted-foreground">
                  <Link href="/">
                    <LogOut />
                    <span>Exit admin</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="min-w-0 bg-neutral-50 dark:bg-neutral-950">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-200 bg-white/80 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.625rem)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
            <SidebarTrigger className="-ml-1" />
            <div className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
            <nav className="flex min-w-0 items-center gap-1.5 text-sm">
              <span className="hidden text-neutral-500 sm:inline">Admin</span>
              <span className="hidden text-neutral-300 sm:inline dark:text-neutral-700">/</span>
              <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                {current?.label ?? "Admin"}
              </span>
            </nav>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
