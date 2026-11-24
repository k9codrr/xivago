"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  BadgeCheck,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  Gift,
  ImagePlus,
  Loader2,
  MapPin,
  QrCode,
  Search,
  ShieldCheck,
  Tag,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES_DATA } from "@/lib/categories";
import {
  BUYER_TEAM_SIZES,
  EXPERIENCE_OPTIONS,
  LANGUAGE_OPTIONS,
  MAIN_CATEGORIES,
  MAX_INTERESTS,
  MAX_SERVICES_PER_SPECIALITY,
  MAX_SPECIALITIES,
  MAX_WORK_PHOTOS,
  PRICE_UNITS,
  PROVIDER_TEAM_SIZES,
  WORK_MODES,
  licenceFieldFor,
  sectionOf,
  stepsFor,
  type AccountType,
  type Goal,
  type StepId,
} from "@/lib/onboarding";
import { ImageUploadField } from "@/components/image-upload-field";
import { PushNotificationsCard } from "@/components/push-notifications-card";
import { PhoneChangeDrawer } from "@/components/phone-change-drawer";
import { Switch } from "@/components/ui/switch";

// ── State ────────────────────────────────────────────────────────────────

interface Form {
  name: string;
  ageConfirmed: boolean;
  accountType: AccountType;
  goal: Goal | null;
  interestCategoryIds: string[];
  companyName: string;
  jobTitle: string;
  teamSize: string;
  gstin: string;
  companyLogo: string;
  yearStarted: string;
  location: string;
  shareContactDefault: boolean;
  categorySubIds: string[];
  categoryProviderIds: string[];
  headline: string;
  experience: string;
  languages: string[];
  workModes: string[];
  startingPrice: string;
  priceUnit: string;
  licenceNumber: string;
  workPhotos: string[];
  website: string;
  avatarUrl: string;
  username: string;
  bio: string;
  whatsappAlerts: boolean;
  marketingEmails: boolean;
  referralCode: string;
}

const EMPTY: Form = {
  name: "",
  ageConfirmed: false,
  accountType: "INDIVIDUAL",
  goal: null,
  interestCategoryIds: [],
  companyName: "",
  jobTitle: "",
  teamSize: "",
  gstin: "",
  companyLogo: "",
  yearStarted: "",
  location: "",
  shareContactDefault: false,
  categorySubIds: [],
  categoryProviderIds: [],
  headline: "",
  experience: "",
  languages: [],
  workModes: [],
  startingPrice: "",
  priceUnit: PRICE_UNITS[0],
  licenceNumber: "",
  workPhotos: [],
  website: "",
  avatarUrl: "",
  username: "",
  bio: "",
  whatsappAlerts: true,
  marketingEmails: false,
  referralCode: "",
};

interface Prefill {
  name: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  companyName: string | null;
  companyLogo: string | null;
  website: string | null;
  location: string | null;
  phone: string | null;
  phoneVerified: boolean;
  ageConfirmed: boolean;
  hasReferrer: boolean;
  onboarded: boolean;
}

