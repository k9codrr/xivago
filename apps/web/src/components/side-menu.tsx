"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioLines,
  Bookmark,
  Coins,
  Crown,
  FileText,
  HelpCircle,
  LogOut,
  Wallet,
  Receipt,
  Rocket,
  Settings,
  User,
  Users,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { forgetPushTokenOnSignOut } from "@/lib/push-client";
import { Haptic, useHaptic } from "@/components/ui/haptic";
import { ThemeToggle } from "./theme-toggle";
import { AddCreditsModal } from "@/components/add-credits-modal";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const PANEL_SPRING = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;

export interface SideMenuUser {
  name: string;
  handle: string; // e.g. "kanishkb018" (no @)
  avatarUrl: string | null;
  followingCount: number;
  followerCount: number;
  isPro: boolean;
}

/* ── Avatar trigger that opens the side menu ── */
export function MenuButton({
  open,
  onClick,
  avatarUrl,
  name,
  className,
}: {
  open: boolean;
  onClick: () => void;
  avatarUrl: string | null;
  name: string;
  className?: string;
}) {
  return (
    <Haptic type="medium">
    <motion.button
      type="button"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-85",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl ?? "/icons/avatar-placeholder.svg"}
        alt={name}
        className="h-8 w-8 rounded-full bg-neutral-200 object-cover dark:bg-neutral-800"
      />
    </motion.button>
    </Haptic>
  );
}

/* ── Menu items config ── */
const MENU_ITEMS = [
  { href: "/profile", label: "Profile", icon: User },
  // { href: "/premium", label: "Premium", icon: Crown },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/explore/buy", label: "Orders", icon: Receipt },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/featured", label: "Feature a Post", icon: Sparkles },
  { href: "/credits", label: "Wallet", icon: Wallet },
];

const FOOTER_ITEMS = [
  { href: "/settings", label: "Settings and privacy", icon: Settings },
  // { href: "/help", label: "Help Center", icon: HelpCircle },
];

const MAX_JOINED_COMMUNITIES = 5;

/* Overrides the sidebar button defaults to keep the menu's large rounded rows. */
const ROW =
  "h-auto gap-5 rounded-full px-4 py-3 text-lg tracking-tight transition-colors [&_svg]:size-6 hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-900";
const ROW_TEXT =
  "font-normal text-neutral-700 hover:text-neutral-700 active:text-neutral-700 dark:text-neutral-300 dark:hover:text-neutral-300 dark:active:text-neutral-300";

interface JoinedCommunity {
  id: string;
  name: string;
  coverImage: string | null;
}

