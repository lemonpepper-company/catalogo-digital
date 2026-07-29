import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { monthStartInSaoPaulo } from "@/lib/order-metrics";

const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from }),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";

type Result = { data?: unknown; error?: unknown; count?: number | null };

interface FakeChain {
  calls: Record<string, unknown[][]>;
  [key: string]: unknown;
}

const CHAIN_METHODS = ["select", "eq", "gte", "order", "range"] as const;

/** Mesmo padrão de fake chain de `__tests__/registrar-pedido.test.ts:36-49`. */
function makeChain(result: Result): FakeChain {
  const calls: Record<string, unknown[][]> = {};
  const chain = { calls } as FakeChain;
  for (const method of CHAIN_METHODS) {
    chain[method] = (...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown, reject?: () => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/**
 * `results` são consumidos em ordem a cada `from("orders")`. Em `getStoreOrders`
 * a ordem é [contagem, lista]; em `getOrderMetrics` é [pedidos do mês, pendentes].
 */
function setupSupabase(results: Result[]): FakeChain[] {
  const made: FakeChain[] = [];
  let index = 0;
  from.mockImplementation(() => {
    const chain = makeChain(results[index] ?? {});
    index += 1;
    made.push(chain);
    return chain;
  });
  return made;
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    created_at: "2026-07-27T15:30:00.000Z",
    customer_name: "Ana",
    payment_method: "pix",
    delivery_method: "retirada",
    delivery_address: null,
    items_count: 2,
    total_cents: 39800,
    status: "pendente",
    order_items: [
      {
        product_name: "Vestido midi",
        unit_price_cents: 19900,
        qty: 2,
        size: "M",
        color: "Areia",
      },
    ],
    ...overrides,
  };
}

async function loadModule() {
  return import("@/lib/server/pedidos");
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  from.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("getStoreOrders — só os pedidos da própria loja, mais recentes primeiro (ORD-12)", () => {
  it("filtra a listagem por store_id", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("filtra a contagem total por store_id", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("ordena por created_at decrescente", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.order).toEqual([["created_at", { ascending: false }]]);
  });

  it("devolve os pedidos mapeados para o view model, com os itens aninhados", async () => {
    setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1);

    expect(result.orders).toEqual([
      {
        id: ORDER_ID,
        createdAt: "2026-07-27T15:30:00.000Z",
        customerName: "Ana",
        paymentMethod: "pix",
        deliveryMethod: "retirada",
        deliveryAddress: null,
        itemsCount: 2,
        totalCents: 39800,
        status: "pendente",
        items: [
          {
            productName: "Vestido midi",
            unitPriceCents: 19900,
            qty: 2,
            size: "M",
            color: "Areia",
          },
        ],
      },
    ]);
  });
});

describe("getStoreOrders — páginas de 20 (ORD-13)", () => {
  it("pede as 20 primeiras linhas na página 1", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.range).toEqual([[0, 19]]);
    expect(result).toMatchObject({ total: 45, page: 1, totalPages: 3 });
  });

  it("pede as linhas 20..39 na página 2", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 2);

    expect(made[1].calls.range).toEqual([[20, 39]]);
    expect(result.page).toBe(2);
  });

  it("aplica clampPage: página acima do total cai na última", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 99);

    expect(result.page).toBe(3);
    expect(made[1].calls.range).toEqual([[40, 59]]);
  });

  it("aplica clampPage: página menor que 1 cai na primeira", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 0);

    expect(result.page).toBe(1);
    expect(made[1].calls.range).toEqual([[0, 19]]);
  });

  it("loja sem pedidos → lista vazia com 1 página", async () => {
    setupSupabase([{ count: 0 }, { data: [] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1);

    expect(result).toEqual({ orders: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe("getStoreOrders — erro do banco nunca vira lista vazia", () => {
  it("lança e loga quando a contagem falha", async () => {
    setupSupabase([{ count: null, error: { message: "permission denied" } }]);
    const { getStoreOrders } = await loadModule();

    await expect(getStoreOrders(STORE_ID, 1)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("lança e loga quando a listagem falha", async () => {
    setupSupabase([{ count: 1 }, { data: null, error: { message: "permission denied" } }]);
    const { getStoreOrders } = await loadModule();

    await expect(getStoreOrders(STORE_ID, 1)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("getOrderMetrics — mês corrente no fuso do lojista (ORD-17, ORD-18)", () => {
  const NOW = new Date("2026-07-15T12:00:00.000Z");

  it("filtra os pedidos do mês pelo corte de São Paulo", async () => {
    const made = setupSupabase([{ data: [] }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, NOW);

    expect(made[0].calls.gte).toEqual([
      ["created_at", monthStartInSaoPaulo(NOW).toISOString()],
    ]);
    expect(made[0].calls.gte[0][1]).toBe("2026-07-01T03:00:00.000Z");
  });

  it("filtra os pedidos do mês por store_id", async () => {
    const made = setupSupabase([{ data: [] }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, NOW);

    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("conta os não cancelados e soma só os confirmados do mês", async () => {
    setupSupabase([
      {
        data: [
          { status: "pendente", total_cents: 1000 },
          { status: "confirmado", total_cents: 2500 },
          { status: "confirmado", total_cents: 7500 },
          { status: "cancelado", total_cents: 9900 },
        ],
      },
      { count: 4 },
    ]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, NOW);

    expect(metrics).toEqual({
      ordersThisMonth: 3,
      confirmedCentsThisMonth: 10000,
      pendingCount: 4,
    });
  });
});

describe("getOrderMetrics — pendentes de todo o histórico (ORD-19)", () => {
  const NOW = new Date("2026-07-15T12:00:00.000Z");

  it("conta apenas os pedidos com status pendente, da própria loja", async () => {
    const made = setupSupabase([{ data: [] }, { count: 7 }]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, NOW);

    expect(made[1].calls.eq).toEqual([
      ["store_id", STORE_ID],
      ["status", "pendente"],
    ]);
    expect(metrics.pendingCount).toBe(7);
  });

  it("não aplica filtro de período na contagem de pendentes", async () => {
    const made = setupSupabase([{ data: [] }, { count: 7 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, NOW);

    expect(made[1].calls.gte).toBeUndefined();
  });
});

describe("getOrderMetrics — sem pedidos e caminhos de erro (ORD-20)", () => {
  const NOW = new Date("2026-07-15T12:00:00.000Z");

  it("devolve zeros quando não há pedido nenhum", async () => {
    setupSupabase([{ data: null }, { count: null }]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, NOW);

    expect(metrics).toEqual({
      ordersThisMonth: 0,
      confirmedCentsThisMonth: 0,
      pendingCount: 0,
    });
  });

  it("lança e loga quando a query do mês falha", async () => {
    setupSupabase([{ data: null, error: { message: "permission denied" } }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await expect(getOrderMetrics(STORE_ID, NOW)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("lança e loga quando a contagem de pendentes falha", async () => {
    setupSupabase([{ data: [] }, { count: null, error: { message: "boom" } }]);
    const { getOrderMetrics } = await loadModule();

    await expect(getOrderMetrics(STORE_ID, NOW)).rejects.toThrow("boom");
    expect(errorSpy).toHaveBeenCalled();
  });
});
