import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { PersonalizacaoClient } from "./PersonalizacaoClient";

export default async function PersonalizacaoPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const limits = getPlanLimits(store.plan, store.planExpiresAt);

  return <PersonalizacaoClient settings={store} limits={limits} />;
}
