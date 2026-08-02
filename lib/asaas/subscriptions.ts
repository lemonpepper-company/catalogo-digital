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

export async function criarCliente(params: {
  name: string;
  cpfCnpj: string;
  email: string;
  externalReference: string;
}): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/customers", { method: "POST", body: params });
}

/**
 * Cartão: checkout hospedado. Confirmado no sandbox que chargeTypes RECURRENT
 * só aceita CREDIT_CARD — Pix devolve 400 e usa criarAssinaturaPix.
 * Nenhum dado de cartão passa por nós: o lojista digita no Asaas.
 */
export async function criarCheckoutCartao(params: {
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
export async function criarAssinaturaPix(params: {
  customerId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
  storeId: string;
  primeiroVencimento: Date;
}): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/subscriptions", {
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

/** Diferença proporcional do upgrade. externalReference leva o store.id para o webhook. */
export async function criarCobrancaAvulsa(params: {
  customerId: string;
  valor: number;
  storeId: string;
  vencimento: Date;
  descricao: string;
}): Promise<{ id: string; invoiceUrl: string }> {
  return asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
    method: "POST",
    body: {
      customer: params.customerId,
      billingType: "UNDEFINED",
      value: params.valor,
      dueDate: emIso(params.vencimento),
      externalReference: params.storeId,
      description: params.descricao,
    },
  });
}
