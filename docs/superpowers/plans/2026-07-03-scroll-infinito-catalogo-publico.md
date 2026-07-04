# Scroll Infinito no Catálogo Público — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o catálogo público (`/[slug]`) renderizar os produtos filtrados em lotes de 24, carregando mais automaticamente conforme o cliente rola a tela, sem mudar a busca ao servidor nem o filtro por categoria/busca (que continuam em memória, sobre o array já carregado).

**Architecture:** `use-catalogo.ts` ganha um estado `visibleCount` (uma "janela" por cima do array já filtrado) e reseta esse estado sempre que o filtro muda. `CatalogoClient.tsx` observa um elemento sentinela logo após a grade via `IntersectionObserver`; quando ele entra na tela, pede mais um lote ao hook. Nenhuma chamada de rede nova — é só controle de quantos cards já carregados aparecem no DOM.

**Tech Stack:** React (hooks), `IntersectionObserver` (API nativa do navegador, sem biblioteca nova), Vitest + React Testing Library.

## Global Constraints

- Lote de 24 produtos (carga inicial e cada carregamento).
- Carregamento automático ao rolar (sem botão "carregar mais").
- Resetar para 24 sempre que a categoria ativa ou a busca mudarem.
- Sem virtualização de lista — cards carregados nunca são removidos do DOM (ver decisão na spec).
- Sem mudança na busca ao servidor/cache do catálogo (`lib/server/catalog.ts`).

---

### Task 1: Carregamento incremental em `use-catalogo.ts` + `CatalogoClient.tsx`

**Files:**
- Modify: `app/[slug]/use-catalogo.ts`
- Modify: `app/[slug]/CatalogoClient.tsx`
- Test: `__tests__/CatalogoClient.test.tsx`

**Interfaces:**
- Consumes: `filterCatalog(products, activeCategory, searchQuery): Product[]` (já existe, `@/lib/catalog`).
- Produces: `useCatalogo` passa a retornar `visibleProducts: Product[]`, `hasMore: boolean` e `loadMore: () => void` em vez de `filteredProducts` — consumidos só dentro de `CatalogoClient.tsx` (não há mais nenhum outro consumidor do hook nesta rodada).

- [ ] **Step 1: Escrever os testes (devem falhar — o comportamento ainda não existe)**

Criar `__tests__/CatalogoClient.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    FakeIntersectionObserver.instances[0].trigger(true);
    expect(countCards(container)).toBe(30);
  });

  it("reseta para o lote inicial ao trocar de categoria", () => {
    const products = [...makeProducts(30, "Vestidos"), ...makeProducts(5, "Blusas")];
    const { container } = render(<CatalogoClient store={store} products={products} />);

    FakeIntersectionObserver.instances[0].trigger(true);
    expect(countCards(container)).toBe(35);

    fireEvent.click(screen.getByText("Blusas"));
    expect(countCards(container)).toBe(5);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/CatalogoClient.test.tsx`
Expected: FAIL — hoje `CatalogoClient` renderiza todos os 30/35 produtos filtrados de uma vez (sem `visibleCount`), então o primeiro teste ("só 24") falha porque `countCards` retorna 30.

- [ ] **Step 3: Atualizar `app/[slug]/use-catalogo.ts`**

Substituir o arquivo inteiro por:

