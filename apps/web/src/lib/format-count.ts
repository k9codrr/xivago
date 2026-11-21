const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** 999 → "999", 1_200 → "1.2K", 15_400 → "15.4K", 1_000_000 → "1M". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return compact.format(n);
}
