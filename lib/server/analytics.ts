import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CatalogEventMetrics, TopViewedProduct } from "@/lib/catalog-metrics";
import type { PeriodRange } from "@/lib/period-filter";

export const TOP_VIEWED_LIMIT = 5;

export interface CatalogAnalytics {
  metrics: CatalogEventMetrics;
  topProducts: TopViewedProduct[];
}

/**
 * Situação da seção de métricas no dashboard. União e não `CatalogAnalytics |
 * null` de propósito: "bloqueado por plano" e "leitura falhou" precisam ser
 * distinguíveis, senão o lojista Starter veria um erro no lugar do upsell
 * (APO-11). `blocked` significa que NENHUMA query foi executada.
 */
export type AnalyticsState =
  | { status: "ok"; data: CatalogAnalytics }
  | { status: "blocked" }
  | { status: "unavailable" };

interface CatalogMetricsRow {
  visits: number | string;
  unique_visitors: number | string;
  buy_clicks: number | string;
  bag_visitors: number | string;
}

interface TopViewedRow {
  product_id: string;
  views: number | string;
}

// Erro de banco nunca vira zero: um permission denied disfarçado de "loja sem
// visitas" esconderia a falha (mesma convenção de lib/server/pedidos.ts).
function fail(context: string, error: { message: string }): never {
  console.error(`${context}:`, error);
  throw new Error(`${context}: ${error.message}`);
}

// As agregações do Postgres voltam como bigint, que o PostgREST serializa em
// string quando o valor é grande — normalizar aqui evita "12" + 1 = "121" na UI.
function toCount(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

/**
 * Métricas da vitrine no mesmo período dos cards de pedidos. `range: null` =
 * preset "tudo": as duas RPCs recebem `p_from`/`p_to` nulos e agregam todo o
 * histórico (ANL-22).
 *
 * A leitura usa o client autenticado, então a RLS de `catalog_events` vale dentro
 * das funções (`security invoker`) e a loja só enxerga os próprios eventos
 * (ANL-17). Nenhuma query em `orders`: o numerador da conversão vem do
 * `getOrderMetrics` que a página já chama com este mesmo range.
 */
export async function getCatalogAnalytics(
  storeId: string,
  range: PeriodRange | null
): Promise<CatalogAnalytics> {
  const supabase = await createClient();

  const from = range ? range.from.toISOString() : null;
  const to = range ? range.to.toISOString() : null;

  const [metricsResult, topResult] = await Promise.all([
    supabase.rpc("get_catalog_metrics", {
      p_store_id: storeId,
      p_from: from,
      p_to: to,
    }),
    supabase.rpc("get_top_viewed_products", {
      p_store_id: storeId,
      p_from: from,
      p_to: to,
      p_limit: TOP_VIEWED_LIMIT,
    }),
  ]);

  if (metricsResult.error)
    fail(`getCatalogAnalytics(${storeId}) — erro ao agregar eventos`, metricsResult.error);
  if (topResult.error)
    fail(`getCatalogAnalytics(${storeId}) — erro ao ler mais vistos`, topResult.error);

  // A função devolve sempre uma linha (agregação sem group by), mas um retorno
  // vazio não pode virar crash: loja sem nenhum evento zera tudo.
  const row = ((metricsResult.data ?? []) as CatalogMetricsRow[])[0];

  return {
    metrics: {
      visits: toCount(row?.visits),
      uniqueVisitors: toCount(row?.unique_visitors),
      buyClicks: toCount(row?.buy_clicks),
      bagVisitors: toCount(row?.bag_visitors),
    },
    topProducts: ((topResult.data ?? []) as TopViewedRow[]).map((item) => ({
      productId: item.product_id,
      views: toCount(item.views),
    })),
  };
}
