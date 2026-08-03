export type Plan = "free" | "starter" | "pro";

export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
  hasOrderHistory: boolean;
  maxFeaturedProducts: number;
  themeOptions: boolean;
  gridDensity: boolean;
  csvImport: boolean;
  customDomain: boolean;
  hasAnalytics: boolean;
}

const FREE_LIMITS: PlanLimits = {
  maxProducts: 8,
  maxCategories: 1,
  maxPhotos: 1,
  hasOrderHistory: false,
  maxFeaturedProducts: 0,
  themeOptions: false,
  gridDensity: false,
  csvImport: false,
  customDomain: false,
  hasAnalytics: false,
};

const STARTER_LIMITS: PlanLimits = {
  maxProducts: 50,
  maxCategories: 7,
  maxPhotos: 3,
  hasOrderHistory: true,
  maxFeaturedProducts: 3,
  themeOptions: true,
  gridDensity: true,
  csvImport: false,
  customDomain: false,
  hasAnalytics: false,
};

const PRO_LIMITS: PlanLimits = {
  maxProducts: Infinity,
  maxCategories: Infinity,
  maxPhotos: 5,
  hasOrderHistory: true,
  maxFeaturedProducts: Infinity,
  themeOptions: true,
  gridDensity: true,
  csvImport: true,
  customDomain: true,
  hasAnalytics: true,
};

function isPaidAccessExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() <= Date.now();
}

/**
 * Starter/Pro liberado manualmente cai para Free quando trial_ends_at vence.
 * trial_ends_at nulo = acesso indeterminado, nunca expira.
 */
export function getEffectivePlan(plan: Plan, trialEndsAt: string | null): Plan {
  if (plan !== "free" && isPaidAccessExpired(trialEndsAt)) return "free";
  return plan;
}

export function getPlanLimits(plan: Plan, trialEndsAt: string | null): PlanLimits {
  switch (getEffectivePlan(plan, trialEndsAt)) {
    case "pro":
      return PRO_LIMITS;
    case "starter":
      return STARTER_LIMITS;
    default:
      return FREE_LIMITS;
  }
}
