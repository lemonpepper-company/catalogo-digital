import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import type { SeoLandingContent } from "@/components/seo/types";

const content: SeoLandingContent = {
  h1: "Título de teste",
  heroSubtitle: "Subtítulo de teste",
  problemSolution: { title: "Problema", body: "Solução do problema" },
  benefits: [{ title: "Benefício 1", desc: "Descrição 1" }],
  faq: [{ q: "Pergunta 1?", a: "Resposta 1" }],
  ctaLabel: "Criar grátis",
  relatedLinks: [{ label: "Outra página", href: "/outra-pagina" }],
};

describe("SeoLandingPage", () => {
  it("renderiza o H1 e o subtítulo", () => {
    render(<SeoLandingPage content={content} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Título de teste" })
    ).toBeTruthy();
    expect(screen.getByText("Subtítulo de teste")).toBeTruthy();
  });

  it("renderiza os benefícios", () => {
    render(<SeoLandingPage content={content} />);
    expect(screen.getByText("Benefício 1")).toBeTruthy();
  });

  it("renderiza o FAQ", () => {
    render(<SeoLandingPage content={content} />);
    expect(screen.getByText("Pergunta 1?")).toBeTruthy();
  });

  it("renderiza os links relacionados", () => {
    render(<SeoLandingPage content={content} />);
    const link = screen.getByText("Outra página").closest("a");
    expect(link?.getAttribute("href")).toBe("/outra-pagina");
  });

  it("não renderiza a seção de links relacionados quando vazia", () => {
    render(<SeoLandingPage content={{ ...content, relatedLinks: [] }} />);
    expect(screen.queryByText("Veja também")).toBeNull();
  });
});
