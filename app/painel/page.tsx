import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, getEffectivePlan } from "@/lib/plan-limits";
import { getOrderMetrics } from "@/lib/server/pedidos";
import { getCatalogAnalytics, type CatalogAnalytics } from "@/lib/server/analytics";
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
  // Um único range governa o dashboard inteiro: os cards de pedidos e a seção da
  // vitrine recebem exatamente o mesmo objeto (ANL-14/ANL-15).
  const range = resolvePeriodRange(params);

  const metrics = getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory
    ? await getOrderMetrics(store.id, range)
    : null;

  // Métricas da vitrine são acessórias: se a leitura falhar, o dashboard segue
  // com os pedidos normais e a seção exibe "—" (edge case da spec). O `null` só
  // significa "indisponível agora" — zero real vem como zero.
  let analytics: CatalogAnalytics | null = null;
  try {
    analytics = await getCatalogAnalytics(store.id, range);
  } catch (error) {
    console.error("DashboardPage: erro ao ler métricas da vitrine —", error);
  }

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
      analytics={analytics}
      periodo={params.periodo}
      de={params.de}
      ate={params.ate}
    />
  );
}
