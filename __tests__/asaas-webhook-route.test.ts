import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const eq = vi.fn();
const single = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: single }) }),
      update: (v: unknown) => {
        update(v);
        return { eq };
      },
    }),
  }),
}));

function req(body: unknown, token = "segredo") {
  return new Request("http://localhost:3000/api/webhooks/asaas", {
    method: "POST",
    headers: { "asaas-access-token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CONFIRMADO = {
  event: "PAYMENT_CONFIRMED",
  payment: { dueDate: "2026-09-01", subscription: "sub_1", externalReference: "loja-1" },
};

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = "segredo";
  update.mockReset();
  eq.mockReset().mockResolvedValue({ error: null });
  single.mockReset().mockResolvedValue({
    data: { id: "loja-1", billing_cycle: "monthly", pending_plan: null },
    error: null,
  });
  vi.resetModules();
});

describe("POST /api/webhooks/asaas — autenticação", () => {
  it("token errado devolve 401 e não escreve nada", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req(CONFIRMADO, "errado"));
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("token de comprimento diferente devolve 401 sem lançar", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    expect((await POST(req(CONFIRMADO, "x"))).status).toBe(401);
  });
});

describe("POST /api/webhooks/asaas — aplicação", () => {
  it("PAYMENT_CONFIRMED grava status, validade e limpa pending_plan", async () => {
    single.mockResolvedValue({
      data: { id: "loja-1", billing_cycle: "monthly", pending_plan: "starter" },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req(CONFIRMADO));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "active",
        plan_expires_at: "2026-10-01T00:00:00.000Z",
        plan: "starter",
        pending_plan: null,
      })
    );
  });

  it("sem pending_plan não mexe na coluna plan", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    await POST(req(CONFIRMADO));
    const gravado = update.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado).not.toHaveProperty("plan");
  });

  /**
   * A fila do Asaas pausa após 15 respostas não-2xx consecutivas. Evento que
   * não tratamos precisa sair com 200, ou um evento comum e irrelevante
   * congelaria o estado de assinatura de toda a base.
   */
  it("evento não tratado devolve 200 sem escrever", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req({ ...CONFIRMADO, event: "PAYMENT_CHECKOUT_VIEWED" }));
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("loja inexistente devolve 200 — reenviar não resolveria", async () => {
    single.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    expect((await POST(req(CONFIRMADO))).status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("erro de escrita devolve 500 para o Asaas reenviar", async () => {
    eq.mockResolvedValue({ error: { message: "banco fora" } });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    expect((await POST(req(CONFIRMADO))).status).toBe(500);
  });

  /**
   * translateEvent lança RangeError quando dueDate não é uma data válida.
   * Isso é dado externo malformado, não falha nossa de escrita — precisa sair
   * 200 sem gravar, como um evento não tratado, ou queimaria uma das 15
   * tentativas que pausam a fila do Asaas.
   */
  it("dueDate inválido em PAYMENT_CONFIRMED devolve 200 sem escrever", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "not-a-date",
          subscription: "sub_1",
          externalReference: "loja-1",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * O checkout hospedado de cartão não propaga o externalReference do checkout
 * para a subscription/payment gerada, e checkout.customer vem null no
 * CHECKOUT_PAID (confirmado no sandbox). CHECKOUT_PAID grava checkout.id em
 * asaas_subscription_id como vínculo temporário; PAYMENT_* seguintes sem
 * externalReference casam por payment.checkoutSession (== checkout.id), e o
 * match substitui o vínculo temporário pelos identificadores reais.
 */
describe("POST /api/webhooks/asaas — checkout hospedado (sem externalReference)", () => {
  it("CHECKOUT_PAID grava checkout.id em asaas_subscription_id e não mexe em plan/status", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "CHECKOUT_PAID",
        checkout: { id: "chk_123", externalReference: "loja-1" },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ asaas_subscription_id: "chk_123" });
  });

  it("PAYMENT_CONFIRMED sem externalReference casa pelo checkoutSession, aplica pending_plan e grava os identificadores reais", async () => {
    single.mockResolvedValue({
      data: { id: "loja-1", billing_cycle: "monthly", pending_plan: "pro" },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_real_1",
          externalReference: null,
          customer: "cus_real_1",
          checkoutSession: "chk_123",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "active",
        plan: "pro",
        pending_plan: null,
        asaas_customer_id: "cus_real_1",
        asaas_subscription_id: "sub_real_1",
      })
    );
  });

  it("renovação seguinte (sem externalReference nem checkoutSession) casa por payment.subscription", async () => {
    single.mockResolvedValue({
      data: { id: "loja-1", billing_cycle: "monthly", pending_plan: null },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-10-01",
          subscription: "sub_real_1",
          externalReference: null,
          customer: "cus_real_1",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "active" }));
  });

  it("PAYMENT_CONFIRMED sem externalReference, checkoutSession nem subscription devolve 200 sem escrever", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: { dueDate: "2026-09-01", externalReference: null },
      })
    );
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});
