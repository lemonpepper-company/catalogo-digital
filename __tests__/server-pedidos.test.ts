import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PeriodRange } from "@/lib/period-filter";

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

const CHAIN_METHODS = ["select", "eq", "gte", "lte", "or", "order", "range"] as const;

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
 * a ordem é [contagem, lista]; em `getOrderMetrics` é [pedidos do período, pendentes].
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
    code: "HS0L52",
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
        code: "HS0L52",
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

describe("getStoreOrders — busca por código ou nome (ORD-35.10)", () => {
  const FILTER = "code.ilike.%ana%,customer_name.ilike.%ana%";

  it("filtra a listagem por código ou nome, case-insensitive via ilike", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "ana");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  it("aplica o mesmo filtro na contagem, mantendo o isolamento por loja", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "ana");

    expect(made[0].calls.or).toEqual([[FILTER]]);
    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
    expect(made[1].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("recalcula a paginação sobre o resultado filtrado", async () => {
    const made = setupSupabase([{ count: 25 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 2, "ana");

    expect(result).toMatchObject({ total: 25, page: 2, totalPages: 2 });
    expect(made[1].calls.range).toEqual([[20, 39]]);
  });

  it("busca com código parcial e em caixa baixa monta o filtro com o termo cru", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "hs0l");

    expect(made[1].calls.or).toEqual([
      ["code.ilike.%hs0l%,customer_name.ilike.%hs0l%"],
    ]);
  });

  it("aplica trim no termo", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "   ana   ");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  it("descarta vírgula, parênteses e curingas que quebrariam o filtro do PostgREST", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "an,a()%*\\");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  // `_` é curinga de 1 caractere no LIKE: sem descartá-lo, "h_0l52" casaria com
  // "HS0L52" e a busca devolveria mais do que o lojista pediu (achado da
  // validação do ciclo 2).
  it("descarta o underscore, que é curinga de um caractere no LIKE", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "an_a");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  it("não aplica filtro nenhum quando a busca está vazia ou só com espaços", async () => {
    for (const query of ["", "   ", "()"]) {
      const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
      const { getStoreOrders } = await loadModule();

      await getStoreOrders(STORE_ID, 1, query);

      expect(made[0].calls.or).toBeUndefined();
      expect(made[1].calls.or).toBeUndefined();
    }
  });

  it("sem argumento de busca continua listando o histórico inteiro", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.or).toBeUndefined();
  });

  it("busca sem resultado devolve lista vazia com total 0, sem erro", async () => {
    setupSupabase([{ count: 0 }, { data: [] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1, "zzzzzz");

    expect(result).toEqual({ orders: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe("getStoreOrders — filtro de período (ORD-46)", () => {
  const RANGE: PeriodRange = {
    from: new Date("2026-07-01T03:00:00.000Z"),
    to: new Date("2026-07-15T12:00:00.000Z"),
  };

  it("aplica gte/lte de created_at na contagem e na listagem quando o range é informado", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "", RANGE);

    expect(made[0].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[0].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
    expect(made[1].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[1].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
  });

  it("combina o filtro de período com a busca por código/nome", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "ana", RANGE);

    expect(made[1].calls.or).toEqual([["code.ilike.%ana%,customer_name.ilike.%ana%"]]);
    expect(made[1].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
  });

  it("sem range (default) não aplica gte/lte, mantendo o comportamento atual", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.gte).toBeUndefined();
    expect(made[1].calls.lte).toBeUndefined();
  });

  it("com range explicitamente null não aplica gte/lte", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "", null);

    expect(made[1].calls.gte).toBeUndefined();
    expect(made[1].calls.lte).toBeUndefined();
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

describe("getOrderMetrics — filtra por período quando informado (ORD-17, ORD-18, ORD-46)", () => {
  const RANGE: PeriodRange = {
    from: new Date("2026-07-01T03:00:00.000Z"),
    to: new Date("2026-07-15T12:00:00.000Z"),
  };

  it("aplica gte/lte de created_at nas duas queries (período e pendentes)", async () => {
    const made = setupSupabase([{ data: [] }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, RANGE);

    expect(made[0].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[0].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
    expect(made[1].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[1].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
  });

  it("filtra os pedidos do período por store_id", async () => {
    const made = setupSupabase([{ data: [] }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, RANGE);

    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("conta os não cancelados e soma só os confirmados do período", async () => {
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

    const metrics = await getOrderMetrics(STORE_ID, RANGE);

    expect(metrics).toEqual({
      ordersThisMonth: 3,
      confirmedCentsThisMonth: 10000,
      pendingCount: 4,
    });
  });

  it("também filtra a contagem de pendentes pelo período, além do status", async () => {
    const made = setupSupabase([{ data: [] }, { count: 4 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, RANGE);

    expect(made[1].calls.eq).toEqual([
      ["store_id", STORE_ID],
      ["status", "pendente"],
    ]);
  });
});

describe("getOrderMetrics — sem filtro de data quando o range é null (todo o período)", () => {
  it("não aplica gte/lte em nenhuma das duas queries", async () => {
    const made = setupSupabase([{ data: [] }, { count: 7 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, null);

    expect(made[0].calls.gte).toBeUndefined();
    expect(made[0].calls.lte).toBeUndefined();
    expect(made[1].calls.gte).toBeUndefined();
    expect(made[1].calls.lte).toBeUndefined();
  });

  it("conta pendentes de todo o histórico, filtrando só por status e store_id", async () => {
    const made = setupSupabase([{ data: [] }, { count: 7 }]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, null);

    expect(made[1].calls.eq).toEqual([
      ["store_id", STORE_ID],
      ["status", "pendente"],
    ]);
    expect(metrics.pendingCount).toBe(7);
  });
});

describe("getOrderMetrics — sem pedidos e caminhos de erro (ORD-20)", () => {
  const RANGE: PeriodRange = {
    from: new Date("2026-07-01T03:00:00.000Z"),
    to: new Date("2026-07-15T12:00:00.000Z"),
  };

  it("devolve zeros quando não há pedido nenhum", async () => {
    setupSupabase([{ data: null }, { count: null }]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, RANGE);

    expect(metrics).toEqual({
      ordersThisMonth: 0,
      confirmedCentsThisMonth: 0,
      pendingCount: 0,
    });
  });

  it("lança e loga quando a query do período falha", async () => {
    setupSupabase([{ data: null, error: { message: "permission denied" } }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await expect(getOrderMetrics(STORE_ID, RANGE)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("lança e loga quando a contagem de pendentes falha", async () => {
    setupSupabase([{ data: [] }, { count: null, error: { message: "boom" } }]);
    const { getOrderMetrics } = await loadModule();

    await expect(getOrderMetrics(STORE_ID, RANGE)).rejects.toThrow("boom");
    expect(errorSpy).toHaveBeenCalled();
  });
});
