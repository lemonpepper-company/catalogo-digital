import { describe, it, expect } from "vitest";
import {
  translateEvent,
  storeIdFromEvent,
  checkoutLinkFromEvent,
  customerIdFromEvent,
} from "@/lib/asaas/events";
import type { AsaasWebhookEvent } from "@/lib/asaas/events";

const AGORA = new Date("2026-08-02T12:00:00.000Z");

function evento(event: string, dueDate = "2026-09-01"): AsaasWebhookEvent {
  return {
    event,
    payment: { dueDate, subscription: "sub_123", externalReference: "loja-1" },
  };
}

describe("translateEvent — pagamento confirmado", () => {
  it("mensal estende o acesso por um mês a partir do vencimento", () => {
    const r = translateEvent(evento("PAYMENT_CONFIRMED"), "monthly", AGORA);
    expect(r).toEqual({
      subscriptionStatus: "active",
      planExpiresAt: "2026-10-01T00:00:00.000Z",
      applyPendingPlan: true,
    });
  });

  it("anual estende por um ano", () => {
    const r = translateEvent(evento("PAYMENT_CONFIRMED"), "annual", AGORA);
    expect(r?.planExpiresAt).toBe("2027-09-01T00:00:00.000Z");
  });

  it("PAYMENT_RECEIVED é ignorado — confirmado já liberou o acesso", () => {
    expect(translateEvent(evento("PAYMENT_RECEIVED"), "monthly", AGORA)).toBeNull();
  });
});

describe("translateEvent — cobrança vencida e período de graça", () => {
  it("dá 3 dias contados do vencimento", () => {
    const r = translateEvent(evento("PAYMENT_OVERDUE"), "monthly", AGORA);
    expect(r).toEqual({
      subscriptionStatus: "past_due",
      planExpiresAt: "2026-09-04T00:00:00.000Z",
      applyPendingPlan: false,
    });
  });

  /**
   * O Asaas reenvia eventos (entrega at-least-once). Se a graça fosse somada
   * sobre o valor atual da coluna, dois envios dariam 6 dias. Calcular a partir
   * do dueDate torna o reenvio inofensivo.
   */
  it("é idempotente: o mesmo evento duas vezes dá a mesma data", () => {
    const a = translateEvent(evento("PAYMENT_OVERDUE"), "monthly", AGORA);
    const b = translateEvent(evento("PAYMENT_OVERDUE"), "monthly", AGORA);
    expect(a).toEqual(b);
  });
});

describe("translateEvent — estorno e chargeback", () => {
  it("estorno encerra o acesso imediatamente", () => {
    const r = translateEvent(evento("PAYMENT_REFUNDED"), "monthly", AGORA);
    expect(r).toEqual({
      subscriptionStatus: "canceled",
      planExpiresAt: AGORA.toISOString(),
      applyPendingPlan: false,
    });
  });

  it("chargeback encerra o acesso imediatamente", () => {
    const r = translateEvent(evento("PAYMENT_CHARGEBACK_REQUESTED"), "monthly", AGORA);
    expect(r?.subscriptionStatus).toBe("canceled");
    expect(r?.planExpiresAt).toBe(AGORA.toISOString());
  });
});

describe("translateEvent — eventos ignorados", () => {
  it.each([
    "PAYMENT_CREATED",
    "PAYMENT_UPDATED",
    "PAYMENT_CHECKOUT_VIEWED",
    "PAYMENT_BANK_SLIP_VIEWED",
    "EVENTO_QUE_NAO_EXISTE",
  ])("%s não muda nada", (nome) => {
    expect(translateEvent(evento(nome), "monthly", AGORA)).toBeNull();
  });

  it("evento sem payment não quebra", () => {
    expect(translateEvent({ event: "PAYMENT_CONFIRMED" }, "monthly", AGORA)).toBeNull();
  });
});

describe("storeIdFromEvent", () => {
  it("lê o externalReference", () => {
    expect(storeIdFromEvent(evento("PAYMENT_CONFIRMED"))).toBe("loja-1");
  });

  it("devolve null quando não há externalReference", () => {
    expect(storeIdFromEvent({ event: "PAYMENT_CONFIRMED", payment: { dueDate: "2026-09-01" } })).toBeNull();
  });
});

/**
 * O checkout hospedado de cartão não propaga o externalReference do checkout
 * para a subscription/payment gerada (confirmado no sandbox e na doc do
 * Asaas — só o objeto "checkout" retém o valor). CHECKOUT_PAID é o evento que
 * expõe esse vínculo, para gravarmos asaas_customer_id e os eventos
 * PAYMENT_* seguintes (sem externalReference) casarem pelo customer.
 */
describe("checkoutLinkFromEvent", () => {
  it("lê storeId e customer de um evento CHECKOUT_PAID", () => {
    const evento: AsaasWebhookEvent = {
      event: "CHECKOUT_PAID",
      checkout: { externalReference: "loja-1", customer: "cus_123" },
    };
    expect(checkoutLinkFromEvent(evento)).toEqual({ storeId: "loja-1", asaasCustomerId: "cus_123" });
  });

  it("devolve null para eventos que não são CHECKOUT_PAID", () => {
    expect(checkoutLinkFromEvent(evento("PAYMENT_CONFIRMED"))).toBeNull();
  });

  it("devolve null se faltar externalReference ou customer", () => {
    expect(
      checkoutLinkFromEvent({ event: "CHECKOUT_PAID", checkout: { customer: "cus_123" } })
    ).toBeNull();
    expect(
      checkoutLinkFromEvent({ event: "CHECKOUT_PAID", checkout: { externalReference: "loja-1" } })
    ).toBeNull();
  });
});

describe("customerIdFromEvent", () => {
  it("lê o customer do payment", () => {
    expect(
      customerIdFromEvent({
        event: "PAYMENT_CONFIRMED",
        payment: { dueDate: "2026-09-01", customer: "cus_123" },
      })
    ).toBe("cus_123");
  });

  it("devolve null quando não há customer", () => {
    expect(customerIdFromEvent({ event: "PAYMENT_CONFIRMED", payment: { dueDate: "2026-09-01" } })).toBeNull();
  });
});
