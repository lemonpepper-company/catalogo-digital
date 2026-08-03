import { describe, it, expect, vi, beforeEach } from "vitest";

const getCurrentStore = vi.fn();
const update = vi.fn((_patch: Record<string, unknown>) => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const criarCheckoutCartao = vi.fn();
const criarAssinaturaPix = vi.fn();
const criarCliente = vi.fn();
const atualizarAssinatura = vi.fn();
const cancelarNoAsaas = vi.fn();
const criarCobrancaAvulsa = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/store", () => ({ getCurrentStore }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update }) }),
}));
vi.mock("@/lib/asaas/subscriptions", () => ({
  criarCliente,
  criarCheckoutCartao,
  criarAssinaturaPix,
  atualizarAssinatura,
  cancelarAssinatura: cancelarNoAsaas,
  criarCobrancaAvulsa,
}));

const LOJA_FREE = {
  id: "loja-1",
  name: "Ateliê Mira",
  plan: "free",
  planExpiresAt: null,
  asaasCustomerId: null,
  asaasSubscriptionId: null,
  billingCycle: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentStore.mockResolvedValue(LOJA_FREE);
  criarCliente.mockResolvedValue({ id: "cus_1" });
  criarCheckoutCartao.mockResolvedValue({ id: "chk_1", link: "https://sandbox.asaas.com/c/1" });
  criarAssinaturaPix.mockResolvedValue({ id: "sub_1" });
});

describe("iniciarAssinatura", () => {
  it("cartão devolve o link do checkout hospedado", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");
    expect(r).toEqual({ ok: true, redirectUrl: "https://sandbox.asaas.com/c/1" });
    expect(criarAssinaturaPix).not.toHaveBeenCalled();
  });

  it("Pix cria a assinatura direto, sem checkout", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, document: "52998224725" });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("starter", "annual", "PIX");
    expect(r).toEqual({ ok: true });
    expect(criarCheckoutCartao).not.toHaveBeenCalled();
    expect(criarAssinaturaPix).toHaveBeenCalled();
  });

  it("nunca grava plan nem plan_expires_at — isso é do webhook", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, document: "52998224725" });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("pro", "monthly", "PIX");
    for (const [patch] of update.mock.calls) {
      expect(patch).not.toHaveProperty("plan");
      expect(patch).not.toHaveProperty("plan_expires_at");
    }
  });

  it("sem loja devolve erro", async () => {
    getCurrentStore.mockResolvedValue(null);
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "PIX")).toEqual({
      error: "Loja não encontrada.",
    });
  });

  it("Pix sem document devolve o código DOCUMENTO_NECESSARIO", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, document: null });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "PIX")).toEqual({
      error: "DOCUMENTO_NECESSARIO",
    });
    expect(criarAssinaturaPix).not.toHaveBeenCalled();
  });

  it("cartão grava pending_plan — é o único jeito do webhook saber para qual plano promover na primeira confirmação", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "pro" }));
  });

  it("Pix grava pending_plan pelo mesmo motivo", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, document: "52998224725" });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("starter", "annual", "PIX");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "starter" }));
  });
});

describe("trocarPlano", () => {
  const LOJA_STARTER = {
    ...LOJA_FREE,
    plan: "starter",
    planExpiresAt: "2026-09-01T00:00:00.000Z",
    asaasCustomerId: "cus_1",
    asaasSubscriptionId: "sub_1",
    billingCycle: "monthly",
  };

  it("upgrade cria cobrança avulsa e NÃO promove o plano", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro");

    expect(criarCobrancaAvulsa).toHaveBeenCalled();
    for (const [patch] of update.mock.calls) {
      expect(patch).not.toHaveProperty("plan");
    }
  });

  /**
   * Sem pending_plan, o PAYMENT_CONFIRMED da cobrança avulsa não teria para
   * qual plano promover — o lojista pagaria a diferença e nunca sairia do
   * plano antigo. Mesma classe de bug que a Task 9 achou em iniciarAssinatura,
   * aqui no caminho de upgrade.
   */
  it("upgrade grava pending_plan — é o que o webhook usa para promover quando a cobrança avulsa confirmar", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "pro" }));
  });

  it("downgrade grava pending_plan e não cobra nada", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_STARTER, plan: "pro" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("starter");

    expect(criarCobrancaAvulsa).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "starter" }));
  });
});

describe("cancelarAssinatura", () => {
  it("marca canceled sem tocar em plan_expires_at", async () => {
    getCurrentStore.mockResolvedValue({
      ...LOJA_FREE,
      plan: "pro",
      asaasSubscriptionId: "sub_1",
      planExpiresAt: "2026-09-01T00:00:00.000Z",
    });
    const { cancelarAssinatura } = await import("@/app/actions/assinatura");

    await cancelarAssinatura();

    expect(cancelarNoAsaas).toHaveBeenCalledWith("sub_1");
    const patch = update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch).toEqual({ subscription_status: "canceled" });
  });
});
