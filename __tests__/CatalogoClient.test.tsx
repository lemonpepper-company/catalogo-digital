import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "@testing-library/react";
import { CatalogoClient } from "@/app/[slug]/CatalogoClient";
import type { Product, Store } from "@/lib/types";
import { resolveTheme } from "@/lib/theme-options";
import { getPlanLimits } from "@/lib/plan-limits";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const store: Store = {
  name: "Ateliê Mira",
  slug: "ateliemira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos", "Vestidos", "Blusas"],
  description: "Vitrine digital",
  accentColor: "#C9A96E",
  catalogUrl: "vtrinedigital.com.br/ateliemira",
  theme: resolveTheme("padrao", "padrao", "padrao", null, getPlanLimits("free", null)),
  gridDensity: "padrao",
};

function makeProducts(count: number, category: string): Product[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${category}-${i}`,
    name: `Produto ${category} ${i}`,
    price: "R$ 100,00",
    category,
    image: "https://example.com/x.jpg",
    desc: "",
    sizes: [],
    soldSizes: [],
    colors: [],
    isFeatured: false,
  }));
}

function countCards(container: HTMLElement) {
  return container.querySelectorAll('img[alt^="Produto "]').length;
}

describe("CatalogoClient — carregamento incremental", () => {
  it("mostra só os primeiros 24 produtos filtrados na carga inicial", () => {
    const products = makeProducts(30, "Vestidos");
    const { container } = render(<CatalogoClient store={store} products={products} />);
    expect(countCards(container)).toBe(24);
  });

  it("carrega mais 24 quando a sentinela entra na tela", () => {
    const products = makeProducts(30, "Vestidos");
    const { container } = render(<CatalogoClient store={store} products={products} />);
    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    expect(countCards(container)).toBe(30);
  });

  it("reseta para o lote inicial ao trocar de categoria", () => {
    const products = [...makeProducts(30, "Vestidos"), ...makeProducts(5, "Blusas")];
    const { container } = render(<CatalogoClient store={store} products={products} />);

    act(() => {
      FakeIntersectionObserver.instances[0].trigger(true);
    });
    expect(countCards(container)).toBe(35);

    fireEvent.click(screen.getByText("Blusas"));
    expect(countCards(container)).toBe(5);
  });
});

describe("CatalogoClient — densidade do grid", () => {
  it("usa grid-cols-2 (padrão) quando gridDensity é 'padrao'", () => {
    const { container } = render(
      <CatalogoClient store={store} products={makeProducts(2, "Vestidos")} />
    );
    const grid = container.querySelector(".grid");
    const classes = grid?.className.split(" ") ?? [];
    expect(classes).toContain("grid-cols-2");
    expect(classes).not.toContain("grid-cols-3");
  });

  it("usa grid-cols-3 quando gridDensity é 'compacto'", () => {
    const { container } = render(
      <CatalogoClient
        store={{ ...store, gridDensity: "compacto" }}
        products={makeProducts(2, "Vestidos")}
      />
    );
    const grid = container.querySelector(".grid");
    const classes = grid?.className.split(" ") ?? [];
    expect(classes).toContain("grid-cols-3");
    expect(classes).not.toContain("grid-cols-2");
  });
});

describe("CatalogoClient — seção de destaques", () => {
  it("mostra a seção Destaques quando há produtos em destaque ativos", () => {
    const products = makeProducts(3, "Vestidos");
    products[0].isFeatured = true;
    products[0].active = true;
    render(<CatalogoClient store={store} products={products} />);
    expect(screen.getByText("Destaques")).toBeTruthy();
  });

  it("não mostra a seção Destaques quando nenhum produto está em destaque", () => {
    render(<CatalogoClient store={store} products={makeProducts(3, "Vestidos")} />);
    expect(screen.queryByText("Destaques")).toBeNull();
  });

  it("não mostra a seção Destaques quando o produto em destaque está inativo", () => {
    const products = makeProducts(3, "Vestidos");
    products[0].isFeatured = true;
    products[0].active = false;
    render(<CatalogoClient store={store} products={products} />);
    expect(screen.queryByText("Destaques")).toBeNull();
  });
});

describe("CatalogoClient — CSS vars de fonte", () => {
  it("não gera referência circular (--font-sora: var(--font-sora)) no pareamento padrão", () => {
    const { container } = render(
      <CatalogoClient store={store} products={makeProducts(2, "Vestidos")} />
    );
    const themed = container.firstElementChild as HTMLElement;
    expect(store.theme.fontDisplayVar).toBe("--font-sora");
    expect(themed.style.getPropertyValue("--font-sora")).not.toBe("var(--font-sora)");
    expect(themed.style.getPropertyValue("--font-dm-sans")).not.toBe("var(--font-dm-sans)");
  });

  it("sobrescreve --font-sora corretamente para pareamento não padrão", () => {
    const editorialStore: Store = {
      ...store,
      theme: resolveTheme("editorial", "padrao", "padrao", null, getPlanLimits("pro", null)),
    };
    const { container } = render(
      <CatalogoClient store={editorialStore} products={makeProducts(2, "Vestidos")} />
    );
    const themed = container.firstElementChild as HTMLElement;
    expect(editorialStore.theme.fontDisplayVar).toBe("--font-fraunces");
    expect(themed.style.getPropertyValue("--font-sora")).toBe("var(--font-fraunces)");
  });
});

describe("CatalogoClient — capa da loja", () => {
  it("renderiza a capa quando a loja tem coverUrl", () => {
    render(
      <CatalogoClient
        store={{ ...store, coverUrl: "https://example.com/capa.jpg" }}
        products={makeProducts(2, "Vestidos")}
      />
    );
    expect(screen.getByAltText("Capa da loja Ateliê Mira")).toBeTruthy();
  });

  it("não renderiza a capa quando não há coverUrl", () => {
    render(<CatalogoClient store={store} products={makeProducts(2, "Vestidos")} />);
    expect(screen.queryByAltText(/Capa da loja/)).toBeNull();
  });
});

describe("CatalogoClient — modal de produto com blur no desktop", () => {
  it("o overlay usa fundo translúcido com blur, não cinza sólido", () => {
    const products = makeProducts(1, "Vestidos");
    const { container } = render(<CatalogoClient store={store} products={products} />);

    fireEvent.click(screen.getByText(products[0].name));

    const overlay = container.querySelector(".fixed.inset-0.z-20") as HTMLElement;
    expect(overlay.className).toContain("md:backdrop-blur-md");
    expect(overlay.className).not.toContain("md:bg-black/50");
  });

  it("mantém a grade de produtos montada atrás do modal, para o backdrop-blur ter o que borrar", () => {
    const products = makeProducts(2, "Vestidos");
    const { container } = render(<CatalogoClient store={store} products={products} />);

    fireEvent.click(screen.getByText(products[0].name));

    const grid = container.querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(grid!.querySelectorAll('img[alt^="Produto "]').length).toBe(2);
  });
});
