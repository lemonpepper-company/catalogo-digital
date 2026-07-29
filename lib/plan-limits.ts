export type Plan = "free" | "starter" | "pro";

export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
  hasOrderHistory: boolean;
  maxFeaturedProducts: number;
  themeOptions: boolean;
  advancedTheme: boolean;
  gridDensity: boolean;
  csvImport: boolean;
}

const FREE_LIMITS: PlanLimits = {
  maxProducts: 8,
  maxCategories: 1,
  maxPhotos: 1,
  hasOrderHistory: false,
  maxFeaturedProducts: 0,
  themeOptions: false,
  advancedTheme: false,
  gridDensity: false,
  csvImport: false,
};

const STARTER_LIMITS: PlanLimits = {
  maxProducts: 30,
  maxCategories: 5,
  maxPhotos: 3,
  hasOrderHistory: true,
  maxFeaturedProducts: 3,
  themeOptions: true,
  advancedTheme: false,
  gridDensity: true,
  csvImport: false,
};

const PRO_LIMITS: PlanLimits = {
  maxProducts: Infinity,
  maxCategories: Infinity,
  maxPhotos: 5,
  hasOrderHistory: true,
  maxFeaturedProducts: Infinity,
  themeOptions: true,
  advancedTheme: true,
  gridDensity: true,
  csvImport: true,
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
