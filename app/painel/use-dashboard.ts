"use client";

import { formatCents } from "@/lib/utils";
import { computeConversionPct } from "@/lib/catalog-metrics";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { AnalyticsState } from "@/lib/server/analytics";
import type { StoreProduct } from "@/lib/types";

export interface TopViewedItem {
  id: string;
  name: string;
  views: number;
}

export function useDashboard(
  products: StoreProduct[],
  metrics: OrderMetrics | null,
  analytics: AnalyticsState = { status: "unavailable" }
) {
  const activeProducts = products.filter((p) => p.isActive && p.stock > 0);
  const soldOutProducts = products.filter((p) => p.stock === 0);

  // `null` = plano sem histórico de pedidos: nenhum número real existe aqui.
  const orderStats = metrics
    ? [
        { value: metrics.ordersThisMonth, label: "Pedidos" },
        {
          value: formatCents(metrics.confirmedCentsThisMonth),
          label: "Vendas confirmadas",
        },
        { value: metrics.pendingCount, label: "Aguardando confirmação" },
      ]
    : null;

  // Só `ok` tem número: `blocked` vira upsell e `unavailable` vira aviso, e nem
  // um nem outro pode inventar valor (≠ período sem eventos, que vem como zeros).
  const data = analytics.status === "ok" ? analytics.data : null;

  const conversionPct = data
    ? computeConversionPct(metrics?.ordersThisMonth ?? 0, data.metrics.bagVisitors)
    : null;

  const catalogStats = data
    ? [
        { value: data.metrics.visits, label: "Visitas" },
        { value: data.metrics.uniqueVisitors, label: "Visitantes únicos" },
        { value: data.metrics.buyClicks, label: "Cliques em comprar" },
        {
          // Sem ninguém com sacola no período não existe taxa — "—" em vez de 0%.
          value: conversionPct === null ? "—" : `${conversionPct}%`,
          label: "Conversão sacola → pedido",
        },
      ]
    : null;

  // Produto deletado sai da lista: o evento continua no banco, mas sem nome não
  // há o que exibir (assumption da spec).
  const topViewed: TopViewedItem[] = (data?.topProducts ?? []).flatMap((item) => {
    const product = products.find((p) => p.id === item.productId);
    return product ? [{ id: product.id, name: product.name, views: item.views }] : [];
  });

  return {
    activeProducts,
    soldOutProducts,
    total: products.length,
    orderStats,
    catalogStats,
    topViewed,
    analyticsBloqueado: analytics.status === "blocked",
  };
}
