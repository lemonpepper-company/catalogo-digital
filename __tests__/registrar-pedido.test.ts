import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const from = vi.fn();
const createAdminClient = vi.fn(() => ({ from }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

/**
 * ORD-27: a captura grava em qualquer plano e **nunca** consulta plano. A garantia
 * são as asserções `expect(getPlanLimits).not.toHaveBeenCalled()` de cada teste,
 * combinadas com o `mockClear()` por teste no beforeEach.
 *
 * Os stubs devolvem valor benigno em vez de lançar: `lib/data.ts` chama
 * `getPlanLimits` no escopo do módulo (tema da vitrine de demonstração) e esse
 * import roda antes de qualquer teste — um mock que lança derrubaria o arquivo
 * inteiro na inicialização, sem relação com o comportamento de registrarPedido.
 */
const FREE_LIMITS_STUB = {
  maxProducts: 8,
  maxCategories: 1,
  maxPhotos: 1,
  hasOrderHistory: false,
  maxFeaturedProducts: 0,
  themeOptions: false,
  gridDensity: false,
};
const getPlanLimits = vi.fn(() => FREE_LIMITS_STUB);
const getEffectivePlan = vi.fn((): "free" => "free");

vi.mock("@/lib/plan-limits", () => ({
  getPlanLimits: () => getPlanLimits(),
  getEffectivePlan: () => getEffectivePlan(),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CLIENT_ORDER_ID = "22222222-2222-4222-8222-222222222222";
const P1 = "33333333-3333-4333-8333-333333333333";
const P2 = "44444444-4444-4444-8444-444444444444";
const ORDER_ID = "55555555-5555-4555-8555-555555555555";

type Result = { data?: unknown; error?: unknown; count?: number };

interface FakeChain {
  calls: Record<string, unknown[][]>;
  [key: string]: unknown;
}

const CHAIN_METHODS = [
  "select",
  "eq",
  "gte",
  "in",
  "upsert",
  "insert",
  "delete",
  "update",
  "order",
  "range",
] as const;

function makeChain(result: Result): FakeChain {
  const calls: Record<string, unknown[][]> = {};
  const chain = { calls } as FakeChain;
  for (const method of CHAIN_METHODS) {
    chain[method] = (...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return chain;
    };
  }
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (resolve: (value: Result) => unknown, reject?: () => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

interface MadeChain {
  table: string;
  chain: FakeChain;
}

/**
 * `plan` mapeia tabela → resultados consumidos em ordem a cada `from(table)`.
 * O último resultado da lista é reusado se houver mais chamadas que resultados.
 */
function setupSupabase(plan: Record<string, Result[]>): MadeChain[] {
  const made: MadeChain[] = [];
  const counters: Record<string, number> = {};
  from.mockImplementation((table: string) => {
    const index = counters[table] ?? 0;
    counters[table] = index + 1;
    const results = plan[table] ?? [{}];
    const result = results[index] ?? results[results.length - 1] ?? {};
    const chain = makeChain(result);
    made.push({ table, chain });
    return chain;
  });
  return made;
}

function callsOf(made: MadeChain[], table: string, method: string): unknown[][] {
  return made
    .filter((entry) => entry.table === table)
    .flatMap((entry) => entry.chain.calls[method] ?? []);
}

function writeCalls(made: MadeChain[]): unknown[][] {
  return made.flatMap((entry) => [
    ...(entry.chain.calls.upsert ?? []),
    ...(entry.chain.calls.insert ?? []),
    ...(entry.chain.calls.update ?? []),
  ]);
}

function upsertRow(made: MadeChain[]): Record<string, unknown> {
  return callsOf(made, "orders", "upsert")[0][0] as Record<string, unknown>;
}

function upsertOptions(made: MadeChain[]): Record<string, unknown> {
  return callsOf(made, "orders", "upsert")[0][1] as Record<string, unknown>;
}

function itemRows(made: MadeChain[]): Record<string, unknown>[] {
  return callsOf(made, "order_items", "insert")[0][0] as Record<string, unknown>[];
}

/** Código derivado de CLIENT_ORDER_ID — literal de propósito (ORD-32.1). */
const DERIVED_CODE = "MMUAMM";

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    slug: "ateliemira",
    clientOrderId: CLIENT_ORDER_ID,
    customerName: "Ana",
    items: [{ productId: P1, size: "M", color: "Areia", qty: 2 }],
    ...overrides,
  };
}

/** Loja ativa encontrada, sem pedidos recentes, produto P1 a R$ 199,00. */
function happyPlan(overrides: Record<string, Result[]> = {}): Record<string, Result[]> {
  return {
    stores: [{ data: { id: STORE_ID } }],
    orders: [{ count: 0 }, { data: [{ id: ORDER_ID }] }],
    products: [{ data: [{ id: P1, name: "Vestido midi", price_cents: 19900 }] }],
    order_items: [{ error: null }],
    ...overrides,
  };
}

async function loadAction() {
  const mod = await import("@/app/actions/pedidos");
  return mod.registrarPedido;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  from.mockReset();
  createAdminClient.mockReset();
  createAdminClient.mockImplementation(() => ({ from }));
  // mockClear, não mockReset: preserva o stub e zera só o registro de chamadas,
  // que é o que as asserções de ORD-27 inspecionam.
  getPlanLimits.mockClear();
  getEffectivePlan.mockClear();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  vi.useRealTimers();
});

describe("registrarPedido — gravação do pedido (ORD-01)", () => {
  it("grava 1 linha em orders com status pendente e retorna ok:true", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: true });
    expect(callsOf(made, "orders", "upsert")).toHaveLength(1);
    expect(upsertRow(made)).toMatchObject({
      store_id: STORE_ID,
      client_order_id: CLIENT_ORDER_ID,
      status: "pendente",
      items_count: 2,
      total_cents: 39800,
    });
  });

  it("grava em orders.code o código derivado do client_order_id (ORD-32.1)", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload());

    expect(upsertRow(made).code).toBe(DERIVED_CODE);
  });

  it("grava 1 linha em order_items por item resolvido, com o snapshot de nome e preço", async () => {
    const made = setupSupabase({
      ...happyPlan(),
      products: [
        {
          data: [
            { id: P1, name: "Vestido midi", price_cents: 19900 },
            { id: P2, name: "Blusa", price_cents: 8000 },
          ],
        },
      ],
    });
    const registrarPedido = await loadAction();

    await registrarPedido(
      validPayload({
        items: [
          { productId: P1, size: "M", color: "Areia", qty: 2 },
          { productId: P2, size: null, color: null, qty: 1 },
        ],
      })
    );

    expect(itemRows(made)).toEqual([
      {
        order_id: ORDER_ID,
        product_id: P1,
        product_name: "Vestido midi",
        unit_price_cents: 19900,
        qty: 2,
        size: "M",
        color: "Areia",
      },
      {
        order_id: ORDER_ID,
        product_id: P2,
        product_name: "Blusa",
        unit_price_cents: 8000,
        qty: 1,
        size: null,
        color: null,
      },
    ]);
  });

  it("grava pagamento, entrega, endereço e nome informados no payload", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(
      validPayload({
        customerName: "Ana",
        payment: "pix",
        delivery: "entrega",
        address: "Rua X, 123",
      })
    );

    expect(upsertRow(made)).toMatchObject({
      customer_name: "Ana",
      payment_method: "pix",
      delivery_method: "entrega",
      delivery_address: "Rua X, 123",
    });
  });
});

