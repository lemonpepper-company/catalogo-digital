# Filtro de busca por nome, categoria e status no painel de produtos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar busca por nome, filtro por categoria e filtro por status à listagem `/painel/produtos`, cobrindo todos os produtos da loja (não só a página atual), reaproveitando o padrão de URL-como-fonte-da-verdade já usado pela paginação existente.

**Architecture:** Um novo módulo puro (`lib/product-filters.ts`) centraliza as constantes e validações dos filtros de categoria/status. `app/painel/produtos/page.tsx` passa a ler `q`/`categoria`/`status` de `searchParams`, aplica essas condições na mesma query que já faz `.range()` e recalcula `totalPages` a partir de um count filtrado — os 3 contadores de status e o total do card continuam com as queries atuais, sem filtro. No client, um novo hook `use-produtos-filtros.ts` mantém o texto digitado localmente com debounce e atualiza a URL via `router.replace`; `use-produtos.ts` passa a preservar os filtros ativos no redirecionamento pós-exclusão do último produto de uma página. `ProdutosClient.tsx` ganha uma barra de filtros (busca + 2 dropdowns reaproveitando o componente `Select` já existente) entre o card de contadores e a tabela, e um estado vazio específico para busca sem resultado.

**Tech Stack:** Next.js App Router (server components + `searchParams`), Supabase JS (`.ilike()`, `.eq()`, `.is()`, `count: "exact", head: true`), Vitest + React Testing Library (incluindo `renderHook`/`act` para o novo hook de filtros).

## Global Constraints

- Busca por nome com debounce de ~400ms; seleção de categoria e de status aplicam o filtro imediatamente, sem debounce.
- Filtro cobre **todos os produtos da loja** (server-side), não só a página atual.
- Filtros combinam entre si (nome + categoria + status ao mesmo tempo) e resetam a paginação para a página 1.
- Contadores do card (ativos/esgotados/inativos/total) sempre refletem os totais da loja, nunca afetados por nenhum dos três filtros.
- Filtro de status usa exatamente as mesmas condições de query já usadas nos contadores: `ativo` → `is_active=true AND stock>0`; `esgotado` → `stock=0`; `inativo` → `is_active=false`.
- Categoria inclui opção "Sem categoria" para produtos com `category_id` nulo.
- `q`/`categoria`/`status` são preservados nos links de paginação e no redirecionamento pós-exclusão do último produto de uma página.
- Valores inválidos de `categoria`/`status` na URL são descartados silenciosamente (mesmo espírito do `clampPage` já existente para `page`).
- Sem filtro por ordenação, sem persistência entre sessões (localStorage) e sem busca no catálogo público — fora de escopo desta rodada.

---

### Task 1: Módulo puro de validação de filtros

**Files:**
- Create: `lib/product-filters.ts`
- Test: `__tests__/product-filters.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: `NO_CATEGORY_VALUE: string`, `STATUS_OPTIONS: readonly { value: "ativo" | "esgotado" | "inativo"; label: string }[]`, `type ProductStatusFilter = "ativo" | "esgotado" | "inativo"`, `isValidStatus(value: string | undefined): value is ProductStatusFilter`, `isValidCategoria(value: string | undefined, categories: { id: string }[]): boolean` — usados pelas Tasks 4 e 5.

- [ ] **Step 1: Escrever os testes (devem falhar, o módulo ainda não existe)**

Criar `__tests__/product-filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  NO_CATEGORY_VALUE,
  STATUS_OPTIONS,
  isValidStatus,
  isValidCategoria,
} from "@/lib/product-filters";

describe("isValidStatus", () => {
  it("aceita os três valores de status conhecidos", () => {
    expect(isValidStatus("ativo")).toBe(true);
    expect(isValidStatus("esgotado")).toBe(true);
    expect(isValidStatus("inativo")).toBe(true);
  });

  it("rejeita valor desconhecido", () => {
    expect(isValidStatus("qualquer-coisa")).toBe(false);
  });

  it("rejeita undefined", () => {
    expect(isValidStatus(undefined)).toBe(false);
  });
});

