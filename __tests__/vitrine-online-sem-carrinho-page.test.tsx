import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VitrineOnlineSemCarrinhoPage, {
  metadata,
} from "@/app/vitrine-online-sem-carrinho/page";

describe("VitrineOnlineSemCarrinhoPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Vitrine Online Sem Carrinho de Compras");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<VitrineOnlineSemCarrinhoPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Uma vitrine online sem carrinho — porque a conversa é o checkout",
      })
    ).toBeTruthy();
  });
});
