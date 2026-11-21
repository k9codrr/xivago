/**
 * "When should the work be done?" — separate from `timelineEnd`, which is
 * how long a post stays open for providers to connect.
 *
 * Options depend on the category flow: a consultation is a same-day or
 * this-week thing, a software build is weeks to months, a visa or patent
 * filing is months, and an event or trip happens on a specific date. The
 * profile is picked from the sub category first, then the main category.
 */

export const COMPLETION_CODES = [
  "SAME_DAY",
  "DAYS_3",
  "WEEK_1",
  "WEEK_2",
  "MONTH_1",
  "MONTH_3",
  "MONTH_6",
  "MONTH_12",
  "ONGOING",
  "FLEXIBLE",
  "DATE",
] as const;
export type CompletionCode = (typeof COMPLETION_CODES)[number];

export const COMPLETION_LABELS: Record<CompletionCode, string> = {
  SAME_DAY: "Same day",
  DAYS_3: "Within 2–3 days",
  WEEK_1: "Within 1 week",
  WEEK_2: "Within 2 weeks",
  MONTH_1: "Within 1 month",
  MONTH_3: "1–3 months",
  MONTH_6: "3–6 months",
  MONTH_12: "6–12 months",
  ONGOING: "Ongoing",
  FLEXIBLE: "Flexible / not sure",
  DATE: "On a specific date",
};

export type CompletionProfileId = "session" | "project" | "process" | "dated";

export interface CompletionProfile {
  id: CompletionProfileId;
  /** Hint under the heading for a request ("I need…"). */
  requestHint: string;
  /** Hint under the heading for an offer ("I provide…"). */
  offerHint: string;
  options: CompletionCode[];
}

export const COMPLETION_PROFILES: Record<CompletionProfileId, CompletionProfile> = {
  session: {
    id: "session",
    requestHint: "When do you need the session or consultation done?",
    offerHint: "How soon can you take a session?",
    options: ["SAME_DAY", "DAYS_3", "WEEK_1", "WEEK_2", "ONGOING", "FLEXIBLE"],
  },
  project: {
    id: "project",
    requestHint: "When should the project be completed?",
    offerHint: "How long do you usually take to deliver?",
    options: ["WEEK_1", "WEEK_2", "MONTH_1", "MONTH_3", "MONTH_6", "ONGOING", "FLEXIBLE"],
  },
  process: {
    id: "process",
    requestHint: "By when should the filing or process be completed?",
    offerHint: "How long does the process usually take with you?",
    options: ["WEEK_2", "MONTH_1", "MONTH_3", "MONTH_6", "MONTH_12", "FLEXIBLE"],
  },
  dated: {
    id: "dated",
    requestHint: "When is the event, trip or ceremony?",
    offerHint: "When are you available?",
    options: ["DATE", "WEEK_2", "MONTH_1", "MONTH_3", "FLEXIBLE"],
  },
};

const MAIN_PROFILE: Record<string, CompletionProfileId> = {
  "8": "project", // Customers
  "10": "project", // Data & Analytics
  "13": "session", // Health & Wellness
  "14": "process", // Legal & Compliance
  "15": "session", // Financial Advisory
  "16": "project", // Real Estate
  "17": "process", // Immigration & Visa
  "18": "process", // IP & Patent
  "19": "project", // Business
  "20": "session", // Career Coaching
  "21": "dated", // Spiritual & Puja
  "22": "project", // B2B Strategy
  "23": "dated", // Events
  "24": "dated", // Travel
  "25": "project", // Software & Tech
  "26": "session", // Education & Tutoring
  "27": "session", // Relationships & Family
  "28": "session", // Pets & Veterinary
  "29": "session", // Beauty & Styling
  "30": "project", // Creative & Media
};

/** Sub categories that behave differently from the rest of their main category. */
const SUB_PROFILE: Record<string, CompletionProfileId> = {
  "14.1": "session", // Micro legal advice is a consultation
  "21.2": "session", // Astrology consultation
  "21.3": "session", // Numerology, tarot
  "21.4": "session", // Meditation, healing
  "21.6": "session", // Gemology
  "22.1": "session", // Industry expert calls
  "25.7": "session", // Tech support
  "28.4": "process", // Pet relocation
  "29.4": "dated", // Bridal & occasion styling
  "30.1": "session", // Creator coaching
  "30.5": "session", // Speaking coaching
};

export function completionProfileFor(subId?: string | null, parentId?: string | null): CompletionProfile {
  const fromSub = subId ? SUB_PROFILE[subId] : undefined;
  const fromMain = parentId ? MAIN_PROFILE[parentId] : subId ? MAIN_PROFILE[subId.split(".")[0] ?? ""] : undefined;
  return COMPLETION_PROFILES[fromSub ?? fromMain ?? "project"];
}

export function isCompletionCode(v: unknown): v is CompletionCode {
  return typeof v === "string" && (COMPLETION_CODES as readonly string[]).includes(v);
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Human label for a stored completion timeline, or null for older posts without one. */
export function completionLabel(code: string | null | undefined, date?: Date | string | null): string | null {
  if (!code || !isCompletionCode(code)) return null;
  if (code === "DATE") return date ? `On ${dateFmt.format(new Date(date))}` : COMPLETION_LABELS.DATE;
  return COMPLETION_LABELS[code];
}