export function SideMenu({ user }: { user: SideMenuUser }) {
  const [open, setOpen] = React.useState(false);
  const [showCreditsModal, setShowCreditsModal] = React.useState(false);
  const [joinedCommunities, setJoinedCommunities] = React.useState<JoinedCommunity[]>([]);
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => setMounted(true), []);

  // Refetched on every open, so a community joined a moment ago shows up
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/communities?mine=1&limit=${MAX_JOINED_COMMUNITIES}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { communities: [] }))
      .then((data) => setJoinedCommunities(data.communities))
      .catch(() => {});
    return () => controller.abort();
  }, [open]);

  // Lock body scroll while the drawer is open
  React.useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tap = useHaptic("light");

  const [signingOut, setSigningOut] = React.useState(false);

  async function handleLogout() {
    if (signingOut) return;
    tap();
    setSigningOut(true);
    try {
      // Unlink this device's push token while the session still exists.
      await forgetPushTokenOnSignOut().catch(() => {});
    } finally {
      setOpen(false);
      await signOut({ callbackUrl: "/login" });
    }
  }

  function closeAndNavigate(href: string) {
    tap();
    setOpen(false);
    router.push(href);
  }

  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 !z-[9999] bg-black backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            role="dialog"
            aria-label="Menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={PANEL_SPRING}
            className="fixed inset-y-0 left-0 !z-[9999] flex w-[82%] max-w-[320px] flex-col bg-white dark:bg-black"
          >
            <SidebarProvider open={open} onOpenChange={setOpen} className="!min-h-0 h-full">
              {/* `none` renders the sidebar in place; this panel supplies the slide-in and backdrop on every screen size */}
              <Sidebar collapsible="none" className="h-full w-full bg-transparent text-inherit">
                {/* ── User header ── */}
                <SidebarHeader className="flex-row items-start justify-between gap-0 px-5 pb-0 pt-[max(env(safe-area-inset-top),1.25rem)]">
                  {/* <ThemeToggle/> */}
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.avatarUrl ?? "/icons/avatar-placeholder.svg"}
                      alt={user.name}
                      className="mb-3 h-12 w-12 rounded-full bg-neutral-200 object-cover dark:bg-neutral-800"
                    />
                    <p className="flex items-center gap-1 text-lg font-extrabold tracking-tight">
                      {user.name}
                      {user.isPro && <Crown className="h-4 w-4 fill-amber-400 text-amber-400" />}
                    </p>
                    <p className="text-sm text-neutral-500">@{user.handle}</p>
                    <p className="mt-3 flex gap-4 text-sm text-neutral-500">
                      <span>
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          {user.followingCount}
                        </span>{" "}
                        following
                      </span>
                      <span>
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          {user.followerCount}
                        </span>{" "}
                        {user.followerCount === 1 ? "follower" : "followers"}
                      </span>
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        setShowCreditsModal(true);
                      }}
                      className="mt-3 flex items-center gap-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-400/20 transition"
                    >
                      <Coins className="h-3.5 w-3.5" />
                      Wallet · Top up
                    </button>
                  </div>

                  {/* Close button */}
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </SidebarHeader>

                {/* ── Menu ── */}
                <SidebarContent className="no-scrollbar mt-4 gap-0 px-2 pb-4">
                  <SidebarMenu className="gap-0">
                    {MENU_ITEMS.map(({ href, label, icon: Icon }) => (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          onClick={() => closeAndNavigate(href)}
                          className={cn(
                            ROW,
                            "font-bold text-neutral-900 hover:text-neutral-900 active:text-neutral-900 dark:text-neutral-100 dark:hover:text-neutral-100 dark:active:text-neutral-100",
                          )}
                        >
                          <Icon strokeWidth={1.8} />
                          <span>{label}</span>
                        </SidebarMenuButton>

                        {href === "/communities" && joinedCommunities.length > 0 && (
                          <SidebarMenuSub className="ml-7 mr-2 gap-0.5 border-neutral-200 py-1 dark:border-neutral-800">
                            {joinedCommunities.map((community) => (
                              <SidebarMenuSubItem key={community.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  className="h-9 gap-2.5 rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100 dark:active:bg-neutral-900"
                                >
                                  <Link
                                    href={`/communities/${community.id}`}
                                    onClick={() => {
                                      tap();
                                      setOpen(false);
                                    }}
                                  >
                                    {community.coverImage ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={community.coverImage} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                                    ) : (
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-bold dark:bg-neutral-800">
                                        {community.name.charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                    <span className="text-sm font-medium">{community.name}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>

                  <hr className="my-3 border-neutral-100 dark:border-neutral-900" />

                  <SidebarMenu className="gap-0">
                    {FOOTER_ITEMS.map(({ href, label, icon: Icon }) => (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton onClick={() => closeAndNavigate(href)} className={cn(ROW, ROW_TEXT)}>
                          <Icon strokeWidth={1.8} />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}

                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => void handleLogout()}
                        disabled={signingOut}
                        className={cn(
                          ROW,
                          "font-normal text-red-500 hover:bg-red-50 hover:text-red-500 active:bg-red-50 active:text-red-500 dark:hover:bg-red-950/30 dark:active:bg-red-950/30",
                        )}
                      >
                        <LogOut strokeWidth={1.8} />
                        <span>{signingOut ? "Logging out…" : "Log out"}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Trigger — user avatar */}
      <MenuButton
        open={open}
        onClick={() => setOpen((v) => !v)}
        avatarUrl={user.avatarUrl}
        name={user.name}
      />
          {/* <ThemeToggle /> */}

      {/* On <body>: the header's backdrop-filter would otherwise trap this fixed panel inside it */}
      {mounted && createPortal(drawer, document.body)}
      <AddCreditsModal
        open={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </>
  );
}
