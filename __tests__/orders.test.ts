import { describe, it, expect, afterEach, vi } from "vitest";
import {
  ORDER_STATUSES,
  isOrderStatus,
  MAX_ORDER_LINES,
  MAX_QTY,
  CUSTOMER_NAME_MAX,
  sanitizeCustomerName,
  resolveOrderItems,
  mapOrderRow,
  newClientOrderId,
  type OrderRow,
  type ProductPriceRow,
  type RequestedItem,
} from "@/lib/orders";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function product(over: Partial<ProductPriceRow> = {}): ProductPriceRow {
  return { id: "p1", name: "Vestido Linho", price_cents: 19900, ...over };
}

function requested(over: Partial<RequestedItem> = {}): RequestedItem {
  return { productId: "p1", size: null, color: null, qty: 1, ...over };
}

describe("constantes de pedido", () => {
  it("expõe os três status válidos, o teto de linhas, de qty e de nome", () => {
    expect(ORDER_STATUSES).toEqual(["pendente", "confirmado", "cancelado"]);
    expect(MAX_ORDER_LINES).toBe(20);
    expect(MAX_QTY).toBe(99);
    expect(CUSTOMER_NAME_MAX).toBe(60);
  });
});

describe("isOrderStatus", () => {
  it("aceita os três status do enum", () => {
    expect(isOrderStatus("pendente")).toBe(true);
    expect(isOrderStatus("confirmado")).toBe(true);
    expect(isOrderStatus("cancelado")).toBe(true);
  });

  it("rejeita valor fora do enum", () => {
    expect(isOrderStatus("enviado")).toBe(false);
    expect(isOrderStatus("Confirmado")).toBe(false);
    expect(isOrderStatus("")).toBe(false);
    expect(isOrderStatus(null)).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
    expect(isOrderStatus(1)).toBe(false);
  });
});

describe("sanitizeCustomerName", () => {
  it("aplica trim no valor informado", () => {
    expect(sanitizeCustomerName("  Ana  ")).toBe("Ana");
  });

  it("devolve null para string vazia, só espaços, null e undefined", () => {
    expect(sanitizeCustomerName("")).toBeNull();
    expect(sanitizeCustomerName("   ")).toBeNull();
    expect(sanitizeCustomerName(null)).toBeNull();
    expect(sanitizeCustomerName(undefined)).toBeNull();
  });

  it("trunca em 60 caracteres sem rejeitar o valor", () => {
    const long = "a".repeat(70);
    expect(sanitizeCustomerName(long)).toBe("a".repeat(60));
    expect(sanitizeCustomerName(long)).toHaveLength(60);
  });

  it("mantém nome de exatamente 60 caracteres intacto", () => {
    const exact = "b".repeat(60);
    expect(sanitizeCustomerName(exact)).toBe(exact);
  });
});

describe("resolveOrderItems", () => {
  it("usa o preço do banco e ignora qualquer valor monetário vindo do cliente", () => {
    const result = resolveOrderItems(
      [
        {
          ...requested({ qty: 2 }),
          // preço adulterado no payload do cliente
          unitPriceCents: 1,
          priceCents: 1,
          price: "R$ 0,01",
        } as RequestedItem,
      ],
      [product({ price_cents: 19900 })]
    );

    expect(result.items[0].unitPriceCents).toBe(19900);
    expect(result.totalCents).toBe(39800);
  });

  it("grava o nome do produto do banco como snapshot da linha", () => {
    const result = resolveOrderItems(
      [requested()],
      [product({ name: "Blusa Seda" })]
    );
    expect(result.items[0].productName).toBe("Blusa Seda");
    expect(result.items[0].productId).toBe("p1");
  });

  it("descarta item sem produto correspondente e grava os restantes", () => {
    const result = resolveOrderItems(
      [
        requested({ productId: "p1", qty: 1 }),
        requested({ productId: "fantasma", qty: 5 }),
        requested({ productId: "p2", qty: 2 }),
      ],
      [
        product({ id: "p1", name: "Vestido", price_cents: 10000 }),
        product({ id: "p2", name: "Saia", price_cents: 5000 }),
      ]
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.productId)).toEqual(["p1", "p2"]);
    expect(result.totalCents).toBe(20000);
    expect(result.itemsCount).toBe(3);
  });

  it("devolve zero itens e zeros quando nenhum produto resolve", () => {
    const result = resolveOrderItems([requested({ productId: "fantasma" })], []);
    expect(result.items).toEqual([]);
    expect(result.totalCents).toBe(0);
    expect(result.itemsCount).toBe(0);
  });

  it("calcula totalCents como a soma de unitário × quantidade", () => {
    const result = resolveOrderItems(
      [
        requested({ productId: "p1", qty: 3 }),
        requested({ productId: "p2", qty: 2 }),
      ],
      [
        product({ id: "p1", price_cents: 1000 }),
        product({ id: "p2", price_cents: 2550 }),
      ]
    );
    expect(result.totalCents).toBe(8100);
  });

  it("calcula itemsCount como a soma das quantidades", () => {
    const result = resolveOrderItems(
      [
        requested({ productId: "p1", qty: 3 }),
        requested({ productId: "p2", qty: 4 }),
      ],
      [product({ id: "p1" }), product({ id: "p2" })]
    );
    expect(result.itemsCount).toBe(7);
  });

  it("gera uma linha por variação quando o mesmo produto aparece com tamanho/cor diferentes", () => {
    const result = resolveOrderItems(
      [
        requested({ productId: "p1", size: "P", color: "Preto", qty: 1 }),
        requested({ productId: "p1", size: "M", color: "Preto", qty: 2 }),
        requested({ productId: "p1", size: "M", color: "Bege", qty: 1 }),
      ],
      [product({ id: "p1", price_cents: 10000 })]
    );

    expect(result.items).toHaveLength(3);
    expect(result.items.map((i) => [i.size, i.color])).toEqual([
      ["P", "Preto"],
      ["M", "Preto"],
      ["M", "Bege"],
    ]);
    expect(result.itemsCount).toBe(4);
    expect(result.totalCents).toBe(40000);
  });

  it("preserva tamanho e cor nulos", () => {
    const result = resolveOrderItems(
      [requested({ size: null, color: null })],
      [product()]
    );
    expect(result.items[0].size).toBeNull();
    expect(result.items[0].color).toBeNull();
  });
});

