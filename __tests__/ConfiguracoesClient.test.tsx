import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  description: "Vitrine premium",
  monogram: "AM",
  analyticsId: null,
  pixelId: null,
  messageTemplate: null,
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
