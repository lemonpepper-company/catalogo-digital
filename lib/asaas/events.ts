export type SubscriptionStatus = "active" | "past_due" | "canceled";
export type BillingCycle = "monthly" | "annual";

export interface AsaasWebhookEvent {
  event: string;
  payment?: {
    dueDate: string;
    subscription?: string | null;
    externalReference?: string | null;
    /** Presente mesmo quando externalReference vem null — usado para gravar o vínculo depois de casar a loja. */
    customer?: string | null;
    /**
     * Igual a checkout.id do evento CHECKOUT_PAID que originou este
     * pagamento — é o único campo que os dois eventos compartilham de forma
     * confiável (checkout.customer vem null no CHECKOUT_PAID; payment não
     * tem externalReference). Usado como fallback de identificação.
     */
    checkoutSession?: string | null;
  } | null;
  /**
   * Só presente em eventos CHECKOUT_*. O externalReference do checkout NÃO
   * propaga para subscription/payment (confirmado no sandbox e na doc do
   * Asaas) — é o único lugar onde ele sobrevive. checkout.customer também não
   * é confiável aqui (vem null no sandbox), então o bootstrapping usa
   * checkout.id, que reaparece como payment.checkoutSession no evento de
   * pagamento seguinte.
   */
  checkout?: {
    id?: string | null;
    externalReference?: string | null;
  } | null;
}

export interface SubscriptionChange {
  subscriptionStatus: SubscriptionStatus;
  /** ISO 8601. Absoluto — nunca derivado do valor atual da coluna. */
  planExpiresAt: string;
  /** true só na confirmação de pagamento, quando um downgrade agendado vira o plano em vigor. */
  applyPendingPlan: boolean;
}

const GRACA_EM_DIAS = 3;

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString();
}

function somarCiclo(iso: string, cycle: BillingCycle): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/**
 * Traduz um evento do Asaas na mudança de estado que ele implica. Puro: não lê
 * relógio nem banco — `now` entra por parâmetro.
 *
 * Devolve null para todo evento que não nos interessa, e a rota responde 200
 * nesse caso: a fila do Asaas pausa após 15 respostas não-2xx consecutivas, e
 * devolver erro para evento irrelevante congelaria o estado de toda a base.
 *
 * O período de graça é calculado a partir do VENCIMENTO, nunca somado sobre o
 * valor atual da coluna — a entrega é at-least-once e a soma acumularia a cada
 * reenvio.
 */
export function translateEvent(
  event: AsaasWebhookEvent,
  cycle: BillingCycle,
  now: Date
): SubscriptionChange | null {
  const dueDate = event.payment?.dueDate;
  if (!dueDate) return null;

  switch (event.event) {
    // PAYMENT_CONFIRMED (cliente pagou) chega antes de PAYMENT_RECEIVED
    // (dinheiro caiu na conta, dias depois) para cartão e boleto — por isso
    // a spec original só reagia a CONFIRMED, pra não punir o lojista pela
    // latência bancária do RECEIVED.
    //
    // Só que Pix PULA CONFIRMED inteiramente: confirmado no sandbox e na doc
    // do Asaas, o fluxo de status é CREATED → RECEIVED direto (sem etapa
    // intermediária), já que a transferência é instantânea. Reagir só a
    // CONFIRMED significa que NENHUMA assinatura Pix jamais promove — é o
    // único evento que o Asaas dispara pra ela. Tratar os dois igual resolve
    // o Pix e é inofensivo pro cartão: o cálculo é absoluto a partir do
    // dueDate (idempotente), então um RECEIVED que chegue depois do CONFIRMED
    // do mesmo dueDate recomputa o mesmo resultado — não soma nem duplica.
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return {
        subscriptionStatus: "active",
        planExpiresAt: somarCiclo(dueDate, cycle),
        applyPendingPlan: true,
      };

    case "PAYMENT_OVERDUE":
      return {
        subscriptionStatus: "past_due",
        planExpiresAt: somarDias(dueDate, GRACA_EM_DIAS),
        applyPendingPlan: false,
      };

    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return {
        subscriptionStatus: "canceled",
        planExpiresAt: now.toISOString(),
        applyPendingPlan: false,
      };

    default:
      return null;
  }
}

/** O store.id vai em externalReference na criação — mais robusto que mapear por customer. */
export function storeIdFromEvent(event: AsaasWebhookEvent): string | null {
  return event.payment?.externalReference ?? null;
}

/**
 * CHECKOUT_PAID é o único evento onde o externalReference do checkout de
 * cartão sobrevive. Devolve o par (loja, checkout.id) para a rota gravar um
 * vínculo temporário — checkout.id reaparece como payment.checkoutSession no
 * evento de pagamento seguinte, que é como os eventos PAYMENT_* (sem
 * externalReference) vão se identificar.
 */
export function checkoutLinkFromEvent(
  event: AsaasWebhookEvent
): { storeId: string; checkoutId: string } | null {
  if (event.event !== "CHECKOUT_PAID") return null;
  const storeId = event.checkout?.externalReference;
  const checkoutId = event.checkout?.id;
  if (!storeId || !checkoutId) return null;
  return { storeId, checkoutId };
}

/** Fallback quando o pagamento chega sem externalReference (caminho de checkout hospedado). */
export function checkoutSessionFromEvent(event: AsaasWebhookEvent): string | null {
  return event.payment?.checkoutSession ?? null;
}
