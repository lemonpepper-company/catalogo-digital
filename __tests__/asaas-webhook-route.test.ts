import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const eq = vi.fn();
const or = vi.fn();
const single = vi.fn();
const cancelarNoAsaas = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: single }) }),
      update: (v: unknown) => {
        update(v);
        // .eq(...) é awaited direto na maioria dos updates, mas o vínculo de
        // checkout hospedado encadeia .eq(...).or(...) — o resultado de eq()
        // precisa ser thenable E ter .or() (espiado separadamente), então
        // anexamos .or na própria Promise devolvida.
        return {
          eq: (...args: unknown[]) => {
            const result = eq(...args) as Promise<{ error: unknown }>;
            return Object.assign(result, { or: (...orArgs: unknown[]) => or(...orArgs) });
          },
        };
      },
    }),
  }),
}));

vi.mock("@/lib/asaas/subscriptions", () => ({
  cancelarAssinatura: (...args: unknown[]) => cancelarNoAsaas(...args),
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
  or.mockReset().mockResolvedValue({ error: null });
  cancelarNoAsaas.mockReset().mockResolvedValue(undefined);
  single.mockReset().mockResolvedValue({
    data: {
      id: "loja-1",
      billing_cycle: "monthly",
      pending_plan: null,
      subscription_status: "active",
      asaas_subscription_id: "sub_1",
    },
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

  /**
   * A entrega é at-least-once. Se este evento for reentregue DEPOIS do
   * PAYMENT_CONFIRMED já ter trocado o vínculo temporário (checkout.id) pelo
   * id real da assinatura, uma escrita sem guarda reverteria a coluna,
   * quebrando o match das renovações seguintes (que casam por
   * payment.subscription). O filtro .or(...) só deve permitir a escrita
   * quando a coluna ainda está vazia ou já é este mesmo checkout.id — nunca
   * sobrescrever um valor diferente (um id de assinatura real já resolvido).
   */
  it("CHECKOUT_PAID só escreve se a coluna estiver vazia ou já for este checkout.id", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    await POST(
      req({
        event: "CHECKOUT_PAID",
        checkout: { id: "chk_123", externalReference: "loja-1" },
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "loja-1");
    expect(or).toHaveBeenCalledWith(
      "asaas_subscription_id.is.null,asaas_subscription_id.eq.chk_123"
    );
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

  /**
   * A entrega não garante ordem entre CHECKOUT_PAID e o PAYMENT_CONFIRMED/
   * RECEIVED seguinte. Se o pagamento chega primeiro (por checkoutSession) e
   * não acha loja, é corrida — CHECKOUT_PAID ainda não gravou o vínculo
   * temporário — não loja inexistente. 200 aqui descartaria o evento para
   * sempre (o Asaas só reenvia depois de resposta não-2xx); 409 força o
   * reenvio, dando tempo do CHECKOUT_PAID chegar.
   */
  it("PAYMENT_CONFIRMED por checkoutSession sem loja casada, pagamento recente (corrida com CHECKOUT_PAID) devolve 409, não 200", async () => {
    single.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_real_1",
          externalReference: null,
          checkoutSession: "chk_123",
          dateCreated: new Date().toISOString(),
        },
      })
    );
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * Sem limite, um CHECKOUT_PAID que nunca chega (o cenário mais provável é
   * o evento não estar marcado no cadastro do webhook no painel do Asaas)
   * faria este pagamento devolver 409 pra sempre — 15 respostas não-2xx
   * consecutivas pausam a fila do Asaas pra base inteira, não só esta loja.
   */
  it("checkoutSession órfão além de 30min devolve 200 sem escrever — evita pausar a fila indefinidamente", async () => {
    single.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const antigo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_real_1",
          externalReference: null,
          checkoutSession: "chk_123",
          dateCreated: antigo,
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("checkoutSession órfão sem dateCreated no payload é tratado como antigo — devolve 200 sem escrever", async () => {
    single.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_real_1",
          externalReference: null,
          checkoutSession: "chk_123",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * A cobrança avulsa do upgrade (diferença proporcional) não pertence a uma
 * assinatura — não tem payment.subscription. Ela só pode promover um
 * pending_plan já agendado; nunca deve mexer em subscription_status/
 * plan_expires_at, que são geridos pelos eventos da assinatura recorrente de
 * verdade.
 */
describe("POST /api/webhooks/asaas — cobrança avulsa de upgrade (sem payment.subscription)", () => {
  const AVULSA_CONFIRMADA = {
    event: "PAYMENT_CONFIRMED",
    payment: { dueDate: "2026-08-06", externalReference: "loja-1" },
  };

  it("confirmada: promove o pending_plan, mas não mexe em subscription_status nem plan_expires_at", async () => {
    single.mockResolvedValue({
      data: {
        id: "loja-1",
        billing_cycle: "monthly",
        pending_plan: "pro",
        subscription_status: "active",
        asaas_subscription_id: "sub_1",
      },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req(AVULSA_CONFIRMADA));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ plan: "pro", pending_plan: null });
  });

  it("vencida: não muda subscription_status nem cancela nada — a assinatura em si não foi afetada", async () => {
    single.mockResolvedValue({
      data: {
        id: "loja-1",
        billing_cycle: "monthly",
        pending_plan: "pro",
        subscription_status: "active",
        asaas_subscription_id: "sub_1",
      },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_OVERDUE",
        payment: { dueDate: "2026-08-06", externalReference: "loja-1" },
      })
    );

    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect(cancelarNoAsaas).not.toHaveBeenCalled();
  });

  it("estornada/chargeback: não cancela a assinatura por engano", async () => {
    single.mockResolvedValue({
      data: {
        id: "loja-1",
        billing_cycle: "monthly",
        pending_plan: null,
        subscription_status: "active",
        asaas_subscription_id: "sub_1",
      },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_REFUNDED",
        payment: { dueDate: "2026-08-06", externalReference: "loja-1" },
      })
    );

    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});

/**
 * Sem cartão pra tentar de novo sozinho, uma assinatura Pix nunca paga faz o
 * Asaas gerar uma cobrança nova a cada ciclo pra sempre. O acesso já está
 * cortado (plan_expires_at no passado), mas cancelar no Asaas evita lixo
 * indefinido no painel de cobranças.
 */
describe("POST /api/webhooks/asaas — Pix nunca pago (PAYMENT_OVERDUE repetido)", () => {
  it("primeiro PAYMENT_OVERDUE (loja ainda active) só dá o período de graça — não cancela", async () => {
    single.mockResolvedValue({
      data: {
        id: "loja-1",
        billing_cycle: "monthly",
        pending_plan: null,
        subscription_status: "active",
        asaas_subscription_id: "sub_1",
      },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_OVERDUE",
        payment: { dueDate: "2026-09-01", subscription: "sub_1", externalReference: "loja-1" },
      })
    );

    expect(res.status).toBe(200);
    expect(cancelarNoAsaas).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ subscription_status: "past_due" })
    );
  });

  it("segundo PAYMENT_OVERDUE consecutivo (loja já past_due) cancela no Asaas e marca canceled", async () => {
    single.mockResolvedValue({
      data: {
        id: "loja-1",
        billing_cycle: "monthly",
        pending_plan: null,
        subscription_status: "past_due",
        asaas_subscription_id: "sub_1",
      },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_OVERDUE",
        payment: { dueDate: "2026-10-01", subscription: "sub_1", externalReference: "loja-1" },
      })
    );

    expect(res.status).toBe(200);
    expect(cancelarNoAsaas).toHaveBeenCalledWith("sub_1");
    expect(update).toHaveBeenCalledWith({ subscription_status: "canceled" });
  });

  it("falha ao cancelar no Asaas não impede a gravação local", async () => {
    cancelarNoAsaas.mockRejectedValue(new Error("Asaas fora do ar"));
    single.mockResolvedValue({
      data: {
        id: "loja-1",
        billing_cycle: "monthly",
        pending_plan: null,
        subscription_status: "past_due",
        asaas_subscription_id: "sub_1",
      },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_OVERDUE",
        payment: { dueDate: "2026-10-01", subscription: "sub_1", externalReference: "loja-1" },
      })
    );

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ subscription_status: "canceled" });
  });
});
