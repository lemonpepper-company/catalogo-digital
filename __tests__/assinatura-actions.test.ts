import { describe, it, expect, vi, beforeEach } from "vitest";

const getCurrentStore = vi.fn();
const update = vi.fn((_patch: Record<string, unknown>) => ({
  eq: vi.fn().mockResolvedValue({ error: null }),
}));
const criarCheckoutCartao = vi.fn();
const criarAssinaturaPix = vi.fn();
const criarCliente = vi.fn();
const atualizarCliente = vi.fn();
const atualizarAssinatura = vi.fn();
const cancelarNoAsaas = vi.fn();
const criarCobrancaAvulsa = vi.fn();
const getUser = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/server/store", () => ({ getCurrentStore }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update }) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser }, from: () => ({ update }) }),
}));
vi.mock("@/lib/asaas/subscriptions", () => ({
  criarCliente,
  atualizarCliente,
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
  document: "52998224725",
  whatsapp: "(11) 99999-0000",
  address: "Rua das Flores",
  addressNumber: "123",
  addressProvince: "Centro",
  addressCity: "São Paulo",
  addressPostalCode: "01001000",
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentStore.mockResolvedValue(LOJA_FREE);
  getUser.mockResolvedValue({ data: { user: { email: "ana@atelie.test" } } });
  criarCliente.mockResolvedValue({ id: "cus_1" });
  atualizarCliente.mockResolvedValue(undefined);
  criarCheckoutCartao.mockResolvedValue({ id: "chk_1", link: "https://sandbox.asaas.com/c/1" });
  criarAssinaturaPix.mockResolvedValue({ id: "sub_1", invoiceUrl: "https://sandbox.asaas.com/i/1" });
  cancelarNoAsaas.mockResolvedValue(undefined);
});

describe("iniciarAssinatura", () => {
  it("cartão devolve o link do checkout hospedado", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");
    expect(r).toEqual({ ok: true, redirectUrl: "https://sandbox.asaas.com/c/1" });
    expect(criarAssinaturaPix).not.toHaveBeenCalled();
  });

  /**
   * Sem o customer, o checkout hospedado não tem quem preencher e o lojista
   * tinha que redigitar nome/CPF do zero, mesmo já tendo esse cadastro salvo
   * — achado testando ao vivo (o Pix já criava/reaproveitava o customer, o
   * cartão não). Os dois meios agora passam pelo mesmo caminho.
   */
  it("cartão também cria/reaproveita o customer do Asaas e passa pro checkout", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");
    expect(criarCliente).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ateliê Mira",
        cpfCnpj: "52998224725",
        email: "ana@atelie.test",
        phone: "11999990000",
      })
    );
    expect(criarCheckoutCartao).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_1" })
    );
  });

  /**
   * O Asaas rejeita usar um customer sem email num checkout ("O campo email
   * deve existir para o customer informado") — achado testando ao vivo.
   * `stores` não tem coluna de email, então tem que vir do usuário
   * autenticado (auth.users), não da loja.
   */
  it("sem email na conta autenticada, devolve erro em vez de criar customer sem email", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "CREDIT_CARD")).toEqual({
      error: "E-mail da conta não encontrado.",
    });
    expect(criarCliente).not.toHaveBeenCalled();
  });

  /**
   * Mesma classe de bug do email, achada logo em seguida testando ao vivo:
   * o Asaas também rejeita customer sem telefone. store.whatsapp é a fonte,
   * normalizado pra só dígitos como o Asaas espera.
   */
  it("sem whatsapp cadastrado, devolve erro em vez de criar customer sem telefone", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, whatsapp: null });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "CREDIT_CARD")).toEqual({
      error: "WhatsApp da loja não cadastrado.",
    });
    expect(criarCliente).not.toHaveBeenCalled();
  });

  it("cartão sem document devolve o código DOCUMENTO_NECESSARIO — mesma exigência do Pix", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, document: null });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "CREDIT_CARD")).toEqual({
      error: "DOCUMENTO_NECESSARIO",
    });
    expect(criarCheckoutCartao).not.toHaveBeenCalled();
  });

  /**
   * Reaproveitar sem sincronizar repetiria pra sempre o mesmo erro de um
   * customer criado antes desses campos existirem (achado real: email,
   * depois phone, depois endereço — um de cada vez, ao vivo). Por isso
   * reaproveitar sempre sincroniza o cadastro completo via PUT.
   */
  it("cartão reaproveita asaas_customer_id já salvo, mas sincroniza o cadastro em vez de criar de novo", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, asaasCustomerId: "cus_existente" });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");
    expect(criarCliente).not.toHaveBeenCalled();
    expect(atualizarCliente).toHaveBeenCalledWith(
      "cus_existente",
      expect.objectContaining({ email: "ana@atelie.test", address: "Rua das Flores" })
    );
    expect(criarCheckoutCartao).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_existente" })
    );
  });

  /**
   * Só o checkout hospedado de cartão exige endereço completo no customer
   * (POST /v3/checkouts recusa sem address/addressNumber/postalCode/
   * province/city) — achado testando ao vivo, depois de já ter corrigido
   * email e telefone. Pix nunca precisou disso.
   */
  it("cartão sem endereço devolve o código ENDERECO_NECESSARIO", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, address: null });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "CREDIT_CARD")).toEqual({
      error: "ENDERECO_NECESSARIO",
    });
    expect(criarCliente).not.toHaveBeenCalled();
    expect(criarCheckoutCartao).not.toHaveBeenCalled();
  });

  it("Pix não exige endereço — nunca passa pelo checkout hospedado", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_FREE, address: null });
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("pro", "monthly", "PIX");
    expect(r).not.toEqual({ error: "ENDERECO_NECESSARIO" });
    expect(criarAssinaturaPix).toHaveBeenCalled();
  });

  /**
   * Sem o link da cobrança, o lojista não tem como pagar o Pix — o Asaas não
   * avisa nada sozinho na nossa tela (diferente do cartão, que redireciona
   * pro checkout hospedado deles).
   */
  it("Pix cria a assinatura direto e devolve o link da cobrança pra pagar", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("starter", "annual", "PIX");
    expect(r).toEqual({ ok: true, pixUrl: "https://sandbox.asaas.com/i/1" });
    expect(criarCheckoutCartao).not.toHaveBeenCalled();
    expect(criarAssinaturaPix).toHaveBeenCalled();
  });

  it("nunca grava plan nem plan_expires_at — isso é do webhook", async () => {
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
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("starter", "annual", "PIX");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "starter" }));
  });

  /**
   * Cancelar mantém o acesso até plan_expires_at — assinar de novo no mesmo
   * plano (ou num plano menor) nesse período cobraria duas vezes o mesmo
   * intervalo. Só o upgrade fica liberado, porque ele não duplica valor.
   */
  describe("com assinatura cancelada ainda dentro do período pago", () => {
    const LOJA_STARTER_CANCELADA = {
      ...LOJA_FREE,
      plan: "starter",
      subscriptionStatus: "canceled",
      planExpiresAt: "2099-09-01T00:00:00.000Z",
    };

    it("Pro segue normalmente — é upgrade", async () => {
      getCurrentStore.mockResolvedValue(LOJA_STARTER_CANCELADA);
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      const r = await iniciarAssinatura("pro", "monthly", "PIX");

      expect(r).not.toEqual(expect.objectContaining({ error: expect.any(String) }));
      expect(criarAssinaturaPix).toHaveBeenCalled();
    });

    it("Starter (mesmo plano) é rejeitado sem chamar o Asaas", async () => {
      getCurrentStore.mockResolvedValue(LOJA_STARTER_CANCELADA);
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      const r = await iniciarAssinatura("starter", "monthly", "PIX");

      expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
      expect(criarAssinaturaPix).not.toHaveBeenCalled();
      expect(criarCliente).not.toHaveBeenCalled();
    });

    it("com prazo no passado, segue normalmente — o período pago já acabou", async () => {
      getCurrentStore.mockResolvedValue({
        ...LOJA_STARTER_CANCELADA,
        planExpiresAt: "2020-01-01T00:00:00.000Z",
      });
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      const r = await iniciarAssinatura("starter", "monthly", "PIX");

      expect(r).not.toEqual(expect.objectContaining({ error: expect.any(String) }));
      expect(criarAssinaturaPix).toHaveBeenCalled();
    });
  });

  /**
   * Diferente do cartão (checkout hospedado expira sozinho em 60min se
   * abandonado), o Pix cria a assinatura no Asaas ANTES de qualquer
   * pagamento — assinar de novo sem cancelar a anterior duplica a cobrança
   * pra sempre. Achado ao vivo: duas assinaturas ACTIVE simultâneas pro
   * mesmo cliente.
   */
  describe("Pix com assinatura anterior pendente de pagamento", () => {
    it("com asaas_subscription_id e subscription_status nulo, cancela a anterior antes de criar a nova", async () => {
      getCurrentStore.mockResolvedValue({
        ...LOJA_FREE,
        asaasSubscriptionId: "sub_abandonada",
        subscriptionStatus: null,
      });
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      await iniciarAssinatura("starter", "annual", "PIX");

      expect(cancelarNoAsaas).toHaveBeenCalledWith("sub_abandonada");
      expect(cancelarNoAsaas.mock.invocationCallOrder[0]).toBeLessThan(
        criarAssinaturaPix.mock.invocationCallOrder[0]
      );
      expect(criarAssinaturaPix).toHaveBeenCalled();
    });

    it("com subscription_status preenchido, não cancela — é assinatura que já funcionou", async () => {
      getCurrentStore.mockResolvedValue({
        ...LOJA_FREE,
        asaasSubscriptionId: "sub_ativa",
        subscriptionStatus: "active",
      });
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      await iniciarAssinatura("pro", "monthly", "PIX");

      expect(cancelarNoAsaas).not.toHaveBeenCalled();
      expect(criarAssinaturaPix).toHaveBeenCalled();
    });

    it("sem asaas_subscription_id, não tenta cancelar nada", async () => {
      getCurrentStore.mockResolvedValue({
        ...LOJA_FREE,
        asaasSubscriptionId: null,
        subscriptionStatus: null,
      });
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      await iniciarAssinatura("pro", "monthly", "PIX");

      expect(cancelarNoAsaas).not.toHaveBeenCalled();
    });

    it("cancelamento que falha não bloqueia a contratação nova, e registra o erro com o id", async () => {
      const erroConsole = vi.spyOn(console, "error").mockImplementation(() => {});
      cancelarNoAsaas.mockRejectedValue(new Error("subscription not found"));
      getCurrentStore.mockResolvedValue({
        ...LOJA_FREE,
        asaasSubscriptionId: "sub_abandonada",
        subscriptionStatus: null,
      });
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      const r = await iniciarAssinatura("starter", "annual", "PIX");

      expect(r).toEqual({ ok: true, pixUrl: "https://sandbox.asaas.com/i/1" });
      expect(criarAssinaturaPix).toHaveBeenCalled();
      expect(erroConsole).toHaveBeenCalledWith(
        expect.stringContaining("sub_abandonada"),
        expect.any(Error)
      );
      erroConsole.mockRestore();
    });

    it("cartão não cancela nada, mesmo com assinatura Pix abandonada", async () => {
      getCurrentStore.mockResolvedValue({
        ...LOJA_FREE,
        asaasSubscriptionId: "sub_abandonada",
        subscriptionStatus: null,
      });
      const { iniciarAssinatura } = await import("@/app/actions/assinatura");

      await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");

      expect(cancelarNoAsaas).not.toHaveBeenCalled();
    });
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

    await trocarPlano("pro", "CREDIT_CARD");

    expect(criarCobrancaAvulsa).toHaveBeenCalled();
    for (const [patch] of update.mock.calls) {
      expect(patch).not.toHaveProperty("plan");
    }
  });

  /**
   * Sem devolver o invoiceUrl pro client redirecionar, a cobrança fica
   * criada no Asaas e o lojista nunca vê como pagar. Achado testando upgrade
   * ao vivo: a tela dizia "processando" mas nunca cobrava nada de fato.
   */
  it("upgrade devolve o invoiceUrl da cobrança avulsa como redirectUrl", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://sandbox.asaas.com/i/pay_1" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    const r = await trocarPlano("pro", "CREDIT_CARD");

    expect(r).toEqual({ ok: true, redirectUrl: "https://sandbox.asaas.com/i/pay_1" });
  });

  /**
   * billingType UNDEFINED gerava uma tela genérica de "escolha a forma de
   * pagamento" (Pix/boleto/cartão) — achado testando upgrade ao vivo. A
   * cobrança avulsa passa a usar o meio que o lojista escolheu no clique,
   * igual à primeira assinatura.
   */
  it("usa o meio escolhido no clique como billingType (cartão)", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro", "CREDIT_CARD");

    expect(criarCobrancaAvulsa).toHaveBeenCalledWith(
      expect.objectContaining({ billingType: "CREDIT_CARD" })
    );
  });

  it("usa o meio escolhido no clique como billingType (Pix)", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro", "PIX");

    expect(criarCobrancaAvulsa).toHaveBeenCalledWith(
      expect.objectContaining({ billingType: "PIX" })
    );
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

    await trocarPlano("pro", "CREDIT_CARD");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "pro" }));
  });

  /**
   * Achado ao vivo: a tela de pagamento do upgrade mostrava bairro e
   * telefone vazios — o customer no Asaas não era sincronizado antes da
   * cobrança, diferente de iniciarAssinatura.
   */
  it("sincroniza o cliente no Asaas antes de atualizar a assinatura", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro", "CREDIT_CARD");

    expect(atualizarCliente).toHaveBeenCalled();
    const ordemCliente = atualizarCliente.mock.invocationCallOrder[0];
    const ordemAssinatura = atualizarAssinatura.mock.invocationCallOrder[0];
    expect(ordemCliente).toBeLessThan(ordemAssinatura);
  });

  it("envia os mesmos campos de cliente que iniciarAssinatura", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro", "CREDIT_CARD");

    expect(atualizarCliente).toHaveBeenCalledWith(
      "cus_1",
      expect.objectContaining({
        name: "Ateliê Mira",
        cpfCnpj: "52998224725",
        email: "ana@atelie.test",
        phone: "11999990000",
        address: "Rua das Flores",
      })
    );
  });

  /**
   * Decisão de produto: Pro não troca para Starter — quem quiser reduzir
   * cancela e assina o menor depois. Server Action é endpoint público, então
   * o bloqueio precisa existir aqui, não só no botão desabilitado do client.
   */
  it("Pro → Starter é rejeitado antes de qualquer chamada ao Asaas", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_STARTER, plan: "pro" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    const r = await trocarPlano("starter", "CREDIT_CARD");

    expect(r).toEqual({ error: "Para mudar para um plano menor, cancele a assinatura atual." });
    expect(atualizarAssinatura).not.toHaveBeenCalled();
    expect(criarCobrancaAvulsa).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
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
    expect(patch).toEqual({ subscription_status: "canceled", pending_plan: null });
  });

  /**
   * Sem isso, cancelar com uma troca de plano aguardando confirmação
   * (iniciarAssinatura/trocarPlano gravam pending_plan no clique, antes do
   * pagamento) travava a UI pra sempre em "Troca já em andamento" — a
   * assinatura cancelada nunca mais gera o PAYMENT_CONFIRMED/RECEIVED que
   * normalmente limparia isso.
   */
  it("limpa pending_plan mesmo quando havia uma troca aguardando confirmação", async () => {
    getCurrentStore.mockResolvedValue({
      ...LOJA_FREE,
      plan: "starter",
      asaasSubscriptionId: "sub_1",
      pendingPlan: "pro",
    });
    const { cancelarAssinatura } = await import("@/app/actions/assinatura");

    await cancelarAssinatura();

    const patch = update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch).toEqual(expect.objectContaining({ pending_plan: null }));
  });
});

