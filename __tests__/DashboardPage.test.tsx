import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Plan, StoreSettings } from "@/lib/types";
import type { PeriodRange } from "@/lib/period-filter";

const getCurrentStore = vi.fn();
const getOrderMetrics = vi.fn();
const getCatalogAnalytics = vi.fn();
const from = vi.fn();
const resolvePeriodRange = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
  mapProduct: (row: unknown) => row,
}));
vi.mock("@/lib/server/pedidos", () => ({
  getOrderMetrics: (...args: unknown[]) => getOrderMetrics(...args),
}));
vi.mock("@/lib/server/analytics", () => ({
  getCatalogAnalytics: (...args: unknown[]) => getCatalogAnalytics(...args),
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

function makeStore(plan: Plan, planExpiresAt: string | null = null): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan,
    planExpiresAt,
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
    document: null,
    address: null,
    addressNumber: null,
    addressProvince: null,
    addressCity: null,
    addressPostalCode: null,
    asaasCustomerId: null,
    asaasSubscriptionId: null,
    billingCycle: null,
    subscriptionStatus: null,
    pendingPlan: null,
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
  getCatalogAnalytics.mockReset();
  from.mockReset();
  resolvePeriodRange.mockReset();
  resolvePeriodRange.mockReturnValue(RANGE);
  setupProductsQuery();
  getOrderMetrics.mockResolvedValue({
    ordersThisMonth: 7,
    confirmedCentsThisMonth: 123450,
    pendingCount: 3,
  });
  getCatalogAnalytics.mockResolvedValue({
    metrics: { visits: 42, uniqueVisitors: 30, buyClicks: 9, bagVisitors: 14 },
    topProducts: [],
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
    expect(getCatalogAnalytics).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("rebaixa Starter/Pro com plan_expires_at vencido para o bloqueio do Free", async () => {
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

describe("/painel — métricas da vitrine (ANL-14, ANL-15, ANL-18, ANL-19)", () => {
  it("busca analytics com o MESMO objeto de range dos cards de pedidos (ANL-15)", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage({ periodo: "7d" });

    expect(getCatalogAnalytics).toHaveBeenCalledWith(STORE_ID, RANGE);
    expect(getOrderMetrics).toHaveBeenCalledWith(STORE_ID, RANGE);
    // Mesma referência, não só objetos equivalentes: uma fonte única de período.
    expect(getCatalogAnalytics.mock.calls[0][1]).toBe(getOrderMetrics.mock.calls[0][1]);
    expect(resolvePeriodRange).toHaveBeenCalledTimes(1);
  });

  it("no plano Free não executa NENHUMA query de analytics (ANL-18)", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    await renderPage({ periodo: "mes" });

    expect(getCatalogAnalytics).not.toHaveBeenCalled();
  });

  it("no Pro com trial vencido também não executa query de analytics (ANL-18)", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro", "2020-01-01T00:00:00.000Z"));

    await renderPage();

    expect(getCatalogAnalytics).not.toHaveBeenCalled();
  });

  it("busca as métricas da vitrine uma única vez no plano pago (ANL-19)", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getCatalogAnalytics).toHaveBeenCalledTimes(1);
  });

  it("renderiza a página com os pedidos intactos quando a leitura de analytics lança", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));
    getCatalogAnalytics.mockRejectedValue(new Error("permission denied"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // A página não pode propagar o erro: analytics é acessório.
    await expect(renderPage()).resolves.toBeTruthy();

    // Os cards de pedidos continuam com os números reais.
    expect(screen.getByText("Pedidos")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
