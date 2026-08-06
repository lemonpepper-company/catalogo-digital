import "server-only";
import { asaasFetch } from "@/lib/asaas/client";
import type { BillingCycle } from "@/lib/asaas/events";
import { precoDe, type PaidPlan } from "@/lib/asaas/plans";

const CICLO_ASAAS: Record<BillingCycle, string> = {
  monthly: "MONTHLY",
  annual: "YEARLY",
};

function emIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface DadosCliente {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  /**
   * Só o checkout hospedado de cartão exige endereço completo no customer
   * (confirmado ao vivo no sandbox: POST /v3/checkouts recusa customer sem
   * address/addressNumber/postalCode/province/city, tudo de uma vez) — o Pix
   * não passa por esse endpoint e nunca pediu nada disso.
   */
  address?: string;
  addressNumber?: string;
  province?: string;
  city?: string;
  postalCode?: string;
}

export async function criarCliente(
  params: DadosCliente & { externalReference: string }
): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/customers", { method: "POST", body: params });
}

/**
 * Sincroniza o perfil de um customer já existente no Asaas — necessário
 * porque um customer criado antes destes campos existirem (ou antes de o
 * lojista ter cadastrado o endereço) fica com o cadastro incompleto lá, e
 * reaproveitar o id sem atualizar repete o mesmo erro do checkout.
 */
export async function atualizarCliente(id: string, params: DadosCliente): Promise<void> {
  await asaasFetch(`/customers/${id}`, { method: "PUT", body: params });
}

/**
 * Cartão: checkout hospedado. Confirmado no sandbox que chargeTypes RECURRENT
 * só aceita CREDIT_CARD — Pix devolve 400 e usa criarAssinaturaPix.
 * Nenhum dado de cartão passa por nós: o lojista digita no Asaas.
 *
 * `customer` pré-preenche nome/CPF/endereço no checkout hospedado — sem ele
 * o lojista tinha que redigitar tudo do zero mesmo já tendo esse cadastro
 * (o Pix já criava o customer, o cartão não passava adiante).
 */
export async function criarCheckoutCartao(params: {
  customerId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
  storeId: string;
  primeiroVencimento: Date;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}): Promise<{ id: string; link: string }> {
  const valor = precoDe(params.plan, params.cycle);
  const fim = new Date(params.primeiroVencimento);
  fim.setUTCFullYear(fim.getUTCFullYear() + 10);

  return asaasFetch<{ id: string; link: string }>("/checkouts", {
    method: "POST",
    body: {
      customer: params.customerId,
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      externalReference: params.storeId,
      callback: {
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        expiredUrl: params.expiredUrl,
      },
      items: [{ name: `Vtrine ${params.plan}`, quantity: 1, value: valor }],
      subscription: {
        cycle: CICLO_ASAAS[params.cycle],
        nextDueDate: emIso(params.primeiroVencimento),
        endDate: emIso(fim),
      },
    },
  });
}

/** Pix: assinatura direta. O Asaas gera uma cobrança por ciclo e o lojista paga cada uma. */
/**
 * Cria a assinatura e devolve junto o link da primeira cobrança gerada — sem
 * isso o lojista não tem como pagar (o Asaas não manda nada pra tela nossa
 * sozinho). O endpoint dedicado de QR code (`/payments/{id}/pixQrCode`) se
 * mostrou instável no sandbox (erro mesmo com espera); `invoiceUrl` vem
 * pronto em todo pagamento, sem chamada extra sujeita a falhar, e é a mesma
 * página hospedada que mostra o QR code e o "copia e cola".
 */
function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A primeira cobrança do Pix não vem pronta no POST /subscriptions — o Asaas
// materializa o registro de payment de forma assíncrona, e no sandbox (e às
// vezes em produção) o GET /payments logo em seguida pode devolver vazio
// ainda. Sem repetir a consulta, o lojista às vezes cai direto no caminho
// "sem link pra pagar" mesmo com a assinatura criada com sucesso.
const TENTATIVAS_INVOICE_URL = 4;
const ESPERA_ENTRE_TENTATIVAS_MS = 800;

