# Paginação da Listagem de Produtos no Painel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a busca "todos os produtos de uma vez" em `/painel/produtos` por paginação real no servidor (20 por página, navegável por URL), mantendo os contadores de status (ativos/esgotados/inativos) e o aviso de limite do plano corretos independente da página exibida.

**Architecture:** Camada pura de cálculo de paginação (`lib/pagination.ts`) sem dependência de UI ou banco, consumida por um componente de navegação (`components/ui/Pagination.tsx`) e pela página server-side (`app/painel/produtos/page.tsx`), que passa a rodar 4 queries `count: "exact", head: true` em paralelo (total + 3 status) além da query paginada com `.range()`. O hook `use-produtos.ts` e o componente `ProdutosClient.tsx` param de calcular os contadores a partir do array de produtos e passam a recebê-los prontos via props.

**Tech Stack:** Next.js App Router (server components + `searchParams`), Supabase JS (`.range()`, `count: "exact", head: true`), Vitest + React Testing Library.

## Global Constraints

- 20 produtos por página (`PRODUCTS_PAGE_SIZE`).
- Navegação via URL: `/painel/produtos?page=N`, não estado de cliente.
- Contadores de status e `limitReached` sempre refletem a loja inteira, nunca a página atual.
- Página inválida ou fora do intervalo é sempre "agarrada" (clamp) entre 1 e o total de páginas — nunca gera erro.
- Ao excluir o último produto de uma página que não é a primeira, navega automaticamente para a página anterior.
- Sem busca/filtro nesta rodada (fora de escopo, ver spec).

---

### Task 1: Lógica pura de paginação

**Files:**
- Create: `lib/pagination.ts`
- Test: `__tests__/pagination.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: `PRODUCTS_PAGE_SIZE: number`, `getTotalPages(total: number, pageSize: number): number`, `clampPage(requestedPage: number, totalPages: number): number`, `type PageToken = number | "ellipsis"`, `getPageRange(currentPage: number, totalPages: number): PageToken[]` — usados pela Task 2.

- [ ] **Step 1: Escrever os testes (devem falhar, o módulo ainda não existe)**

Criar `__tests__/pagination.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTotalPages, clampPage, getPageRange } from "@/lib/pagination";

describe("getTotalPages", () => {
  it("arredonda para cima", () => {
    expect(getTotalPages(45, 20)).toBe(3);
  });

  it("retorna 1 quando não há itens", () => {
    expect(getTotalPages(0, 20)).toBe(1);
  });

  it("retorna 1 quando total é múltiplo exato do tamanho da página", () => {
    expect(getTotalPages(40, 20)).toBe(2);
  });
});

describe("clampPage", () => {
  it("mantém uma página válida", () => {
    expect(clampPage(2, 5)).toBe(2);
  });

  it("agarra página maior que o total na última página", () => {
    expect(clampPage(999, 5)).toBe(5);
  });

  it("agarra página menor que 1 na primeira página", () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(-3, 5)).toBe(1);
  });

  it("agarra valor não numérico (NaN) na primeira página", () => {
    expect(clampPage(Number("abc"), 5)).toBe(1);
  });

  it("trunca páginas fracionárias", () => {
    expect(clampPage(2.9, 5)).toBe(2);
  });
});

