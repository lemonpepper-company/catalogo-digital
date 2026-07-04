import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { ProdutosClient } from "@/app/painel/produtos/ProdutosClient";
import type { StoreProduct } from "@/lib/types";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
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

const noFilters = { initialQ: "", initialCategoria: "", initialStatus: "" };

describe("ProdutosClient — contadores e paginação", () => {
  it("mostra o total da loja no cabeçalho, não o tamanho da página atual", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={2}
        totalPages={3}
        categories={[]}
        {...noFilters}
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
        categories={[]}
        {...noFilters}
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
        categories={[]}
        {...noFilters}
      />
    );
    expect(screen.getByLabelText("Paginação")).toBeTruthy();
  });

  it("redireciona para a página anterior ao excluir o último produto da página", async () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={2}
        totalPages={3}
        categories={[]}
        {...noFilters}
      />
    );

    fireEvent.click(screen.getAllByLabelText("Excluir")[0]);

    const dialog = screen.getByRole("dialog", { name: "Excluir produto" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Excluir" })
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/painel/produtos?page=1");
    });
  });

  it("preserva os filtros ativos no redirecionamento pós-exclusão", async () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={2}
        totalPages={3}
        categories={[{ id: "cat-1", name: "Vestidos" }]}
        initialQ="vestido"
        initialCategoria="cat-1"
        initialStatus="ativo"
      />
    );

    fireEvent.click(screen.getAllByLabelText("Excluir")[0]);
    const dialog = screen.getByRole("dialog", { name: "Excluir produto" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Excluir" })
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        "/painel/produtos?page=1&q=vestido&categoria=cat-1&status=ativo"
      );
    });
  });

  it("mostra o botão Limpar filtros só quando há filtro ativo", () => {
    const { rerender } = render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[]}
        {...noFilters}
      />
    );
    expect(screen.queryByText("Limpar filtros")).toBeNull();

    rerender(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[]}
        initialQ="vestido"
        initialCategoria=""
        initialStatus=""
      />
    );
    expect(screen.getByText("Limpar filtros")).toBeTruthy();
  });

  it("mostra estado vazio filtrado quando o filtro não retorna produtos", () => {
    render(
      <ProdutosClient
        products={[]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[]}
        initialQ="produto-inexistente"
        initialCategoria=""
        initialStatus=""
      />
    );
    expect(screen.getByText("Nenhum produto encontrado")).toBeTruthy();
    expect(screen.getByText("Limpar filtros")).toBeTruthy();
  });

  it("mostra estado vazio original quando a loja não tem nenhum produto", () => {
    render(
      <ProdutosClient
        products={[]}
        maxProducts={Infinity}
        counts={{ active: 0, soldOut: 0, inactive: 0, total: 0 }}
        page={1}
        totalPages={1}
        categories={[]}
        {...noFilters}
      />
    );
    expect(screen.getByText("Nenhum produto cadastrado ainda")).toBeTruthy();
    expect(screen.queryByText("Limpar filtros")).toBeNull();
  });

  it("digitar no campo de busca atualiza o valor exibido no input", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[]}
        {...noFilters}
      />
    );
    const input = screen.getByPlaceholderText(
      "Buscar por nome..."
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "vestido" } });
    expect(input.value).toBe("vestido");
  });

  it("selecionar uma categoria aplica o filtro imediatamente via router.replace", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[{ id: "cat-1", name: "Vestidos" }]}
        {...noFilters}
      />
    );
    fireEvent.click(screen.getAllByText("Todas as categorias")[0]);
    fireEvent.click(screen.getByText("Vestidos"));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?categoria=cat-1", {
      scroll: false,
    });
  });
});
