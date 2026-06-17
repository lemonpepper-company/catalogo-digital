export type Plan = "starter" | "pro" | null;

export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
}

const PRO_LIMITS: PlanLimits = {
  maxProducts: Infinity,
  maxCategories: Infinity,
  maxPhotos: 5,
};

const STARTER_LIMITS: PlanLimits = {
  maxProducts: 30,
  maxCategories: 5,
  maxPhotos: 3,
};

export function isTrialActive(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > Date.now();
}

export function getPlanLimits(plan: Plan, trialActive: boolean): PlanLimits {
  if (plan === "pro" || (plan === null && trialActive)) return PRO_LIMITS;
  return STARTER_LIMITS;
}
