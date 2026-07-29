import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ConfiguracoesClient } from "@/app/painel/configuracoes/ConfiguracoesClient";
import { getPlanLimits } from "@/lib/plan-limits";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";
import type { StoreSettings } from "@/lib/types";

// Isolate the client from the server action + browser-only image compression.
vi.mock("@/app/actions/store", () => ({
  updateStoreSettings: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (f: File) => f),
}));

const baseSettings: StoreSettings = {
  id: "store1",
  name: "Ateliê Mira",
  slug: "ateliemira",
  plan: "pro",
  trialEndsAt: new Date().toISOString(),
  whatsapp: "5511999990000",
  accentColor: "#C9A96E",
  logoUrl: null,
  coverUrl: null,
  description: "Vitrine premium",
  monogram: "AM",
  analyticsId: null,
  pixelId: null,
  messageTemplate: null,
  instagram: null,
  paymentMethods: [],
  deliveryMethods: [],
  customDomain: null,
  customDomainVerified: false,
  fontPairing: "padrao",
  backgroundPalette: "padrao",
  cornerStyle: "padrao",
  secondaryColor: null,
  gridDensity: "padrao",
};

// trialEndsAt=null → acesso indeterminado, nunca expira (ver getEffectivePlan em lib/plan-limits.ts).
const proLimits = getPlanLimits("pro", null);
const starterLimits = getPlanLimits("starter", null);

describe("ConfiguracoesClient logo avatar", () => {
  it("renders the saved logo as an image", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, logoUrl: "https://cdn.test/logo.jpg" }}
        limits={proLimits}
      />
    );
    const img = screen.getByRole("img", { name: "Ateliê Mira" });
    expect(img.getAttribute("src")).toBe("https://cdn.test/logo.jpg");
  });

  it("falls back to the monogram when there is no logo", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("ConfiguracoesClient — Instagram (novo)", () => {
  it("renderiza o instagram salvo", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, instagram: "atelieming" }}
        limits={proLimits}
      />
    );
    expect(screen.getByLabelText(/Instagram/i)).toHaveValue("atelieming");
  });
});

describe("ConfiguracoesClient — pagamento e entrega (novo)", () => {
  it("renderiza todas as opções desmarcadas por padrão", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!.parentElement!;
    expect(within(pixRow).getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("marca a forma de pagamento salva anteriormente", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, paymentMethods: ["pix"] }}
        limits={proLimits}
      />
    );
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!.parentElement!;
    expect(within(pixRow).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("alterna a forma de pagamento ao clicar no switch", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!.parentElement!;
    const toggle = within(pixRow).getByRole("switch");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("marca a forma de entrega salva anteriormente", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, deliveryMethods: ["entrega"] }}
        limits={proLimits}
      />
    );
    const entregaRow = screen.getByText("Enviar no endereço").closest("div")!.parentElement!.parentElement!;
    expect(within(entregaRow).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });
});

describe("ConfiguracoesClient — Domínio próprio (novo)", () => {
  it("mostra mensagem de bloqueio e nenhum input quando o plano não é Pro", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={starterLimits} />);
    expect(screen.getByText(/Domínio próprio disponível no plano Pro/i)).toBeTruthy();
    expect(screen.queryByLabelText("Domínio")).toBeNull();
  });

  it("mostra o input e o badge 'Aguardando verificação' quando há domínio salvo e não verificado", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, customDomain: "minhaloja.com.br", customDomainVerified: false }}
        limits={proLimits}
      />
    );
    expect(screen.getByLabelText("Domínio")).toHaveValue("minhaloja.com.br");
    expect(screen.getByText("Aguardando verificação")).toBeTruthy();
    expect(screen.queryByText("Verificado")).toBeNull();
  });

  it("mostra o badge 'Verificado' quando o domínio salvo já foi verificado", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, customDomain: "minhaloja.com.br", customDomainVerified: true }}
        limits={proLimits}
      />
    );
    expect(screen.getByText("Verificado")).toBeTruthy();
  });

  it("o botão de salvar diz 'Salvar domínio', nunca 'Verificar'", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    expect(screen.getByRole("button", { name: "Salvar domínio" })).toBeTruthy();
  });
});

describe("ConfiguracoesClient — link de suporte", () => {
  it("mostra um link de suporte no final da página", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    const link = screen.getByRole("link", { name: /suporte/i });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Preciso de suporte com minha loja na Vtrine Digital."
      )}`
    );
  });

  it("fica escondido no desktop (lg:hidden) — a Sidebar já mostra o mesmo link", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    const link = screen.getByRole("link", { name: /suporte/i });
    expect(link.closest("div")?.className).toContain("lg:hidden");
  });
});
