import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, getEffectivePlan } from "@/lib/plan-limits";
import { getOrderMetrics } from "@/lib/server/pedidos";
import { resolvePeriodRange } from "@/lib/period-filter";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  // Dashboard é exclusiva de planos pagos: no Free, nenhum dado real
  // (produtos, pedidos, faturamento) chega ao HTML — mesmo padrão de bloqueio
  // já usado em /painel/pedidos.
  if (getEffectivePlan(store.plan, store.trialEndsAt) === "free") {
    return (
      <RecursoBloqueado
        titulo="Dashboard"
        descricao="Acompanhe um resumo de produtos, vendas e pedidos da sua loja. Disponível a partir do plano Starter."
      />
    );
  }

  const params = await searchParams;

  // Gate antes do I/O: no plano Free nenhum número de pedido/faturamento é
  // buscado nem o período é resolvido, então nada real pode chegar ao HTML
  // (ORD-29).
  const metrics = getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory
    ? await getOrderMetrics(store.id, resolvePeriodRange(params))
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

  return (
    <DashboardClient
      products={products}
      storeName={store.name}
      metrics={metrics}
      periodo={params.periodo}
      de={params.de}
      ate={params.ate}
    />
  );
}
