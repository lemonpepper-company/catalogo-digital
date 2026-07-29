import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { getOrderMetrics } from "@/lib/server/pedidos";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  // Gate antes do I/O: no plano Free nenhum número de pedido/faturamento é
  // buscado, então nada real pode chegar ao HTML (ORD-29).
  const metrics = getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory
    ? await getOrderMetrics(store.id)
    : null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new, is_featured"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const products = (data ?? []).map(mapProduct);
  const catalogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${store.slug}`;

  return (
    <DashboardClient
      products={products}
      storeName={store.name}
      catalogUrl={catalogUrl}
      metrics={metrics}
    />
  );
}
