import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const from = vi.fn();
const createAdminClient = vi.fn(() => ({ from }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

/**
 * ANL-09: a captura grava em qualquer plano e **nunca** consulta plano. A garantia
 * é `expect(getPlanLimits).not.toHaveBeenCalled()` combinada com o `mockClear()`
 * por teste. Stub benigno (não lança) porque `lib/data.ts` chama getPlanLimits no
 * escopo do módulo — mesmo motivo documentado em registrar-pedido.test.ts.
 */
const FREE_LIMITS_STUB = {
  maxProducts: 8,
  maxCategories: 1,
  maxPhotos: 1,
  hasOrderHistory: false,
  maxFeaturedProducts: 0,
  themeOptions: false,
  advancedTheme: false,
  gridDensity: false,
};
const getPlanLimits = vi.fn(() => FREE_LIMITS_STUB);
const getEffectivePlan = vi.fn((): "free" => "free");

vi.mock("@/lib/plan-limits", () => ({
  getPlanLimits: () => getPlanLimits(),
  getEffectivePlan: () => getEffectivePlan(),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const VISITOR_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

type Result = { data?: unknown; error?: unknown };

interface FakeChain {
  calls: Record<string, unknown[][]>;
  [key: string]: unknown;
}

const CHAIN_METHODS = ["select", "eq", "in", "insert", "upsert", "delete", "update"] as const;

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

/** Toda escrita feita em qualquer tabela — usado para provar "nada gravado". */
function writeCalls(made: MadeChain[]): unknown[][] {
  return made.flatMap((entry) => [
    ...(entry.chain.calls.insert ?? []),
    ...(entry.chain.calls.upsert ?? []),
    ...(entry.chain.calls.update ?? []),
    ...(entry.chain.calls.delete ?? []),
  ]);
}

function insertedRow(made: MadeChain[]): Record<string, unknown> {
  return callsOf(made, "catalog_events", "insert")[0][0] as Record<string, unknown>;
}

function payload(over: Record<string, unknown> = {}) {
  return {
    slug: "ateliemira",
    visitorId: VISITOR_ID,
    eventType: "catalog_visit",
    productId: null,
    ...over,
  };
}

/** Loja ativa encontrada, produto pertencente à loja, insert sem erro. */
function happyPlan(overrides: Record<string, Result[]> = {}): Record<string, Result[]> {
  return {
    stores: [{ data: { id: STORE_ID } }],
    products: [{ data: { id: PRODUCT_ID } }],
    catalog_events: [{ error: null }],
    ...overrides,
  };
}

async function loadAction() {
  const mod = await import("@/app/actions/eventos");
  return mod.registrarEvento;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  from.mockReset();
  createAdminClient.mockReset();
  createAdminClient.mockImplementation(() => ({ from }));
  getPlanLimits.mockClear();
  getEffectivePlan.mockClear();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("registrarEvento — gravação (ANL-10)", () => {
  it("grava catalog_visit com store_id, event_type, product_id null e visitor_id", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: true });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(1);
    expect(insertedRow(made)).toEqual({
      store_id: STORE_ID,
      event_type: "catalog_visit",
      product_id: null,
      visitor_id: VISITOR_ID,
    });
  });

  // O schema aceita productId ausente (`.nullish()`), e é assim que o payload
  // chega de verdade: JSON.stringify descarta `undefined`. Sem este caso, a
  // normalização `productId ?? null` do insert nunca é exercitada.
  it("grava product_id null quando a chave productId nem vem no payload", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();
    const { productId: _omit, ...semProduto } = payload({ eventType: "catalog_visit" });

    const result = await registrarEvento(semProduto);

    expect(result).toEqual({ ok: true });
    expect(insertedRow(made)).toEqual({
      store_id: STORE_ID,
      event_type: "catalog_visit",
      product_id: null,
      visitor_id: VISITOR_ID,
    });
  });

  it("grava buy_click sem produto", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload({ eventType: "buy_click" }));

    expect(result).toEqual({ ok: true });
    expect(insertedRow(made)).toEqual({
      store_id: STORE_ID,
      event_type: "buy_click",
      product_id: null,
      visitor_id: VISITOR_ID,
    });
  });

  it("grava product_view e add_to_bag com o product_id do payload", async () => {
    for (const eventType of ["product_view", "add_to_bag"]) {
      const made = setupSupabase(happyPlan());
      const registrarEvento = await loadAction();

      const result = await registrarEvento(payload({ eventType, productId: PRODUCT_ID }));

      expect(result).toEqual({ ok: true });
      expect(insertedRow(made)).toEqual({
        store_id: STORE_ID,
        event_type: eventType,
        product_id: PRODUCT_ID,
        visitor_id: VISITOR_ID,
      });
    }
  });

  it("resolve a loja pelo slug exigindo is_active (ANL-08)", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    await registrarEvento(payload());

    expect(callsOf(made, "stores", "eq")).toEqual([
      ["slug", "ateliemira"],
      ["is_active", true],
    ]);
  });

  it("confere a posse do produto por id + store_id, sem exigir is_active", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    await registrarEvento(payload({ eventType: "product_view", productId: PRODUCT_ID }));

    expect(callsOf(made, "products", "eq")).toEqual([
      ["id", PRODUCT_ID],
      ["store_id", STORE_ID],
    ]);
  });

  it("não consulta a tabela products quando o evento não tem produto", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    await registrarEvento(payload({ eventType: "catalog_visit" }));

    expect(made.filter((entry) => entry.table === "products")).toHaveLength(0);
  });
});