const DRAFT_KEY = "xv_onboarding_draft";
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Which screens own a field, for jumping back when the server rejects it (first one in the user's flow wins). */
const FIELD_STEP: Partial<Record<keyof Form, StepId[]>> = {
  name: ["S1"],
  ageConfirmed: ["S1"],
  companyName: ["B2", "P4"],
  gstin: ["B2", "P4"],
  yearStarted: ["P4"],
  location: ["B3", "P2"],
  categorySubIds: ["P1"],
  headline: ["P2"],
  website: ["P3"],
  username: ["F1"],
  bio: ["F1"],
};

/**
 * Post-signup onboarding. The steps, what's required and why are described in
 * lib/onboarding.ts. New accounts are sent here by middleware until they
 * finish; the profile is saved when they leave F2 (notifications), so the
 * verification and summary screens run on a saved account.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-white dark:bg-black" />}>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { update } = useSession();
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState<StepId>("S1");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneDrawerOpen, setPhoneDrawerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  // Load what the account already has, then any unfinished draft on this device.
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/onboarding");
      if (!res.ok) {
        toast.error("Could not load your details. Refresh to try again.");
        return;
      }
      const p = (await res.json()) as Prefill;
      if (p.onboarded && params.get("redo") !== "1") {
        router.replace("/");
        return;
      }
      setPrefill(p);
      setPhoneVerified(p.phoneVerified);
      let next: Form = {
        ...EMPTY,
        name: p.name ?? "",
        ageConfirmed: p.ageConfirmed,
        username: p.username ?? "",
        avatarUrl: p.avatarUrl ?? "",
        bio: p.bio ?? "",
        companyName: p.companyName ?? "",
        companyLogo: p.companyLogo ?? "",
        website: p.website ?? "",
        location: p.location ?? "",
      };
      let nextStep: StepId = "S1";
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as { form: Partial<Form>; step: StepId };
          next = { ...next, ...draft.form, ageConfirmed: p.ageConfirmed || Boolean(draft.form.ageConfirmed) };
          // Never resume past the save point; F3/F4 need a saved profile.
          nextStep = draft.step === "F3" || draft.step === "F4" ? "F2" : draft.step;
        }
      } catch {
        /* no draft */
      }
      setForm(next);
      setStep(nextStep);
    })();
  }, [params, router]);

  // Keep a draft so a refresh or app switch doesn't lose answers.
  useEffect(() => {
    if (!prefill || saved) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }));
    } catch {
      /* storage unavailable */
    }
  }, [form, step, prefill, saved]);

  const steps = useMemo(() => stepsFor(form.accountType, form.goal), [form.accountType, form.goal]);
  const index = steps.indexOf(step);
  const section = sectionOf(step);
  const sectionSteps = steps.filter((s) => s[0] === section.key);
  const sectionIndex = sectionSteps.indexOf(step);
  const provides = form.goal === "PROVIDE" || form.goal === "BOTH";

  function go(next: StepId) {
    setStep(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }
  const goNext = () => {
    const next = steps[index + 1];
    if (next) go(next);
  };
  const goBack = () => {
    const prev = steps[index - 1];
    if (prev && !saved) go(prev);
  };

  // Username availability, checked as they type on F1.
  useEffect(() => {
    if (step !== "F1") return;
    const u = form.username.trim().replace(/^@/, "").toLowerCase();
    if (!u || u === prefill?.username) {
      setUsernameStatus(u ? "ok" : "idle");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const res = await fetch(`/api/onboarding/username?u=${encodeURIComponent(u)}`);
      const data = (await res.json().catch(() => ({}))) as { available?: boolean; message?: string | null };
      setUsernameStatus(data.available ? "ok" : "taken");
      if (!data.available) setErrors((e) => ({ ...e, username: data.message ?? "That username is taken." }));
    }, 400);
    return () => clearTimeout(t);
  }, [form.username, step, prefill?.username]);

  /** Client-side check for the current step; returns false and shows errors if it can't continue. */
  function validate(s: StepId): boolean {
    const e: Partial<Record<keyof Form, string>> = {};
    if (s === "S1") {
      if (form.name.trim().length < 2) e.name = "Enter your full name";
      if (!form.ageConfirmed) e.ageConfirmed = "You must be 18 or older to use xivago";
    }
    if (s === "B2" || s === "P4") {
      if (!form.companyName.trim()) e.companyName = "Enter your business name";
      if (form.gstin.trim() && !GSTIN.test(form.gstin.trim().toUpperCase())) e.gstin = "Enter a valid 15-character GSTIN";
    }
    if (s === "P4" && form.yearStarted) {
      const y = Number(form.yearStarted);
      if (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear()) e.yearStarted = "Enter a valid year";
    }
    if (s === "B3" || s === "P2") {
      if (form.location.trim().length < 2) e.location = "Enter your city";
    }
    if (s === "P1" && form.categorySubIds.length === 0) e.categorySubIds = "Pick at least one speciality";
    if (s === "P2" && !form.headline.trim()) e.headline = "Add a one-line headline";
    if (s === "F1") {
      if (usernameStatus === "taken") e.username = errors.username ?? "That username is taken.";
      const u = form.username.trim().replace(/^@/, "");
      if (u && !/^[a-zA-Z0-9_]{3,30}$/.test(u)) e.username = "3–30 letters, numbers or underscores";
    }
    setErrors((prev) => ({ ...prev, ...e }));
    if (Object.keys(e).length) {
      toast.error(Object.values(e)[0]!);
      return false;
    }
    return true;
  }

  function onContinue() {
    if (!validate(step)) return;
    if (step === "F2") void save();
    else goNext();
  }

  /** Skip clears what the step would have saved, so "skip" really means "not now". */
  function onSkip() {
    if (step === "B1") set("interestCategoryIds", []);
    if (step === "P3") setForm((f) => ({ ...f, licenceNumber: "", workPhotos: [], website: prefill?.website ?? "" }));
    if (step === "F1") {
      setErrors((e) => ({ ...e, username: undefined }));
      setForm((f) => ({ ...f, username: prefill?.username ?? "", bio: prefill?.bio ?? "" }));
      setUsernameStatus("idle");
    }
    goNext();
  }

  async function save() {
    if (!form.goal) return go("S3");
    setSaving(true);
    try {
      const business = form.accountType === "BUSINESS";
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ageConfirmed: form.ageConfirmed,
          accountType: form.accountType,
          goal: form.goal,
          interestCategoryIds: form.goal === "PROVIDE" ? [] : form.interestCategoryIds,
          ...(business
            ? {
                companyName: form.companyName,
                jobTitle: form.jobTitle,
                teamSize: form.teamSize,
                gstin: form.gstin,
                companyLogo: form.companyLogo,
                yearStarted: form.yearStarted,
              }
            : {}),
          location: form.location,
          shareContactDefault: form.shareContactDefault,
          ...(provides
            ? {
                categorySubIds: form.categorySubIds,
                categoryProviderIds: form.categoryProviderIds,
                headline: form.headline,
                experience: form.experience,
                languages: form.languages,
                workModes: form.workModes,
                startingPrice: form.startingPrice,
                priceUnit: form.priceUnit,
                licenceNumber: form.licenceNumber,
                workPhotos: form.workPhotos,
                website: form.website,
              }
            : {}),
          avatarUrl: form.avatarUrl,
          username: form.username.trim() || undefined,
          bio: form.bio,
          whatsappAlerts: form.whatsappAlerts,
          marketingEmails: form.marketingEmails,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data?.error?.code as string | undefined;
        if (code === "USERNAME_TAKEN") {
          setErrors((e) => ({ ...e, username: data.error.message }));
          go("F1");
          toast.error(data.error.message);
          return;
        }
        // Validation errors name the field: show it on its screen and jump there.
        const fieldErrors = (data?.error?.details?.fieldErrors ?? {}) as Record<string, string[] | undefined>;
        const field = Object.keys(fieldErrors)[0] as keyof Form | undefined;
        const message = (field && fieldErrors[field]?.[0]) || data?.error?.message || "Could not save your profile. Try again.";
        if (field) {
          setErrors((e) => ({ ...e, [field]: message }));
          const target = FIELD_STEP[field]?.find((st) => steps.includes(st));
          if (target) go(target);
        }
        toast.error(message);
        return;
      }

      // Referral is separate: a bad code shouldn't undo a saved profile.
      if (form.referralCode.trim() && !prefill?.hasReferrer) {
        const ref = await fetch("/api/referrals/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: form.referralCode.trim() }),
        });
        const refData = await ref.json().catch(() => ({}));
        if (ref.ok) toast.success(`Referral applied: ${refData.welcomeCredits} bonus credits added.`);
        else toast.error(refData?.error?.message ?? "That referral code didn't work. You can add it later from Invite.");
      }

      setSaved(true);
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      void update(); // refresh the session so middleware sees the finished account
      go(phoneVerified ? "F4" : "F3");
    } finally {
      setSaving(false);
    }
  }

  function finish(href: string) {
    router.replace(href);
    router.refresh();
  }

  if (!prefill) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" aria-label="Loading" />
      </main>
    );
  }

  const firstName = form.name.trim().split(/\s+/)[0] ?? "";
  const showBack = index > 0 && !saved && step !== "F4";
  const skippable = step === "B1" || step === "P3" || step === "F1";

  return (
    <main className="flex h-dvh flex-col bg-white text-neutral-900 dark:bg-black dark:text-neutral-50">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden px-5 pt-[max(env(safe-area-inset-top),1rem)]">
        {step !== "F4" && (
          <>
            <div className="flex h-11 items-center gap-3">
              {showBack && (
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Back"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-50"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
              )}
              <span className="flex-1 text-[13px] text-neutral-500 dark:text-neutral-400">
                Step {sectionIndex + 1} of {sectionSteps.length} · {section.label}
              </span>
              {skippable && (
                <button type="button" onClick={onSkip} className="h-10 px-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  Skip
                </button>
              )}
            </div>
            <div className="mb-6 mt-3 flex gap-1" aria-hidden>
              {sectionSteps.map((s, i) => (
                <i
                  key={s}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i <= sectionIndex ? "bg-neutral-900 dark:bg-neutral-50" : "bg-neutral-200 dark:bg-neutral-800",
                  )}
                />
              ))}
            </div>
          </>
        )}

        <div ref={scrollRef} className="-mx-5 flex-1 overflow-y-auto px-5 pb-6">
          {step === "S1" && (
            <Screen
              icon={
                <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                  <span className="text-2xl font-extrabold text-brand-600 dark:text-brand-300">x</span>
                </div>
              }
              title="Welcome to xivago"
              sub="Real people, real needs. Let's set up your profile. It takes about 2 minutes, and you can change everything later."
            >
              <Field id="ob-name" label="Your full name" error={errors.name}
                why="Shown on your profile. Use the name on your ID, because verification checks it.">
                <input id="ob-name" className={inputCls(errors.name)} autoComplete="name" value={form.name}
                  onChange={(e) => set("name", e.target.value)} maxLength={80} />
              </Field>
              <label htmlFor="ob-age" className={cn(cardCls, "flex items-start gap-3 p-4", errors.ageConfirmed && "border-red-500")}>
                <input id="ob-age" type="checkbox" className="mt-0.5 h-[22px] w-[22px] shrink-0 accent-brand-600"
                  checked={form.ageConfirmed} disabled={prefill.ageConfirmed}
                  onChange={(e) => set("ageConfirmed", e.target.checked)} />
                <span>
                  <span className="mb-1 block text-[15px] font-semibold">I&apos;m 18 or older</span>
                  <span className="block text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">
                    {prefill.ageConfirmed
                      ? "You confirmed this when you signed up."
                      : "xivago is for adults only. The law needs us to confirm this before you continue."}
                  </span>
                </span>
              </label>
            </Screen>
          )}

          {step === "S2" && (
            <Screen title="Who are you here as?" sub="This decides what your profile shows. You can switch later in Settings.">
              <ChoiceCard selected={form.accountType === "INDIVIDUAL"} onClick={() => set("accountType", "INDIVIDUAL")}
                icon={<User className="h-5 w-5" />} tone="indigo" title="Just me"
                description="You use xivago as a person, under your own name."
                tags={["Freelancers", "Professionals", "Students", "Families"]} />
              <ChoiceCard selected={form.accountType === "BUSINESS"} onClick={() => set("accountType", "BUSINESS")}
                icon={<Briefcase className="h-5 w-5" />} tone="emerald" title="A business or team"
                description="You act for a company. Your profile shows the business name and logo."
                tags={["Companies", "Agencies", "Firms", "Clinics", "Studios"]} />
              <Why>Why we ask: business profiles get a company name, logo and team details, and can add GST details to invoices.</Why>
            </Screen>
          )}

          {step === "S3" && (
            <Screen title="What brings you to xivago?" sub="This sets what you see first. Everyone can post a request or an offer anytime.">
              {(
                [
                  { goal: "BUY", icon: <Search className="h-5 w-5" />, tone: "red", title: "I need services or products",
                    description: "Post what you need. Providers respond, and you choose who to talk to." },
                  { goal: "PROVIDE", icon: <Tag className="h-5 w-5" />, tone: "blue", title: "I offer services or products",
                    description: "Get found by people who need you, and respond to their requests." },
                  { goal: "BOTH", icon: <ArrowLeftRight className="h-5 w-5" />, tone: "emerald", title: "Both",
                    description: "You offer your own work and also hire others. We'll ask about both." },
                ] as const
              ).map((o) => (
                <ChoiceCard key={o.goal} selected={form.goal === o.goal} icon={o.icon} tone={o.tone} title={o.title}
                  description={o.description} chevron
                  onClick={() => {
                    set("goal", o.goal);
                    const next = stepsFor(form.accountType, o.goal)[3];
                    if (next) go(next);
                  }} />
              ))}
              <Why>Why we ask: buyers see providers and offers first; providers see open requests in their specialities first.</Why>
            </Screen>
          )}

          {step === "B1" && (
            <Screen title="What are you looking for?" sub={`Pick up to ${MAX_INTERESTS}. You'll still be able to post a request in any category.`}>
              <div className="flex flex-wrap gap-2">
                {MAIN_CATEGORIES.map((c) => {
                  const on = form.interestCategoryIds.includes(c.id);
                  return (
                    <Chip key={c.id} selected={on}
                      onClick={() => {
                        if (on) set("interestCategoryIds", form.interestCategoryIds.filter((id) => id !== c.id));
                        else if (form.interestCategoryIds.length >= MAX_INTERESTS) toast.error(`You can pick up to ${MAX_INTERESTS}.`);
                        else set("interestCategoryIds", [...form.interestCategoryIds, c.id]);
                      }}>
                      {c.label}
                    </Chip>
                  );
                })}
              </div>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400">{form.interestCategoryIds.length} of {MAX_INTERESTS} selected</p>
              <Why>Why we ask: we use these to fill your feed with relevant providers and offers. Nobody else sees them.</Why>
            </Screen>
          )}

          {(step === "B2" || step === "P4") && (
            <Screen badge="BUSINESS ACCOUNTS ONLY" title="About your business"
              sub={step === "B2" ? "So providers know who they're working with." : "Your business becomes the main name on your profile."}>
              <Field id="ob-co" label={step === "B2" ? "Company name" : "Business name"} error={errors.companyName}
                why={step === "B2"
                  ? "Shown on your requests in place of your personal name."
                  : "Shown as the main name on your profile, with you listed as the contact person."}>
                <input id="ob-co" className={inputCls(errors.companyName)} value={form.companyName} maxLength={100}
                  autoComplete="organization" onChange={(e) => set("companyName", e.target.value)} />
              </Field>
              {step === "B2" && (
                <Field id="ob-role" label="Your role" optional>
                  <input id="ob-role" className={inputCls()} value={form.jobTitle} maxLength={60}
                    placeholder="e.g. Founder, HR lead, Procurement" onChange={(e) => set("jobTitle", e.target.value)} />
                </Field>
              )}
              {step === "P4" && (
                <div>
                  <p className={labelCls}>Logo <Opt /></p>
                  <ImageUploadField kind="logo" value={form.companyLogo || undefined} onChange={(url) => set("companyLogo", url)}
                    label="Logo" shape="square" />
                </div>
              )}
              <ChipField label="Team size" optional
                why={step === "B2" ? "Helps providers judge the size of the job before they respond." : "Buyers with bigger jobs look for teams that can take them on."}
                options={step === "B2" ? BUYER_TEAM_SIZES : PROVIDER_TEAM_SIZES}
                value={form.teamSize} onChange={(v) => set("teamSize", form.teamSize === v ? "" : v)} />
              <div className={cn(step === "P4" && "grid grid-cols-2 gap-3")}>
                {step === "P4" && (
                  <Field id="ob-yr" label="Year started" optional error={errors.yearStarted}>
                    <input id="ob-yr" className={inputCls(errors.yearStarted)} inputMode="numeric" maxLength={4} placeholder="2019"
                      value={form.yearStarted} onChange={(e) => set("yearStarted", e.target.value.replace(/\D/g, ""))} />
                  </Field>
                )}
                <Field id="ob-gst" label="GSTIN" optional error={errors.gstin}
                  why={step === "B2" ? "Only printed on your xivago invoices so you can claim GST input credit. Never shown on your profile." : undefined}>
                  <input id="ob-gst" className={cn(inputCls(errors.gstin), "uppercase")} maxLength={15} placeholder="15 characters"
                    value={form.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} />
                </Field>
              </div>
              {step === "P4" && <Why>GSTIN is only printed on your xivago invoices. It&apos;s never shown on your profile.</Why>}
            </Screen>
          )}

          {step === "B3" && (
            <Screen title="Where are you?" sub="Many services happen in person, so your city matters.">
              <CityField value={form.location} error={errors.location} onChange={(v) => set("location", v)}
                why="Only to show people and posts near you. We save your city, not your exact spot." />
              <p className="mt-2 text-[13px] font-bold tracking-wider text-neutral-500 dark:text-neutral-400">YOUR PRIVACY</p>
              <ToggleRow id="ob-share" title="Show my phone on requests"
                description="Off means your number stays private. In-app chat always works. You can still choose per request."
                checked={form.shareContactDefault} onChange={(v) => set("shareContactDefault", v)} />
            </Screen>
          )}

          {step === "P1" && (
            <SpecialityPicker
              subIds={form.categorySubIds}
              providerIds={form.categoryProviderIds}
              error={errors.categorySubIds}
              onChange={(subIds, providerIds) => {
                setForm((f) => ({ ...f, categorySubIds: subIds, categoryProviderIds: providerIds }));
                setErrors((e) => ({ ...e, categorySubIds: undefined }));
              }}
            />
          )}

          {step === "P2" && (
            <Screen title="How do you work?">
              <Field id="ob-hl" label="Headline" error={errors.headline}
                why={`The first line people see under your name. ${60 - form.headline.length} characters left.`}>
                <input id="ob-hl" className={inputCls(errors.headline)} maxLength={60} value={form.headline}
                  placeholder="e.g. Counselling psychologist for students" onChange={(e) => set("headline", e.target.value)} />
              </Field>
              <CityField value={form.location} error={errors.location} onChange={(v) => set("location", v)}
                why="In-person providers are shown to people in and around this city." />
              <ChipField label="Experience" optional options={EXPERIENCE_OPTIONS} value={form.experience}
                onChange={(v) => set("experience", form.experience === v ? "" : v)} suffix=" yrs" />
              <MultiChipField label="Languages you work in" optional options={LANGUAGE_OPTIONS} value={form.languages}
                onChange={(v) => set("languages", v)} why="Many buyers ask for a provider who speaks their language." />
              <MultiChipField label="Where you work" optional options={WORK_MODES.map((m) => m.id)}
                labels={Object.fromEntries(WORK_MODES.map((m) => [m.id, m.label]))} value={form.workModes}
                onChange={(v) => set("workModes", v)} why="Online providers are shown across India; in-person ones to people near your city." />
              <Field id="ob-pr" label="Starting price" optional why="Helps buyers judge fit before they message you.">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">₹</span>
                    <input id="ob-pr" className={cn(inputCls(), "pl-7")} inputMode="numeric" placeholder="1,500"
                      value={form.startingPrice ? Number(form.startingPrice).toLocaleString("en-IN") : ""}
                      onChange={(e) => set("startingPrice", e.target.value.replace(/\D/g, "").slice(0, 8))} />
                  </div>
                  <select aria-label="Price unit" className={cn(inputCls(), "w-36")} value={form.priceUnit}
                    onChange={(e) => set("priceUnit", e.target.value)}>
                    {PRICE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </Field>
            </Screen>
          )}

          {step === "P3" && (() => {
            const licence = licenceFieldFor(form.categorySubIds);
            return (
              <Screen title="Show your credentials" sub="Optional, but proof of your work helps buyers choose you.">
                <Field id="ob-lic" label={licence.label} hint={licence.licensed ? "(recommended)" : "(optional)"}
                  why={licence.licensed ? "Your speciality is regulated, so buyers look for this first." : undefined}>
                  <input id="ob-lic" className={inputCls()} maxLength={40} placeholder={licence.placeholder}
                    value={form.licenceNumber} onChange={(e) => set("licenceNumber", e.target.value)} />
                  <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[12.5px] leading-snug text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Shown as <b>&quot;Self-declared&quot;</b> on your profile. xivago checks who you are, not your qualifications, so buyers are told to check them too.
                  </p>
                </Field>
                <WorkPhotos value={form.workPhotos} onChange={(v) => set("workPhotos", v)} />
                <Field id="ob-web" label="Website or portfolio link" optional>
                  <input id="ob-web" className={inputCls()} inputMode="url" placeholder="https://" value={form.website}
                    onChange={(e) => set("website", e.target.value)} />
                </Field>
              </Screen>
            );
          })()}

          {step === "F1" && (
            <Screen title="Put a face to your name" sub="A real photo helps people trust who they're talking to.">
              <div className="flex flex-col items-center gap-2">
                <ImageUploadField kind="avatar" value={form.avatarUrl || undefined} onChange={(url) => set("avatarUrl", url)}
                  label="Profile photo" shape="circle" />
                <Why center>A clear photo of your face. JPEG, PNG or WEBP, up to 5 MB.</Why>
              </div>
              <Field id="ob-un" label="Username" error={errors.username}>
                <div className={cn(inputCls(errors.username), "flex items-center gap-1")}>
                  <span className="text-neutral-500">@</span>
                  <input id="ob-un" className="h-full flex-1 bg-transparent outline-none" autoCapitalize="none" autoCorrect="off"
                    spellCheck={false} maxLength={30} value={form.username}
                    onChange={(e) => set("username", e.target.value.replace(/^@/, "").toLowerCase())} />
                  {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" aria-hidden />}
                </div>
                {usernameStatus === "ok" && form.username && !errors.username && (
                  <p className="mt-2 text-[12.5px] text-emerald-600 dark:text-emerald-400">Available. People can mention you as @{form.username}.</p>
                )}
              </Field>
              <Field id="ob-bio" label="Short bio" hint={`(optional, ${300 - form.bio.length} characters left)`}>
                <textarea id="ob-bio" rows={3} maxLength={300} className={cn(inputCls(), "h-auto resize-none py-3 leading-relaxed")}
                  placeholder="What you do, who you help, or what you're looking for" value={form.bio}
                  onChange={(e) => set("bio", e.target.value)} />
              </Field>
            </Screen>
          )}

          {step === "F2" && (
            <Screen title="How should we reach you?" sub="Each one is optional. Change them anytime in Settings.">
              <div className={cn(cardCls, "overflow-hidden")}>
                <PushNotificationsCard />
              </div>
              <ToggleRow id="ob-wa" title="WhatsApp alerts" description="Only when someone responds to your post or messages you and it sits unread."
                checked={form.whatsappAlerts} onChange={(v) => set("whatsappAlerts", v)} />
              <ToggleRow id="ob-em" title="News and offers by email" description="Product updates and occasional offers. Unsubscribe anytime."
                checked={form.marketingEmails} onChange={(v) => set("marketingEmails", v)} />
              {!prefill.hasReferrer && (
                <Field id="ob-ref" label="Referral code" optional why="If a friend invited you, you both get reward credits.">
                  <input id="ob-ref" className={cn(inputCls(), "uppercase")} autoComplete="off" maxLength={20} placeholder="e.g. KANI7QX2"
                    value={form.referralCode} onChange={(e) => set("referralCode", e.target.value.toUpperCase())} />
                </Field>
              )}
            </Screen>
          )}

          {step === "F3" && (
            <Screen icon={<ShieldCheck className="mb-4 h-10 w-10 text-emerald-500" aria-hidden />} title="Get verified to post"
              sub="Browsing is open to everyone. Verifying your phone is how xivago keeps fake profiles out, and lets people trust your requests and offers.">
              <VerifyStep n={1} title="Verify your phone"
                description={phoneVerified ? "Done. Your number stays private." : "A one-time code on WhatsApp. Your number stays private."}>
                {phoneVerified ? (
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <BadgeCheck className="h-4 w-4" aria-hidden /> Verified
                  </span>
                ) : (
                  <button type="button" onClick={() => setPhoneDrawerOpen(true)}
                    className="mt-2.5 h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white dark:bg-white dark:text-black">
                    Send code
                  </button>
                )}
              </VerifyStep>
              <VerifyStep n={2} title="Verify your identity with DigiLocker"
                description="Confirms your name matches a government ID. We never store your documents.">
                <span className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-bold tracking-wider text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  LAUNCHING SOON
                </span>
              </VerifyStep>
              <Why>We check who you are, not your qualifications. Anything a provider says about their skills is self-declared.</Why>
            </Screen>
          )}

          {step === "F4" && (
            <div className="flex flex-col pt-10">
              <div className="mb-5 grid h-16 w-16 place-items-center self-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <h1 className="mb-2 text-center text-[28px] font-extrabold leading-tight tracking-tight">
                You&apos;re all set{firstName ? `, ${firstName}` : ""}
              </h1>
              <p className="mb-6 text-center text-[15px] text-neutral-500 dark:text-neutral-400">Here&apos;s how other people see your profile.</p>
              <ProfilePreview form={form} phoneVerified={phoneVerified} />
              <div className="mt-5 flex flex-col gap-2.5">
                <NextLink href="/profile" icon={<QrCode className="h-5 w-5" />} title="Share your profile QR"
                  description="Anyone who scans it opens your profile." />
                <NextLink href="/invite" icon={<Gift className="h-5 w-5" />} title="Invite friends, earn credits"
                  description="You both get reward credits when a friend joins." />
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        {step !== "S3" && (
          <div className="flex flex-col gap-1 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
            {step === "F3" ? (
              <>
                <PrimaryButton onClick={() => (phoneVerified ? go("F4") : setPhoneDrawerOpen(true))}>
                  {phoneVerified ? "Continue" : "Verify now"}
                </PrimaryButton>
                {!phoneVerified && (
                  <button type="button" onClick={() => go("F4")} className="h-11 text-[15px] font-semibold text-neutral-600 dark:text-neutral-300">
                    I&apos;ll do it later
                  </button>
                )}
              </>
            ) : step === "F4" ? (
              <>
                <PrimaryButton onClick={() => finish(form.goal === "BUY" ? "/post" : "/")}>
                  {form.goal === "BUY" ? "Post your first request" : "See requests in your specialities"}
                </PrimaryButton>
                <button type="button" onClick={() => finish("/")} className="h-11 text-[15px] font-semibold text-neutral-600 dark:text-neutral-300">
                  Go to home
                </button>
              </>
            ) : (
              <PrimaryButton onClick={onContinue} disabled={saving || (step === "F1" && usernameStatus === "checking")}>
                {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-label="Saving" /> : step === "F2" ? "Save and continue" : "Continue"}
              </PrimaryButton>
            )}
          </div>
        )}
      </div>

      <PhoneChangeDrawer
        open={phoneDrawerOpen}
        onClose={() => setPhoneDrawerOpen(false)}
        onChanged={() => {
          setPhoneVerified(true);
          setPhoneDrawerOpen(false);
          void update();
          go("F4");
        }}
      />
    </main>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

const cardCls = "rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900";
const labelCls = "mb-2 block text-[13px] font-semibold text-neutral-800 dark:text-neutral-200";
const inputCls = (error?: string) =>
  cn(
    "h-12 w-full rounded-xl border bg-neutral-50 px-3.5 text-[15px] text-neutral-900 outline-none transition focus:border-brand-500 dark:bg-neutral-900 dark:text-neutral-50",
    error ? "border-red-500" : "border-neutral-200 dark:border-neutral-800",
  );

function Screen({ title, sub, badge, icon, children }: { title: string; sub?: string; badge?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      {icon}
      {badge && (
        <span className="mb-3 self-start rounded-lg bg-emerald-100 px-2 py-1 text-[11.5px] font-bold tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {badge}
        </span>
      )}
      <h1 className="mb-2 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      {sub ? <p className="mb-6 text-[15px] leading-relaxed text-neutral-500 dark:text-neutral-400">{sub}</p> : <div className="mb-4" />}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Opt() {
  return <span className="font-medium text-neutral-500 dark:text-neutral-400">(optional)</span>;
}

function Why({ children, center }: { children: ReactNode; center?: boolean }) {
  return <p className={cn("text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400", center && "text-center")}>{children}</p>;
}

function Field({ id, label, optional, hint, why, error, children }: {
  id: string; label: string; optional?: boolean; hint?: string; why?: string; error?: string; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}{" "}
        {optional && <Opt />}
        {hint && <span className="font-medium text-neutral-500 dark:text-neutral-400">{hint}</span>}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-[12.5px] text-red-600 dark:text-red-400">{error}</p> : why ? <div className="mt-2"><Why>{why}</Why></div> : null}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center rounded-full border px-3.5 text-[13.5px] transition",
        selected
          ? "border-neutral-900 bg-neutral-900 font-semibold text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-black"
          : "border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200",
      )}>
      {children}
    </button>
  );
}

function ChipField({ label, optional, why, options, value, onChange, suffix }: {
  label: string; optional?: boolean; why?: string; options: readonly string[]; value: string; onChange: (v: string) => void; suffix?: string;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className={labelCls}>{label} {optional && <Opt />}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} selected={value === o} onClick={() => onChange(o)}>
            {o}{suffix && /\d$/.test(o) ? suffix : ""}
          </Chip>
        ))}
      </div>
      {why && <div className="mt-2"><Why>{why}</Why></div>}
    </div>
  );
}

