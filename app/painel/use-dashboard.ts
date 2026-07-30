"use client";

import { formatCents } from "@/lib/utils";
import { computeConversionPct } from "@/lib/catalog-metrics";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { CatalogAnalytics } from "@/lib/server/analytics";
import type { StoreProduct } from "@/lib/types";

export interface TopViewedItem {
  id: string;
  name: string;
  views: number;
}

export function useDashboard(
  products: StoreProduct[],
  metrics: OrderMetrics | null,
  analytics: CatalogAnalytics | null = null
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

  // `null` = leitura das métricas da vitrine falhou (≠ período sem eventos, que
  // vem como zeros). A UI distingue os dois: indisponível avisa, zero mostra 0.
  const conversionPct = analytics
    ? computeConversionPct(metrics?.ordersThisMonth ?? 0, analytics.metrics.bagVisitors)
    : null;

  const catalogStats = analytics
    ? [
        { value: analytics.metrics.visits, label: "Visitas" },
        { value: analytics.metrics.uniqueVisitors, label: "Visitantes únicos" },
        { value: analytics.metrics.buyClicks, label: "Cliques em comprar" },
        {
          // Sem ninguém com sacola no período não existe taxa — "—" em vez de 0%.
          value: conversionPct === null ? "—" : `${conversionPct}%`,
          label: "Conversão sacola → pedido",
        },
      ]
    : null;

  // Produto deletado sai da lista: o evento continua no banco, mas sem nome não
  // há o que exibir (assumption da spec).
  const topViewed: TopViewedItem[] = (analytics?.topProducts ?? []).flatMap((item) => {
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
  };
}
