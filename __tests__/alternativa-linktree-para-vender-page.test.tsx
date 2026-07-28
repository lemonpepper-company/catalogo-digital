import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AlternativaLinktreeParaVenderPage, {
  metadata,
} from "@/app/alternativa-linktree-para-vender/page";

describe("AlternativaLinktreeParaVenderPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Alternativa ao Linktree Pra Vender Produtos");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<AlternativaLinktreeParaVenderPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Seu link na bio pode vender — não só listar links",
      })
    ).toBeTruthy();
  });
});