describe("registrarPedido — grava em qualquer plano (ORD-27)", () => {
  it("grava o pedido sem nunca consultar o plano da loja", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: true });
    expect(callsOf(made, "orders", "upsert")).toHaveLength(1);
    expect(getPlanLimits).not.toHaveBeenCalled();
    expect(getEffectivePlan).not.toHaveBeenCalled();
  });

  it("não lê nenhuma coluna de plano da loja — a query de `stores` pede só o id", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload());

    expect(callsOf(made, "stores", "select")).toEqual([["id"]]);
  });
});

describe("registrarPedido — preço vem só do banco (ORD-02)", () => {
  it("ignora qualquer valor monetário enviado pelo cliente e usa products.price_cents", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(
      validPayload({
        totalCents: 1,
        items: [
          {
            productId: P1,
            size: "M",
            color: "Areia",
            qty: 2,
            unitPriceCents: 1,
            price: "R$ 0,01",
          },
        ],
      })
    );

    expect(upsertRow(made).total_cents).toBe(39800);
    expect(itemRows(made)[0].unit_price_cents).toBe(19900);
  });
});

describe("registrarPedido — validação e loja (ORD-07)", () => {
  it("rejeita payload inválido sem tocar no banco", async () => {
    setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(
      validPayload({ clientOrderId: "nao-e-uuid" })
    );

    expect(result).toEqual({ ok: false });
    expect(from).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("retorna ok:false sem gravar quando o slug não existe", async () => {
    const made = setupSupabase({ ...happyPlan(), stores: [{ data: null }] });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("busca a loja filtrando por slug e is_active=true (loja inativa não resolve)", async () => {
    const made = setupSupabase({ ...happyPlan(), stores: [{ data: null }] });
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload());

    expect(callsOf(made, "stores", "eq")).toEqual([
      ["slug", "ateliemira"],
      ["is_active", true],
    ]);
  });

  it("retorna ok:false sem gravar quando a leitura da loja falha", async () => {
    const made = setupSupabase({
      ...happyPlan(),
      stores: [{ data: null, error: { message: "boom" } }],
    });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });
});

describe("registrarPedido — itens que não resolvem (ORD-06)", () => {
  it("descarta o item sem produto correspondente e grava o resto", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(
      validPayload({
        items: [
          { productId: P1, size: "M", color: "Areia", qty: 2 },
          { productId: P2, size: null, color: null, qty: 3 },
        ],
      })
    );

    expect(result).toEqual({ ok: true });
    expect(upsertRow(made)).toMatchObject({ items_count: 2, total_cents: 39800 });
    expect(itemRows(made)).toHaveLength(1);
    expect(itemRows(made)[0].product_id).toBe(P1);
  });

  it("busca produtos restritos à loja e ativos", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload());

    expect(callsOf(made, "products", "in")).toEqual([["id", [P1]]]);
    expect(callsOf(made, "products", "eq")).toEqual([
      ["store_id", STORE_ID],
      ["is_active", true],
    ]);
  });

  it("não grava nada quando nenhum item resolve", async () => {
    const made = setupSupabase({ ...happyPlan(), products: [{ data: [] }] });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });
});