function MultiChipField({ label, optional, why, options, labels, value, onChange }: {
  label: string; optional?: boolean; why?: string; options: readonly string[]; labels?: Record<string, string>;
  value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className={labelCls}>{label} {optional && <Opt />}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <Chip key={o} selected={on} onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}>
              {labels?.[o] ?? o}
            </Chip>
          );
        })}
      </div>
      {why && <div className="mt-2"><Why>{why}</Why></div>}
    </div>
  );
}

const TONES = {
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
} as const;

function ChoiceCard({ selected, onClick, icon, tone, title, description, tags, chevron }: {
  selected: boolean; onClick: () => void; icon: ReactNode; tone: keyof typeof TONES; title: string; description: string;
  tags?: string[]; chevron?: boolean;
}) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition",
        selected
          ? "border-2 border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40"
          : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900",
      )}>
      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", TONES[tone])}>{icon}</span>
      <span className="flex-1">
        <span className="mb-1 block text-[17px] font-bold text-neutral-900 dark:text-neutral-50">{title}</span>
        <span className="block text-[13.5px] leading-snug text-neutral-600 dark:text-neutral-400">{description}</span>
        {tags && (
          <span className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-md bg-neutral-200/70 px-2 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{t}</span>
            ))}
          </span>
        )}
      </span>
      {chevron && <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />}
    </button>
  );
}

