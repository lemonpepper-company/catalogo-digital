import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoreSettings } from "@/lib/types";

const getCurrentStore = vi.fn();
const getPixPendente = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
vi.mock("@/lib/server/assinatura", () => ({
  getPixPendente: (...args: unknown[]) => getPixPendente(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/painel",
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";

function makeStore(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan: "free",
    planExpiresAt: null,
    whatsapp: "35999999999",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: "AM",
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
    ...overrides,
  };
}

async function renderLayout() {
  const { default: PainelLayout } = await import("@/app/painel/layout");
  return render(await PainelLayout({ children: <div>conteúdo da página</div> }));
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getPixPendente.mockReset();
  getPixPendente.mockResolvedValue(null);
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vtrine.test");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-05T12:00:00.000Z"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("PainelLayout — item Dashboard sempre visível na navegação", () => {
  it("mostra o item Dashboard no plano Free (o bloqueio acontece dentro da página)", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "free" }));

    await renderLayout();

    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
  });

  it("mostra o item Dashboard no plano Pro", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "pro" }));

    await renderLayout();

    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
  });
});

describe("PainelLayout — link do catálogo com domínio próprio", () => {
  it("usa o domínio próprio verificado no Pro", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({
        plan: "pro",
        customDomain: "minhaloja.com.br",
        customDomainVerified: true,
      })
    );

    await renderLayout();

    expect(screen.getByText("minhaloja.com.br")).toBeTruthy();
  });

  it("usa o link de slug quando não há domínio verificado", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "pro" }));

    await renderLayout();

    expect(screen.getByText("vtrine.test/ateliemira")).toBeTruthy();
  });
});

/**
 * Pix não é débito automático: o Asaas gera a cobrança sozinho a cada
 * ciclo, mas quem paga é o lojista. Sem um aviso visível em toda página
 * (não só na tela de Assinatura), o lojista só descobre a cobrança pendente
 * se lembrar de abrir aquela tela por conta própria.
 *
 * Só entra no ar perto do vencimento (3 dias antes, mesma janela da graça
 * que já existe depois) — o Asaas gera a cobrança com bem mais antecedência
 * (até 40 dias, por padrão deles), e avisar tão cedo seria ruído sem nenhum
 * bloqueio em jogo. "hoje" fixado em 2026-08-05T12:00 (fake timer) pra não
 * depender da data real do sistema rodando o teste.
 */
describe("PainelLayout — aviso de Pix pendente", () => {
  it("vencimento amanhã (dentro da janela de 3 dias) mostra o banner", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({ plan: "pro", asaasSubscriptionId: "sub_1", subscriptionStatus: "active" })
    );
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/abc123",
      dueDate: "2026-08-06",
    });

    await renderLayout();

    expect(getPixPendente).toHaveBeenCalledWith("sub_1", "active");
    expect(screen.getByText(/pagamento pix pendente/i)).toBeTruthy();
    expect(screen.getByText(/vencimento em 6 de agosto de 2026/i)).toBeTruthy();
    const link = screen.getByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/abc123");
  });

  it("vencimento já passado (vencida) mostra o banner", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({ plan: "pro", asaasSubscriptionId: "sub_1", subscriptionStatus: "past_due" })
    );
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/vencida1",
      dueDate: "2026-08-01",
    });

    await renderLayout();

    expect(screen.getByText(/pagamento pix pendente/i)).toBeTruthy();
  });

  it("vencimento em exatamente 3 dias (borda da janela) mostra o banner", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({ plan: "pro", asaasSubscriptionId: "sub_1", subscriptionStatus: "active" })
    );
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/borda1",
      dueDate: "2026-08-08",
    });

    await renderLayout();

    expect(screen.getByText(/pagamento pix pendente/i)).toBeTruthy();
  });

  it("vencimento daqui a 4 dias (fora da janela) não mostra o banner ainda", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({ plan: "pro", asaasSubscriptionId: "sub_1", subscriptionStatus: "active" })
    );
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/longe1",
      dueDate: "2026-08-09",
    });

    await renderLayout();

    expect(screen.queryByText(/pagamento pix pendente/i)).toBeNull();
  });

  it("sem cobrança pendente, o banner não aparece", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "pro" }));
    getPixPendente.mockResolvedValue(null);

    await renderLayout();

    expect(screen.queryByText(/pagamento pix pendente/i)).toBeNull();
  });
});
