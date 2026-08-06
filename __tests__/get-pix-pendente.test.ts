import { describe, it, expect, vi, beforeEach } from "vitest";

const buscarCobrancaEmAberto = vi.fn();

vi.mock("@/lib/asaas/subscriptions", () => ({ buscarCobrancaEmAberto }));

beforeEach(() => {
  buscarCobrancaEmAberto.mockReset();
  vi.resetModules();
});

/**
 * Cartão é débito automático de verdade — o Asaas tenta o cartão salvo
 * sozinho, sem ação do lojista. Pix não: o Asaas gera uma cobrança nova a
 * cada ciclo que o lojista precisa pagar manualmente, e é isso que este
 * helper expõe pro banner global e pro card da página de Assinatura.
 */
describe("getPixPendente", () => {
  it("cobrança PIX em aberto devolve invoiceUrl e dueDate", async () => {
    buscarCobrancaEmAberto.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/abc123",
      billingType: "PIX",
      dueDate: "2026-08-06",
    });
    const { getPixPendente } = await import("@/lib/server/assinatura");

    const r = await getPixPendente("sub_1", "active");

    expect(buscarCobrancaEmAberto).toHaveBeenCalledWith("sub_1");
    expect(r).toEqual({ invoiceUrl: "https://sandbox.asaas.com/i/abc123", dueDate: "2026-08-06" });
  });

  it("cobrança de CARTÃO em aberto devolve null — cartão cobra sozinho", async () => {
    buscarCobrancaEmAberto.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/cartao1",
      billingType: "CREDIT_CARD",
      dueDate: "2026-08-06",
    });
    const { getPixPendente } = await import("@/lib/server/assinatura");

    expect(await getPixPendente("sub_1", "active")).toBeNull();
  });

  it("sem cobrança em aberto devolve null", async () => {
    buscarCobrancaEmAberto.mockResolvedValue(null);
    const { getPixPendente } = await import("@/lib/server/assinatura");

    expect(await getPixPendente("sub_1", "active")).toBeNull();
  });

  it("sem asaasSubscriptionId, nem consulta o Asaas", async () => {
    const { getPixPendente } = await import("@/lib/server/assinatura");

    expect(await getPixPendente(null, "active")).toBeNull();
    expect(buscarCobrancaEmAberto).not.toHaveBeenCalled();
  });

  it("assinatura cancelada, nem consulta o Asaas", async () => {
    const { getPixPendente } = await import("@/lib/server/assinatura");

    expect(await getPixPendente("sub_1", "canceled")).toBeNull();
    expect(buscarCobrancaEmAberto).not.toHaveBeenCalled();
  });

  it("subscription_status null (primeira assinatura ainda processando) consulta normalmente", async () => {
    buscarCobrancaEmAberto.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/primeira1",
      billingType: "PIX",
      dueDate: "2026-08-06",
    });
    const { getPixPendente } = await import("@/lib/server/assinatura");

    expect(await getPixPendente("sub_1", null)).toEqual({
      invoiceUrl: "https://sandbox.asaas.com/i/primeira1",
      dueDate: "2026-08-06",
    });
  });

  it("Asaas fora do ar devolve null em vez de lançar — best-effort", async () => {
    buscarCobrancaEmAberto.mockRejectedValue(new Error("Asaas fora do ar"));
    const { getPixPendente } = await import("@/lib/server/assinatura");

    await expect(getPixPendente("sub_1", "active")).resolves.toBeNull();
  });
});