function ToggleRow({ id, title, description, checked, onChange }: {
  id: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className={cn(cardCls, "flex items-start gap-4 px-4 py-3.5")}>
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="mb-0.5 block text-[15px] font-semibold">{title}</span>
        <span className="block text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">{description}</span>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60">
      {children}
    </button>
  );
}

interface PlaceHit { id: string; name: string; secondary: string; full: string }

/** City input with suggestions (Indian cities/districts/states) and "use my current location". */
function CityField({ value, onChange, error, why }: { value: string; onChange: (v: string) => void; error?: string; why: string }) {
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!open || value.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/places?scope=region&q=${encodeURIComponent(value.trim())}`).catch(() => null);
      if (res?.ok) setHits(((await res.json()) as { places: PlaceHit[] }).places.slice(0, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [value, open]);

  function useCurrent() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device. Type your city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/places?reverse=1&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
          const place = res.ok ? ((await res.json()) as { places: PlaceHit[] }).places[0] : undefined;
          if (place) {
            onChange(place.secondary ? `${place.name}, ${place.secondary}`.slice(0, 100) : place.name);
            setOpen(false);
          } else toast.error("Couldn't find your city. Type it instead.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        toast.error("Location permission was denied. Type your city instead.");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  return (
    <div className="relative">
      <label htmlFor="ob-city" className={labelCls}>City</label>
      <input id="ob-city" className={inputCls(error)} autoComplete="address-level2" placeholder="e.g. Muzaffarnagar, Uttar Pradesh"
        value={value} maxLength={100}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && hits.length > 0 && (
        <ul className="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" className="flex w-full flex-col px-3.5 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange((h.secondary ? `${h.name}, ${h.secondary}` : h.name).slice(0, 100)); setOpen(false); }}>
                <span className="text-[15px]">{h.name}</span>
                {h.secondary && <span className="text-xs text-neutral-500">{h.secondary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={useCurrent} disabled={locating}
        className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-800 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200">
        {locating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
        Use my current location
      </button>
      {error ? <p className="mt-1.5 text-[12.5px] text-red-600 dark:text-red-400">{error}</p> : <div className="mt-2"><Why>{why}</Why></div>}
    </div>
  );
}

/** P1: industry chips, then up to 3 specialities (sub categories), each with optional services (provider types). */
function SpecialityPicker({ subIds, providerIds, error, onChange }: {
  subIds: string[]; providerIds: string[]; error?: string; onChange: (subIds: string[], providerIds: string[]) => void;
}) {
  const [mainId, setMainId] = useState<string>(() => subIds[0]?.split(".")[0] ?? MAIN_CATEGORIES[0]?.id ?? "");
  const main = CATEGORIES_DATA.find((c) => c.id === mainId);
  const servicesCount = providerIds.length;

  function toggleSub(id: string) {
    if (subIds.includes(id)) {
      onChange(subIds.filter((s) => s !== id), providerIds.filter((p) => !p.startsWith(`${id}.`)));
    } else if (subIds.length >= MAX_SPECIALITIES) {
      toast.error(`You can pick up to ${MAX_SPECIALITIES} specialities. Remove one first.`);
    } else {
      onChange([...subIds, id], providerIds);
    }
  }
  function toggleProvider(subId: string, id: string) {
    if (providerIds.includes(id)) onChange(subIds, providerIds.filter((p) => p !== id));
    else if (providerIds.filter((p) => p.startsWith(`${subId}.`)).length >= MAX_SERVICES_PER_SPECIALITY)
      toast.error(`Up to ${MAX_SERVICES_PER_SPECIALITY} services per speciality.`);
    else onChange(subIds, [...providerIds, id]);
  }

  return (
    <Screen title="What do you offer?" sub={`Pick your industry, then up to ${MAX_SPECIALITIES} specialities. Tap a speciality to choose the services you provide.`}>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="Industry">
        {MAIN_CATEGORIES.map((c) => {
          const picked = subIds.some((s) => s.split(".")[0] === c.id);
          return (
            <span key={c.id} className="shrink-0">
              <Chip selected={mainId === c.id} onClick={() => setMainId(c.id)}>
                {c.label}{picked ? " •" : ""}
              </Chip>
            </span>
          );
        })}
      </div>
      {main?.subCategories.map((sub) => {
        const on = subIds.includes(sub.id);
        return (
          <div key={sub.id}
            className={cn("rounded-2xl border p-3.5", on ? "border-2 border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-950/40" : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900")}>
            <button type="button" aria-pressed={on} onClick={() => toggleSub(sub.id)} className="flex w-full items-start gap-3 text-left">
              <span className={cn("mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-2",
                on ? "border-brand-600 bg-brand-600" : "border-neutral-400 dark:border-neutral-600")}>
                {on && <Check className="h-3.5 w-3.5 text-white" aria-hidden />}
              </span>
              <span className="flex-1">
                <span className="mb-0.5 block text-[15px] font-bold">{sub.name}</span>
                {sub.subtitle && <span className="block text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">{sub.subtitle}</span>}
              </span>
            </button>
            {on && sub.providers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 pl-[34px]" role="group" aria-label={`Services in ${sub.name}`}>
                {sub.providers.map((p) => {
                  const sel = providerIds.includes(p.id);
                  return (
                    <button key={p.id} type="button" aria-pressed={sel} onClick={() => toggleProvider(sub.id, p.id)}
                      className={cn("rounded-lg px-2.5 py-1.5 text-xs",
                        sel ? "bg-brand-600 text-white" : "bg-neutral-200/70 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300")}>
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {subIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {subIds.map((id) => {
            const sub = CATEGORIES_DATA.flatMap((c) => c.subCategories).find((s) => s.id === id);
            return (
              <button key={id} type="button" onClick={() => toggleSub(id)}
                className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                aria-label={`Remove ${sub?.name ?? id}`}>
                {sub?.name ?? id} <X className="h-3 w-3" aria-hidden />
              </button>
            );
          })}
        </div>
      )}
      <p className={cn("text-[13px]", error ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400")}>
        {error ?? `${subIds.length} of ${MAX_SPECIALITIES} specialities · ${servicesCount} service${servicesCount === 1 ? "" : "s"}`}
      </p>
      <Why>Why we ask: we show you requests in these specialities first, and show your profile to people searching for them.</Why>
    </Screen>
  );
}

/** P3: up to 6 photos of certificates or work, uploaded like avatars. */
function WorkPhotos({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return void toast.error("Only JPEG, PNG or WEBP images.");
    if (file.size > 5 * 1024 * 1024) return void toast.error("File is too large. Max 5 MB.");
    setUploading(true);
    try {
      const sign = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "portfolio", contentType: file.type, fileSizeBytes: file.size }),
      });
      const data = await sign.json();
      if (!sign.ok) return void toast.error(data?.error?.message ?? "Could not start upload.");
      const put = await fetch(data.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) return void toast.error("Upload failed. Please try again.");
      onChange([...value, data.publicUrl as string].slice(0, MAX_WORK_PHOTOS));
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <p className={labelCls}>Photos of your work <span className="font-medium text-neutral-500 dark:text-neutral-400">(up to {MAX_WORK_PHOTOS})</span></p>
      <div className="grid grid-cols-3 gap-2">
        {value.length < MAX_WORK_PHOTOS && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
            Add
          </button>
        )}
        {value.map((url) => (
          <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Your work" className="h-full w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((v) => v !== url))} aria-label="Remove photo"
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
    </div>
  );
}

function VerifyStep({ n, title, description, children }: { n: number; title: string; description: string; children: ReactNode }) {
  return (
    <div className={cn(cardCls, "flex gap-3.5 p-4")}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-bold text-white dark:bg-neutral-50 dark:text-black">{n}</span>
      <div className="flex-1">
        <p className="mb-0.5 text-[15px] font-semibold">{title}</p>
        <p className="text-[12.5px] leading-snug text-neutral-500 dark:text-neutral-400">{description}</p>
        {children}
      </div>
    </div>
  );
}

function ProfilePreview({ form, phoneVerified }: { form: Form; phoneVerified: boolean }) {
  const business = form.accountType === "BUSINESS" && form.companyName.trim();
  const displayName = business ? form.companyName.trim() : form.name.trim();
  const initials = displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const city = form.location.split(",")[0]?.trim();
  const provides = form.goal !== "BUY";
  const tags = provides
    ? form.categorySubIds.map((id) => CATEGORIES_DATA.flatMap((c) => c.subCategories).find((s) => s.id === id)?.name).filter(Boolean)
    : form.interestCategoryIds.map((id) => MAIN_CATEGORIES.find((c) => c.id === id)?.label).filter(Boolean);

  return (
    <div className={cn(cardCls, "p-4")}>
      <div className="flex items-center gap-3.5">
        {form.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-lg font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200">{initials}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[17px] font-bold">{displayName}</p>
          <p className="truncate text-[13px] text-neutral-500 dark:text-neutral-400">
            {form.username ? `@${form.username}` : ""}{form.username && city ? " · " : ""}{city}
          </p>
          {provides && form.headline && <p className="mt-0.5 truncate text-[13px]">{form.headline}</p>}
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        <span className={cn("rounded-md px-2 py-1 text-xs font-medium",
          phoneVerified ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300")}>
          {phoneVerified ? "Phone verified" : "Phone not verified"}
        </span>
        {tags.length > 0 && (
          <span className="rounded-md bg-brand-100 px-2 py-1 text-xs font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {tags.slice(0, 3).join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

function NextLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link href={href} className={cn(cardCls, "flex items-center gap-3.5 p-4")}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="block text-[12.5px] text-neutral-500 dark:text-neutral-400">{description}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-neutral-400" aria-hidden />
    </Link>
  );
}
