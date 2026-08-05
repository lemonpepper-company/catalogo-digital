import { describe, it, expect, vi, beforeEach } from "vitest";

const asaasFetch = vi.fn();

vi.mock("@/lib/asaas/client", () => ({ asaasFetch }));

const PARAMS = {
  customerId: "cus_1",
  plan: "starter" as const,
  cycle: "monthly" as const,
  storeId: "loja-1",
  primeiroVencimento: new Date("2026-09-01T00:00:00.000Z"),
};

beforeEach(() => {
  asaasFetch.mockReset();
});

/**
 * O POST /subscriptions do Pix devolve antes do Asaas materializar a
 * primeira cobrança — um GET /payments logo em seguida pode vir vazio mesmo
 * com a assinatura criada com sucesso (visto ao vivo no sandbox: o lojista
 * clicava, a assinatura existia no Asaas, mas a tela caía no "sem link pra
 * pagar" porque a única tentativa de buscar o invoiceUrl chegou cedo demais).
 */
describe("criarAssinaturaPix — invoiceUrl chega atrasado", () => {
  it("acha de primeira quando o payment já existe", async () => {
    asaasFetch
      .mockResolvedValueOnce({ id: "sub_1" })
      .mockResolvedValueOnce({ data: [{ invoiceUrl: "https://sandbox.asaas.com/i/1" }] });

    const { criarAssinaturaPix } = await import("@/lib/asaas/subscriptions");
    const r = await criarAssinaturaPix(PARAMS);

    expect(r).toEqual({ id: "sub_1", invoiceUrl: "https://sandbox.asaas.com/i/1" });
    expect(asaasFetch).toHaveBeenCalledTimes(2);
  });

  it("tenta de novo (com espera) quando o payment ainda não existe", async () => {
    vi.useFakeTimers();
    try {
      asaasFetch
        .mockResolvedValueOnce({ id: "sub_1" })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [{ invoiceUrl: "https://sandbox.asaas.com/i/1" }] });

      const { criarAssinaturaPix } = await import("@/lib/asaas/subscriptions");
      const promise = criarAssinaturaPix(PARAMS);

      await vi.runAllTimersAsync();
      const r = await promise;

      expect(r).toEqual({ id: "sub_1", invoiceUrl: "https://sandbox.asaas.com/i/1" });
      expect(asaasFetch).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("desiste depois do limite de tentativas — devolve invoiceUrl null, não quebra", async () => {
    vi.useFakeTimers();
    try {
      asaasFetch.mockResolvedValueOnce({ id: "sub_1" }).mockResolvedValue({ data: [] });

      const { criarAssinaturaPix } = await import("@/lib/asaas/subscriptions");
      const promise = criarAssinaturaPix(PARAMS);

      await vi.runAllTimersAsync();
      const r = await promise;

      expect(r).toEqual({ id: "sub_1", invoiceUrl: null });
      // 1 criação + 4 tentativas de busca do invoiceUrl.
      expect(asaasFetch).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });
});
