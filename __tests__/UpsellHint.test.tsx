import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpsellHint } from "@/components/painel/UpsellHint";

describe("UpsellHint", () => {
  it("renderiza o texto informado como link", () => {
    render(<UpsellHint label="Disponível no Starter — fale conosco" />);
    expect(
      screen.getByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeTruthy();
  });

  it("aponta para a página de assinatura", () => {
    render(<UpsellHint label="Disponível no Pro — fale conosco" />);
    const link = screen.getByRole("link", { name: "Disponível no Pro — fale conosco" });
    expect(link.getAttribute("href")).toBe("/painel/assinatura");
  });
});