describe("registrarEvento — captura em qualquer plano (ANL-09)", () => {
  it("grava sem nunca consultar plano ou limites", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: true });
    expect(getPlanLimits).not.toHaveBeenCalled();
    expect(getEffectivePlan).not.toHaveBeenCalled();
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(1);
  });
});

describe("registrarEvento — rejeições sem gravar nada (ANL-08)", () => {
  it("rejeita payload inválido antes de tocar o banco", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload({ eventType: "hack_event" }));

    expect(result).toEqual({ ok: false });
    expect(made).toHaveLength(0);
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("rejeita visitorId que não é uuid sem tocar o banco", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload({ visitorId: "nao-uuid" }));

    expect(result).toEqual({ ok: false });
    expect(made).toHaveLength(0);
  });

  it("rejeita quando a loja não existe ou está inativa, sem gravar", async () => {
    const made = setupSupabase(happyPlan({ stores: [{ data: null }] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("rejeita quando a busca da loja falha, sem gravar", async () => {
    const made = setupSupabase(happyPlan({ stores: [{ error: { message: "boom" } }] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("rejeita produto de outra loja, sem gravar o evento", async () => {
    const made = setupSupabase(happyPlan({ products: [{ data: null }] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(
      payload({ eventType: "product_view", productId: PRODUCT_ID })
    );

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(0);
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("rejeita quando a busca do produto falha, sem gravar o evento", async () => {
    const made = setupSupabase(happyPlan({ products: [{ error: { message: "boom" } }] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(
      payload({ eventType: "add_to_bag", productId: PRODUCT_ID })
    );

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(0);
  });
});

describe("registrarEvento — falhas de gravação (ANL-07)", () => {
  it("devolve ok:false sem lançar quando o insert falha", async () => {
    const made = setupSupabase(happyPlan({ catalog_events: [{ error: { message: "boom" } }] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(1);
  });

  it("devolve ok:false sem lançar quando o client do Supabase estoura", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("sem service role");
    });
    const registrarEvento = await loadAction();

    await expect(registrarEvento(payload())).resolves.toEqual({ ok: false });
  });

  it("devolve ok:false sem lançar quando uma query rejeita", async () => {
    from.mockImplementation(() => {
      throw new Error("conexão perdida");
    });
    const registrarEvento = await loadAction();

    await expect(registrarEvento(payload())).resolves.toEqual({ ok: false });
  });
});
