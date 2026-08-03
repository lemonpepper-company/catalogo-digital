import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { getEffectivePlan } from "@/lib/plan-limits";
import type { PaidPlan } from "@/lib/asaas/plans";
import type { BillingCycle, SubscriptionStatus } from "@/lib/asaas/events";
import { AssinaturaClient } from "./AssinaturaClient";

export default async function AssinaturaPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  // Loja com assinatura vencida (cancelada ou past_due que passou da graça)
  // precisa reaparecer como Free aqui, ou o cliente cai no ramo de
  // trocarPlano (exige asaasSubscriptionId vivo) em vez de iniciarAssinatura
  // — sem caminho funcional para assinar de novo.
  const plan = getEffectivePlan(store.plan, store.planExpiresAt);

  return (
    <AssinaturaClient
      plan={plan}
      planExpiresAt={store.planExpiresAt}
      subscriptionStatus={store.subscriptionStatus as SubscriptionStatus | null}
      billingCycle={store.billingCycle as BillingCycle | null}
      pendingPlan={store.pendingPlan as PaidPlan | null}
      document={store.document}
    />
  );
}
