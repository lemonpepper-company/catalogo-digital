import type { OrderStatus } from "@/lib/orders";

export { monthStartInSaoPaulo } from "@/lib/timezone-sp";

export interface OrderMetrics {
  ordersThisMonth: number;
  confirmedCentsThisMonth: number;
  pendingCount: number;
}

export interface OrderMetricRow {
  status: OrderStatus;
  total_cents: number;
}

/**
 * `monthRows` são os pedidos já filtrados pelo período desejado (ver
 * `lib/period-filter.ts`); `pendingTotal` é a contagem de pendentes do mesmo
 * período (ou de todo o histórico quando o período é "tudo").
 */
export function computeOrderMetrics(
  monthRows: OrderMetricRow[],
  pendingTotal: number
): OrderMetrics {
  let ordersThisMonth = 0;
  let confirmedCentsThisMonth = 0;

  for (const row of monthRows) {
    if (row.status === "cancelado") continue;
    ordersThisMonth += 1;
    if (row.status === "confirmado") confirmedCentsThisMonth += row.total_cents;
  }

  return { ordersThisMonth, confirmedCentsThisMonth, pendingCount: pendingTotal };
}
