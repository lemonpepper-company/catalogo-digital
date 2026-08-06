import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoreSettings } from "@/lib/types";

const getCurrentStore = vi.fn();
const getPixPendente = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
// AvisoPixPendente (dentro do <Suspense> do layout) chama getPixPendente —
// mockado aqui só pra não bater na rede real; o conteúdo do aviso em si é
// testado em __tests__/AvisoPixPendente.test.tsx, chamando o Server
// Component async diretamente. @testing-library/react (react-dom) não
// resolve componentes async aninhados dentro de Suspense — o fallback null
// é o que fica no DOM nestes testes, então não dá pra asserir o conteúdo
// do aviso aqui.
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
});

afterEach(() => {
  vi.unstubAllEnvs();
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
 * O aviso de Pix pendente faz uma chamada de rede ao Asaas — por isso vive
 * num Server Component próprio (AvisoPixPendente) dentro de <Suspense>, em
 * vez de inline no layout: sem isso, a chamada segurava o render do painel
 * inteiro em toda navegação, pra qualquer lojista com assinatura Pix ativa.
 * Este teste garante só que o layout renderiza normalmente (não trava, não
 * quebra) com uma loja que tem assinatura — o conteúdo do aviso em si é
 * responsabilidade do Server Component, testado à parte.
 */
describe("PainelLayout — não bloqueia o render por causa do aviso de Pix", () => {
  it("renderiza o painel mesmo com getPixPendente ainda pendente", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({ plan: "pro", asaasSubscriptionId: "sub_1", subscriptionStatus: "active" })
    );
    getPixPendente.mockImplementation(() => new Promise(() => {})); // nunca resolve

    await renderLayout();

    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
  });
});
