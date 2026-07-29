import { describe, it, expect } from "vitest";
import {
  monthStartInSaoPaulo,
  computeOrderMetrics,
} from "@/lib/order-metrics";
import type { OrderStatus } from "@/lib/orders";

function row(status: OrderStatus, total_cents: number) {
  return { status, total_cents };
}

describe("monthStartInSaoPaulo", () => {
  it("devolve 1º de janeiro às 00:00 de São Paulo (03:00 UTC)", () => {
    const start = monthStartInSaoPaulo(new Date("2026-01-15T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("devolve 1º de julho às 00:00 de São Paulo (03:00 UTC)", () => {
    const start = monthStartInSaoPaulo(new Date("2026-07-27T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });

  it("usa o mês do fuso de São Paulo, não o de UTC, na virada do mês", () => {
    // 01/08 01:00 UTC ainda é 31/07 22:00 em São Paulo → mês corrente é julho.
    const start = monthStartInSaoPaulo(new Date("2026-08-01T01:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });

  it("respeita a virada de ano no fuso de São Paulo", () => {
    // 01/01 02:00 UTC ainda é 31/12 23:00 em São Paulo → mês corrente é dezembro.
    const start = monthStartInSaoPaulo(new Date("2026-01-01T02:00:00.000Z"));
    expect(start.toISOString()).toBe("2025-12-01T03:00:00.000Z");
  });

  it("é idempotente quando o instante já é exatamente o início do mês", () => {
    const start = monthStartInSaoPaulo(new Date("2026-07-01T03:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });
});

describe("computeOrderMetrics", () => {
  it("conta em ordersThisMonth todos os pedidos com status diferente de cancelado", () => {
    const metrics = computeOrderMetrics(
      [
        row("pendente", 1000),
        row("confirmado", 2000),
        row("cancelado", 3000),
        row("pendente", 4000),
      ],
      0
    );
    expect(metrics.ordersThisMonth).toBe(3);
  });

  it("soma em confirmedCentsThisMonth apenas os pedidos confirmados", () => {
    const metrics = computeOrderMetrics(
      [
        row("pendente", 1000),
        row("confirmado", 2500),
        row("confirmado", 7500),
        row("cancelado", 9999),
      ],
      0
    );
    expect(metrics.confirmedCentsThisMonth).toBe(10000);
  });

  it("usa o total de pendentes recebido como pendingCount, sem filtro de período", () => {
    const metrics = computeOrderMetrics([row("confirmado", 5000)], 7);
    expect(metrics.pendingCount).toBe(7);
  });

  it("devolve zeros para lista vazia, sem NaN", () => {
    const metrics = computeOrderMetrics([], 0);
    expect(metrics).toEqual({
      ordersThisMonth: 0,
      confirmedCentsThisMonth: 0,
      pendingCount: 0,
    });
    expect(Number.isNaN(metrics.confirmedCentsThisMonth)).toBe(false);
  });

  it("pedido cancelado não conta em nenhuma das duas métricas do mês", () => {
    const metrics = computeOrderMetrics(
      [row("cancelado", 50000), row("cancelado", 10000)],
      0
    );
    expect(metrics.ordersThisMonth).toBe(0);
    expect(metrics.confirmedCentsThisMonth).toBe(0);
  });

  it("cancelar um pedido confirmado derruba as duas métricas do mês", () => {
    const antes = computeOrderMetrics([row("confirmado", 12000)], 0);
    const depois = computeOrderMetrics([row("cancelado", 12000)], 0);
    expect(antes.ordersThisMonth).toBe(1);
    expect(antes.confirmedCentsThisMonth).toBe(12000);
    expect(depois.ordersThisMonth).toBe(0);
    expect(depois.confirmedCentsThisMonth).toBe(0);
  });

  it("pedido pendente conta no mês mas não soma no faturamento confirmado", () => {
    const metrics = computeOrderMetrics([row("pendente", 8000)], 1);
    expect(metrics.ordersThisMonth).toBe(1);
    expect(metrics.confirmedCentsThisMonth).toBe(0);
    expect(metrics.pendingCount).toBe(1);
  });

  it("devolve as três métricas juntas para uma carteira mista", () => {
    const metrics = computeOrderMetrics(
      [
        row("pendente", 1000),
        row("confirmado", 3000),
        row("confirmado", 2000),
        row("cancelado", 9000),
      ],
      2
    );
    expect(metrics).toEqual({
      ordersThisMonth: 3,
      confirmedCentsThisMonth: 5000,
      pendingCount: 2,
    });
  });
});
