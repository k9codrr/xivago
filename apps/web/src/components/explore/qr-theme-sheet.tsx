"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { CardHalo, QrCard, RimBorder } from "./qr-card";
import {
  BACKDROPS,
  BORDER_STYLES,
  BORDER_TONES,
  CARD_FILLS,
  CARD_IMAGES,
  CUSTOM_IMAGE,
  DEFAULT_THEME,
  HERO_IMAGES,
  PATTERNS,
  PRESETS,
  borderColor,
  imageBackground,
  imageFileToDataUrl,
  patternStyle,
  setCustomImage,
  useCustomImage,
  type BackdropId,
  type CardFillId,
  type ImageSlot,
  type QrTheme,
} from "./qr-theme";

interface QrThemeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: QrTheme;
  onSave: (theme: QrTheme) => void;
  qrValue?: string;
  avatarUrl?: string | null;
  initial?: string;
}

/** Presets without images mean "no image", so picking one clears a previous image. */
const withImageDefaults = (t: QrTheme): QrTheme => ({ heroImage: "none", cardImage: "none", ...t });
const same = (a: QrTheme, b: QrTheme) => JSON.stringify(withImageDefaults(a)) === JSON.stringify(withImageDefaults(b));

/** Long-press on the Explore QR opens this: pick a preset or tune the card, its
 *  border, the backdrop and the pattern behind it, with a live preview. */
