import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const from = vi.fn();
const createAdminClient = vi.fn(() => ({ from }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

/**
 * `lib/plan-limits` roda de verdade aqui (APO-01/APO-03): o gate é dirigido pelo
 * `plan`/`trial_ends_at` da linha falsa de `stores`, então o teste exercita a
 * resolução real de plano e expiração de trial em vez de um stub.
 */
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

/** Linha de `stores` no plano pedido — o gate de APO-01 lê estes dois campos. */
function storeRow(plan: string, trialEndsAt: string | null = null) {
  return { data: { id: STORE_ID, plan, trial_ends_at: trialEndsAt } };
}

/** Loja Pro ativa encontrada, produto pertencente à loja, insert sem erro. */
function happyPlan(overrides: Record<string, Result[]> = {}): Record<string, Result[]> {
  return {
    stores: [storeRow("pro")],
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

describe("registrarEvento — captura exclusiva do Pro (APO-01 a APO-06)", () => {
  it("não grava nada quando a loja é free", async () => {
    const made = setupSupabase(happyPlan({ stores: [storeRow("free")] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(0);
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("não grava nada quando a loja é starter", async () => {
    const made = setupSupabase(happyPlan({ stores: [storeRow("starter")] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: false });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(0);
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("grava normalmente quando a loja é pro", async () => {
    const made = setupSupabase(happyPlan({ stores: [storeRow("pro")] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: true });
    expect(insertedRow(made)).toEqual({
      store_id: STORE_ID,
      event_type: "catalog_visit",
      product_id: null,
      visitor_id: VISITOR_ID,
    });
  });

  it("não grava quando o pro tem trial_ends_at vencido (APO-03)", async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const made = setupSupabase(happyPlan({ stores: [storeRow("pro", past)] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: false });
    expect(writeCalls(made)).toHaveLength(0);
  });

  it("grava quando o pro tem trial_ends_at no futuro (APO-03)", async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const made = setupSupabase(happyPlan({ stores: [storeRow("pro", future)] }));
    const registrarEvento = await loadAction();

    const result = await registrarEvento(payload());

    expect(result).toEqual({ ok: true });
    expect(callsOf(made, "catalog_events", "insert")).toHaveLength(1);
  });

  it("recusa por plano é silenciosa, ao contrário da loja inexistente (APO-04)", async () => {
    setupSupabase(happyPlan({ stores: [storeRow("free")] }));
    const registrarEvento = await loadAction();

    await registrarEvento(payload());
    expect(errorSpy).not.toHaveBeenCalled();

    setupSupabase(happyPlan({ stores: [{ data: null }] }));
    await registrarEvento(payload());
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("bloqueia antes de conferir a posse do produto", async () => {
    const made = setupSupabase(happyPlan({ stores: [storeRow("free")] }));
    const registrarEvento = await loadAction();

    await registrarEvento(payload({ eventType: "product_view", productId: PRODUCT_ID }));

    expect(made.filter((entry) => entry.table === "products")).toHaveLength(0);
  });

  it("lê plano e trial na mesma consulta de stores, sem round-trip novo (APO-06)", async () => {
    const made = setupSupabase(happyPlan());
    const registrarEvento = await loadAction();

    await registrarEvento(payload());

    expect(callsOf(made, "stores", "select")).toEqual([["id, plan, trial_ends_at"]]);
    expect(made.filter((entry) => entry.table === "stores")).toHaveLength(1);
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
