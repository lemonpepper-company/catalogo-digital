import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Plan, StoreSettings } from "@/lib/types";
import type { PeriodRange } from "@/lib/period-filter";

const getCurrentStore = vi.fn();
const getOrderMetrics = vi.fn();
const from = vi.fn();
const resolvePeriodRange = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
  mapProduct: (row: unknown) => row,
}));
vi.mock("@/lib/server/pedidos", () => ({
  getOrderMetrics: (...args: unknown[]) => getOrderMetrics(...args),
}));
vi.mock("@/lib/period-filter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/period-filter")>();
  return {
    ...actual,
    resolvePeriodRange: (...args: unknown[]) => resolvePeriodRange(...args),
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ replace: vi.fn() }),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const RANGE: PeriodRange = {
  from: new Date("2026-07-01T03:00:00.000Z"),
  to: new Date("2026-07-15T12:00:00.000Z"),
};

function makeStore(plan: Plan, trialEndsAt: string | null = null): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan,
    trialEndsAt,
    whatsapp: "35999999999",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    fontPairing: "padrao",
    backgroundPalette: "padrao",
    cornerStyle: "padrao",
    secondaryColor: null,
    gridDensity: "padrao",
    customDomain: null,
    customDomainVerified: false,
  };
}

function setupProductsQuery() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: { data: unknown[] }) => unknown) =>
    Promise.resolve({ data: [] }).then(resolve);
  from.mockImplementation(() => chain);
}

async function renderPage(params: { periodo?: string; de?: string; ate?: string } = {}) {
  const { default: DashboardPage } = await import("@/app/painel/page");
  return render(await DashboardPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getOrderMetrics.mockReset();
  from.mockReset();
  resolvePeriodRange.mockReset();
  resolvePeriodRange.mockReturnValue(RANGE);
  setupProductsQuery();
  getOrderMetrics.mockResolvedValue({
    ordersThisMonth: 7,
    confirmedCentsThisMonth: 123450,
    pendingCount: 3,
  });
});

describe("/painel — cards de ROI nos planos pagos (ORD-30)", () => {
  it("no plano Starter busca as métricas da loja com o range resolvido e mostra os três cards", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getOrderMetrics).toHaveBeenCalledWith(STORE_ID, RANGE);
    expect(screen.getByText("Pedidos")).toBeTruthy();
    expect(screen.getByText("Vendas confirmadas")).toBeTruthy();
    expect(screen.getByText("Aguardando confirmação")).toBeTruthy();
  });
});

describe("/painel — Dashboard exclusiva de planos pagos", () => {
  it("no plano Free mostra o bloqueio de recurso pago sem buscar produtos nem métricas", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    await renderPage();

    expect(from).not.toHaveBeenCalled();
    expect(getOrderMetrics).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("rebaixa Starter/Pro com trial_ends_at vencido para o bloqueio do Free", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro", "2020-01-01T00:00:00.000Z"));

    await renderPage();

    expect(from).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
  });

  it("não bloqueia Starter no plano ativo", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(from).toHaveBeenCalled();
    expect(screen.queryByText("Disponível a partir do plano Starter")).toBeNull();
  });
});

describe("/painel — filtro de período (ORD-46)", () => {
  it("repassa periodo de searchParams para resolvePeriodRange", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage({ periodo: "hoje" });

    expect(resolvePeriodRange).toHaveBeenCalledWith({
      periodo: "hoje",
      de: undefined,
      ate: undefined,
    });
  });

  it("repassa o período customizado (de/ate) para resolvePeriodRange", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage({ de: "2026-07-01", ate: "2026-07-10" });

    expect(resolvePeriodRange).toHaveBeenCalledWith({
      periodo: undefined,
      de: "2026-07-01",
      ate: "2026-07-10",
    });
  });
});
