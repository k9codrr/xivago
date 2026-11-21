"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { BoostConfig } from "@/lib/boost-shared";

type Form = Record<keyof BoostConfig, string>;

const INPUT =
  "w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN =
  "rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50";

const toForm = (s: BoostConfig): Form => ({
  pricePerDay: String(s.pricePerDay),
  minDays: String(s.minDays),
  maxDays: String(s.maxDays),
  extendPricePerDay: String(s.extendPricePerDay),
  extendMinDays: String(s.extendMinDays),
  extendMaxDays: String(s.extendMaxDays),
});

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</span>
      <input className={INPUT} type="number" min={1} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="block text-xs text-neutral-500">{hint}</span>
    </label>
  );
}

export default function AdminBoostingPage() {
  const [saved, setSaved] = useState<BoostConfig | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [activeBoosts, setActiveBoosts] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/boost-settings");
    if (!res.ok) {
      toast.error("Could not load boost settings.");
      return;
    }
    const data = await res.json();
    setSaved(data.settings);
    setForm(toForm(data.settings));
    setActiveBoosts(data.activeBoosts ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!form || !saved) {
    return (
      <div className="flex justify-center py-16 text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const set = (key: keyof BoostConfig) => (v: string) => setForm((f) => (f ? { ...f, [key]: v } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(saved));
  const n = (k: keyof BoostConfig) => Number(form[k]) || 0;

  async function save() {
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form!).map(([k, v]) => [k, Number(v)]));
      const res = await fetch("/api/admin/boost-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = (data?.error?.details?.fieldErrors ?? {}) as Record<string, string[]>;
        const issue = Object.values(fieldErrors).flat()[0] ?? data?.error?.message;
        toast.error(issue ?? "Could not save.");
        return;
      }
      toast.success("Boost pricing saved.");
      setSaved(data.settings);
      setForm(toForm(data.settings));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Featured boosting</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Featured posts are pinned on top of every post list. Users pay per day. Changes apply to boosts bought
          after you save; running boosts keep their end date. {activeBoosts} post(s) featured right now.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-white">New boost</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price per day (credits)" hint="Charged for each featured day." value={form.pricePerDay} onChange={set("pricePerDay")} />
          <Field label="Minimum days" hint="Shortest boost a user can buy." value={form.minDays} onChange={set("minDays")} />
          <Field label="Maximum days" hint="Longest boost a user can buy." value={form.maxDays} onChange={set("maxDays")} />
        </div>
        <p className="text-xs text-neutral-500">
          Minimum charge: {n("pricePerDay") * n("minDays")} credits · maximum: {n("pricePerDay") * n("maxDays")} credits
        </p>
      </section>

      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="font-semibold text-neutral-900 dark:text-white">Extension</h2>
        <p className="text-sm text-neutral-500">
          For a post that was featured before, while its boost is still running (days are added to the end) or after
          it has ended (starts again from now; a post that expired on its own is reopened).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price per day (credits)" hint="Charged for each extra day." value={form.extendPricePerDay} onChange={set("extendPricePerDay")} />
          <Field label="Minimum days" hint="Shortest extension." value={form.extendMinDays} onChange={set("extendMinDays")} />
          <Field label="Maximum days" hint="Longest extension in one purchase." value={form.extendMaxDays} onChange={set("extendMaxDays")} />
        </div>
        <p className="text-xs text-neutral-500">
          Minimum charge: {n("extendPricePerDay") * n("extendMinDays")} credits · maximum:{" "}
          {n("extendPricePerDay") * n("extendMaxDays")} credits
        </p>
      </section>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          disabled={!dirty || saving}
          onClick={() => setForm(toForm(saved))}
        >
          Reset
        </button>
        <button type="button" className={BTN} disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
