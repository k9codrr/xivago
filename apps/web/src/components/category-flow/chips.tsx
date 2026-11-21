import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "auto" | "dark";

const INDUSTRY_TONE: Record<Tone, string> = {
  auto: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300",
  dark: "border-sky-400/20 bg-sky-400/10 text-sky-300",
};

const TAG_TONE: Record<Tone, string> = {
  auto: "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-white/10 dark:bg-neutral-900 dark:text-neutral-400",
  dark: "border-white/10 bg-neutral-900 text-neutral-400",
};

/** Industry badges for a sub category. Pass `hrefFor` (link) or `onSelect` (button) to make them filters. */
export function IndustryBadges({
  industries,
  tone = "auto",
  className,
  hrefFor,
  onSelect,
}: {
  industries: string[];
  tone?: Tone;
  className?: string;
  hrefFor?: (industry: string) => string;
  onSelect?: (industry: string) => void;
}) {
  if (industries.length === 0) return null;
  const chip = cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", INDUSTRY_TONE[tone]);
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {industries.map((industry) =>
        hrefFor ? (
          <Link key={industry} href={hrefFor(industry)} className={cn(chip, "hover:opacity-80")}>
            {industry}
          </Link>
        ) : onSelect ? (
          <button key={industry} type="button" onClick={() => onSelect(industry)} className={cn(chip, "hover:opacity-80")}>
            {industry}
          </button>
        ) : (
          <span key={industry} className={chip}>
            {industry}
          </span>
        ),
      )}
    </div>
  );
}

/** Tag chips for a problem. Pass `hrefFor` (link) or `onSelect` (button) to make them filters. */
export function TagChips({
  tags,
  tone = "auto",
  className,
  hrefFor,
  onSelect,
}: {
  tags: string[];
  tone?: Tone;
  className?: string;
  hrefFor?: (tag: string) => string;
  onSelect?: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  const chip = cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", TAG_TONE[tone]);
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) =>
        hrefFor ? (
          <Link key={tag} href={hrefFor(tag)} className={cn(chip, "hover:text-white")}>
            #{tag}
          </Link>
        ) : onSelect ? (
          <button key={tag} type="button" onClick={() => onSelect(tag)} className={cn(chip, "hover:text-white")}>
            #{tag}
          </button>
        ) : (
          <span key={tag} className={chip}>
            #{tag}
          </span>
        ),
      )}
    </div>
  );
}
