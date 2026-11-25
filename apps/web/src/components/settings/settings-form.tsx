"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  Bell,
  ChevronRight,
  Compass,
  FileText,
  KeyRound,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  LogOut,
  PanelBottom,
  PanelsTopLeft,
  Shapes,
  Shield,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { forgetPushTokenOnSignOut } from "@/lib/push-client";
import { playSound, setSoundsEnabled, soundsEnabled } from "@/lib/sounds";
import { setCardLayout, useCardLayout, type CardLayout } from "@/lib/card-layout";
import { setHeroStyle, useHeroStyle, type HeroStyle } from "@/lib/hero-style";
import { setNavStyle, useNavStyle, type NavStyle } from "@/lib/nav-style";
import { setSheetStyle, useSheetStyle, type SheetStyle } from "@/lib/sheet-style";
import { setDrawerStyle, useDrawerStyle, type DrawerStyle } from "@/lib/drawer-style";
import { setExploreIcons, useExploreIcons, type ExploreIconSet } from "@/lib/explore-icons";
import { setCategoryIcons, useCategoryIcons, type CategoryIconPrefs } from "@/lib/category-icons";
import { CardLayoutPicker, CARD_LAYOUT_LABELS } from "@/components/settings/card-layout-picker";
import { HeroStylePicker, HERO_STYLE_LABELS } from "@/components/settings/hero-style-picker";
import { NavStylePicker, NAV_STYLE_LABELS } from "@/components/settings/nav-style-picker";
import { SheetStylePicker, SHEET_STYLE_LABELS } from "@/components/settings/sheet-style-picker";
import { DrawerStylePicker, DRAWER_STYLE_LABELS } from "@/components/settings/drawer-style-picker";
import { ExploreIconsPicker, EXPLORE_ICON_LABELS } from "@/components/settings/explore-icons-picker";
import { CategoryIconsPicker, CATEGORY_ICON_STYLE_LABELS } from "@/components/settings/category-icons-picker";
import { SoundToggle } from "@/components/settings/sound-toggle";
import { PasswordSettings } from "@/components/settings/password-settings";
import { DeleteAccount } from "@/components/settings/delete-account";

interface Prefs {
  cardLayout: CardLayout;
  heroStyle: HeroStyle;
  categoryIcons: CategoryIconPrefs;
  sheetStyle: SheetStyle;
  drawerStyle: DrawerStyle;
  navStyle: NavStyle;
  exploreIcons: ExploreIconSet;
  sounds: boolean;
}

type PrefKey = keyof Prefs;
type Panel = "cardLayout" | "heroStyle" | "categoryIcons" | "sheetStyle" | "drawerStyle" | "navStyle" | "exploreIcons" | "password" | "delete";

const PANEL_INFO: Record<Panel, { title: string; hint: string }> = {
  cardLayout: {
    title: "Feed cards",
    hint: "How requests and offers look on your home feed. Tapping a card opens the same details either way.",
  },
  heroStyle: {
    title: "Home hero",
    hint: "How featured requests at the top of your home page look. Same requests and actions either way.",
  },
  categoryIcons: {
    title: "Category icons",
    hint: "The look of the category icons on your home page.",
  },
  sheetStyle: {
    title: "Post drawer",
    hint: "How the drawer for posting a request or offer looks. It works the same in every style.",
  },
  drawerStyle: {
    title: "Demand drawer",
    hint: "How the demand detail drawer looks when you tap a post card. Choose between default and modern peek style.",
  },
  navStyle: {
    title: "Bottom navigation",
    hint: "How the tab bar at the bottom of the screen looks. Same tabs either way.",
  },
  exploreIcons: {
    title: "Explore icons",
    hint: "The 3D icon style on the Explore page cards. Same layout and features either way.",
  },
  password: {
    title: "Password",
    hint: "Change your password, or reset it with a code sent to your email or verified WhatsApp number.",
  },
  delete: {
    title: "Delete account",
    hint: "Download a copy of your data, or permanently delete your account.",
  },
};