describe("getPageRange", () => {
  it("mostra todas as páginas quando são poucas (<=7)", () => {
    expect(getPageRange(1, 3)).toEqual([1, 2, 3]);
    expect(getPageRange(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("mostra reticências no fim quando a página atual está no início", () => {
    expect(getPageRange(1, 12)).toEqual([1, 2, "ellipsis", 12]);
  });

  it("mostra reticências no início quando a página atual está no fim", () => {
    expect(getPageRange(12, 12)).toEqual([1, "ellipsis", 11, 12]);
  });

  it("mostra reticências dos dois lados quando a página atual está no meio", () => {
    expect(getPageRange(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/pagination.test.ts`
Expected: FAIL — `Cannot find module '@/lib/pagination'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `lib/pagination.ts`**

```ts
export const PRODUCTS_PAGE_SIZE = 20;

export function getTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(requestedPage: number, totalPages: number): number {
  if (!Number.isFinite(requestedPage)) return 1;
  return Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages);
}

export type PageToken = number | "ellipsis";

export function getPageRange(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage - 1 >= 1) pages.add(currentPage - 1);
  if (currentPage + 1 <= totalPages) pages.add(currentPage + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: PageToken[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(sorted[i]);
  }
  return result;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/pagination.test.ts`
Expected: PASS — 12 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/pagination.ts __tests__/pagination.test.ts
git commit -m "feat: adiciona lógica pura de paginação (getTotalPages, clampPage, getPageRange)"
```

---

### Task 2: Componente de navegação `Pagination`

**Files:**
- Create: `components/ui/Pagination.tsx`
- Test: `__tests__/Pagination.test.tsx`

**Interfaces:**
- Consumes: `getPageRange(currentPage, totalPages): PageToken[]` da Task 1 (`@/lib/pagination`).
- Produces: `<Pagination currentPage={number} totalPages={number} basePath={string} />` — usado pela Task 3 em `ProdutosClient.tsx`.

- [ ] **Step 1: Escrever os testes (devem falhar, o componente ainda não existe)**

Criar `__tests__/Pagination.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Pagination } from "@/components/ui/Pagination";

describe("Pagination", () => {
  it("não renderiza nada quando há 1 página ou menos", () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} basePath="/painel/produtos" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza todos os números quando são poucas páginas", () => {
    render(<Pagination currentPage={2} totalPages={3} basePath="/painel/produtos" />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("marca a página atual com aria-current", () => {
    render(<Pagination currentPage={2} totalPages={3} basePath="/painel/produtos" />);
    const current = screen.getByText("2");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("1").getAttribute("aria-current")).toBeNull();
  });

  it("gera os links com o basePath e o número de página corretos", () => {
    render(<Pagination currentPage={2} totalPages={3} basePath="/painel/produtos" />);
    expect(screen.getByText("3").getAttribute("href")).toBe("/painel/produtos?page=3");
  });

  it("mostra reticências quando há muitas páginas", () => {
    render(<Pagination currentPage={1} totalPages={12} basePath="/painel/produtos" />);
    expect(screen.getByText("…")).toBeTruthy();
  });

  it("desabilita 'Anterior' na primeira página e 'Próxima' na última", () => {
    render(<Pagination currentPage={1} totalPages={3} basePath="/painel/produtos" />);
    expect(screen.getByText("‹ Anterior").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Próxima ›").getAttribute("aria-disabled")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/Pagination.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Pagination'`.

- [ ] **Step 3: Implementar `components/ui/Pagination.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getPageRange } from "@/lib/pagination";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hrefFor = (page: number) => `${basePath}?page=${page}`;
  const tokens = getPageRange(currentPage, totalPages);
  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-center gap-1.5 pt-2 flex-wrap"
    >
      <Link
        href={hrefFor(Math.max(1, currentPage - 1))}
        aria-disabled={isFirst ? "true" : undefined}
        className={cn(
          "h-9 px-3 rounded-btn border border-sand font-body text-[13px] text-obsidian flex items-center",
          isFirst && "pointer-events-none opacity-40"
        )}
      >
        ‹ Anterior
      </Link>

      {tokens.map((token, i) =>
        token === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            className="px-2 font-body text-[13px] text-graphite"
          >
            …
          </span>
        ) : (
          <Link
            key={token}
            href={hrefFor(token)}
            aria-current={token === currentPage ? "page" : undefined}
            className={cn(
              "h-9 min-w-9 px-2.5 rounded-btn font-body text-[13px] flex items-center justify-center",
              token === currentPage
                ? "bg-linen text-obsidian font-medium"
                : "text-graphite hover:bg-surface-hover"
            )}
          >
            {token}
          </Link>
        )
      )}

      <Link
        href={hrefFor(Math.min(totalPages, currentPage + 1))}
        aria-disabled={isLast ? "true" : undefined}
        className={cn(
          "h-9 px-3 rounded-btn border border-sand font-body text-[13px] text-obsidian flex items-center",
          isLast && "pointer-events-none opacity-40"
        )}
      >
        Próxima ›
      </Link>
    </nav>
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/Pagination.test.tsx`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Pagination.tsx __tests__/Pagination.test.tsx
git commit -m "feat: adiciona componente Pagination"
```

---

### Task 3: `use-produtos.ts` + `ProdutosClient.tsx` recebem contadores e página prontos

**Files:**
- Modify: `app/painel/produtos/use-produtos.ts`
- Modify: `app/painel/produtos/ProdutosClient.tsx`
- Test: `__tests__/ProdutosClient.test.tsx`

**Interfaces:**
- Consumes: `<Pagination currentPage totalPages basePath />` da Task 2 (`@/components/ui/Pagination`).
- Produces: `ProdutosClient` passa a aceitar as props `counts: ProductCounts` (`{ active: number; soldOut: number; inactive: number; total: number }`), `page: number`, `totalPages: number`, além de `products` e `maxProducts` já existentes — usadas pela Task 4 (`page.tsx`, que monta essas props a partir do banco).

- [ ] **Step 1: Escrever os testes (devem falhar — as props novas ainda não existem)**

Criar `__tests__/ProdutosClient.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: FAIL — `counts`/`page`/`totalPages` não existem nas props de `ProdutosClient`, TypeScript/props mismatch, ou o texto "45 produtos cadastrados" não é encontrado (o componente atual mostra o tamanho do array).

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

export function useProdutos(
  products: StoreProduct[],
  maxProducts: number,
  counts: ProductCounts,
  page: number
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
          router.push(`/painel/produtos?page=${page - 1}`);
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

No topo do arquivo, adicionar o import do novo componente e do tipo de contadores:

```tsx
import { Pagination } from "@/components/ui/Pagination";
import type { ProductCounts } from "./use-produtos";
```

Substituir a interface de props e a assinatura do componente:

```tsx
interface ProdutosClientProps {
  products: StoreProduct[];
  maxProducts: number;
  counts: ProductCounts;
  page: number;
  totalPages: number;
}

export function ProdutosClient({
  products,
  maxProducts,
  counts,
  page,
  totalPages,
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
  } = useProdutos(products, maxProducts, counts, page);
```

Trocar o parágrafo do cabeçalho (hoje usa `products.length`) para usar `counts.total`:

```tsx
<p className="font-body text-[15px] text-graphite mt-1.5">
  {counts.total}{" "}
  {counts.total === 1 ? "produto cadastrado" : "produtos cadastrados"}
  {Number.isFinite(maxProducts) ? ` · limite ${maxProducts}` : ""}
</p>
```

Depois do `<Card pad={0} className="overflow-hidden">...</Card>` que lista os produtos (fecha logo antes do `</>`), adicionar o componente de paginação:

```tsx
          </Card>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/painel/produtos"
          />
        </>
      )}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: PASS — 3 testes.

- [ ] **Step 6: Rodar a suíte inteira para checar regressões**

Run: `npx vitest run`
Expected: PASS — todos os arquivos, incluindo os das Tasks 1 e 2.

- [ ] **Step 7: Commit**

```bash
git add app/painel/produtos/use-produtos.ts app/painel/produtos/ProdutosClient.tsx __tests__/ProdutosClient.test.tsx
git commit -m "feat: ProdutosClient recebe contadores e paginação prontos via props"
```

---

### Task 4: `page.tsx` busca só a página atual e as contagens totais

**Files:**
- Modify: `app/painel/produtos/page.tsx`

**Interfaces:**
- Consumes: `PRODUCTS_PAGE_SIZE`, `getTotalPages`, `clampPage` da Task 1 (`@/lib/pagination`); `ProdutosClient` com as props `products`, `maxProducts`, `counts: ProductCounts`, `page`, `totalPages` da Task 3.
- Produces: nada (última task desta rodada).

**Nota:** esta task não tem teste automatizado — nenhuma outra página server-side deste projeto tem teste unitário (busca dados reais do Supabase), o padrão existente é verificação manual no navegador. Mantendo a convenção do projeto.

- [ ] **Step 1: Substituir `app/painel/produtos/page.tsx` inteiro**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { PRODUCTS_PAGE_SIZE, getTotalPages, clampPage } from "@/lib/pagination";
import { ProdutosClient } from "./ProdutosClient";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();

  const [
    { count: total },
    { count: active },
    { count: soldOut },
    { count: inactive },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id),
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
  const { page: pageParam } = await searchParams;
  const page = clampPage(Number(pageParam ?? "1"), totalPages);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("store_id", store.id)
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
    />
  );
}
```

- [ ] **Step 2: Rodar a suíte inteira e o type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: todos os testes PASS; `tsc` sem erros novos relacionados a `app/painel/produtos/` (ignorar o erro pré-existente de `@vercel/speed-insights/next` em `app/layout.tsx`, não relacionado a esta mudança — se ele não aparecer porque a dependência já foi instalada nesta máquina, tudo bem também).

- [ ] **Step 3: Verificação manual no navegador**

1. Rodar o servidor de dev e abrir `/painel/produtos` numa loja com mais de 20 produtos (se os dados de teste tiverem menos, criar produtos rapidamente ou ajustar temporariamente `PRODUCTS_PAGE_SIZE` para 2 só para o teste local, revertendo depois).
2. Confirmar que aparecem só até 20 produtos na página 1, e que a navegação de páginas aparece embaixo da lista.
3. Clicar em "Próxima" → confirmar que a URL vira `/painel/produtos?page=2` e a lista muda.
4. Digitar `/painel/produtos?page=999` diretamente na barra de endereço → confirmar que mostra a última página válida, sem erro.
5. Confirmar que os contadores "ativos/esgotados/inativos" no card cinza continuam com os mesmos números em qualquer página (não mudam ao trocar de página).
6. Excluir o único produto restante de uma página que não é a primeira → confirmar que a navegação volta automaticamente para a página anterior.

Expected: todos os passos acima se comportam como descrito, sem erros no console do navegador.

- [ ] **Step 4: Commit**

```bash
git add app/painel/produtos/page.tsx
git commit -m "feat: pagina produtos do painel via range() e contagens separadas no servidor"
```