export async function criarAssinaturaPix(params: {
  customerId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
  storeId: string;
  primeiroVencimento: Date;
}): Promise<{ id: string; invoiceUrl: string | null }> {
  const assinatura = await asaasFetch<{ id: string }>("/subscriptions", {
    method: "POST",
    body: {
      customer: params.customerId,
      billingType: "PIX",
      value: precoDe(params.plan, params.cycle),
      nextDueDate: emIso(params.primeiroVencimento),
      cycle: CICLO_ASAAS[params.cycle],
      externalReference: params.storeId,
      description: `Vtrine ${params.plan}`,
    },
  });

  let invoiceUrl: string | null = null;
  for (let tentativa = 0; tentativa < TENTATIVAS_INVOICE_URL && !invoiceUrl; tentativa++) {
    if (tentativa > 0) await esperar(ESPERA_ENTRE_TENTATIVAS_MS);
    const cobrancas = await asaasFetch<{ data: { invoiceUrl: string }[] }>(
      `/payments?subscription=${assinatura.id}&limit=1`
    );
    invoiceUrl = cobrancas.data[0]?.invoiceUrl ?? null;
  }

  return { id: assinatura.id, invoiceUrl };
}

const STATUS_EM_ABERTO = new Set(["PENDING", "OVERDUE"]);

/**
 * Cobrança em aberto (pendente ou vencida) da assinatura — usada pra mostrar
 * o link de pagamento do Pix na tela sempre que há algo aguardando, não só
 * na hora do clique de assinar. Diferente de criarAssinaturaPix, que sempre
 * pega a cobrança mais recente (a assinatura acabou de ser criada, só existe
 * uma), aqui pode haver cobrança já paga misturada no histórico — por isso o
 * filtro por status em vez de só limit=1.
 */
export async function buscarCobrancaEmAberto(
  subscriptionId: string
): Promise<{ invoiceUrl: string; billingType: string; dueDate: string } | null> {
  const cobrancas = await asaasFetch<{
    data: { invoiceUrl: string; billingType: string; dueDate: string; status: string }[];
  }>(`/payments?subscription=${subscriptionId}&limit=5`);
  return cobrancas.data.find((c) => STATUS_EM_ABERTO.has(c.status)) ?? null;
}

export async function atualizarAssinatura(params: {
  subscriptionId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
}): Promise<void> {
  await asaasFetch(`/subscriptions/${params.subscriptionId}`, {
    method: "PUT",
    body: {
      value: precoDe(params.plan, params.cycle),
      cycle: CICLO_ASAAS[params.cycle],
      // Cobranças pendentes ficam como estão: o proporcional do ciclo corrente
      // é cobrado à parte, e mexer nelas duplicaria a diferença.
      updatePendingPayments: false,
    },
  });
}

export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

/**
 * Diferença proporcional do upgrade. externalReference leva o store.id para
 * o webhook.
 *
 * billingType usa o mesmo meio da assinatura original — com "UNDEFINED" a
 * página de pagamento mostra uma tela genérica pra escolher Pix/boleto/
 * cartão, quebrando a experiência de quem já escolheu um meio na primeira
 * assinatura (achado testando upgrade ao vivo). Continua sendo POST
 * /v3/payments (não /v3/checkouts): o checkout hospedado tem uma lógica de
 * vínculo temporário em asaas_subscription_id (ver webhook) pensada pra
 * primeira assinatura, que corromperia o id de uma assinatura já ativa.
 */
export async function criarCobrancaAvulsa(params: {
  customerId: string;
  valor: number;
  storeId: string;
  vencimento: Date;
  descricao: string;
  billingType: "CREDIT_CARD" | "PIX";
}): Promise<{ id: string; invoiceUrl: string }> {
  return asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
    method: "POST",
    body: {
      customer: params.customerId,
      billingType: params.billingType,
      value: params.valor,
      dueDate: emIso(params.vencimento),
      externalReference: params.storeId,
      description: params.descricao,
    },
  });
}