export function QrThemeSheet({ open, onOpenChange, theme, onSave, qrValue, avatarUrl, initial }: QrThemeSheetProps) {
  const [draft, setDraft] = useState(theme);
  useEffect(() => {
    if (open) setDraft(theme);
  }, [open, theme]);

  const set = (patch: Partial<QrTheme>) => {
    void haptic("selection");
    setDraft((d) => ({ ...d, ...patch }));
  };
  const backdrop = BACKDROPS[draft.backdrop];
  const customHero = useCustomImage("hero");
  const previewImage = imageBackground(draft.heroImage, "hero", customHero);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-[430px] border-white/10 bg-[#0e0e10] text-white">
        <DrawerHeader className="pb-1 text-left">
          <DrawerTitle className="text-[17px] font-semibold text-white">Customise your QR</DrawerTitle>
          <DrawerDescription className="text-[12.5px] text-white/50">
            Only you see this look. It&apos;s saved on this device.
          </DrawerDescription>
        </DrawerHeader>

        <div className="no-scrollbar overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),16px)]">
          {/* Live preview */}
          <div
            className="relative mt-2 grid h-[210px] place-items-center overflow-hidden rounded-[22px]"
            style={{ background: backdrop.base }}
          >
            {previewImage && (
              <>
                <span className="absolute inset-0" style={{ background: previewImage }} />
                <span className="absolute inset-0 bg-black/25" />
              </>
            )}
            <span className="absolute inset-0" style={patternStyle(draft.pattern, backdrop.ink)} />
            <span
              className="absolute inset-0"
              style={{ background: `radial-gradient(70% 60% at 50% 110%, ${backdrop.glow}, transparent 70%)` }}
            />
            <CardHalo theme={draft} className="h-[240px] w-[240px]" />
            <QrCard theme={draft} size={150} value={qrValue} avatarUrl={avatarUrl} initial={initial} />
          </div>

          <Section title="Presets">
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
              {PRESETS.map((p) => {
                const active = same(p.theme, draft);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set(withImageDefaults(p.theme))}
                    aria-pressed={active}
                    className="flex shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "relative grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-[18px] ring-2 transition",
                        active ? "ring-white" : "ring-transparent",
                      )}
                      style={{ background: imageBackground(p.theme.heroImage, "hero", null) ?? BACKDROPS[p.theme.backdrop].base }}
                    >
                      <span className="absolute inset-0" style={patternStyle(p.theme.pattern, BACKDROPS[p.theme.backdrop].ink)} />
                      <QrCard theme={p.theme} size={40} value={qrValue} />
                    </span>
                    <span className={cn("text-[11px]", active ? "text-white" : "text-white/55")}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Card colour">
            <div className="flex flex-wrap gap-3">
              {(Object.keys(CARD_FILLS) as CardFillId[]).map((id) => {
                const f = CARD_FILLS[id];
                return (
                  <Swatch
                    key={id}
                    label={f.label}
                    active={draft.fill === id}
                    onClick={() => set({ fill: id })}
                    background={`radial-gradient(120% 120% at 100% 100%, ${f.to}, ${f.from} 70%)`}
                  />
                );
              })}
            </div>
          </Section>

          <Section title="Card image">
            <ImagePicker
              slot="card"
              value={draft.cardImage ?? "none"}
              options={CARD_IMAGES}
              onChange={(cardImage) => set({ cardImage })}
            />
          </Section>

          <Section title="Border">
            <div className="flex gap-2">
              {BORDER_STYLES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => set({ border: b.id })}
                  aria-pressed={draft.border === b.id}
                  className={cn(
                    "relative flex h-[58px] flex-1 flex-col items-center justify-center gap-1 rounded-[14px] bg-white/[0.04] text-[11.5px] transition",
                    draft.border === b.id ? "text-white ring-1 ring-white/70" : "text-white/55 ring-1 ring-white/[0.08]",
                  )}
                >
                  <span className="relative h-6 w-6 rounded-[7px] bg-white/[0.06]">
                    <RimBorder color="#fff" mode={b.id} width={1.5} />
                  </span>
                  {b.label}
                </button>
              ))}
            </div>
            {draft.border !== "none" && (
              <div className="mt-3 flex gap-2">
                {BORDER_TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set({ borderTone: t.id })}
                    aria-pressed={draft.borderTone === t.id}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-full px-3.5 text-[12px] transition",
                      draft.borderTone === t.id ? "bg-white text-black" : "bg-white/[0.06] text-white/70",
                    )}
                  >
                    <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: borderColor(t.id, draft.fill) }} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Background">
            <div className="flex flex-wrap gap-3">
              {(Object.keys(BACKDROPS) as BackdropId[]).map((id) => {
                const b = BACKDROPS[id];
                return (
                  <Swatch
                    key={id}
                    label={b.label}
                    active={draft.backdrop === id}
                    onClick={() => set({ backdrop: id })}
                    background={`radial-gradient(90% 90% at 50% 100%, ${b.glow}, ${b.base} 70%)`}
                  />
                );
              })}
            </div>
          </Section>

          <Section title="Background image">
            <ImagePicker
              slot="hero"
              value={draft.heroImage ?? "none"}
              options={HERO_IMAGES}
              onChange={(heroImage) => set({ heroImage })}
            />
          </Section>

          <Section title="Pattern">
            <div className="grid grid-cols-4 gap-2.5">
              {PATTERNS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set({ pattern: p.id })}
                  aria-pressed={draft.pattern === p.id}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "relative h-[54px] w-full overflow-hidden rounded-[14px] ring-2 transition",
                      draft.pattern === p.id ? "ring-white" : "ring-white/[0.06]",
                    )}
                    style={{ background: backdrop.base }}
                  >
                    <span className="absolute inset-0" style={patternStyle(p.id, "rgba(255,255,255,0.22)")} />
                  </span>
                  <span className={cn("text-[11px]", draft.pattern === p.id ? "text-white" : "text-white/55")}>{p.label}</span>
                </button>
              ))}
            </div>
          </Section>

          <label className="mt-6 flex items-center justify-between gap-4 rounded-[16px] bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/[0.06]">
            <span>
              <span className="block text-[14px] font-medium">Show &ldquo;Scan &amp; Sell&rdquo; art</span>
              <span className="block text-[12px] text-white/45">Turn off to show a clean QR others can scan</span>
            </span>
            <Switch checked={draft.label} onCheckedChange={(v) => set({ label: v })} />
          </label>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => set(withImageDefaults(DEFAULT_THEME))}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-5 text-[14px] font-medium text-white/80 active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <button
              type="button"
              onClick={() => {
                void haptic("success");
                onSave(draft);
                onOpenChange(false);
              }}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-black active:scale-[0.98]"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} /> Apply
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{title}</h4>
      {children}
    </section>
  );
}

