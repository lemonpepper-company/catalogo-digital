export interface CatalogEventMetrics {
  visits: number;
  uniqueVisitors: number;
  buyClicks: number;
  /** Visitantes distintos que colocaram algo na sacola — denominador da conversão. */
  bagVisitors: number;
}

export interface TopViewedProduct {
  productId: string;
  views: number;
}

/**
 * Conversão sacola → pedido, em % com uma casa decimal.
 *
 * `null` quando ninguém montou sacola no período: sem denominador não existe taxa,
 * e a UI mostra "—" em vez de um zero enganoso (ANL-16).
 *
 * O valor NÃO é capado em 100%: mais pedidos que visitantes com sacola é um
 * cenário real (visitante sem storage, pedido por outro canal) e esconder isso
 * mentiria sobre os dados (edge case da spec).
 */
export function computeConversionPct(
  ordersInPeriod: number,
  bagVisitors: number
): number | null {
  if (bagVisitors === 0) return null;
  return Math.round((ordersInPeriod / bagVisitors) * 1000) / 10;
}
