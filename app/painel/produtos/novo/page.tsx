import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import type { StoreCategory } from "@/lib/types";
import { ProdutoFormClient } from "../ProdutoFormClient";

export const metadata = {
  title: "Novo produto — Painel",
};

export default async function NovoProdutoPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("store_id", store.id)
    .order("position", { ascending: true });

  const categories: StoreCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    productCount: 0,
  }));

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return <ProdutoFormClient categories={categories} maxPhotos={limits.maxPhotos} />;
}
