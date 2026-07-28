import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const limits = getPlanLimits(store.plan, store.trialEndsAt);

  return <ConfiguracoesClient settings={store} limits={limits} />;
}
