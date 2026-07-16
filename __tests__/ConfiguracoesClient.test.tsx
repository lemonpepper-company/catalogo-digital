import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ConfiguracoesClient } from "@/app/painel/configuracoes/ConfiguracoesClient";
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
};

describe("ConfiguracoesClient logo avatar", () => {
  it("renders the saved logo as an image", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, logoUrl: "https://cdn.test/logo.jpg" }}
      />
    );
    const img = screen.getByRole("img", { name: "Ateliê Mira" });
    expect(img.getAttribute("src")).toBe("https://cdn.test/logo.jpg");
  });

  it("falls back to the monogram when there is no logo", () => {
    render(<ConfiguracoesClient settings={baseSettings} />);
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("ConfiguracoesClient — Instagram (novo)", () => {
  it("renderiza o instagram salvo", () => {
    render(<ConfiguracoesClient settings={{ ...baseSettings, instagram: "atelieming" }} />);
    expect(screen.getByLabelText(/Instagram/i)).toHaveValue("atelieming");
  });
});

describe("ConfiguracoesClient — pagamento e entrega (novo)", () => {
  it("renderiza todas as opções desmarcadas por padrão", () => {
    render(<ConfiguracoesClient settings={baseSettings} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!.parentElement!;
    expect(within(pixRow).getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("marca a forma de pagamento salva anteriormente", () => {
    render(<ConfiguracoesClient settings={{ ...baseSettings, paymentMethods: ["pix"] }} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!.parentElement!;
    expect(within(pixRow).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("alterna a forma de pagamento ao clicar no switch", () => {
    render(<ConfiguracoesClient settings={baseSettings} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!.parentElement!;
    const toggle = within(pixRow).getByRole("switch");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("marca a forma de entrega salva anteriormente", () => {
    render(<ConfiguracoesClient settings={{ ...baseSettings, deliveryMethods: ["entrega"] }} />);
    const entregaRow = screen.getByText("Enviar no endereço").closest("div")!.parentElement!.parentElement!;
    expect(within(entregaRow).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });
});