```ts
"use client";

import { useState, useCallback, useEffect } from "react";
import { renderWhatsAppMessage, normalizeWhatsapp } from "@/lib/utils";
import { filterCatalog } from "@/lib/catalog";
import type { CartItem, Product, Store } from "@/lib/types";

export const CATALOG_BATCH_SIZE = 24;

interface UseCatalogoArgs {
  store: Store;
  products: Product[];
}

export function useCatalogo({ store, products }: UseCatalogoArgs) {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openProduct, setOpenProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(CATALOG_BATCH_SIZE);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Alterna o campo de busca; ao fechar, limpa o termo (CAT-B06).
  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) setSearchQuery("");
      return !open;
    });
  }, []);

  const filteredProducts = filterCatalog(products, activeCategory, searchQuery);

  // Volta pro lote inicial sempre que o filtro muda — senão o scroll fica
  // com um número de itens visíveis que não corresponde ao filtro atual.
  useEffect(() => {
    setVisibleCount(CATALOG_BATCH_SIZE);
  }, [activeCategory, searchQuery]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + CATALOG_BATCH_SIZE);
  }, []);

  const bagCount = cart.reduce((s, it) => s + it.qty, 0);
  const hasWhatsapp = !!store.whatsapp;

  const handleAdd = useCallback(
    (product: Product, size: string | null, color: string | null, qty: number) => {
      const key = `${product.id}|${size ?? ""}|${color ?? ""}`;
      setCart((prev) => {
        const found = prev.find((it) => it.key === key);
        if (found) {
          return prev.map((it) =>
            it.key === key ? { ...it, qty: Math.min(99, it.qty + qty) } : it
          );
        }
        return [...prev, { key, product, size, color, qty }];
      });
      setOpenProduct(null);
      setBagOpen(true);
    },
    []
  );

  const handleQty = useCallback((key: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((it) => it.key !== key)
        : prev.map((it) => (it.key === key ? { ...it, qty } : it))
    );
  }, []);

  const handleRemove = useCallback((key: string) => {
    setCart((prev) => prev.filter((it) => it.key !== key));
  }, []);

  const handleCheckout = useCallback(() => {
    if (!store.whatsapp) {
      flash("Esta loja ainda não configurou o WhatsApp.");
      return;
    }
    const msg = renderWhatsAppMessage(store.messageTemplate, cart);
    flash("Abrindo o WhatsApp…");
    window.open(
      `https://wa.me/${normalizeWhatsapp(store.whatsapp)}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }, [cart, store.whatsapp, store.messageTemplate, flash]);

  return {
    activeCategory,
    setActiveCategory,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    openProduct,
    setOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    visibleProducts,
    hasMore,
    loadMore,
    activeProducts: products,
    bagCount,
    hasWhatsapp,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  };
}
```

- [ ] **Step 4: Atualizar `app/[slug]/CatalogoClient.tsx`**

Trocar o import do React no topo (adicionar `useEffect`, `useRef`):

```tsx
"use client";

import { useEffect, useRef } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { StoreHeader } from "@/components/catalogo/StoreHeader";
import { ProductCard } from "@/components/catalogo/ProductCard";
import { ProductDetail } from "@/components/catalogo/ProductDetail";
import { BagDrawer } from "@/components/catalogo/BagDrawer";
import type { Product, Store } from "@/lib/types";
import { useCatalogo } from "./use-catalogo";
```

Trocar a desestruturação do hook (linhas 18-39 do arquivo atual), removendo `filteredProducts` e adicionando `visibleProducts`, `hasMore`, `loadMore`:

```tsx
  const {
    activeCategory,
    setActiveCategory,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    openProduct,
    setOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    visibleProducts,
    hasMore,
    loadMore,
    activeProducts,
    bagCount,
    hasWhatsapp,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  } = useCatalogo({ store, products });

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);
```

Trocar o bloco que renderiza a grade (hoje checa `filteredProducts.length === 0` e mapeia `filteredProducts`):

```tsx
      {visibleProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-24 text-center">
          <p className="font-display font-medium text-[16px] text-obsidian">
            {searchQuery.trim()
              ? "Nenhuma peça encontrada"
              : "Nenhuma peça disponível no momento"}
          </p>
          <p className="font-body text-[14px] text-graphite">
            {searchQuery.trim()
              ? "Tente buscar por outro nome."
              : "Volte em breve para conferir as novidades."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 px-4 pb-8 pt-1 sm:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={setOpenProduct}
                priority={index < 2}
              />
            ))}
          </div>
          {hasMore && <div ref={sentinelRef} aria-hidden className="h-px" />}
        </>
      )}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/CatalogoClient.test.tsx`
Expected: PASS — 3 testes.

- [ ] **Step 6: Rodar a suíte inteira para checar regressões**

Run: `npx vitest run`
Expected: PASS — todos os arquivos, incluindo `__tests__/catalog.test.ts` e `__tests__/BagDrawer.test.tsx` (que também usam o catálogo).

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `app/[slug]/`.

- [ ] **Step 8: Verificação manual num navegador real**

Usar as ferramentas de preview desta sessão (Chromium real — `IntersectionObserver` funciona nativamente, diferente do dublê usado no teste automatizado):

1. Abrir o catálogo público de uma loja com mais de 24 produtos ativos (ex: `/ateliemira` com os dados de seed, se tiver produtos suficientes — senão, ajustar `CATALOG_BATCH_SIZE` temporariamente pra um valor baixo tipo 3 só pra testar localmente, revertendo depois).
2. Confirmar que só aparecem os primeiros produtos na carga inicial.
3. Rolar a página até perto do fim da grade → confirmar que mais produtos aparecem sozinhos, sem clique.
4. Trocar de categoria (clicar num pill diferente) → confirmar que a grade volta a mostrar só o lote inicial daquela categoria.
5. Verificar no console do navegador que não há erros.

Expected: todos os passos acima se comportam como descrito.

- [ ] **Step 9: Commit**

```bash
git add app/\[slug\]/use-catalogo.ts app/\[slug\]/CatalogoClient.tsx __tests__/CatalogoClient.test.tsx
git commit -m "feat: adiciona carregamento incremental (scroll infinito) no catálogo público"
```
