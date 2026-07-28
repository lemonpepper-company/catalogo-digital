import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VitrineDigitalPage, { metadata } from "@/app/vitrine-digital/page";

describe("VitrineDigitalPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("O que é Vitrine Digital? — Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<VitrineDigitalPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "O que é uma vitrine digital (e por que sua loja precisa de uma)",
      })
    ).toBeTruthy();
  });
});
