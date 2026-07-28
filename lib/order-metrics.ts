import type { OrderStatus } from "@/lib/orders";

const TIME_ZONE = "America/Sao_Paulo";

export interface OrderMetrics {
  ordersThisMonth: number;
  confirmedCentsThisMonth: number;
  pendingCount: number;
}

export interface OrderMetricRow {
  status: OrderStatus;
  total_cents: number;
}

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function zonedParts(date: Date): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const { type, value } of zonedFormatter.formatToParts(date)) {
    if (type !== "literal") parts[type] = Number(value);
  }
  // "24" aparece na meia-noite em algumas implementações de hourCycle.
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

// Quanto o relógio de São Paulo está adiantado/atrasado em relação a UTC no instante dado.
function zoneOffsetMs(date: Date): number {
  const p = zonedParts(date);
  const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUTC - date.getTime();
}

/** Instante (em UTC) do dia 1 às 00:00 no fuso do lojista brasileiro. */
export function monthStartInSaoPaulo(now: Date): Date {
  const { year, month } = zonedParts(now);
  const naiveStart = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
  return new Date(naiveStart - zoneOffsetMs(new Date(naiveStart)));
}

/**
 * `monthRows` são os pedidos já filtrados pelo mês corrente; `pendingTotal` é a
 * contagem de pendentes de todo o histórico (o card "Aguardando confirmação"
 * não tem filtro de período).
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
