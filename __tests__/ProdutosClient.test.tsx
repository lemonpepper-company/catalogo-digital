import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProdutosClient } from "@/app/painel/produtos/ProdutosClient";
import type { StoreProduct } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/app/actions/produtos", () => ({
  toggleProductActive: vi.fn(async () => ({ ok: true })),
  deleteProduct: vi.fn(async () => ({ ok: true })),
}));

function makeProduct(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: "p1",
    name: "Vestido midi",
    priceCents: 28990,
    description: null,
    categoryId: null,
    sizes: [],
    soldSizes: [],
    colors: [],
    images: [],
    stock: 10,
    isActive: true,
    isNew: false,
    ...overrides,
  };
}

const baseCounts = { active: 4, soldOut: 1, inactive: 1, total: 45 };

describe("ProdutosClient — contadores e paginação", () => {
  it("mostra o total da loja no cabeçalho, não o tamanho da página atual", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={2}
        totalPages={3}
      />
    );
    expect(screen.getByText(/45 produtos cadastrados/)).toBeTruthy();
  });

  it("mostra os contadores de status vindos de counts, não calculados da página atual", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={1}
        totalPages={3}
      />
    );
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("ativos")).toBeTruthy();
  });

  it("renderiza a navegação de páginas quando há mais de uma página", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={2}
        totalPages={3}
      />
    );
    expect(screen.getByLabelText("Paginação")).toBeTruthy();
  });
});
