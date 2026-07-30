import { describe, it, expect } from "vitest";
import { eventPayloadSchema, EVENT_TYPE_VALUES } from "@/lib/validation/evento";

const VISITOR_UUID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_UUID = "22222222-2222-4222-8222-222222222222";

function payload(over: Record<string, unknown> = {}) {
  return {
    slug: "loja-da-ana",
    visitorId: VISITOR_UUID,
    eventType: "catalog_visit",
    productId: null,
    ...over,
  };
}

describe("eventPayloadSchema — payloads aceitos (ANL-08)", () => {
  it("aceita catalog_visit e buy_click com productId null", () => {
    for (const eventType of ["catalog_visit", "buy_click"]) {
      const result = eventPayloadSchema.safeParse(payload({ eventType, productId: null }));
      expect(result.success).toBe(true);
    }
  });

  it("aceita catalog_visit e buy_click com productId ausente do objeto", () => {
    for (const eventType of ["catalog_visit", "buy_click"]) {
      const { productId: _omit, ...semProduto } = payload({ eventType });
      expect(eventPayloadSchema.safeParse(semProduto).success).toBe(true);
    }
  });

  it("aceita product_view e add_to_bag com productId uuid", () => {
    for (const eventType of ["product_view", "add_to_bag"]) {
      const result = eventPayloadSchema.safeParse(
        payload({ eventType, productId: PRODUCT_UUID })
      );
      expect(result.success).toBe(true);
    }
  });

  it("aceita os 4 tipos da allowlist na combinação válida de produto", () => {
    const comProduto = ["product_view", "add_to_bag"];
    for (const eventType of EVENT_TYPE_VALUES) {
      const productId = comProduto.includes(eventType) ? PRODUCT_UUID : null;
      expect(eventPayloadSchema.safeParse(payload({ eventType, productId })).success).toBe(
        true
      );
    }
  });
});

describe("eventPayloadSchema — payloads rejeitados (ANL-08)", () => {
  it("rejeita eventType fora da allowlist", () => {
    for (const eventType of ["hack_event", "CATALOG_VISIT", "", "checkout", null]) {
      expect(eventPayloadSchema.safeParse(payload({ eventType })).success).toBe(false);
    }
  });

  it("rejeita visitorId que não é uuid", () => {
    for (const visitorId of ["abc-123", "", null, undefined, 42]) {
      expect(eventPayloadSchema.safeParse(payload({ visitorId })).success).toBe(false);
    }
  });

  it("rejeita slug vazio ou ausente", () => {
    expect(eventPayloadSchema.safeParse(payload({ slug: "" })).success).toBe(false);
    const { slug: _omit, ...semSlug } = payload();
    expect(eventPayloadSchema.safeParse(semSlug).success).toBe(false);
  });

  it("rejeita productId que não é uuid em product_view", () => {
    const result = eventPayloadSchema.safeParse(
      payload({ eventType: "product_view", productId: "nao-uuid" })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita product_view e add_to_bag sem productId (null ou ausente)", () => {
    for (const eventType of ["product_view", "add_to_bag"]) {
      const comNull = eventPayloadSchema.safeParse(payload({ eventType, productId: null }));
      expect(comNull.success).toBe(false);
      if (comNull.success) throw new Error("payload deveria ser inválido");
      expect(comNull.error.issues[0].message).toBe("Produto obrigatório para este evento");
      expect(comNull.error.issues[0].path).toEqual(["productId"]);

      const { productId: _omit, ...semProduto } = payload({ eventType });
      expect(eventPayloadSchema.safeParse(semProduto).success).toBe(false);
    }
  });

  it("rejeita catalog_visit e buy_click com productId preenchido", () => {
    for (const eventType of ["catalog_visit", "buy_click"]) {
      const result = eventPayloadSchema.safeParse(
        payload({ eventType, productId: PRODUCT_UUID })
      );
      expect(result.success).toBe(false);
      if (result.success) throw new Error("payload deveria ser inválido");
      expect(result.error.issues[0].message).toBe("Este evento não aceita produto");
      expect(result.error.issues[0].path).toEqual(["productId"]);
    }
  });

  it("rejeita payload que não é objeto", () => {
    for (const invalido of [null, undefined, "string", 42, []]) {
      expect(eventPayloadSchema.safeParse(invalido).success).toBe(false);
    }
  });
});
