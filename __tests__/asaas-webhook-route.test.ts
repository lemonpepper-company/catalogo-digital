import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const eq = vi.fn();
const or = vi.fn();
const selectAfterOr = vi.fn();
const single = vi.fn();
const cancelarNoAsaas = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      // Reproduz a mutabilidade real do postgrest-js: .eq() muta e devolve o
      // MESMO builder, acumulando filtros. select() por sua vez cria um
      // builder novo a cada chamada — se o código sob teste reaproveitar um
      // único builder entre tentativas (o bug real), os filtros das
      // tentativas anteriores vazam para a próxima.
      select: () => {
        const filtros: Array<[string, unknown]> = [];
        const builder = {
          eq: (coluna: string, valor: unknown) => {
            filtros.push([coluna, valor]);
            return builder;
          },
          maybeSingle: () => single(filtros.slice()),
        };
        return builder;
      },
      update: (v: unknown) => {
        update(v);
        // .eq(...) é awaited direto na maioria dos updates, mas o vínculo de
        // checkout hospedado encadeia .eq(...).or(...).select(...) — o
        // resultado de eq() precisa ser thenable E ter .or() (espiado
        // separadamente), então anexamos .or na própria Promise devolvida.
        // .or() por sua vez devolve algo com .select(), espiado à parte.
        return {
          eq: (...args: unknown[]) => {
            const result = eq(...args) as Promise<{ error: unknown }>;
            return Object.assign(result, {
              or: (...orArgs: unknown[]) => {
                or(...orArgs);
                return { select: (...selArgs: unknown[]) => selectAfterOr(...selArgs) };
              },
            });
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
  or.mockReset();
  selectAfterOr.mockReset().mockResolvedValue({ data: [{ id: "loja-1" }], error: null });
  cancelarNoAsaas.mockReset().mockResolvedValue(undefined);
  // Casa se TODOS os filtros acumulados no builder baterem com a loja padrão
  // — simula o AND que o Postgres aplicaria. Testes que precisam de um
  // resultado diferente sobrescrevem com mockResolvedValue(Once).
  single.mockReset().mockImplementation((filtros: Array<[string, unknown]>) => {
    const loja: Record<string, unknown> = {
      id: "loja-1",
      billing_cycle: "monthly",
      pending_plan: null,
      subscription_status: "active",
      asaas_subscription_id: "sub_1",
      asaas_customer_id: "cus_1",
    };
    const bate = filtros.every(([coluna, valor]) => loja[coluna] === valor);
    return Promise.resolve({ data: bate ? loja : null, error: null });
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
  it("CHECKOUT_PAID só escreve se a coluna estiver vazia, já for este checkout.id, ou subscription_status for null", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    await POST(
      req({
        event: "CHECKOUT_PAID",
        checkout: { id: "chk_123", externalReference: "loja-1" },
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "loja-1");
    expect(or).toHaveBeenCalledWith(
      "asaas_subscription_id.is.null,asaas_subscription_id.eq.chk_123,subscription_status.is.null"
    );
  });

  /**
   * Bug real: loja tinha asaas_subscription_id de uma tentativa Pix
   * abandonada (subscription_status nulo — nunca chegou a promover). Um
   * checkout novo por cartão não conseguia vincular porque a guarda antiga
   * só liberava coluna vazia ou o mesmo checkout.id, tratando o id órfão
   * como se fosse uma assinatura ativa e intocável.
   */
  it("CHECKOUT_PAID com asaas_subscription_id de tentativa anterior e subscription_status nulo grava o vínculo novo", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "CHECKOUT_PAID",
        checkout: { id: "chk_novo", externalReference: "loja-1" },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ asaas_subscription_id: "chk_novo" });
    expect(selectAfterOr).toHaveBeenCalledWith("id");
  });

  it("CHECKOUT_PAID reentregue com o mesmo checkout.id é idempotente", async () => {
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
   * update() que casa zero linhas (ex.: assinatura ativa bloqueou a
   * escrita) não é erro do Supabase — a rota precisa continuar respondendo
   * 200 (não queimar as 15 tentativas que pausam a fila), mas logar, ou o
   * bug fica invisível como aconteceu na primeira vez.
   */
  it("update de vínculo que casa zero linhas responde 200 e loga erro", async () => {
    selectAfterOr.mockResolvedValue({ data: [], error: null });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "CHECKOUT_PAID",
        checkout: { id: "chk_123", externalReference: "loja-1" },
      })
    );
    expect(res.status).toBe(200);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  /**
   * O filtro .or(...) é aplicado pelo Postgres, não pelo mock — uma
   * assinatura ativa (subscription_status = 'active', asaas_subscription_id
   * já é o id real) não casa nenhuma das três condições do filtro, e o
   * Supabase devolve zero linhas em vez de sobrescrever. A rota precisa
   * responder 200 sem tratar isso como falha, exatamente como no caso de
   * zero linhas acima — é o mesmo mecanismo protegendo o caso oposto do bug
   * original (não vincular o novo NÃO pode significar sobrescrever o real).
   */
  it("CHECKOUT_PAID com assinatura ativa não sobrescreve — filtro do Postgres casa zero linhas, rota responde 200", async () => {
    selectAfterOr.mockResolvedValue({ data: [], error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "CHECKOUT_PAID",
        checkout: { id: "chk_reentrega_tardia", externalReference: "loja-1" },
      })
    );
    expect(res.status).toBe(200);
    expect(or).toHaveBeenCalledWith(
      "asaas_subscription_id.is.null,asaas_subscription_id.eq.chk_reentrega_tardia,subscription_status.is.null"
    );
  });

  it("PAYMENT_CONFIRMED sem externalReference casa a loja, aplica pending_plan e grava os identificadores reais", async () => {
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

  /**
   * O checkoutSession (== checkout.id gravado pelo CHECKOUT_PAID) só existe
   * se o CHECKOUT_PAID já tiver sido processado. Se ele ainda não chegou —
   * ou, como no bug real, nunca gravou por causa da guarda antiga — o
   * pagamento chega sem loja casada por payment.subscription nem por
   * checkoutSession. O asaas_customer_id é gravado por nós ANTES do checkout
   * (ver app/actions/assinatura.ts), não depende dessa ordem, e serve de
   * fallback final.
   */
  it("PAYMENT_CONFIRMED sem externalReference, subscription e checkoutSession não casados, mas com customer que bate, acha a loja", async () => {
    single
      .mockResolvedValueOnce({ data: null, error: null }) // busca por payment.subscription: não acha
      .mockResolvedValueOnce({ data: null, error: null }) // busca por checkoutSession: não acha
      .mockResolvedValueOnce({
        data: { id: "loja-1", billing_cycle: "monthly", pending_plan: "pro" },
        error: null,
      }); // fallback por asaas_customer_id: acha
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_nao_bate",
          externalReference: null,
          customer: "cus_real_1",
          checkoutSession: "chk_orfao",
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "active",
        plan: "pro",
        asaas_customer_id: "cus_real_1",
        asaas_subscription_id: "sub_nao_bate",
      })
    );
  });

  /**
   * Bug real: ramos exclusivos (if/else if) faziam checkoutSession truthy
   * impedir que payment.subscription — o id real e definitivo, presente no
   * mesmo evento — fosse sequer tentado. O evento pagou (diferença de upgrade
   * de plano), mas o plano nunca promoveu porque a rota marcava
   * checkoutSession órfão e devolvia 409 pra sempre.
   */
  it("evento com checkoutSession e subscription juntos casa por payment.subscription — não vira órfão", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_RECEIVED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_1", // bate com a loja padrão do beforeEach
          externalReference: null,
          checkoutSession: "chk_nao_bate", // não bate — não pode bloquear a tentativa por subscription
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "active" }));
  });

  /**
   * Bug real: `supabaseLoja` era criado uma vez e reaproveitado entre
   * tentativas — .eq() do postgrest-js muta e devolve o MESMO builder, então
   * a busca por customer herdava o filtro de asaas_subscription_id da
   * tentativa anterior e nunca casava nenhuma linha (mock replica essa
   * mutabilidade acima). Cada tentativa abaixo não bate isolada, exceto a
   * última, por customer — só passa se o código montar uma query nova a cada
   * tentativa.
   */
  it("busca que casaria isolada por customer não pode casar depois de subscription e checkoutSession terem rodado antes", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_outra", // não bate
          externalReference: null,
          customer: "cus_1", // bate isolado — só se a busca usar uma query nova
          checkoutSession: "chk_outra", // não bate
        },
      })
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: "active" }));
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
        dateCreated: new Date().toISOString(),
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_real_1",
          externalReference: null,
          checkoutSession: "chk_123",
        },
      })
    );
    expect(res.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });

  /**
   * dateCreated de TOPO do evento (com hora) e payment.dateCreated (só data)
   * são homônimos com granularidades diferentes — essa é a armadilha do bug
   * real. Um pagamento de segundos atrás em que só payment.dateCreated (data
   * de hoje, sem hora) está presente não pode ser calculado como se tivesse
   * ~1 dia de idade e escapar do 409 por acidente.
   */
  it("órfão em que só payment.dateCreated existe (formato só-data) não é tratado como recente por acidente", async () => {
    single.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(
      req({
        event: "PAYMENT_CONFIRMED",
        // sem dateCreated de topo — só o de payment, granularidade errada
        payment: {
          dueDate: "2026-09-01",
          subscription: "sub_real_1",
          externalReference: null,
          checkoutSession: "chk_123",
          dateCreated: new Date().toISOString().slice(0, 10),
        },
      })
    );
    expect(res.status).toBe(200);
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
        dateCreated: antigo,
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