describe("mapOrderRow", () => {
  const row: OrderRow = {
    id: "o1",
    created_at: "2026-07-20T13:45:00.000Z",
    customer_name: "Ana",
    payment_method: "pix",
    delivery_method: "entrega",
    delivery_address: "Rua A, 10",
    items_count: 3,
    total_cents: 29900,
    status: "confirmado",
    order_items: [
      {
        product_name: "Vestido Linho",
        unit_price_cents: 9900,
        qty: 2,
        size: "M",
        color: "Bege",
      },
      {
        product_name: "Saia",
        unit_price_cents: 10100,
        qty: 1,
        size: null,
        color: null,
      },
    ],
  };

  it("converte a linha snake_case do Supabase no view model camelCase", () => {
    const order = mapOrderRow(row);
    expect(order).toEqual({
      id: "o1",
      createdAt: "2026-07-20T13:45:00.000Z",
      customerName: "Ana",
      paymentMethod: "pix",
      deliveryMethod: "entrega",
      deliveryAddress: "Rua A, 10",
      itemsCount: 3,
      totalCents: 29900,
      status: "confirmado",
      items: [
        {
          productName: "Vestido Linho",
          unitPriceCents: 9900,
          qty: 2,
          size: "M",
          color: "Bege",
        },
        {
          productName: "Saia",
          unitPriceCents: 10100,
          qty: 1,
          size: null,
          color: null,
        },
      ],
    });
  });

  it("converte order_items aninhado preservando nome e valor unitário gravados", () => {
    const order = mapOrderRow(row);
    expect(order.items).toHaveLength(2);
    expect(order.items[0].productName).toBe("Vestido Linho");
    expect(order.items[0].unitPriceCents).toBe(9900);
  });

  it("devolve items vazio quando order_items vem null ou ausente", () => {
    expect(mapOrderRow({ ...row, order_items: null }).items).toEqual([]);
    const { order_items: _omit, ...withoutItems } = row;
    expect(mapOrderRow(withoutItems as OrderRow).items).toEqual([]);
  });

  it("preserva customer_name null como null", () => {
    expect(mapOrderRow({ ...row, customer_name: null }).customerName).toBeNull();
  });
});

describe("newClientOrderId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devolve um uuid v4 válido", () => {
    expect(newClientOrderId()).toMatch(UUID_V4);
  });

  it("usa crypto.randomUUID quando disponível", () => {
    const randomUUID = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    vi.stubGlobal("crypto", { randomUUID });
    expect(newClientOrderId()).toBe("11111111-1111-4111-8111-111111111111");
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it("mantém o formato uuid v4 quando randomUUID é indisponível", () => {
    vi.stubGlobal("crypto", {});
    expect(newClientOrderId()).toMatch(UUID_V4);
  });

  it("gera identificadores distintos em chamadas consecutivas", () => {
    expect(newClientOrderId()).not.toBe(newClientOrderId());
  });
});
