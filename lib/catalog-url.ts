import { getPlanLimits, type Plan } from "@/lib/plan-limits";

export function getCatalogUrl(store: {
  slug: string;
  plan: Plan;
  planExpiresAt: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
}): string {
  const limits = getPlanLimits(store.plan, store.planExpiresAt);

  if (limits.customDomain && store.customDomainVerified && store.customDomain) {
    return `https://${store.customDomain}`;
  }

  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${store.slug}`;
}
