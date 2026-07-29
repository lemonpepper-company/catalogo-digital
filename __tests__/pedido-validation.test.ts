import { describe, it, expect } from "vitest";
import { orderPayloadSchema } from "@/lib/validation/pedido";
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from "@/lib/data";

const UUID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_UUID = "22222222-2222-4222-8222-222222222222";

function minimalPayload(over: Record<string, unknown> = {}) {
  return {
    slug: "loja-da-ana",
    clientOrderId: UUID,
    items: [{ productId: PRODUCT_UUID, size: null, color: null, qty: 1 }],
    ...over,
  };
}

function items(count: number) {
  return Array.from({ length: count }, () => ({
    productId: PRODUCT_UUID,
    size: null,
    color: null,
    qty: 1,
  }));
}

describe("orderPayloadSchema — payloads aceitos", () => {
  it("aceita o payload mínimo: 1 item, sem nome, pagamento ou entrega", () => {
    const result = orderPayloadSchema.safeParse(minimalPayload());
    expect(result.success).toBe(true);
  });

  it("aceita o payload completo com nome, pagamento, entrega, endereço e variação", () => {
    const result = orderPayloadSchema.safeParse({
      slug: "loja-da-ana",
      clientOrderId: UUID,
      customerName: "Ana",
      payment: "pix",
      delivery: "entrega",
      address: "Rua A, 10",
      items: [{ productId: PRODUCT_UUID, size: "M", color: "Bege", qty: 3 }],
    });
    expect(result.success).toBe(true);
  });

  it("aceita todos os valores de PAYMENT_METHODS e DELIVERY_METHODS", () => {
    for (const payment of PAYMENT_METHOD_VALUES) {
      expect(orderPayloadSchema.safeParse(minimalPayload({ payment })).success).toBe(
        true
      );
    }
    for (const delivery of DELIVERY_METHOD_VALUES) {
      expect(
        orderPayloadSchema.safeParse(minimalPayload({ delivery })).success
      ).toBe(true);
    }
  });

  it("aceita customerName acima de 60 caracteres (o corte é do sanitizeCustomerName)", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({ customerName: "a".repeat(200) })
    );
    expect(result.success).toBe(true);
  });

  it("aceita null nos campos opcionais (campo em branco não invalida o pedido)", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({
        customerName: null,
        payment: null,
        delivery: null,
        address: null,
      })
    );
    expect(result.success).toBe(true);
  });

  it("aceita exatamente 20 linhas de item e qty 99 (limites inclusivos)", () => {
    expect(orderPayloadSchema.safeParse(minimalPayload({ items: items(20) })).success).toBe(
      true
    );
    expect(
      orderPayloadSchema.safeParse(
        minimalPayload({
          items: [{ productId: PRODUCT_UUID, size: null, color: null, qty: 99 }],
        })
      ).success
    ).toBe(true);
  });
});

describe("orderPayloadSchema — payloads rejeitados", () => {
  it("rejeita clientOrderId que não é uuid", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({ clientOrderId: "abc-123" })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita productId que não é uuid", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({
        items: [{ productId: "nao-uuid", size: null, color: null, qty: 1 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita sacola sem nenhum item", () => {
    const result = orderPayloadSchema.safeParse(minimalPayload({ items: [] }));
    expect(result.success).toBe(false);
  });

  it("rejeita mais de 20 linhas de item", () => {
    const result = orderPayloadSchema.safeParse(minimalPayload({ items: items(21) }));
    expect(result.success).toBe(false);
  });

  it("rejeita qty 0", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({
        items: [{ productId: PRODUCT_UUID, size: null, color: null, qty: 0 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita qty 100", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({
        items: [{ productId: PRODUCT_UUID, size: null, color: null, qty: 100 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita qty fracionário", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({
        items: [{ productId: PRODUCT_UUID, size: null, color: null, qty: 1.5 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita slug vazio", () => {
    const result = orderPayloadSchema.safeParse(minimalPayload({ slug: "" }));
    expect(result.success).toBe(false);
  });

  it("rejeita payment fora de PAYMENT_METHODS", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({ payment: "boleto" })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita delivery fora de DELIVERY_METHODS", () => {
    const result = orderPayloadSchema.safeParse(
      minimalPayload({ delivery: "drone" })
    );
    expect(result.success).toBe(false);
  });

  it("expõe a mensagem do erro em .error.issues[0].message (Zod v4)", () => {
    const result = orderPayloadSchema.safeParse(minimalPayload({ items: [] }));
    expect(result.success).toBe(false);
    if (result.success) throw new Error("payload deveria ser inválido");
    expect(result.error.issues[0].message).toBe("Sacola vazia");
  });
});
