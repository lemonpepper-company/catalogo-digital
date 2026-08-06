import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfiguracoesClient } from "@/app/painel/configuracoes/ConfiguracoesClient";
import { MSG_DEFAULT } from "@/app/painel/configuracoes/use-configuracoes";
import { getPlanLimits } from "@/lib/plan-limits";
import type { StoreSettings } from "@/lib/types";

vi.mock("@/app/actions/store", () => ({
  updateStoreSettings: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/app/actions/auth", () => ({ signOut: vi.fn() }));
vi.mock("@/app/actions/upload", () => ({ uploadStoreLogo: vi.fn() }));

function makeSettings(messageTemplate: string | null): StoreSettings {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan: "pro",
    planExpiresAt: null,
    whatsapp: "35999999999",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate,
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

// planExpiresAt=null → acesso indeterminado (ver getEffectivePlan).
const proLimits = getPlanLimits("pro", null);

function templateTextarea(): HTMLTextAreaElement {
  return document.querySelector("textarea") as HTMLTextAreaElement;
}

describe("Configurações — variáveis {nome} e {pedido} (ORD-34)", () => {
  it("oferece {nome} e {pedido} como chips clicáveis (ORD-34.7)", () => {
    render(<ConfiguracoesClient settings={makeSettings(null)} limits={proLimits} />);

    expect(screen.getByRole("button", { name: "+ {nome}" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ {pedido}" })).toBeTruthy();
  });

  it("insere o token no template ao clicar no chip (ORD-34.7)", () => {
    render(<ConfiguracoesClient settings={makeSettings("Oi!")} limits={proLimits} />);

    fireEvent.click(screen.getByRole("button", { name: "+ {pedido}" }));

    expect(templateTextarea().value).toContain("{pedido}");
  });

  it("renderiza {nome} e {pedido} no preview (ORD-34.7)", () => {
    render(<ConfiguracoesClient settings={makeSettings("{nome}\n{pedido}")} limits={proLimits} />);

    expect(screen.getByText(/Cliente: Ana/)).toBeTruthy();
    expect(screen.getByText(/Pedido: A1B2C3/)).toBeTruthy();
  });

  it("preserva o template customizado da loja, sem reescrita nem anexo (ORD-34.6)", () => {
    const custom = "Oi! Quero:\n{itens}\nTotal {total}";
    render(<ConfiguracoesClient settings={makeSettings(custom)} limits={proLimits} />);

    expect(templateTextarea().value).toBe(custom);
  });

  it('"Restaurar padrão" traz o formato com {nome} e {pedido} (ORD-33.5)', () => {
    render(<ConfiguracoesClient settings={makeSettings("Oi!")} limits={proLimits} />);

    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));

    expect(templateTextarea().value).toBe(MSG_DEFAULT);
    expect(templateTextarea().value).toContain("{nome}");
    expect(templateTextarea().value).toContain("{pedido}");
  });

  it("loja com template nulo abre o textarea no formato padrão (ORD-33.4)", () => {
    render(<ConfiguracoesClient settings={makeSettings(null)} limits={proLimits} />);

    expect(templateTextarea().value).toBe(MSG_DEFAULT);
  });
});

describe("Configurações — preview do WhatsApp reflete pagamento/entrega reais", () => {
  it("não deixa linha vazia no preview quando pagamento e entrega não estão configurados", () => {
    render(<ConfiguracoesClient settings={makeSettings(null)} limits={proLimits} />);

    const preview = document.querySelector(
      ".bg-linen.border.border-sand\\/50.rounded-card.p-4"
    ) as HTMLElement;
    expect(preview.textContent).not.toMatch(/\n{3,}/);
  });

  it("mostra a forma de pagamento real quando configurada", () => {
    const settings = { ...makeSettings(null), paymentMethods: ["pix"] };
    render(<ConfiguracoesClient settings={settings} limits={proLimits} />);

    expect(screen.getByText(/Forma de pagamento: Pix/)).toBeTruthy();
  });

  it("mostra a forma de entrega real quando configurada", () => {
    const settings = { ...makeSettings(null), deliveryMethods: ["retirada"] };
    render(<ConfiguracoesClient settings={settings} limits={proLimits} />);

    expect(screen.getByText(/Entrega: Retirar no local/)).toBeTruthy();
  });

  it("não mostra nenhuma forma de pagamento/entrega no preview quando a loja não configurou nenhuma", () => {
    render(<ConfiguracoesClient settings={makeSettings(null)} limits={proLimits} />);

    expect(screen.queryByText(/Forma de pagamento/)).toBeNull();
    expect(screen.queryByText(/Entrega:/)).toBeNull();
  });
});
