"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { profileEditSchema, type ProfileEditInput } from "@/lib/validation/profile";
import { FieldError } from "@/components/ui/field-error";
import { Switch } from "@/components/ui/switch";
import { ImageUploadField } from "@/components/image-upload-field";
import { ServicesPicker } from "@/components/services-picker";
import { CategoryFlowPicker } from "@/components/category-flow/category-flow-picker";
import { PushNotificationsCard } from "@/components/push-notifications-card";
import { PhoneChangeDrawer } from "@/components/phone-change-drawer";
import { cn } from "@/lib/utils";

const FORM_ID = "profile-edit-form";

/* ── Apple-style grouped list primitives ─────────────────────────────── */

function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section>
      {title && (
        <h2 className="mb-2 px-4 text-[13px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-[20px] border border-black/[0.04] bg-white/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.06] dark:bg-[#1C1C1E]/80 [&>*+*]:border-t [&>*+*]:border-black/[0.06] dark:[&>*+*]:border-white/[0.08]">
        {children}
      </div>
      {footer && (
        <p className="mt-2 px-4 text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">{footer}</p>
      )}
    </section>
  );
}

const fieldInput =
  "w-full min-w-0 bg-transparent text-[16px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-white dark:placeholder:text-neutral-500";

function FieldRow({
  id,
  label,
  error,
  children,
}: {
  id?: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-3 transition-colors focus-within:bg-emerald-500/[0.04]">
      <div className="flex items-center gap-3">
        <label
          htmlFor={id}
          className="w-28 shrink-0 text-[15px] font-medium text-neutral-900 dark:text-white"
        >
          {label}
        </label>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {error && (
        <div className="pl-[124px]">
          <FieldError message={error} />
        </div>
      )}
    </div>
  );
}

function PrefToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-neutral-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chatNotifications, setChatNotifications] = useState(true);
  const [slotNotifications, setSlotNotifications] = useState(true);
  const [followNotifications, setFollowNotifications] = useState(true);
  // Full stored prefs, so saving doesn't wipe keys this page doesn't edit.
  const [storedPrefs, setStoredPrefs] = useState<Record<string, unknown>>({});
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneDrawerOpen, setPhoneDrawerOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileEditInput>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: { services: [], categorySubIds: [], categoryProviderIds: [], categoryProblemIds: [] },
  });

  const bio = watch("bio") ?? "";

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/users/me");
      if (!res.ok) {
        toast.error("Could not load your profile.");
        setLoading(false);
        return;
      }
      const { profile } = await res.json();
      reset({
        name: profile.name ?? "",
        username: profile.username ?? undefined,
        bio: profile.bio ?? "",
        companyName: profile.companyName ?? "",
        companyLogo: profile.companyLogo ?? "",
        avatarUrl: profile.avatarUrl ?? "",
        website: profile.website ?? "",
        services: profile.services ?? [],
        location: profile.location ?? "",
        categorySubIds: profile.categorySubIds ?? [],
        categoryProviderIds: profile.categoryProviderIds ?? [],
        categoryProblemIds: profile.categoryProblemIds ?? [],
      });
      setPhone(profile.phone ?? null);
      setPhoneVerified(Boolean(profile.phone) && profile.metaLink?.whatsappId === profile.phone.replace(/^\+/, ""));
      // Opt-out model (see DECISIONS.md #42): absent/undefined means enabled.
      const prefs = (profile.metaLink?.notifPrefs ?? {}) as Record<string, unknown>;
      setStoredPrefs(prefs);
      setChatNotifications(prefs.chatMessages !== false);
      setSlotNotifications(prefs.slots !== false);
      setFollowNotifications(prefs.follows !== false);
      setLoading(false);
    })();
  }, [reset]);

  async function onSubmit(values: ProfileEditInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          notifPrefs: {
            ...storedPrefs,
            chatMessages: chatNotifications,
            slots: slotNotifications,
            follows: followNotifications,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not save your profile.");
        return;
      }
      toast.success("Profile updated.");
      router.push("/profile");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-[#F2F2F7] pb-16 text-neutral-900 dark:bg-black dark:text-white">
      {/* Soft ambient tint behind the top of the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(52,199,89,0.18),transparent)] dark:bg-[radial-gradient(60%_100%_at_50%_0%,rgba(52,199,89,0.14),transparent)]"
      />

      {/* ── Frosted nav bar ── */}
      <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)] border-b border-black/[0.06] bg-[#F2F2F7]/70 backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/[0.08] dark:bg-black/60">
        <div className="mx-auto grid h-12 max-w-xl grid-cols-[1fr_auto_1fr] items-center px-2">
          <Link
            href="/profile"
            className="justify-self-start rounded-full px-3 py-1.5 text-[17px] text-emerald-600 transition active:opacity-60 dark:text-emerald-400"
          >
            Cancel
          </Link>
          <h1 className="text-[17px] font-semibold tracking-tight">Edit Profile</h1>
          <button
            type="submit"
            form={FORM_ID}
            disabled={loading || submitting}
            className="flex items-center gap-1.5 justify-self-end rounded-full px-3 py-1.5 text-[17px] font-semibold text-emerald-600 transition active:opacity-60 disabled:opacity-40 dark:text-emerald-400"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Done
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-[15px] text-neutral-500">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          Loading your profile…
        </div>
      ) : (
        <form
          id={FORM_ID}
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="relative mx-auto max-w-xl space-y-8 px-4 pt-6"
        >
          {/* ── Photos ── */}
          <Group title="Photos">
            <div className="px-4 py-4">
              <Controller
                name="avatarUrl"
                control={control}
                render={({ field }) => (
                  <ImageUploadField
                    kind="avatar"
                    value={field.value}
                    onChange={field.onChange}
                    label="Profile photo"
                    shape="circle"
                  />
                )}
              />
            </div>
            <div className="px-4 py-4">
              <Controller
                name="companyLogo"
                control={control}
                render={({ field }) => (
                  <ImageUploadField
                    kind="logo"
                    value={field.value}
                    onChange={field.onChange}
                    label="Company logo"
                    shape="square"
                  />
                )}
              />
            </div>
          </Group>

          {/* ── About ── */}
          <Group title="About">
            <FieldRow id="name" label="Name" error={errors.name?.message}>
              <input
                id="name"
                placeholder="Full name"
                aria-invalid={Boolean(errors.name)}
                className={fieldInput}
                {...register("name")}
              />
            </FieldRow>
            <FieldRow id="username" label="Username" error={errors.username?.message}>
              <input
                id="username"
                placeholder="your_handle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.username)}
                className={fieldInput}
                {...register("username")}
              />
            </FieldRow>
            <FieldRow id="companyName" label="Company" error={errors.companyName?.message}>
              <input
                id="companyName"
                placeholder="Company name"
                aria-invalid={Boolean(errors.companyName)}
                className={fieldInput}
                {...register("companyName")}
              />
            </FieldRow>
            <div className="px-4 py-3 transition-colors focus-within:bg-emerald-500/[0.04]">
              <label htmlFor="bio" className="text-[15px] font-medium text-neutral-900 dark:text-white">
                Bio
              </label>
              <textarea
                id="bio"
                rows={3}
                maxLength={300}
                placeholder="Tell people what you do"
                aria-invalid={Boolean(errors.bio)}
                className={cn(fieldInput, "mt-1.5 resize-none leading-relaxed")}
                {...register("bio")}
              />
              <div className="flex items-center justify-between">
                <FieldError message={errors.bio?.message} />
                <span className="ml-auto text-[12px] tabular-nums text-neutral-400">{bio.length}/300</span>
              </div>
            </div>
          </Group>

          {/* ── Contact ── */}
          <Group
            title="Contact"
            footer="Your phone number stays private — it's only shown when you opt in on a specific request."
          >
            <FieldRow id="website" label="Website" error={errors.website?.message}>
              <input
                id="website"
                inputMode="url"
                placeholder="yourcompany.com"
                aria-invalid={Boolean(errors.website)}
                className={fieldInput}
                {...register("website")}
              />
            </FieldRow>
            <FieldRow label="Phone">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("min-w-0 truncate text-[16px]", !phone && "text-neutral-400 dark:text-neutral-500")}>
                  {phone ?? "Not added"}
                  {phoneVerified && <span className="ml-2 text-[12px] font-medium text-emerald-500">Verified</span>}
                </span>
                <button
                  type="button"
                  onClick={() => setPhoneDrawerOpen(true)}
                  className="shrink-0 text-[15px] font-medium text-emerald-600 dark:text-emerald-400"
                >
                  {!phone ? "Add" : phoneVerified ? "Change" : "Verify"}
                </button>
              </div>
            </FieldRow>
            <FieldRow id="location" label="Location" error={errors.location?.message}>
              <input
                id="location"
                placeholder="City, State"
                aria-invalid={Boolean(errors.location)}
                className={fieldInput}
                {...register("location")}
              />
            </FieldRow>
          </Group>

          {/* ── Services ── */}
          <Group title="Services">
            <div className="p-4">
              <Controller
                name="services"
                control={control}
                render={({ field }) => (
                  <ServicesPicker value={field.value ?? []} onChange={field.onChange} />
                )}
              />
              <FieldError message={errors.services?.message as string | undefined} />
            </div>
          </Group>

          {/* ── What you offer: Sub Category -> Provider type -> Problems ── */}
          <Group title="What you offer" footer="People find you by sub-category, service and the common needs you help with.">
            <div className="p-4">
              <CategoryFlowPicker
                value={{
                  categorySubIds: watch("categorySubIds") ?? [],
                  categoryProviderIds: watch("categoryProviderIds") ?? [],
                  categoryProblemIds: watch("categoryProblemIds") ?? [],
                }}
                onChange={(next) => {
                  setValue("categorySubIds", next.categorySubIds, { shouldDirty: true });
                  setValue("categoryProviderIds", next.categoryProviderIds, { shouldDirty: true });
                  setValue("categoryProblemIds", next.categoryProblemIds, { shouldDirty: true });
                }}
              />
              <FieldError
                message={
                  (errors.categorySubIds?.message ??
                    errors.categoryProviderIds?.message ??
                    errors.categoryProblemIds?.message) as string | undefined
                }
              />
            </div>
          </Group>

          {/* ── Notifications ── */}
          <Group title="Notifications" footer="Device push changes apply instantly. Other preferences save with Done.">
            <PushNotificationsCard />
            <PrefToggle
              title="Chat messages"
              description="A push when a new message arrives, and a WhatsApp message if a reply sits unread for 15 minutes."
              checked={chatNotifications}
              onChange={setChatNotifications}
            />
            <PrefToggle
              title="New responses"
              description="A push when a provider responds to one of your requests."
              checked={slotNotifications}
              onChange={setSlotNotifications}
            />
            <PrefToggle
              title="New followers"
              description="A push when someone starts following you."
              checked={followNotifications}
              onChange={setFollowNotifications}
            />
          </Group>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-neutral-900 text-[17px] font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
      <PhoneChangeDrawer
        open={phoneDrawerOpen}
        onClose={() => setPhoneDrawerOpen(false)}
        onChanged={(next) => {
          setPhone(next);
          setPhoneVerified(true);
        }}
      />
    </main>
  );
}
