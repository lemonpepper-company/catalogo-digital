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
    trialEndsAt: null,
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

describe("PersonalizacaoClient — cor secundária bloqueada (Free/Starter)", () => {
  it("swatches ficam desabilitados com tooltip 'Disponível no Pro'", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("starter", null)} />
    );
    const swatch = screen.getByRole("button", { name: "#1F2D5A" });
    expect(swatch).toBeDisabled();
    const tooltips = screen.getAllByRole("tooltip");
    expect(tooltips.some((t) => t.textContent === "Disponível no Pro")).toBe(true);
  });

  it("mostra o aviso 'Disponível no Pro' mesmo no plano Starter (antes não mostrava nada)", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("starter", null)} />
    );
    expect(
      screen.getByRole("link", { name: "Disponível no Pro — fale conosco" })
    ).toBeTruthy();
  });

  it("mostra o mesmo aviso no plano Free", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("free", null)} />
    );
    expect(
      screen.getByRole("link", { name: "Disponível no Pro — fale conosco" })
    ).toBeTruthy();
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
