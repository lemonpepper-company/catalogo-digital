import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoreSettings } from "@/lib/types";

const getCurrentStore = vi.fn();
const getPixPendente = vi.fn();
const redirect = vi.fn((_path: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
vi.mock("@/lib/server/assinatura", () => ({
  getPixPendente: (...args: unknown[]) => getPixPendente(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));
vi.mock("@/app/actions/assinatura", () => ({
  iniciarAssinatura: vi.fn(),
  trocarPlano: vi.fn(),
  cancelarAssinatura: vi.fn(),
  salvarDocumento: vi.fn(),
  salvarEndereco: vi.fn(),
}));
vi.mock("@/app/actions/cep", () => ({
  buscarEndereco: vi.fn(),
}));

function makeStore(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: "store-1",
    name: "Ateliê Mira",
    slug: "atelie-mira",
    plan: "pro",
    planExpiresAt: "2026-09-12T00:00:00.000Z",
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
    asaasSubscriptionId: "sub_1",
    billingCycle: "monthly",
    subscriptionStatus: "active",
    pendingPlan: null,
    ...overrides,
  };
}

async function renderPage() {
  const { default: AssinaturaPage } = await import("@/app/painel/assinatura/page");
  const ui = await AssinaturaPage();
  return render(ui);
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getPixPendente.mockReset();
  redirect.mockClear();
});

/**
 * pixUrl (mostrado só na hora do clique de assinar) some ao navegar — sem
 * buscar no Asaas a cada carregamento, a cobrança de renovação (segundo
 * ciclo em diante) nunca reaparecia na tela, mesmo com uma cobrança de
 * verdade esperando pagamento. getPixPendente (lib/server/assinatura.ts) é
 * quem filtra por PIX/status e faz a busca best-effort — testado à parte.
 */
describe("/painel/assinatura — cobrança Pix em aberto (busca no servidor)", () => {
  it("com cobrança pendente, mostra o link de pagamento", async () => {
    getCurrentStore.mockResolvedValue(makeStore());
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/renovacao1",
      dueDate: "2026-08-06",
    });

    await renderPage();

    expect(getPixPendente).toHaveBeenCalledWith("sub_1", "active");
    const link = screen.getByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/renovacao1");
  });

  it("sem cobrança em aberto, o card não aparece", async () => {
    getCurrentStore.mockResolvedValue(makeStore());
    getPixPendente.mockResolvedValue(null);

    await renderPage();

    expect(screen.queryByRole("link", { name: /pagar agora/i })).toBeNull();
  });

  /**
   * Primeira assinatura (Free → pago) via Pix: iniciarAssinatura grava
   * asaas_subscription_id na hora, mas subscription_status só existe depois
   * do webhook confirmar o primeiro pagamento — fica null enquanto
   * "processando". Achado ao vivo: sem esse caso, a cobrança mais importante
   * (a primeira, ainda não paga) ficava escondida.
   */
  it("primeira assinatura ainda não confirmada (subscription_status null) repassa null pro getPixPendente", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({ plan: "free", subscriptionStatus: null, pendingPlan: "pro" })
    );
    getPixPendente.mockResolvedValue({
      invoiceUrl: "https://sandbox.asaas.com/i/primeira1",
      dueDate: "2026-08-06",
    });

    await renderPage();

    expect(getPixPendente).toHaveBeenCalledWith("sub_1", null);
    const link = screen.getByRole("link", { name: /pagar agora/i });
    expect(link.getAttribute("href")).toBe("https://sandbox.asaas.com/i/primeira1");
  });
});

describe("/painel/assinatura — sessão ausente", () => {
  it("redireciona para /login quando não há loja do usuário", async () => {
    getCurrentStore.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getPixPendente).not.toHaveBeenCalled();
  });
});
