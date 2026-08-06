import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PersonalizacaoClient } from "@/app/painel/personalizacao/PersonalizacaoClient";
import { getPlanLimits } from "@/lib/plan-limits";
import type { StoreSettings } from "@/lib/types";

vi.mock("@/app/actions/store", () => ({
  updatePersonalizacao: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (f: File) => f),
}));

function makeSettings(): StoreSettings {
  return {
    id: "store1",
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan: "free",
    planExpiresAt: null,
    whatsapp: "5511999990000",
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

describe("PersonalizacaoClient — localização do card de cor secundária", () => {
  it("aparece dentro do card 'Cor de destaque'", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("pro", null)} />
    );
    const card = screen.getByText("Cor de destaque").closest(".rounded-card") as HTMLElement;
    expect(within(card).getByText(/Cor secundária/)).toBeTruthy();
  });

  it("não aparece mais dentro do card 'Tema'", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("pro", null)} />
    );
    const card = screen.getByText("Tema").closest(".rounded-card") as HTMLElement;
    expect(within(card).queryByText(/Cor secundária/)).toBeNull();
  });
});

describe("PersonalizacaoClient — cor secundária liberada em todos os planos", () => {
  it("swatch é editável no plano Free", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("free", null)} />
    );
    expect(screen.getByLabelText("#1F2D5A")).not.toBeDisabled();
  });

  it("não exibe upsell de cor secundária no plano Free", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("free", null)} />
    );
    expect(screen.queryByText(/desbloquear a cor secundária/i)).toBeNull();
  });
});

describe("PersonalizacaoClient — cor secundária liberada (Pro)", () => {
  it("swatches ficam interativos, sem tooltip nem aviso de upsell", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("pro", null)} />
    );
    const swatch = screen.getByRole("button", { name: "#1F2D5A" });
    expect(swatch).not.toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Disponível no Pro — fale conosco" })
    ).toBeNull();
  });
});
