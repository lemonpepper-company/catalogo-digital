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
};

function isPlanAccessExpired(planExpiresAt: string | null): boolean {
  if (!planExpiresAt) return false;
  return new Date(planExpiresAt).getTime() <= Date.now();
}

/**
 * O plano contratado (`plan`) vale até `plan_expires_at`. Nulo = não expira:
 * loja free, ou liberação manual indeterminada feita direto no banco.
 *
 * `subscription_status` NÃO entra aqui de propósito. Acesso é decidido só por
 * data — é o que mantém esta regra barata o bastante para rodar a cada request
 * de vitrine (get_effective_plan roda fora do unstable_cache em
 * lib/server/catalog.ts) e o que faz o período de graça funcionar sem que a
 * leitura conheça o conceito: a graça é a data empurrada, não um estado.
 */
export function getEffectivePlan(plan: Plan, planExpiresAt: string | null): Plan {
  if (plan !== "free" && isPlanAccessExpired(planExpiresAt)) return "free";
  return plan;
}

export function getPlanLimits(plan: Plan, planExpiresAt: string | null): PlanLimits {
  switch (getEffectivePlan(plan, planExpiresAt)) {
    case "pro":
      return PRO_LIMITS;
    case "starter":
      return STARTER_LIMITS;
    default:
      return FREE_LIMITS;
  }
}