describe("registrarPedido — idempotência (ORD-04)", () => {
  it("usa upsert com onConflict store_id,client_order_id e ignoreDuplicates", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload());

    expect(upsertOptions(made)).toEqual({
      onConflict: "store_id,client_order_id",
      ignoreDuplicates: true,
    });
  });

  it("retorna ok:true sem gravar itens quando o client_order_id já existe (0 linhas)", async () => {
    const made = setupSupabase({
      ...happyPlan(),
      orders: [{ count: 0 }, { data: [] }],
    });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: true });
    expect(callsOf(made, "order_items", "insert")).toHaveLength(0);
  });
});

describe("registrarPedido — teto anti-abuso (ORD-08)", () => {
  it("descarta a gravação quando a loja já tem 20 pedidos nos últimos 60 s", async () => {
    const made = setupSupabase({ ...happyPlan(), orders: [{ count: 20 }] });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("grava normalmente com 19 pedidos na janela", async () => {
    const made = setupSupabase({
      ...happyPlan(),
      orders: [{ count: 19 }, { data: [{ id: ORDER_ID }] }],
    });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: true });
    expect(callsOf(made, "orders", "upsert")).toHaveLength(1);
  });

  it("conta apenas os pedidos da loja criados nos últimos 60 segundos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-27T12:00:00.000Z"));
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload());

    expect(callsOf(made, "orders", "eq")[0]).toEqual(["store_id", STORE_ID]);
    expect(callsOf(made, "orders", "gte")[0]).toEqual([
      "created_at",
      "2026-07-27T11:59:00.000Z",
    ]);
  });
});

describe("registrarPedido — nome do cliente (ORD-10, ORD-31)", () => {
  it("aplica trim no nome informado", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload({ customerName: "   Ana Maria   " }));

    expect(upsertRow(made).customer_name).toBe("Ana Maria");
  });

  it("rejeita nome em branco sem gravar nada (ORD-31.4)", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload({ customerName: "   " }));

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejeita nome com 1 caractere sem gravar nada (ORD-31.4)", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload({ customerName: "A" }));

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("rejeita nome ausente sem gravar nada (ORD-31.4)", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();
    const { customerName: _omit, ...payload } = validPayload();

    const result = await registrarPedido(payload);

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("trunca o nome em 60 caracteres", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    await registrarPedido(validPayload({ customerName: "A".repeat(70) }));

    expect(upsertRow(made).customer_name).toBe("A".repeat(60));
  });
});

describe("registrarPedido — código do pedido (ORD-32)", () => {
  // ORD-32.1 (revisada): o código gravado é sempre derivado do client_order_id no
  // servidor. Um cliente adulterado que mande outro código não contamina o campo.
  it("ignora o código enviado no payload e grava o derivado do client_order_id", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload({ code: "ZZZZZZ" }));

    expect(result).toEqual({ ok: true });
    expect(upsertRow(made).code).toBe(DERIVED_CODE);
    expect(upsertRow(made).code).not.toBe("ZZZZZZ");
  });

  it("grava normalmente quando o payload não traz código nenhum", async () => {
    const made = setupSupabase(happyPlan());
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: true });
    expect(upsertRow(made).code).toBe(DERIVED_CODE);
  });
});

describe("registrarPedido — falhas de escrita e erros inesperados (ORD-03)", () => {
  it("deleta o pedido órfão e retorna ok:false quando o insert dos itens falha", async () => {
    const made = setupSupabase({
      ...happyPlan(),
      order_items: [{ error: { message: "boom" } }],
      orders: [{ count: 0 }, { data: [{ id: ORDER_ID }] }, { error: null }],
    });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "orders", "delete")).toHaveLength(1);
    expect(callsOf(made, "orders", "eq")).toContainEqual(["id", ORDER_ID]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("retorna ok:false sem gravar itens quando o upsert do pedido falha", async () => {
    const made = setupSupabase({
      ...happyPlan(),
      orders: [{ count: 0 }, { data: null, error: { message: "boom" } }],
    });
    const registrarPedido = await loadAction();

    const result = await registrarPedido(validPayload());

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "order_items", "insert")).toHaveLength(0);
  });

  it("captura o erro de createAdminClient (env ausente), loga e retorna ok:false sem lançar", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
    });
    const registrarPedido = await loadAction();

    await expect(registrarPedido(validPayload())).resolves.toEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalled();
  });

  it("captura erro inesperado de qualquer query e retorna ok:false sem lançar", async () => {
    from.mockImplementation(() => {
      throw new Error("conexão perdida");
    });
    const registrarPedido = await loadAction();

    await expect(registrarPedido(validPayload())).resolves.toEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalled();
  });
});
