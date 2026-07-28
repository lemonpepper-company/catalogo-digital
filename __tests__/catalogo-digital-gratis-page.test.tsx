import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CatalogoDigitalGratisPage, { metadata } from "@/app/catalogo-digital-gratis/page";

describe("CatalogoDigitalGratisPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Catálogo Digital Grátis — Crie o seu em minutos");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<CatalogoDigitalGratisPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Criar catálogo digital grátis pra vender pelo WhatsApp",
      })
    ).toBeTruthy();
  });
});