function samePref<K extends PrefKey>(key: K, a: Prefs[K], b: Prefs[K]): boolean {
  if (key === "categoryIcons") {
    const x = a as CategoryIconPrefs;
    const y = b as CategoryIconPrefs;
    if (x.style !== y.style) return false;
    const ids = new Set([...Object.keys(x.picks), ...Object.keys(y.picks)]);
    for (const id of ids) if ((x.picks[id] ?? 0) !== (y.picks[id] ?? 0)) return false;
    return true;
  }
  return a === b;
}

/**
 * Settings and privacy. Choices are kept as a draft and only applied when the
 * user taps Save — nothing changes in the app while they browse the options.
 */
export function SettingsForm() {
  const router = useRouter();

  // Saved values (live from each store).
  const cardLayout = useCardLayout();
  const heroStyle = useHeroStyle();
  const categoryIcons = useCategoryIcons();
  const sheetStyle = useSheetStyle();
  const drawerStyle = useDrawerStyle();
  const navStyle = useNavStyle();
  const exploreIcons = useExploreIcons();
  const [sounds, setSounds] = useState(true);
  useEffect(() => setSounds(soundsEnabled()), []);

  const saved: Prefs = useMemo(
    () => ({ cardLayout, heroStyle, categoryIcons, sheetStyle, drawerStyle, navStyle, exploreIcons, sounds }),
    [cardLayout, heroStyle, categoryIcons, sheetStyle, drawerStyle, navStyle, exploreIcons, sounds],
  );

  // Pending edits on top of the saved values.
  const [draft, setDraft] = useState<Partial<Prefs>>({});
  const [panel, setPanel] = useState<Panel | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const value: Prefs = { ...saved, ...draft };
  const changedKeys = (Object.keys(draft) as PrefKey[]).filter(
    (k) => draft[k] !== undefined && !samePref(k, draft[k] as never, saved[k] as never),
  );
  const dirty = changedKeys.length > 0;

  function update<K extends PrefKey>(key: K, v: Prefs[K]) {
    setDraft((d) => ({ ...d, [key]: v }));
  }

  // Warn before closing the tab / reloading with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      for (const key of changedKeys) {
        switch (key) {
          case "cardLayout":
            setCardLayout(value.cardLayout);
            break;
          case "heroStyle":
            setHeroStyle(value.heroStyle);
            break;
          case "categoryIcons":
            setCategoryIcons(value.categoryIcons);
            break;
          case "sheetStyle":
            setSheetStyle(value.sheetStyle);
            break;
          case "drawerStyle":
            setDrawerStyle(value.drawerStyle);
            break;
          case "navStyle":
            setNavStyle(value.navStyle);
            break;
          case "exploreIcons":
            setExploreIcons(value.exploreIcons);
            break;
          case "sounds":
            setSoundsEnabled(value.sounds);
            setSounds(value.sounds);
            break;
        }
      }
      setDraft({});
      playSound("success");
      toast.success("Settings saved.");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft({});
    setConfirmLeave(false);
  }

  function leavePage() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  function handleBack() {
    if (panel) return setPanel(null);
    if (dirty) return setConfirmLeave(true);
    leavePage();
  }

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await forgetPushTokenOnSignOut().catch(() => {});
    } finally {
      await signOut({ callbackUrl: "/login" });
    }
  }

  // Scroll to the top whenever a sub-page opens or closes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [panel]);

  const saveButton = (
    <button
      type="button"
      onClick={save}
      disabled={!dirty || saving}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition active:scale-95",
        dirty ? "bg-[#0A84FF] text-white" : "text-neutral-600",
      )}
    >
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Save
    </button>
  );

  const isPrefPanel = panel !== null && panel !== "password" && panel !== "delete";

  return (
    <main className="min-h-dvh bg-black px-4 pb-12 text-white">
      <PageHeader
        title={panel ? PANEL_INFO[panel].title : "Settings and privacy"}
        onBack={handleBack}
        action={panel === "password" || panel === "delete" ? null : saveButton}
      />

      {/* Unsaved changes strip — sticks right under the header so Save is always in reach */}
      {dirty && (
        <div className="sticky top-[calc(max(env(safe-area-inset-top),0.5rem)+3.1rem)] z-20 -mx-4 flex items-center gap-3 border-b border-[#0A84FF]/20 bg-[#0A84FF]/[0.12] px-4 py-2.5 backdrop-blur-xl">
          <p className="min-w-0 flex-1 text-[13px] text-neutral-200">
            {changedKeys.length === 1 ? "1 unsaved change" : `${changedKeys.length} unsaved changes`}
          </p>
          <button type="button" onClick={discard} className="text-[13px] font-medium text-neutral-400">
            Discard
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-full bg-[#0A84FF] px-3.5 py-1.5 text-[13px] font-semibold text-white active:scale-95"
          >
            Save changes
          </button>
        </div>
      )}

      {panel === null ? (
        <div className="pt-4">
          <Group title="Appearance">
            <Row
              icon={LayoutGrid}
              tint="from-sky-400 to-blue-600"
              label="Feed cards"
              value={CARD_LAYOUT_LABELS[value.cardLayout].title}
              changed={changedKeys.includes("cardLayout")}
              onClick={() => setPanel("cardLayout")}
            />
            <Row
              icon={LayoutTemplate}
              tint="from-indigo-400 to-violet-600"
              label="Home hero"
              value={HERO_STYLE_LABELS[value.heroStyle].title}
              changed={changedKeys.includes("heroStyle")}
              onClick={() => setPanel("heroStyle")}
            />
            <Row
              icon={Shapes}
              tint="from-amber-300 to-orange-500"
              label="Category icons"
              value={CATEGORY_ICON_STYLE_LABELS[value.categoryIcons.style].title}
              changed={changedKeys.includes("categoryIcons")}
              onClick={() => setPanel("categoryIcons")}
            />
            <Row
              icon={PanelsTopLeft}
              tint="from-emerald-400 to-teal-600"
              label="Post drawer"
              value={SHEET_STYLE_LABELS[value.sheetStyle].title}
              changed={changedKeys.includes("sheetStyle")}
              onClick={() => setPanel("sheetStyle")}
            />
            <Row
              icon={PanelsTopLeft}
              tint="from-pink-400 to-rose-600"
              label="Demand drawer"
              value={DRAWER_STYLE_LABELS[value.drawerStyle].title}
              changed={changedKeys.includes("drawerStyle")}
              onClick={() => setPanel("drawerStyle")}
            />
            <Row
              icon={PanelBottom}
              tint="from-fuchsia-400 to-purple-600"
              label="Bottom navigation"
              value={NAV_STYLE_LABELS[value.navStyle].title}
              changed={changedKeys.includes("navStyle")}
              onClick={() => setPanel("navStyle")}
            />
            <Row
              icon={Compass}
              tint="from-cyan-400 to-sky-600"
              label="Explore icons"
              value={EXPLORE_ICON_LABELS[value.exploreIcons].title}
              changed={changedKeys.includes("exploreIcons")}
              onClick={() => setPanel("exploreIcons")}
            />
          </Group>

          <Group title="Preferences" footer="Saved on this device.">
            <SoundToggle value={value.sounds} onChange={(v) => update("sounds", v)} />
            <Row
              icon={Bell}
              tint="from-red-400 to-rose-600"
              label="Notifications"
              href="/activity"
            />
          </Group>

          <Group title="Account & security">
            <Row icon={KeyRound} tint="from-neutral-400 to-neutral-600" label="Password" onClick={() => setPanel("password")} />
          </Group>

          <Group title="Legal">
            <Row icon={Shield} tint="from-blue-400 to-indigo-600" label="Privacy Policy" href="/privacy" />
            <Row icon={FileText} tint="from-slate-400 to-slate-600" label="Terms of Service" href="/terms" />
          </Group>

          <Group>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={signingOut}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/[0.04] disabled:opacity-60"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-white/[0.06] text-red-500">
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </span>
              <span className="flex-1 text-[15px] font-medium text-red-500">{signingOut ? "Logging out…" : "Log out"}</span>
            </button>
            <Row
              icon={Trash2}
              tint="from-red-500 to-red-700"
              label="Delete account"
              danger
              onClick={() => setPanel("delete")}
            />
          </Group>
        </div>
      ) : (
        <div className="pt-4">
          <p className="mb-5 px-1 text-[13.5px] leading-relaxed text-neutral-400">{PANEL_INFO[panel].hint}</p>

          {panel === "cardLayout" && <CardLayoutPicker value={value.cardLayout} onChange={(v) => update("cardLayout", v)} />}
          {panel === "heroStyle" && <HeroStylePicker value={value.heroStyle} onChange={(v) => update("heroStyle", v)} />}
          {panel === "categoryIcons" && (
            <CategoryIconsPicker value={value.categoryIcons} onChange={(v) => update("categoryIcons", v)} />
          )}
          {panel === "sheetStyle" && <SheetStylePicker value={value.sheetStyle} onChange={(v) => update("sheetStyle", v)} />}
          {panel === "drawerStyle" && <DrawerStylePicker value={value.drawerStyle} onChange={(v) => update("drawerStyle", v)} />}
          {panel === "navStyle" && <NavStylePicker value={value.navStyle} onChange={(v) => update("navStyle", v)} />}
          {panel === "exploreIcons" && (
            <ExploreIconsPicker value={value.exploreIcons} onChange={(v) => update("exploreIcons", v)} />
          )}
          {panel === "password" && <PasswordSettings />}
          {panel === "delete" && <DeleteAccount />}

          {isPrefPanel && (
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="h-11 flex-1 rounded-xl border border-neutral-800 text-[14px] font-semibold text-neutral-300 active:scale-[0.98]"
              >
                Done
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                className="h-11 flex-1 rounded-xl bg-[#0A84FF] text-[14px] font-semibold text-white transition active:scale-[0.98] disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                Save changes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leave with unsaved changes? */}
      {confirmLeave && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-title"
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmLeave(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-neutral-950 px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-6 ring-1 ring-white/10 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="unsaved-title" className="text-lg font-semibold">
              Save your changes?
            </h2>
            <p className="mt-1.5 text-sm text-neutral-400">
              You have {changedKeys.length === 1 ? "1 unsaved change" : `${changedKeys.length} unsaved changes`}. They
              won&apos;t apply unless you save them.
            </p>
            <button
              type="button"
              onClick={() => {
                save();
                setConfirmLeave(false);
                leavePage();
              }}
              className="mt-5 h-12 w-full rounded-full bg-[#0A84FF] text-[15px] font-semibold text-white active:scale-[0.98]"
            >
              Save and leave
            </button>
            <button
              type="button"
              onClick={() => {
                discard();
                leavePage();
              }}
              className="mt-2.5 h-12 w-full rounded-full bg-white/[0.06] text-[15px] font-semibold text-red-400 active:scale-[0.98]"
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={() => setConfirmLeave(false)}
              className="mt-2.5 w-full py-2 text-center text-sm text-neutral-500"
            >
              Keep editing
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Group({ title, footer, children }: { title?: string; footer?: string; children: ReactNode }) {
  return (
    <section className="mb-7">
      {title && <h2 className="mb-2 px-4 text-[12.5px] font-medium uppercase tracking-[0.06em] text-neutral-500">{title}</h2>}
      <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl bg-neutral-900/80 ring-1 ring-white/[0.05]">
        {children}
      </div>
      {footer && <p className="mt-2 px-4 text-[12px] text-neutral-600">{footer}</p>}
    </section>
  );
}

function Row({
  icon: Icon,
  tint,
  label,
  value,
  changed,
  danger,
  href,
  onClick,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  value?: string;
  changed?: boolean;
  danger?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br text-white", tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className={cn("min-w-0 flex-1 text-[15px] font-medium", danger ? "text-red-500" : "text-white")}>{label}</span>
      {value && (
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[14px] text-neutral-500">
          {changed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A84FF]" aria-label="Unsaved" />}
          {value}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
    </>
  );
  const cls = "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/[0.04]";
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  );
}
