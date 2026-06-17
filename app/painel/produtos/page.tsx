import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { ProdutosClient } from "./ProdutosClient";

export default async function ProdutosPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const products = (data ?? []).map(mapProduct);
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return (
    <ProdutosClient products={products} maxProducts={limits.maxProducts} />
  );
}
