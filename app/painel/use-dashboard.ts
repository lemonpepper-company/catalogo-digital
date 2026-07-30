"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";

export function useDashboard(
  products: StoreProduct[],
  catalogUrl: string,
  metrics: OrderMetrics | null
) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(catalogUrl).catch(() => {});
    setCopied(true);
    flash("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

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
    copied,
    toast,
    handleCopy,
    activeProducts,
    soldOutProducts,
    total: products.length,
    orderStats,
  };
}
