import { DESIGNS_1 } from "./designs-1";
import { DESIGNS_2 } from "./designs-2";
import { DESIGNS_3 } from "./designs-3";
import type { Design } from "./parts";

export type { Design } from "./parts";

/**
 * The 9 metal designs for every home category, keyed by category id.
 * Each design is drawn on a 64x64 grid; see kit.tsx for the materials and
 * parts.tsx for the shared building blocks (coins, rivets, facets...).
 */
export const DESIGNS: Record<string, Design[]> = { ...DESIGNS_1, ...DESIGNS_2, ...DESIGNS_3 };