describe("isValidCategoria", () => {
  const categories = [{ id: "cat-1" }, { id: "cat-2" }];

  it("aceita um id de categoria existente", () => {
    expect(isValidCategoria("cat-1", categories)).toBe(true);
  });

  it("aceita o valor sentinela de sem categoria", () => {
    expect(isValidCategoria(NO_CATEGORY_VALUE, categories)).toBe(true);
  });

  it("rejeita um id que não existe entre as categorias", () => {
    expect(isValidCategoria("cat-inexistente", categories)).toBe(false);
  });

  it("rejeita undefined", () => {
    expect(isValidCategoria(undefined, categories)).toBe(false);
  });
});

describe("STATUS_OPTIONS", () => {
  it("expõe os três status na ordem ativo, esgotado, inativo", () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "ativo",
      "esgotado",
      "inativo",
    ]);
  });

  it("cada status tem um label legível", () => {
    expect(STATUS_OPTIONS.find((o) => o.value === "ativo")?.label).toBe("Ativos");
    expect(STATUS_OPTIONS.find((o) => o.value === "esgotado")?.label).toBe("Esgotados");
    expect(STATUS_OPTIONS.find((o) => o.value === "inativo")?.label).toBe("Inativos");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/product-filters.test.ts`
Expected: FAIL — `Cannot find module '@/lib/product-filters'`.

- [ ] **Step 3: Implementar `lib/product-filters.ts`**

```ts
export const NO_CATEGORY_VALUE = "sem-categoria";

export const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativos" },
  { value: "esgotado", label: "Esgotados" },
  { value: "inativo", label: "Inativos" },
] as const;

export type ProductStatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

export function isValidStatus(
  value: string | undefined
): value is ProductStatusFilter {
  return !!value && STATUS_OPTIONS.some((o) => o.value === value);
}

export function isValidCategoria(
  value: string | undefined,
  categories: { id: string }[]
): boolean {
  if (!value) return false;
  if (value === NO_CATEGORY_VALUE) return true;
  return categories.some((c) => c.id === value);
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/product-filters.test.ts`
Expected: PASS — 8 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/product-filters.ts __tests__/product-filters.test.ts
git commit -m "feat: adiciona validação pura de filtros de produtos (status e categoria)"
```

---

### Task 2: `Pagination` preserva filtros extras nos links

**Files:**
- Modify: `components/ui/Pagination.tsx`
- Test: `__tests__/Pagination.test.tsx`

**Interfaces:**
- Consumes: nada de novo (usa `getPageRange` já existente).
- Produces: `<Pagination currentPage totalPages basePath extraParams?: Record<string, string> />` — usado pela Task 4 (`ProdutosClient.tsx`).

- [ ] **Step 1: Escrever o teste novo (deve falhar, a prop ainda não existe)**

Adicionar ao final do `describe("Pagination", ...)` em `__tests__/Pagination.test.tsx` (mantendo os testes existentes intactos):

```tsx
  it("inclui extraParams nos links gerados, junto com page", () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={3}
        basePath="/painel/produtos"
        extraParams={{ q: "vestido", categoria: "cat-1" }}
      />
    );
    expect(screen.getByText("3").getAttribute("href")).toBe(
      "/painel/produtos?page=3&q=vestido&categoria=cat-1"
    );
  });
```

- [ ] **Step 2: Rodar os testes e confirmar que o novo falha**

Run: `npx vitest run __tests__/Pagination.test.tsx`
Expected: FAIL no teste novo — o href gerado ainda é só `?page=3`, sem `q`/`categoria` (os demais testes continuam passando).

- [ ] **Step 3: Atualizar `components/ui/Pagination.tsx`**

Trocar a interface de props e a função `hrefFor`:

```tsx
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
  extraParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  totalPages,
  basePath,
  extraParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) =>
    `${basePath}?${new URLSearchParams({ page: String(page), ...extraParams }).toString()}`;
```

O restante do componente (tokens, botões Anterior/Próxima) permanece inalterado.

- [ ] **Step 4: Rodar os testes e confirmar que todos passam**

Run: `npx vitest run __tests__/Pagination.test.tsx`
Expected: PASS — 7 testes (6 existentes + 1 novo).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Pagination.tsx __tests__/Pagination.test.tsx
git commit -m "feat: Pagination preserva extraParams nos links gerados"
```

---

### Task 3: Hook `use-produtos-filtros` (debounce + atualização de URL)

**Files:**
- Create: `app/painel/produtos/use-produtos-filtros.ts`
- Test: `__tests__/use-produtos-filtros.test.ts`

**Interfaces:**
- Consumes: nada de novo.
- Produces: `useProdutosFiltros(initialQ: string, initialCategoria: string, initialStatus: string): { q: string; onQChange(value: string): void; onCategoriaChange(value: string): void; onStatusChange(value: string): void; clearFilters(): void }` — usado pela Task 4 (`ProdutosClient.tsx`).

- [ ] **Step 1: Escrever os testes (devem falhar, o hook ainda não existe)**

Criar `__tests__/use-produtos-filtros.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProdutosFiltros } from "@/app/painel/produtos/use-produtos-filtros";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

describe("useProdutosFiltros", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não chama router.replace imediatamente ao digitar", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onQChange("vestido"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("chama router.replace com ?q= após o debounce de 400ms", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onQChange("vestido"));
    act(() => vi.advanceTimersByTime(400));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?q=vestido", {
      scroll: false,
    });
  });

  it("cancela o debounce anterior se o usuário digitar de novo antes de 400ms", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onQChange("ves"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onQChange("vestido"));
    act(() => vi.advanceTimersByTime(400));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/painel/produtos?q=vestido", {
      scroll: false,
    });
  });

  it("aplica o filtro de categoria imediatamente, sem esperar debounce", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onCategoriaChange("cat-1"));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?categoria=cat-1", {
      scroll: false,
    });
  });

  it("aplica o filtro de status imediatamente, sem esperar debounce", () => {
    const { result } = renderHook(() => useProdutosFiltros("", "", ""));
    act(() => result.current.onStatusChange("ativo"));
    expect(replace).toHaveBeenCalledWith("/painel/produtos?status=ativo", {
      scroll: false,
    });
  });

  it("combina q, categoria e status na mesma URL", () => {
    const { result } = renderHook(() =>
      useProdutosFiltros("vestido", "cat-1", "")
    );
    act(() => result.current.onStatusChange("ativo"));
    expect(replace).toHaveBeenCalledWith(
      "/painel/produtos?q=vestido&categoria=cat-1&status=ativo",
      { scroll: false }
    );
  });

  it("clearFilters limpa a URL e o estado local de busca", () => {
    const { result } = renderHook(() =>
      useProdutosFiltros("vestido", "cat-1", "ativo")
    );
    act(() => result.current.clearFilters());
    expect(replace).toHaveBeenCalledWith("/painel/produtos", {
      scroll: false,
    });
    expect(result.current.q).toBe("");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/use-produtos-filtros.test.ts`
Expected: FAIL — `Cannot find module '@/app/painel/produtos/use-produtos-filtros'`.

- [ ] **Step 3: Implementar `app/painel/produtos/use-produtos-filtros.ts`**

```ts
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

export function useProdutosFiltros(
  initialQ: string,
  initialCategoria: string,
  initialStatus: string
) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const qRef = useRef(initialQ);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replace = (nextQ: string, nextCategoria: string, nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextCategoria) params.set("categoria", nextCategoria);
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    router.replace(`/painel/produtos${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const onQChange = (value: string) => {
    setQ(value);
    qRef.current = value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      replace(value, initialCategoria, initialStatus);
    }, DEBOUNCE_MS);
  };

  const onCategoriaChange = (value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    replace(qRef.current, value, initialStatus);
  };

  const onStatusChange = (value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    replace(qRef.current, initialCategoria, value);
  };

  const clearFilters = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setQ("");
    qRef.current = "";
    replace("", "", "");
  };

  return { q, onQChange, onCategoriaChange, onStatusChange, clearFilters };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/use-produtos-filtros.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Commit**

```bash
git add app/painel/produtos/use-produtos-filtros.ts __tests__/use-produtos-filtros.test.ts
git commit -m "feat: adiciona hook use-produtos-filtros com debounce de busca"
```

---

### Task 4: `use-produtos.ts` preserva filtros + `ProdutosClient.tsx` ganha a barra de filtros

**Files:**
- Modify: `app/painel/produtos/use-produtos.ts`
- Modify: `app/painel/produtos/ProdutosClient.tsx`
- Test: `__tests__/ProdutosClient.test.tsx`

**Interfaces:**
- Consumes: `useProdutosFiltros(initialQ, initialCategoria, initialStatus)` da Task 3; `<Pagination extraParams />` da Task 2; `NO_CATEGORY_VALUE`, `STATUS_OPTIONS` da Task 1.
- Produces: `useProdutos(products, maxProducts, counts, page, filters: { q: string; categoria: string; status: string })`; `ProdutosClient` passa a exigir as props `categories: { id: string; name: string }[]`, `initialQ: string`, `initialCategoria: string`, `initialStatus: string` — usadas pela Task 5 (`page.tsx`).

- [ ] **Step 1: Escrever os testes (devem falhar — as props novas ainda não existem)**

Substituir `__tests__/ProdutosClient.test.tsx` inteiro por:

```tsx
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: FAIL — TypeScript aponta `categories`/`initialQ`/`initialCategoria`/`initialStatus` como props inexistentes em `ProdutosClientProps`, e os textos "Nenhum produto encontrado"/"Limpar filtros"/placeholder "Buscar por nome..." não são encontrados.

- [ ] **Step 3: Atualizar `app/painel/produtos/use-produtos.ts`**

Substituir o arquivo inteiro por:

```ts
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toggleProductActive,
  deleteProduct,
} from "@/app/actions/produtos";
import type { StoreProduct, ToastState } from "@/lib/types";

export interface ProductCounts {
  active: number;
  soldOut: number;
  inactive: number;
  total: number;
}

export interface ProductFilters {
  q: string;
  categoria: string;
  status: string;
}

export function useProdutos(
  products: StoreProduct[],
  maxProducts: number,
  counts: ProductCounts,
  page: number,
  filters: ProductFilters
) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<StoreProduct | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const limitReached = counts.total >= maxProducts;

  const toggleActive = (product: StoreProduct) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", product.id);
      fd.set("isActive", String(!product.isActive));
      const res = await toggleProductActive(null, fd);
      if (res && "error" in res) flash(res.error, "error");
    });
  };

  const removeProduct = (id: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await deleteProduct(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
      } else {
        flash("Produto excluído", "error");
        if (products.length === 1 && page > 1) {
          const params = new URLSearchParams();
          params.set("page", String(page - 1));
          if (filters.q) params.set("q", filters.q);
          if (filters.categoria) params.set("categoria", filters.categoria);
          if (filters.status) params.set("status", filters.status);
          router.push(`/painel/produtos?${params.toString()}`);
        }
      }
      setConfirm(null);
    });
  };

  return {
    products,
    confirm,
    setConfirm,
    toast,
    active: counts.active,
    soldOut: counts.soldOut,
    inactive: counts.inactive,
    limitReached,
    isPending,
    toggleActive,
    removeProduct,
  };
}
```

- [ ] **Step 4: Atualizar `app/painel/produtos/ProdutosClient.tsx`**

Substituir o arquivo inteiro por:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn, formatCents } from "@/lib/utils";
import type { StoreProduct } from "@/lib/types";
import { useProdutos } from "./use-produtos";
import { useProdutosFiltros } from "./use-produtos-filtros";
import { Pagination } from "@/components/ui/Pagination";
import type { ProductCounts } from "./use-produtos";
import { NO_CATEGORY_VALUE, STATUS_OPTIONS } from "@/lib/product-filters";

interface ProdutosClientProps {
  products: StoreProduct[];
  maxProducts: number;
  counts: ProductCounts;
  page: number;
  totalPages: number;
  categories: { id: string; name: string }[];
  initialQ: string;
  initialCategoria: string;
  initialStatus: string;
}

export function ProdutosClient({
  products,
  maxProducts,
  counts,
  page,
  totalPages,
  categories,
  initialQ,
  initialCategoria,
  initialStatus,
}: ProdutosClientProps) {
  const {
    confirm,
    setConfirm,
    toast,
    active,
    soldOut,
    inactive,
    limitReached,
    isPending,
    toggleActive,
    removeProduct,
  } = useProdutos(products, maxProducts, counts, page, {
    q: initialQ,
    categoria: initialCategoria,
    status: initialStatus,
  });

  const { q, onQChange, onCategoriaChange, onStatusChange, clearFilters } =
    useProdutosFiltros(initialQ, initialCategoria, initialStatus);

  const isStoreEmpty = counts.total === 0;
  const hasActiveFilters = Boolean(
    initialQ || initialCategoria || initialStatus
  );

  const categoriaLabel =
    initialCategoria === NO_CATEGORY_VALUE
      ? "Sem categoria"
      : categories.find((c) => c.id === initialCategoria)?.name ?? "";

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === initialStatus)?.label ?? "";

  const extraParams: Record<string, string> = {};
  if (initialQ) extraParams.q = initialQ;
  if (initialCategoria) extraParams.categoria = initialCategoria;
  if (initialStatus) extraParams.status = initialStatus;

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Produtos
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            {counts.total}{" "}
            {counts.total === 1 ? "produto cadastrado" : "produtos cadastrados"}
            {Number.isFinite(maxProducts) ? ` · limite ${maxProducts}` : ""}
          </p>
        </div>
        {limitReached ? (
          <span className="inline-flex items-center justify-center min-h-11 px-6 py-2.5 rounded-btn bg-linen text-graphite font-display font-medium text-[15px] cursor-not-allowed text-center">
            Limite atingido — faça upgrade
          </span>
        ) : (
          <Link
            href="/painel/produtos/novo"
            className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
          >
            <Plus size={18} />
            Novo produto
          </Link>
        )}
      </div>

      {isStoreEmpty ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
              <Package size={42} />
            </div>
            <div>
              <div className="font-display font-semibold text-[20px] text-obsidian">
                Nenhum produto cadastrado ainda
              </div>
              <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                Cadastre sua primeira peça e ela aparece no catálogo público na hora.
              </p>
            </div>
            <Link
              href="/painel/produtos/novo"
              className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-btn bg-gold text-white font-display font-medium text-[15px] hover:bg-gold-hover transition-colors"
            >
              <Plus size={18} />
              Cadastrar primeiro produto →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="bg-linen">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10">
              {[
                { value: active, label: "ativos", color: "bg-success" },
                { value: soldOut, label: "esgotados", color: "bg-soldout" },
                { value: inactive, label: "inativos", color: "bg-inactive" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
                  <span className="font-display font-semibold text-[20px] text-obsidian">
                    {s.value}
                  </span>
                  <span className="font-body text-[14px] text-graphite">{s.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite pointer-events-none"
              />
              <Input
                value={q}
                onChange={(e) => onQChange(e.target.value)}
                placeholder="Buscar por nome..."
                aria-label="Buscar por nome"
                className="pl-9"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select
                value={categoriaLabel || "Todas as categorias"}
                options={[
                  "Todas as categorias",
                  ...categories.map((c) => c.name),
                  "Sem categoria",
                ]}
                onChange={(label) => {
                  if (label === "Todas as categorias") onCategoriaChange("");
                  else if (label === "Sem categoria")
                    onCategoriaChange(NO_CATEGORY_VALUE);
                  else {
                    const found = categories.find((c) => c.name === label);
                    onCategoriaChange(found ? found.id : "");
                  }
                }}
              />
            </div>
            <div className="w-full sm:w-[180px]">
              <Select
                value={statusLabel || "Todos os status"}
                options={["Todos os status", ...STATUS_OPTIONS.map((o) => o.label)]}
                onChange={(label) => {
                  if (label === "Todos os status") onStatusChange("");
                  else {
                    const found = STATUS_OPTIONS.find((o) => o.label === label);
                    onStatusChange(found ? found.value : "");
                  }
                }}
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            )}
          </div>

          {products.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
                  <Search size={42} />
                </div>
                <div>
                  <div className="font-display font-semibold text-[20px] text-obsidian">
                    Nenhum produto encontrado
                  </div>
                  <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                    Tente ajustar sua busca ou filtro.
                  </p>
                </div>
                <Button variant="ghost" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card pad={0} className="overflow-hidden">
                <div className="hidden lg:flex items-center gap-4 px-5 py-3 bg-linen">
                  <span className="flex-1 font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                    Produto
                  </span>
                  <span className="w-[120px] flex-shrink-0 text-right font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                    Estoque
                  </span>
                  <span className="w-[140px] flex-shrink-0 font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
                    Visibilidade
                  </span>
                  <span className="w-[76px] flex-shrink-0" />
                </div>

                {products.map((p, i) => {
                  const isSoldOut = p.stock === 0;
                  const stockTone =
                    isSoldOut || p.stock <= 5
                      ? "text-soldout font-semibold"
                      : "text-graphite";
                  return (
                    <div
                      key={p.id}
                      style={{
                        borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                      }}
                    >
                      {/* Card mobile (abaixo de lg:) */}
                      <div className="lg:hidden flex flex-col gap-3 px-5 py-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <ProductThumbnail
                            src={p.images[0]}
                            alt={p.name}
                            active={p.isActive}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-display font-medium text-[15px] text-obsidian truncate">
                              {p.name}
                            </div>
                            <div className="font-body text-[13px] text-graphite mt-0.5">
                              {formatCents(p.priceCents)}
                            </div>
                          </div>
                          <ProductActions
                            editHref={`/painel/produtos/${p.id}`}
                            onDelete={() => setConfirm(p)}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3 pl-[68px]">
                          <StockLabel stock={p.stock} tone={stockTone} />
                          <VisibilityToggle
                            active={p.isActive}
                            onToggle={() => toggleActive(p)}
                          />
                        </div>
                      </div>

                      {/* Linha desktop (lg: e acima) */}
                      <div className="hidden lg:flex items-center gap-4 px-5 py-3.5">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <ProductThumbnail
                            src={p.images[0]}
                            alt={p.name}
                            active={p.isActive}
                          />
                          <div className="min-w-0">
                            <div className="font-display font-medium text-[15px] text-obsidian truncate">
                              {p.name}
                            </div>
                            <div className="font-body text-[13px] text-graphite mt-0.5">
                              {formatCents(p.priceCents)}
                            </div>
                          </div>
                        </div>

                        <div className="w-[120px] flex-shrink-0 text-right">
                          <StockLabel stock={p.stock} tone={stockTone} />
                        </div>

                        <div className="w-[140px] flex-shrink-0">
                          <VisibilityToggle
                            active={p.isActive}
                            onToggle={() => toggleActive(p)}
                          />
                        </div>

                        <div className="w-[76px] flex-shrink-0">
                          <ProductActions
                            editHref={`/painel/produtos/${p.id}`}
                            onDelete={() => setConfirm(p)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                basePath="/painel/produtos"
                extraParams={extraParams}
              />
            </>
          )}
        </>
      )}

      {confirm && (
        <Modal title="Excluir produto" onClose={() => setConfirm(null)}>
          <p className="font-body text-[15px] text-graphite leading-relaxed">
            Tem certeza que deseja excluir{" "}
            <strong className="text-obsidian font-semibold">{confirm.name}</strong>?
            Essa ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              disabled={isPending}
              onClick={() => removeProduct(confirm.id)}
            >
              {isPending ? "Excluindo…" : "Excluir"}
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}

function ProductThumbnail({
  src,
  alt,
  active,
}: {
  src: string | undefined;
  alt: string;
  active: boolean;
}) {
  return (
    <div
      className="relative w-[52px] h-16 rounded-[8px] overflow-hidden bg-linen flex-shrink-0"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      {src && (
        <Image src={src} alt={alt} fill sizes="52px" className="object-cover" />
      )}
    </div>
  );
}

function StockLabel({ stock, tone }: { stock: number; tone: string }) {
  return (
    <span className={cn("font-body text-[13px]", tone)}>
      {stock === 0 ? "Esgotado" : `${stock} em estoque`}
    </span>
  );
}

function VisibilityToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch checked={active} onChange={onToggle} />
      <span
        className={cn(
          "font-body text-[13px]",
          active ? "text-success" : "text-inactive"
        )}
      >
        {active ? "Ativo" : "Inativo"}
      </span>
    </div>
  );
}

function ProductActions({
  editHref,
  onDelete,
}: {
  editHref: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1 flex-shrink-0">
      <Link
        href={editHref}
        aria-label="Editar"
        className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
      >
        <Pencil size={15} />
      </Link>
      <button
        onClick={onDelete}
        aria-label="Excluir"
        className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: PASS — 10 testes.

- [ ] **Step 6: Rodar a suíte inteira para checar regressões**

Run: `npx vitest run`
Expected: PASS — todos os arquivos, incluindo os das Tasks 1, 2 e 3.

- [ ] **Step 7: Commit**

```bash
git add app/painel/produtos/use-produtos.ts app/painel/produtos/ProdutosClient.tsx __tests__/ProdutosClient.test.tsx
git commit -m "feat: ProdutosClient ganha barra de filtros (nome, categoria, status)"
```

---

### Task 5: `page.tsx` aplica os filtros no servidor + verificação manual

**Files:**
- Modify: `app/painel/produtos/page.tsx`

**Interfaces:**
- Consumes: `PRODUCTS_PAGE_SIZE`, `getTotalPages`, `clampPage` (`@/lib/pagination`); `NO_CATEGORY_VALUE`, `isValidStatus`, `isValidCategoria`, `type ProductStatusFilter` da Task 1 (`@/lib/product-filters`); `ProdutosClient` com as props `categories`, `initialQ`, `initialCategoria`, `initialStatus` da Task 4.
- Produces: nada (última task desta rodada).

**Nota:** esta task não tem teste automatizado — nenhuma outra página server-side deste projeto tem teste unitário (busca dados reais do Supabase); o padrão existente (ver `2026-07-03-paginacao-painel-produtos.md`) é verificação manual no navegador.

- [ ] **Step 1: Substituir `app/painel/produtos/page.tsx` inteiro**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { PRODUCTS_PAGE_SIZE, getTotalPages, clampPage } from "@/lib/pagination";
import {
  NO_CATEGORY_VALUE,
  isValidStatus,
  isValidCategoria,
  type ProductStatusFilter,
} from "@/lib/product-filters";
import { ProdutosClient } from "./ProdutosClient";

function applyProductFilters(
  query: any,
  q: string | undefined,
  categoria: string | undefined,
  status: ProductStatusFilter | undefined
) {
  let result = query;
  if (q) result = result.ilike("name", `%${q}%`);
  if (categoria === NO_CATEGORY_VALUE) result = result.is("category_id", null);
  else if (categoria) result = result.eq("category_id", categoria);
  if (status === "ativo") result = result.eq("is_active", true).gt("stock", 0);
  else if (status === "esgotado") result = result.eq("stock", 0);
  else if (status === "inativo") result = result.eq("is_active", false);
  return result;
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    categoria?: string;
    status?: string;
  }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { page: pageParam, q, categoria, status } = await searchParams;

  const { data: categoryRows } = await supabase
    .from("categories")
    .select("id, name")
    .eq("store_id", store.id)
    .order("position", { ascending: true });
  const categories = categoryRows ?? [];

  const validCategoria = isValidCategoria(categoria, categories)
    ? categoria
    : undefined;
  const validStatus = isValidStatus(status) ? status : undefined;

  const [
    { count: total },
    { count: active },
    { count: soldOut },
    { count: inactive },
  ] = await Promise.all([
    applyProductFilters(
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", store.id),
      q,
      validCategoria,
      validStatus
    ),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("is_active", true)
      .gt("stock", 0),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("stock", 0),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("is_active", false),
  ]);

  const totalPages = getTotalPages(total ?? 0, PRODUCTS_PAGE_SIZE);
  const page = clampPage(Number(pageParam ?? "1"), totalPages);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  const { data } = await applyProductFilters(
    supabase
      .from("products")
      .select(
        "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
      )
      .eq("store_id", store.id),
    q,
    validCategoria,
    validStatus
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  const products = (data ?? []).map(mapProduct);
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return (
    <ProdutosClient
      products={products}
      maxProducts={limits.maxProducts}
      counts={{
        active: active ?? 0,
        soldOut: soldOut ?? 0,
        inactive: inactive ?? 0,
        total: total ?? 0,
      }}
      page={page}
      totalPages={totalPages}
      categories={categories}
      initialQ={q ?? ""}
      initialCategoria={validCategoria ?? ""}
      initialStatus={validStatus ?? ""}
    />
  );
}
```

- [ ] **Step 2: Rodar a suíte inteira e o type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: todos os testes PASS; `tsc` sem erros novos relacionados a `app/painel/produtos/` (ignorar qualquer erro pré-existente não relacionado a esta mudança, se houver).

- [ ] **Step 3: Verificação manual no navegador**

1. Rodar o servidor de dev e abrir `/painel/produtos` numa loja com produtos de nomes e categorias variados.
2. Digitar parte de um nome no campo de busca e aguardar ~400ms sem apertar Enter → confirmar que a lista atualiza sozinha e a URL passa a ter `?q=...`.
3. Selecionar uma categoria no dropdown → confirmar atualização imediata (sem esperar debounce) e `?categoria=...` na URL.
4. Selecionar um status (Ativos/Esgotados/Inativos) → confirmar atualização imediata e `?status=...` na URL.
5. Combinar busca + categoria + status → confirmar que a URL contém os três parâmetros e a lista reflete a interseção.
6. Confirmar que os contadores do card cinza (ativos/esgotados/inativos/total) **não mudam** com nenhum filtro ativo.
7. Buscar por um nome que não existe → confirmar que aparece "Nenhum produto encontrado" com o botão "Limpar filtros", e que o botão limpa a busca e volta a mostrar a lista completa.
8. Com um filtro ativo e mais de uma página de resultado, clicar em "Próxima" → confirmar que o filtro se mantém na URL e na barra de filtros.
9. Com um filtro ativo, excluir o único produto restante de uma página que não é a primeira → confirmar que o redirecionamento para a página anterior preserva o filtro na URL.
10. Selecionar "Sem categoria" → confirmar que só aparecem produtos com `category_id` nulo.

Expected: todos os passos acima se comportam como descrito, sem erros no console do navegador.

- [ ] **Step 4: Commit**

```bash
git add app/painel/produtos/page.tsx
git commit -m "feat: filtra produtos do painel por nome, categoria e status no servidor"
```
