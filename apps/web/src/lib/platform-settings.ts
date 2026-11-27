import { prisma } from "@/lib/db";

export interface PlatformConfig {
  offerSlotsEnabled: boolean;
}

const DEFAULT_CONFIG: PlatformConfig = {
  offerSlotsEnabled: true,
};

/** Returns the singleton platform settings row, creating it with defaults if missing. */
export async function getPlatformSettings(): Promise<PlatformConfig> {
  try {
    const row = await prisma.platformSettings.upsert({
      where: { id: "global" },
      create: { id: "global", ...DEFAULT_CONFIG },
      update: {},
      select: { offerSlotsEnabled: true },
    });
    return row;
  } catch {
    return DEFAULT_CONFIG;
  }
}