function Swatch({
  label,
  active,
  onClick,
  background,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  background: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-[#0e0e10] transition",
          active ? "ring-white" : "ring-transparent",
        )}
        style={{ background }}
      >
        {active && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
      </span>
      <span className={cn("text-[10.5px]", active ? "text-white" : "text-white/50")}>{label}</span>
    </button>
  );
}

/* ───────── Image picker: none, built-in images, or the user's own photo ───────── */

/** Longest edge kept for each slot: enough for a sharp phone screen, small enough for storage. */
const MAX_EDGE: Record<ImageSlot, number> = { hero: 1280, card: 720 };

function ImagePicker({
  slot,
  value,
  options,
  onChange,
}: {
  slot: ImageSlot;
  value: string;
  options: { id: string; label: string; css: string }[];
  onChange: (choice: string) => void;
}) {
  const custom = useCustomImage(slot);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick a photo (JPG, PNG or WEBP).");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await imageFileToDataUrl(file, MAX_EDGE[slot]);
      if (!setCustomImage(slot, dataUrl)) {
        toast.error("Not enough space on this device for that photo. Try a smaller one.");
        return;
      }
      onChange(CUSTOM_IMAGE);
    } catch {
      toast.error("Could not read that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeCustom() {
    setCustomImage(slot, null);
    if (value === CUSTOM_IMAGE) onChange("none");
  }

  const tile = (active: boolean) =>
    cn(
      "relative grid h-[64px] w-[64px] shrink-0 place-items-center overflow-hidden rounded-[16px] ring-2 transition",
      active ? "ring-white" : "ring-white/[0.08]",
    );

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {/* Upload your own */}
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={slot === "hero" ? "Upload a background photo" : "Upload a card photo"}
          className={cn(tile(false), "border border-dashed border-white/25 bg-white/[0.04] ring-0")}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin text-white/70" /> : <ImagePlus className="h-5 w-5 text-white/70" />}
        </button>
        <span className="text-[11px] text-white/55">Upload</span>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPick(e.target.files?.[0])} />
      </div>

      {custom && (
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="relative">
            <button
              type="button"
              onClick={() => onChange(CUSTOM_IMAGE)}
              aria-pressed={value === CUSTOM_IMAGE}
              aria-label="Your photo"
              className={tile(value === CUSTOM_IMAGE)}
              style={{ background: `center / cover no-repeat url("${custom}")` }}
            >
              {value === CUSTOM_IMAGE && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
            </button>
            <button
              type="button"
              onClick={removeCustom}
              aria-label="Remove your photo"
              className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-[#0e0e10] text-white/80 ring-1 ring-white/20"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
          <span className={cn("text-[11px]", value === CUSTOM_IMAGE ? "text-white" : "text-white/55")}>Yours</span>
        </div>
      )}

      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button type="button" onClick={() => onChange("none")} aria-pressed={value === "none"} className={cn(tile(value === "none"), "bg-white/[0.04]")}>
          <span className="text-[11px] text-white/50">None</span>
        </button>
        <span className={cn("text-[11px]", value === "none" ? "text-white" : "text-white/55")}>Off</span>
      </div>

      {options.map((o) => (
        <div key={o.id} className="flex shrink-0 flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            aria-label={o.label}
            className={tile(value === o.id)}
            style={{ background: o.css }}
          >
            {value === o.id && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
          </button>
          <span className={cn("text-[11px]", value === o.id ? "text-white" : "text-white/55")}>{o.label}</span>
        </div>
      ))}
    </div>
  );
}
