import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "@testing-library/react";
import { CatalogoClient } from "@/app/[slug]/CatalogoClient";
import type { Product, Store } from "@/lib/types";

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
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos", "Vestidos", "Blusas"],
  description: "Vitrine digital",
  accentColor: "#C9A96E",
  catalogUrl: "vtrinedigital.com.br/ateliemira",
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
