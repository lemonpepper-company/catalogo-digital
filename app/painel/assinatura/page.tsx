import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import type { PaidPlan } from "@/lib/asaas/plans";
import type { BillingCycle, SubscriptionStatus } from "@/lib/asaas/events";
import { AssinaturaClient } from "./AssinaturaClient";

export default async function AssinaturaPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  return (
    <AssinaturaClient
      plan={store.plan}
      planExpiresAt={store.planExpiresAt}
      subscriptionStatus={store.subscriptionStatus as SubscriptionStatus | null}
      billingCycle={store.billingCycle as BillingCycle | null}
      pendingPlan={store.pendingPlan as PaidPlan | null}
      document={store.document}
    />
  );
}
