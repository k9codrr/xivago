export interface TrialStatus {
  isPro: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  isPendingDataDeletion: boolean;
  daysLeftInTrial: number;
  daysUntilDeletion: number;
  trialEndsAt: Date;
  dataDeletionAt: Date;
}

export function getUserTrialStatus(user: {
  createdAt: Date | string;
  subscription?: { status: string } | null;
  trialEndsAt?: Date | string | null;
  dataDeletionAt?: Date | string | null;
}): TrialStatus {
  const isPro = user.subscription?.status === "ACTIVE";

  const created = new Date(user.createdAt);
  const trialEnds = user.trialEndsAt
    ? new Date(user.trialEndsAt)
    : new Date(created.getTime() + 7 * 24 * 60 * 60 * 1000);

  const dataDeletion = user.dataDeletionAt
    ? new Date(user.dataDeletionAt)
    : new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const isTrialActive = !isPro && now.getTime() <= trialEnds.getTime();
  const isTrialExpired = !isPro && now.getTime() > trialEnds.getTime();
  const isPendingDataDeletion = !isPro && now.getTime() >= dataDeletion.getTime();

  const daysLeftInTrial = Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / msPerDay));
  const daysUntilDeletion = Math.max(0, Math.ceil((dataDeletion.getTime() - now.getTime()) / msPerDay));

  return {
    isPro,
    isTrialActive,
    isTrialExpired,
    isPendingDataDeletion,
    daysLeftInTrial,
    daysUntilDeletion,
    trialEndsAt: trialEnds,
    dataDeletionAt: dataDeletion,
  };
}
