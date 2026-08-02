export type SubscriptionStatus = "active" | "past_due" | "canceled";
export type BillingCycle = "monthly" | "annual";

export interface AsaasWebhookEvent {
  event: string;
  payment?: {
    dueDate: string;
    subscription?: string | null;
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
    // Confirmado, não recebido: recebido é o dinheiro cair na conta, dias
    // depois. Punir o lojista por latência bancária seria errado.
    case "PAYMENT_CONFIRMED":
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
