import type { BillingCycle } from "@/lib/asaas/events";

export type PaidPlan = "starter" | "pro";

/** Anual = 10 meses pagos (17% off). À vista: assinatura no Asaas não parcela. */
export const PRECOS: Record<PaidPlan, Record<BillingCycle, number>> = {
  starter: { monthly: 29.9, annual: 299 },
  pro: { monthly: 59.9, annual: 599 },
};

export function precoDe(plan: PaidPlan, cycle: BillingCycle): number {
  return PRECOS[plan][cycle];
}

const DIAS_DO_CICLO: Record<BillingCycle, number> = { monthly: 30, annual: 365 };

/**
 * Diferença proporcional ao que resta do ciclo corrente. O Asaas não faz pro
 * rata — "alterações de valor afetam somente cobranças futuras" — então o
 * upgrade cobra esta diferença como cobrança avulsa.
 *
 * Devolve 0 para downgrade e para ciclo já vencido: nunca cobramos a mais, e o
 * downgrade só vale na virada.
 */
export function proporcional(
  de: PaidPlan,
  para: PaidPlan,
  cycle: BillingCycle,
  planExpiresAt: string,
  now: Date
): number {
  const diferencaCheia = precoDe(para, cycle) - precoDe(de, cycle);
  if (diferencaCheia <= 0) return 0;

  const restanteMs = new Date(planExpiresAt).getTime() - now.getTime();
  if (restanteMs <= 0) return 0;

  const diasRestantes = restanteMs / 86_400_000;
  const fracao = Math.min(1, diasRestantes / DIAS_DO_CICLO[cycle]);
  return Math.round(diferencaCheia * fracao * 100) / 100;
}
