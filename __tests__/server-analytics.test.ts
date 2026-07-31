import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PeriodRange } from "@/lib/period-filter";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ rpc, from }),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const P2 = "33333333-3333-4333-8333-333333333333";

type Result = { data?: unknown; error?: unknown };

/**
 * Resposta por nome de função SQL. A ordem das chamadas não importa (as duas RPCs
 * saem juntas num Promise.all), então o plano é indexado pelo nome.
 */
function setupRpc(plan: Record<string, Result>) {
  rpc.mockImplementation((fn: string) => Promise.resolve(plan[fn] ?? { data: [] }));
}

function argsOf(fn: string): Record<string, unknown> {
  const call = rpc.mock.calls.find((entry) => entry[0] === fn);
  if (!call) throw new Error(`RPC ${fn} não foi chamada`);
  return call[1] as Record<string, unknown>;
}

function metricsRow(over: Record<string, unknown> = {}) {
  return {
    visits: 12,
    unique_visitors: 7,
    buy_clicks: 3,
    bag_visitors: 4,
    ...over,
  };
}

function happyPlan(over: Record<string, Result> = {}): Record<string, Result> {
  return {
    get_catalog_metrics: { data: [metricsRow()] },
    get_top_viewed_products: {
      data: [
        { product_id: P1, views: 9 },
        { product_id: P2, views: 2 },
      ],
    },
    ...over,
  };
}

const range: PeriodRange = {
  from: new Date("2026-07-01T03:00:00.000Z"),
  to: new Date("2026-07-30T20:59:59.000Z"),
};

async function loadLib() {
  const mod = await import("@/lib/server/analytics");
  return mod.getCatalogAnalytics;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("getCatalogAnalytics — mapeamento do retorno (ANL-12/ANL-13)", () => {
  it("mapeia as quatro métricas da RPC para o view-model", async () => {
    setupRpc(happyPlan());
    const getCatalogAnalytics = await loadLib();

    const result = await getCatalogAnalytics(STORE_ID, range);

    expect(result.metrics).toEqual({
      visits: 12,
      uniqueVisitors: 7,
      buyClicks: 3,
      bagVisitors: 4,
    });
  });

  it("mapeia os mais vistos preservando a ordem da RPC", async () => {
    setupRpc(happyPlan());
    const getCatalogAnalytics = await loadLib();

    const result = await getCatalogAnalytics(STORE_ID, range);

    expect(result.topProducts).toEqual([
      { productId: P1, views: 9 },
      { productId: P2, views: 2 },
    ]);
  });

  it("converte contagens que chegam como string (bigint do Postgres) em número", async () => {
    setupRpc(
      happyPlan({
        get_catalog_metrics: {
          data: [metricsRow({ visits: "120", unique_visitors: "70" })],
        },
        get_top_viewed_products: { data: [{ product_id: P1, views: "90" }] },
      })
    );
    const getCatalogAnalytics = await loadLib();

    const result = await getCatalogAnalytics(STORE_ID, range);

    expect(result.metrics.visits).toBe(120);
    expect(result.metrics.uniqueVisitors).toBe(70);
    expect(result.topProducts[0].views).toBe(90);
  });

  it("zera as métricas quando a loja não tem nenhum evento", async () => {
    setupRpc({
      get_catalog_metrics: { data: [] },
      get_top_viewed_products: { data: [] },
    });
    const getCatalogAnalytics = await loadLib();

    const result = await getCatalogAnalytics(STORE_ID, range);

    expect(result.metrics).toEqual({
      visits: 0,
      uniqueVisitors: 0,
      buyClicks: 0,
      bagVisitors: 0,
    });
    expect(result.topProducts).toEqual([]);
  });

  it("não consulta a tabela orders — o numerador da conversão vem da página", async () => {
    setupRpc(happyPlan());
    const getCatalogAnalytics = await loadLib();

    await getCatalogAnalytics(STORE_ID, range);

    expect(from).not.toHaveBeenCalled();
  });
});

describe("getCatalogAnalytics — período (ANL-14/ANL-22)", () => {
  it("propaga from/to do range para as duas RPCs, com o store_id", async () => {
    setupRpc(happyPlan());
    const getCatalogAnalytics = await loadLib();

    await getCatalogAnalytics(STORE_ID, range);

    expect(argsOf("get_catalog_metrics")).toEqual({
      p_store_id: STORE_ID,
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
    });
    expect(argsOf("get_top_viewed_products")).toEqual({
      p_store_id: STORE_ID,
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_limit: 5,
    });
  });

  it("propaga p_from e p_to nulos quando o período é 'tudo' (ANL-22)", async () => {
    setupRpc(happyPlan());
    const getCatalogAnalytics = await loadLib();

    await getCatalogAnalytics(STORE_ID, null);

    expect(argsOf("get_catalog_metrics")).toEqual({
      p_store_id: STORE_ID,
      p_from: null,
      p_to: null,
    });
    expect(argsOf("get_top_viewed_products")).toEqual({
      p_store_id: STORE_ID,
      p_from: null,
      p_to: null,
      p_limit: 5,
    });
  });

  it("pede no máximo 5 produtos mais vistos (ANL-13)", async () => {
    setupRpc(happyPlan());
    const getCatalogAnalytics = await loadLib();

    await getCatalogAnalytics(STORE_ID, range);

    expect(argsOf("get_top_viewed_products").p_limit).toBe(5);
  });
});

describe("getCatalogAnalytics — erro nunca vira zero silencioso", () => {
  it("lança com contexto quando a RPC de métricas falha", async () => {
    setupRpc(happyPlan({ get_catalog_metrics: { error: { message: "permission denied" } } }));
    const getCatalogAnalytics = await loadLib();

    await expect(getCatalogAnalytics(STORE_ID, range)).rejects.toThrow(
      `getCatalogAnalytics(${STORE_ID}) — erro ao agregar eventos: permission denied`
    );
  });

  it("lança com contexto quando a RPC de mais vistos falha", async () => {
    setupRpc(
      happyPlan({ get_top_viewed_products: { error: { message: "permission denied" } } })
    );
    const getCatalogAnalytics = await loadLib();

    await expect(getCatalogAnalytics(STORE_ID, range)).rejects.toThrow(
      `getCatalogAnalytics(${STORE_ID}) — erro ao ler mais vistos: permission denied`
    );
  });
});
