import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoriasClient } from "@/app/painel/categorias/CategoriasClient";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";
import type { StoreCategory } from "@/lib/types";

vi.mock("@/app/actions/categorias", () => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const categories: StoreCategory[] = [
  { id: "c1", name: "Vestidos", position: 0, productCount: 3 },
];

describe("CategoriasClient — limite de categorias", () => {
  it("mostra o botão 'Nova categoria' quando o limite não foi atingido", () => {
    render(<CategoriasClient categories={categories} maxCategories={5} />);
    expect(screen.getByRole("button", { name: "Nova categoria" })).toBeTruthy();
  });

  it("mostra um link de upsell clicável quando o limite foi atingido", () => {
    render(<CategoriasClient categories={categories} maxCategories={1} />);
    const link = screen.getByRole("link", {
      name: "Limite de categorias do plano atingido — fale conosco para aumentar",
    });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Quero aumentar o limite de categorias da minha loja."
      )}`
    );
  });

  it("não mostra o botão 'Nova categoria' quando o limite foi atingido", () => {
    render(<CategoriasClient categories={categories} maxCategories={1} />);
    expect(screen.queryByRole("button", { name: "Nova categoria" })).toBeNull();
  });
});
