import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import type { StoreCategory } from "@/lib/types";
import { CategoriasClient } from "./CategoriasClient";

export default async function CategoriasPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("store_id", store.id)
    .order("position", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("category_id")
    .eq("store_id", store.id);

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.category_id)
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  const categories: StoreCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    productCount: counts.get(c.id) ?? 0,
  }));

  const limits = getPlanLimits(store.plan, store.trialEndsAt);

  return (
    <CategoriasClient
      categories={categories}
      maxCategories={limits.maxCategories}
    />
  );
}
