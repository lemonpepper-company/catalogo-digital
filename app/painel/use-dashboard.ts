"use client";

import { formatCents } from "@/lib/utils";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";

export function useDashboard(products: StoreProduct[], metrics: OrderMetrics | null) {
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

  return {
    activeProducts,
    soldOutProducts,
    total: products.length,
    orderStats,
  };
}
