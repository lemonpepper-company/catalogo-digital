import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Plan, StoreSettings } from "@/lib/types";

const getCurrentStore = vi.fn();
const getOrderMetrics = vi.fn();
const from = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
  mapProduct: (row: unknown) => row,
}));
vi.mock("@/lib/server/pedidos", () => ({
  getOrderMetrics: (...args: unknown[]) => getOrderMetrics(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";

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

async function renderPage() {
  const { default: DashboardPage } = await import("@/app/painel/page");
  return render(await DashboardPage());
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getOrderMetrics.mockReset();
  from.mockReset();
  setupProductsQuery();
  getOrderMetrics.mockResolvedValue({
    ordersThisMonth: 7,
    confirmedCentsThisMonth: 123450,
    pendingCount: 3,
  });
});

describe("/painel — gate de plano dos cards de ROI (ORD-29)", () => {
  it("no plano Free não busca métricas e mostra o aviso de upgrade", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    const { container } = await renderPage();

    expect(getOrderMetrics).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.queryByText("Pedidos no mês")).toBeNull();
    expect(container.textContent).not.toContain("R$");
  });
});

describe("/painel — cards de ROI nos planos pagos (ORD-30)", () => {
  it("no plano Starter busca as métricas da loja e mostra os três cards", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getOrderMetrics).toHaveBeenCalledWith(STORE_ID);
    expect(screen.getByText("Pedidos no mês")).toBeTruthy();
    expect(screen.getByText("Vendas confirmadas no mês")).toBeTruthy();
    expect(screen.getByText("Aguardando confirmação")).toBeTruthy();
  });

  it("rebaixa Starter com trial_ends_at vencido para o estado bloqueado", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter", "2020-01-01T00:00:00.000Z"));

    await renderPage();

    expect(getOrderMetrics).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
  });
});