/**
 * Coletado pela modal quando o lojista tenta assinar via cartão sem
 * endereço. Rua/bairro/cidade chegam prontos da modal (só sugeridos pelo
 * CEP no cliente, via app/actions/cep.ts) — salvarEndereco não consulta o
 * ViaCEP, só valida e grava.
 */
describe("salvarEndereco", () => {
  beforeEach(() => {
    getCurrentStore.mockResolvedValue(LOJA_FREE);
  });

  it("valida e grava o endereço normalizado", async () => {
    const { salvarEndereco } = await import("@/app/actions/assinatura");

    const r = await salvarEndereco("01001-000", "123", "Rua das Flores", "Centro", "São Paulo");

    expect(r).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      address: "Rua das Flores",
      address_number: "123",
      address_province: "Centro",
      address_city: "São Paulo",
      address_postal_code: "01001000",
    });
  });

  it("CEP inválido devolve erro sem gravar", async () => {
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    expect(await salvarEndereco("123", "10", "Rua X", "Bairro X", "Cidade X")).toEqual({
      error: "CEP inválido.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("número vazio devolve erro sem gravar", async () => {
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    expect(await salvarEndereco("01001-000", "  ", "Rua X", "Bairro X", "Cidade X")).toEqual({
      error: "Número é obrigatório.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("rua vazia devolve erro sem gravar", async () => {
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    expect(await salvarEndereco("01001-000", "123", "  ", "Bairro X", "Cidade X")).toEqual({
      error: "Rua é obrigatória.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("bairro vazio devolve erro sem gravar", async () => {
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    expect(await salvarEndereco("01001-000", "123", "Rua X", "  ", "Cidade X")).toEqual({
      error: "Bairro é obrigatório.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("cidade vazia devolve erro sem gravar", async () => {
    const { salvarEndereco } = await import("@/app/actions/assinatura");
    expect(await salvarEndereco("01001-000", "123", "Rua X", "Bairro X", "  ")).toEqual({
      error: "Cidade é obrigatória.",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
