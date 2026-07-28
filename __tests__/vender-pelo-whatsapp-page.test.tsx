import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VenderPeloWhatsappPage, { metadata } from "@/app/vender-pelo-whatsapp/page";

describe("VenderPeloWhatsappPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<VenderPeloWhatsappPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Vender pelo WhatsApp sem virar bagunça",
      })
    ).toBeTruthy();
  });
});
