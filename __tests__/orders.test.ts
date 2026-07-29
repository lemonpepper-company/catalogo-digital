import { describe, it, expect, afterEach, vi } from "vitest";
import {
  ORDER_STATUSES,
  isOrderStatus,
  MAX_ORDER_LINES,
  MAX_QTY,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NAME_MIN,
  ORDER_CODE_LENGTH,
  ORDER_CODE_PATTERN,
  deriveOrderCode,
  isValidCustomerName,
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

  it("expõe o mínimo de 2 caracteres do nome e os 6 caracteres do código", () => {
    expect(CUSTOMER_NAME_MIN).toBe(2);
    expect(ORDER_CODE_LENGTH).toBe(6);
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

describe("sanitizeCustomerName (ORD-31)", () => {
  it("aplica trim no valor informado", () => {
    expect(sanitizeCustomerName("  Ana  ")).toBe("Ana");
  });

  it("devolve null para string vazia, só espaços, null e undefined", () => {
    expect(sanitizeCustomerName("")).toBeNull();
    expect(sanitizeCustomerName("   ")).toBeNull();
    expect(sanitizeCustomerName(null)).toBeNull();
    expect(sanitizeCustomerName(undefined)).toBeNull();
  });

  it("devolve null para nome com menos de 2 caracteres após o trim", () => {
    expect(sanitizeCustomerName("A")).toBeNull();
    expect(sanitizeCustomerName("   A   ")).toBeNull();
  });

  it("aceita nome de exatamente 2 caracteres após o trim", () => {
    expect(sanitizeCustomerName("Jô")).toBe("Jô");
    expect(sanitizeCustomerName("  An  ")).toBe("An");
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

describe("isValidCustomerName (ORD-31)", () => {
  it("é false para vazio, só espaços, 1 caractere, null e undefined", () => {
    expect(isValidCustomerName("")).toBe(false);
    expect(isValidCustomerName("   ")).toBe(false);
    expect(isValidCustomerName("A")).toBe(false);
    expect(isValidCustomerName(" A ")).toBe(false);
    expect(isValidCustomerName(null)).toBe(false);
    expect(isValidCustomerName(undefined)).toBe(false);
  });

  it("é true a partir de 2 caracteres após o trim, inclusive acima de 60", () => {
    expect(isValidCustomerName("An")).toBe(true);
    expect(isValidCustomerName("  Ana Maria  ")).toBe(true);
    expect(isValidCustomerName("a".repeat(70))).toBe(true);
  });
});

describe("deriveOrderCode (ORD-32)", () => {
  const UUID_A = "df1b1f26-6865-4484-bcb1-f96411dcdee4";
  const UUID_B = "99f8ef01-1a0d-4e56-b586-5a2dc156e56c";

  it("devolve 6 caracteres em [A-Z0-9]", () => {
    const code = deriveOrderCode(UUID_A);
    expect(code).toHaveLength(6);
    expect(code).toMatch(ORDER_CODE_PATTERN);
  });

  it("é determinístico: o mesmo client_order_id sempre gera o mesmo código", () => {
    expect(deriveOrderCode(UUID_A)).toBe(deriveOrderCode(UUID_A));
    expect(deriveOrderCode(UUID_B)).toBe(deriveOrderCode(UUID_B));
  });

  // Vetores conferidos contra o backfill SQL de
  // supabase/migrations/20260728100000_orders_code.sql rodando no banco local:
  // travar o valor aqui impede que as duas implementações da mesma regra divirjam.
  it("reproduz os vetores usados no backfill da migration", () => {
    expect(deriveOrderCode(UUID_A)).toBe("HS0L52");
    expect(deriveOrderCode(UUID_B)).toBe("MIXICD");
  });

  it("gera códigos distintos para client_order_ids distintos", () => {
    expect(deriveOrderCode(UUID_A)).not.toBe(deriveOrderCode(UUID_B));
  });

  it("ignora os hifens do uuid (mesmo código com e sem separadores)", () => {
    expect(deriveOrderCode(UUID_A.replaceAll("-", ""))).toBe(deriveOrderCode(UUID_A));
  });

  it("é insensível à caixa do hexadecimal de entrada", () => {
    expect(deriveOrderCode(UUID_A.toUpperCase())).toBe(deriveOrderCode(UUID_A));
  });

  it("gera 6 caracteres válidos para qualquer uuid recém-criado", () => {
    for (let i = 0; i < 50; i++) {
      expect(deriveOrderCode(newClientOrderId())).toMatch(ORDER_CODE_PATTERN);
    }
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
