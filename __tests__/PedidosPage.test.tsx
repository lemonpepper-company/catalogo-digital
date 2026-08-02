import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Plan, StoreOrder, StoreSettings } from "@/lib/types";
import type { PeriodRange } from "@/lib/period-filter";

const getCurrentStore = vi.fn();
const getStoreOrders = vi.fn();
const resolvePeriodRange = vi.fn();
const redirect = vi.fn((_path: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
vi.mock("@/lib/server/pedidos", () => ({
  getStoreOrders: (...args: unknown[]) => getStoreOrders(...args),
}));
vi.mock("@/lib/period-filter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/period-filter")>();
  return {
    ...actual,
    resolvePeriodRange: (...args: unknown[]) => resolvePeriodRange(...args),
  };
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
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
    asaasCustomerId: null,
    asaasSubscriptionId: null,
    billingCycle: null,
    subscriptionStatus: null,
    pendingPlan: null,
  };
}

function makeOrder(): StoreOrder {
  return {
    id: "o1",
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
  };
}

async function renderPage(pageParam?: string, q?: string, periodo?: string) {
  const { default: PedidosPage } = await import("@/app/painel/pedidos/page");
  const ui = await PedidosPage({
    searchParams: Promise.resolve({
      ...(pageParam ? { page: pageParam } : {}),
      ...(q === undefined ? {} : { q }),
      ...(periodo === undefined ? {} : { periodo }),
    }),
  });
  return render(ui);
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getStoreOrders.mockReset();
  redirect.mockClear();
  resolvePeriodRange.mockReset();
  resolvePeriodRange.mockReturnValue(RANGE);
  getStoreOrders.mockResolvedValue({
    orders: [makeOrder()],
    total: 1,
    page: 1,
    totalPages: 1,
  });
});

describe("/painel/pedidos — gate de plano (ORD-28)", () => {
  it("no plano Free renderiza o bloqueio sem executar a query de pedidos", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    await renderPage();

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Falar no WhatsApp →" })).toBeTruthy();
  });

  it("no plano Free nenhum dado do histórico chega ao HTML", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    const { container } = await renderPage();

    expect(container.textContent).not.toContain("Ana");
    expect(container.textContent).not.toContain("R$");
    expect(screen.queryByRole("button", { name: /Ver detalhe do pedido/ })).toBeNull();
  });

  it("no plano Free com busca preenchida nenhuma query roda (ORD-35.12)", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    const { container } = await renderPage(undefined, "HS0L52");

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(container.textContent).not.toContain("Ana");
    expect(container.textContent).not.toContain("HS0L52");
    expect(
      screen.queryByLabelText("Buscar por código ou nome do cliente")
    ).toBeNull();
  });
});

describe("/painel/pedidos — busca vinda da URL (ORD-35.10)", () => {
  it("repassa searchParams.q para a leitura do histórico", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage(undefined, "hs0l");

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "hs0l", RANGE);
  });

  it("combina busca e página na mesma leitura", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro"));
    getStoreOrders.mockResolvedValue({
      orders: [makeOrder()],
      total: 30,
      page: 2,
      totalPages: 2,
    });

    await renderPage("2", "ana");

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 2, "ana", RANGE);
  });

  it("mostra o código do pedido na lista renderizada pela página", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(screen.getByText("HS0L52")).toBeTruthy();
  });
});

describe("/painel/pedidos — planos pagos (ORD-30)", () => {
  it("no plano Starter lista os pedidos da loja", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "", RANGE);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("R$ 398,00")).toBeTruthy();
  });

  it("no plano Pro sem prazo de expiração lista os pedidos", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro", null));

    await renderPage();

    expect(getStoreOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("rebaixa Starter com plan_expires_at vencido para o estado bloqueado", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter", "2020-01-01T00:00:00.000Z"));

    await renderPage();

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
  });

  it("repassa a página pedida na URL para a leitura do histórico", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));
    getStoreOrders.mockResolvedValue({
      orders: [makeOrder()],
      total: 21,
      page: 2,
      totalPages: 2,
    });

    await renderPage("2");

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 2, "", RANGE);
  });
});

describe("/painel/pedidos — histórico do período Free ao virar pago (ORD-30.7)", () => {
  it("os pedidos gravados no Free aparecem quando o plano efetivo vira starter, sem migração", async () => {
    getStoreOrders.mockResolvedValue({
      orders: [makeOrder()],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    getCurrentStore.mockResolvedValue(makeStore("free"));
    const bloqueado = await renderPage();

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(bloqueado.container.textContent).not.toContain("Ana");
    bloqueado.unmount();

    getCurrentStore.mockResolvedValue(makeStore("starter"));
    const liberado = await renderPage();

    expect(getStoreOrders).toHaveBeenCalledTimes(1);
    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "", RANGE);
    expect(liberado.getByText("Ana")).toBeTruthy();
    expect(liberado.getByText("R$ 398,00")).toBeTruthy();
  });
});

describe("/painel/pedidos — sessão ausente", () => {
  it("redireciona para /login quando não há loja do usuário", async () => {
    getCurrentStore.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
  });
});

describe("/painel/pedidos — filtro de período (ORD-46)", () => {
  it("repassa periodo de searchParams para resolvePeriodRange", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage(undefined, undefined, "hoje");

    expect(resolvePeriodRange).toHaveBeenCalledWith({
      periodo: "hoje",
      de: undefined,
      ate: undefined,
    });
  });

  it("usa o range resolvido na leitura do histórico", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "", RANGE);
  });
});
