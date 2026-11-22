/**
 * How an offer's price is charged: per unit (session, hour, sq ft…), per
 * service, or one price for the whole job. The choices depend on the
 * category — a consultation is priced per session, a software build per
 * project, a trip per person — so the list is picked from the sub category
 * first, then the main category, then the category's completion profile.
 */
import { completionProfileFor } from "@/lib/completion-timeline";

export const PRICE_UNITS = [
  "TOTAL",
  "PER_SERVICE",
  "PER_PROJECT",
  "PER_SESSION",
  "PER_HOUR",
  "PER_DAY",
  "PER_MONTH",
  "PER_PERSON",
  "PER_EVENT",
  "PER_CASE",
  "PER_NIGHT",
  "PER_SQFT",
  "PER_UNIT",
] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export interface PriceUnitInfo {
  /** Button label in the post flow. */
  label: string;
  /** One-line hint under the button. */
  hint: string;
  /** Shown after the amount on cards: "₹500 / session". Empty for a whole price. */
  suffix: string;
}

export const PRICE_UNIT_INFO: Record<PriceUnit, PriceUnitInfo> = {
  TOTAL: { label: "Whole package", hint: "One price for everything", suffix: "" },
  PER_SERVICE: { label: "Per service", hint: "Each service is charged separately", suffix: "/ service" },
  PER_PROJECT: { label: "Per project", hint: "Fixed price for the full project", suffix: "/ project" },
  PER_SESSION: { label: "Per session", hint: "Each session or consultation", suffix: "/ session" },
  PER_HOUR: { label: "Per hour", hint: "Charged by the hour", suffix: "/ hour" },
  PER_DAY: { label: "Per day", hint: "Charged by the day", suffix: "/ day" },
  PER_MONTH: { label: "Per month", hint: "Monthly retainer or plan", suffix: "/ month" },
  PER_PERSON: { label: "Per person", hint: "Charged for each person", suffix: "/ person" },
  PER_EVENT: { label: "Per event", hint: "Fixed price for each event", suffix: "/ event" },
  PER_CASE: { label: "Per case / filing", hint: "Each application, case or filing", suffix: "/ case" },
  PER_NIGHT: { label: "Per night", hint: "Stays and night packages", suffix: "/ night" },
  PER_SQFT: { label: "Per sq ft", hint: "Charged by area", suffix: "/ sq ft" },
  PER_UNIT: { label: "Per unit / item", hint: "Each piece, page, video or item", suffix: "/ unit" },
};

const BY_PROFILE: Record<ReturnType<typeof completionProfileFor>["id"], PriceUnit[]> = {
  session: ["PER_SESSION", "PER_HOUR", "PER_MONTH", "TOTAL"],
  project: ["PER_PROJECT", "PER_HOUR", "PER_MONTH", "PER_UNIT"],
  process: ["PER_CASE", "PER_SERVICE", "TOTAL", "PER_HOUR"],
  dated: ["PER_EVENT", "PER_DAY", "PER_PERSON", "TOTAL"],
};

/** Main categories whose pricing doesn't follow their completion profile. */
const BY_MAIN: Record<string, PriceUnit[]> = {
  "16": ["PER_SQFT", "PER_MONTH", "PER_SERVICE", "TOTAL"], // Real Estate
  "24": ["PER_PERSON", "PER_NIGHT", "PER_DAY", "TOTAL"], // Travel
  "26": ["PER_HOUR", "PER_SESSION", "PER_MONTH", "TOTAL"], // Education & Tutoring
  "28": ["PER_SERVICE", "PER_SESSION", "PER_DAY", "PER_MONTH"], // Pets & Veterinary
  "29": ["PER_SERVICE", "PER_SESSION", "PER_PERSON", "TOTAL"], // Beauty & Styling
  "30": ["PER_PROJECT", "PER_UNIT", "PER_HOUR", "PER_MONTH"], // Creative & Media
};

/** Sub categories that price differently from the rest of their main category. */
const BY_SUB: Record<string, PriceUnit[]> = {
  "29.4": ["PER_EVENT", "PER_PERSON", "TOTAL", "PER_SERVICE"], // Bridal & occasion styling
  "28.4": ["PER_CASE", "TOTAL", "PER_SERVICE", "PER_DAY"], // Pet relocation
  "25.7": ["PER_SERVICE", "PER_HOUR", "PER_MONTH", "TOTAL"], // Tech support
};

/** The price types an offer in this category can pick, most common first. */
export function priceUnitsFor(subId?: string | null, parentId?: string | null): PriceUnit[] {
  const main = parentId ?? (subId ? subId.split(".")[0] : null);
  return (
    (subId ? BY_SUB[subId] : undefined) ??
    (main ? BY_MAIN[main] : undefined) ??
    BY_PROFILE[completionProfileFor(subId, parentId).id]
  );
}

export function isPriceUnit(v: unknown): v is PriceUnit {
  return typeof v === "string" && (PRICE_UNITS as readonly string[]).includes(v);
}

/** "/ session", or "" for a whole price or an unknown code. */
export function priceUnitSuffix(code: string | null | undefined): string {
  return code && isPriceUnit(code) ? PRICE_UNIT_INFO[code].suffix : "";
}

/** "₹500" → "₹500 / session". Leaves the label alone without a unit. */
export function withPriceUnit(budgetLabel: string | null | undefined, code: string | null | undefined): string | null {
  if (!budgetLabel) return budgetLabel ?? null;
  const suffix = priceUnitSuffix(code);
  return suffix ? `${budgetLabel} ${suffix}` : budgetLabel;
}
