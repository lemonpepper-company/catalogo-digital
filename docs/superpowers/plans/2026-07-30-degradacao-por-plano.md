# Degradação por Plano — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer os limites de plano valerem também na leitura pública da vitrine — hoje eles só existem na escrita — e impedir que o domínio próprio sobreviva ao rebaixamento.

**Architecture:** Um módulo puro novo (`lib/plan-visibility.ts`) recebe o catálogo cru e os `PlanLimits` e devolve só o que a vitrine pode exibir; `resolveCatalog` passa a chamá-lo antes do mapeamento. O domínio próprio ganha uma função `security definer` que devolve slug, verificação e plano efetivo numa chamada, e o middleware redireciona 307 para o slug quando o plano não inclui `customDomain`. O painel recebe do servidor a contagem de ocultos e o conjunto de IDs visíveis.

**Tech Stack:** Next.js App Router (Server Components + middleware), Supabase (Postgres + RLS + funções `security definer`), TypeScript, Vitest + Testing Library.

## Global Constraints

- **Spec de referência:** `docs/superpowers/specs/2026-07-30-degradacao-por-plano-design.md` (commits `d3e706a`, `042008b`).
- **Nada é apagado no rebaixamento.** Todo corte é de leitura. Nenhuma task deve emitir `delete`, `update` ou despublicação de produto, categoria ou foto.
- **Ordenação canônica de produtos:** `created_at desc, id desc`, idêntica na vitrine pública e no painel. `created_at` sozinho não desempata — a importação por CSV insere em lote numa transação e `now()` é o horário da transação, então todas as linhas de um import compartilham o valor.
- **O conjunto público é `is_active = true`** (`lib/server/catalog.ts:55`). Toda contagem de ocultos e todo `visibleIds` usam esse mesmo filtro. O `active` que `app/painel/produtos/page.tsx` já calcula é `is_active AND stock > 0` e **não** serve — a vitrine exibe esgotados.
- **A regra de plano mora em TypeScript.** Nenhuma migration pode conter `'pro'`/`'starter'` hardcoded como gate de recurso; SQL devolve o plano efetivo e `getPlanLimits` decide.
- **Redirect de domínio rebaixado é 307**, nunca 301 — 301 fica cacheado no browser do visitante e sobrevive ao re-upgrade.
- **Fora de escopo (Spec 2):** gateway, checkout, preços em `app/page.tsx`, página de assinatura, `plan_expires_at`/`subscription_status`. CTAs de upsell continuam apontando para o WhatsApp via `vtrineWhatsAppHref`.
- **Comando de teste:** `npx vitest run <caminho>` para arquivo único; `npx vitest run` para a suíte.

---

### Task 1: Limites novos do Starter (50 produtos, 7 categorias)

**Files:**
- Modify: `lib/plan-limits.ts:29-40` (`STARTER_LIMITS`)
- Modify: `app/landing/data.tsx:118-126` (`starterFeatures`)
- Test: `__tests__/plan-limits.test.ts:44-55`

**Interfaces:**
- Consumes: nada.
- Produces: `STARTER_LIMITS.maxProducts === 50`, `STARTER_LIMITS.maxCategories === 7`. Tasks 3 e 7 dependem desses valores nos fixtures.

- [ ] **Step 1: Atualizar o teste de limites do Starter**

Em `__tests__/plan-limits.test.ts`, no `it("starter tem limites intermediários")`, trocar os dois números:

```ts
  it("starter tem limites intermediários", () => {
    expect(getPlanLimits("starter", null)).toEqual({
      maxProducts: 50,
      maxCategories: 7,
      maxPhotos: 3,
      hasOrderHistory: true,
      maxFeaturedProducts: 3,
      themeOptions: true,
      advancedTheme: false,
      gridDensity: true,
      csvImport: false,
      customDomain: false,
    });
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: FAIL — `expected 30 to be 50`.

- [ ] **Step 3: Aplicar os limites novos**

Em `lib/plan-limits.ts`, dentro de `STARTER_LIMITS`:

```ts
const STARTER_LIMITS: PlanLimits = {
  maxProducts: 50,
  maxCategories: 7,
  maxPhotos: 3,
  hasOrderHistory: true,
  maxFeaturedProducts: 3,
  themeOptions: true,
  advancedTheme: false,
  gridDensity: true,
  csvImport: false,
  customDomain: false,
};
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS.

- [ ] **Step 5: Atualizar os bullets da landing**

Em `app/landing/data.tsx`, as duas primeiras entradas de `starterFeatures`:

```ts
export const starterFeatures = [
  "Até 50 produtos",
  "7 categorias",
  "3 fotos por produto",
  "Temas, fundos e formatos personalizáveis",
  "Até 3 produtos em destaque",
  "Histórico de pedidos",
  "Dashboard com métricas de vendas",
];
```

- [ ] **Step 6: Rodar a suíte de landing e confirmar que passa**

Run: `npx vitest run __tests__/landing-data.test.ts`
Expected: PASS — os testes existentes checam "Histórico de pedidos" e "Dashboard com métricas de vendas", que não mudaram.

- [ ] **Step 7: Commit**

```bash
git add lib/plan-limits.ts app/landing/data.tsx __tests__/plan-limits.test.ts
git commit -m "feat: Starter passa a 50 produtos e 7 categorias"
```

---

### Task 2: Remover a flag `advancedTheme`

Cor secundária passa a valer em todos os planos, inclusive Free. A flag controla um único ponto (`lib/theme-options.ts:103`) — fonte, fundo e cantos são governados por `themeOptions` e não mudam.

**Files:**
- Modify: `lib/plan-limits.ts` (campo `advancedTheme` do tipo e das três constantes)
- Modify: `lib/theme-options.ts:62-65,103` (`ThemeLimits` e `resolveTheme`)
- Modify: `app/actions/store.ts:127`
- Modify: `app/painel/personalizacao/PersonalizacaoClient.tsx:53,77-91`
- Test: `__tests__/plan-limits.test.ts`, `__tests__/theme-options.test.ts`, `__tests__/PersonalizacaoClient.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `PlanLimits` sem `advancedTheme`; `ThemeLimits` reduzido a `{ themeOptions: boolean }`. Task 3 constrói fixtures de `PlanLimits` e depende dessa forma final.

- [ ] **Step 1: Atualizar o teste de `resolveTheme`**

Em `__tests__/theme-options.test.ts`, substituir os casos que dependem de `advancedTheme` por um que prova que a cor sobrevive no plano mais restrito:

```ts
  it("preserva secondaryColor mesmo sem themeOptions (todos os planos)", () => {
    const theme = resolveTheme("editorial", "areia", "reto", "#8B0000", {
      themeOptions: false,
    });
    expect(theme.secondaryColor).toBe("#8B0000");
  });

  it("secondaryColor nula continua nula", () => {
    const theme = resolveTheme("padrao", "padrao", "padrao", null, {
      themeOptions: true,
    });
    expect(theme.secondaryColor).toBeNull();
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/theme-options.test.ts`
Expected: FAIL — erro de tipo/execução por `ThemeLimits` ainda exigir `advancedTheme`.

- [ ] **Step 3: Remover a flag de `lib/theme-options.ts`**

Interface (linhas 62-65) passa a:

```ts
export interface ThemeLimits {
  themeOptions: boolean;
}
```

E o retorno de `resolveTheme` (linha 103) deixa de condicionar:

```ts
    secondaryColor,
```

- [ ] **Step 4: Remover a flag de `lib/plan-limits.ts`**

Tirar `advancedTheme: boolean;` da interface `PlanLimits` e a linha `advancedTheme: ...` de `FREE_LIMITS`, `STARTER_LIMITS` e `PRO_LIMITS`.

- [ ] **Step 5: Remover a condicional de `app/actions/store.ts`**

Linha 127 passa a:

```ts
  const secondaryColor = parsed.data.secondaryColor;
```

- [ ] **Step 6: Destravar o campo em `PersonalizacaoClient.tsx`**

No bloco da cor secundária, remover o `locked` e o upsell. O `.map` passa a:

```tsx
              {SECONDARY_COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => f.setSecondaryColor(c)}
                  aria-label={c}
                  className="w-10 h-10 rounded-full transition-all duration-200"
                  style={{
                    background: c,
                    border:
                      f.secondaryColor === c
                        ? "2px solid var(--color-primary)"
                        : "1px solid var(--color-border)",
                    outline: f.secondaryColor === c ? "2px solid var(--color-bg)" : "none",
                    outlineOffset: f.secondaryColor === c ? "-4px" : "0",
                    boxSizing: "border-box",
                  }}
                />
              ))}
```

Remover na sequência o bloco `{!f.limits.advancedTheme && (...)}` inteiro (o `<div className="mt-2">` com o `<UpsellHint>`).

Manter os imports de `Fragment`, `Tooltip`, `UpsellHint` e `PLAN_GATE_LABEL` — todos continuam em uso no bloco de densidade do grid (linhas 137-150).

- [ ] **Step 7: Atualizar os testes de limites e do painel**

Em `__tests__/plan-limits.test.ts`, remover as cinco linhas `advancedTheme: ...` dos objetos esperados.

Em `__tests__/PersonalizacaoClient.test.tsx`, trocar qualquer asserção de bloqueio da cor secundária por (o arquivo já tem `makeSettings()` e passa `limits` via `getPlanLimits`):

```tsx
describe("PersonalizacaoClient — cor secundária liberada em todos os planos", () => {
  it("swatch é editável no plano Free", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("free", null)} />
    );
    expect(screen.getByLabelText("#1F2D5A")).not.toBeDisabled();
  });

  it("não exibe upsell de cor secundária no plano Free", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("free", null)} />
    );
    expect(screen.queryByText(/desbloquear a cor secundária/i)).toBeNull();
  });
});
```

`#1F2D5A` é a primeira entrada de `SECONDARY_COLOR_OPTIONS` (`lib/data.ts:176`) e o `aria-label` do botão é a própria cor.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS. Qualquer referência remanescente a `advancedTheme` quebra a compilação do teste e aponta o arquivo.

- [ ] **Step 9: Confirmar que a flag sumiu do código**

Run: `grep -rn "advancedTheme" lib/ app/ components/ __tests__/`
Expected: nenhuma saída.

- [ ] **Step 10: Remover o bullet da landing**

Em `app/landing/data.tsx`, tirar `"Cor secundária exclusiva",` de `proFeatures`. Não adicionar equivalente em `freeFeatures` nem em `starterFeatures`.

- [ ] **Step 11: Travar a ausência do bullet com teste**

Adicionar a `__tests__/landing-data.test.ts`:

```ts
describe("bullets de plano — cor secundária deixou de ser diferencial", () => {
  it("nenhum plano anuncia cor secundária", () => {
    for (const features of [freeFeatures, starterFeatures, proFeatures]) {
      expect(features.some((f) => /secund(á|a)ria/i.test(f))).toBe(false);
    }
  });

  it("Starter anuncia os limites novos", () => {
    expect(starterFeatures).toContain("Até 50 produtos");
    expect(starterFeatures).toContain("7 categorias");
  });
});
```

- [ ] **Step 12: Rodar os testes da landing**

Run: `npx vitest run __tests__/landing-data.test.ts`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add lib/plan-limits.ts lib/theme-options.ts app/actions/store.ts \
  app/painel/personalizacao/PersonalizacaoClient.tsx app/landing/data.tsx __tests__/
git commit -m "feat: cor secundária disponível em todos os planos"
```

---

### Task 3: Módulo puro `lib/plan-visibility.ts`

**Files:**
- Create: `lib/plan-visibility.ts`
- Test: `__tests__/plan-visibility.test.ts`

**Interfaces:**
- Consumes: `PlanLimits` (Tasks 1 e 2), `PublicProductRow`/`PublicCategoryRow` de `lib/catalog.ts`.
- Produces: `applyPlanVisibility(products, categories, limits): VisibleCatalog`, com `VisibleCatalog = { products: PublicProductRow[]; categories: PublicCategoryRow[] }`. Task 4 consome exatamente essa assinatura.

**Pré-condição do módulo:** `products` chega **já ordenado** pela ordenação canônica. `PublicProductRow` não tem `created_at` — `PRODUCT_COLS` não o seleciona — então a função nunca ordena: preserva a ordem de entrada e corta.

- [ ] **Step 1: Escrever os testes**

Criar `__tests__/plan-visibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyPlanVisibility } from "@/lib/plan-visibility";
import { getPlanLimits } from "@/lib/plan-limits";
import type { PublicProductRow, PublicCategoryRow } from "@/lib/catalog";

function produto(over: Partial<PublicProductRow> & { id: string }): PublicProductRow {
  return {
    name: `Produto ${over.id}`,
    price_cents: 1000,
    description: null,
    category_id: null,
    sizes: null,
    sold_sizes: null,
    colors: null,
    images: ["a.jpg"],
    stock: 5,
    is_active: true,
    is_new: false,
    is_featured: false,
    ...over,
  };
}

const cats: PublicCategoryRow[] = [
  { id: "c1", name: "Vestidos", position: 1 },
  { id: "c2", name: "Blusas", position: 2 },
];

const free = getPlanLimits("free", null);
const starter = getPlanLimits("starter", null);
const pro = getPlanLimits("pro", null);

describe("applyPlanVisibility — produtos", () => {
  it("corta no maxProducts preservando a ordem de entrada", () => {
    const rows = Array.from({ length: 12 }, (_, i) => produto({ id: `p${i}` }));
    const { products } = applyPlanVisibility(rows, [], free);
    expect(products).toHaveLength(8);
    expect(products.map((p) => p.id)).toEqual([
      "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7",
    ]);
  });

  it("Pro (Infinity) devolve todos os produtos", () => {
    const rows = Array.from({ length: 300 }, (_, i) => produto({ id: `p${i}` }));
    const { products } = applyPlanVisibility(rows, [], pro);
    expect(products).toHaveLength(300);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(applyPlanVisibility([], [], free)).toEqual({ products: [], categories: [] });
  });
});

describe("applyPlanVisibility — fotos", () => {
  it("corta a galeria no maxPhotos e preserva a capa", () => {
    const rows = [produto({ id: "p1", images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"] })];
    const { products } = applyPlanVisibility(rows, [], free);
    expect(products[0].images).toEqual(["1.jpg"]);
  });

  it("images nula continua nula", () => {
    const rows = [produto({ id: "p1", images: null })];
    const { products } = applyPlanVisibility(rows, [], starter);
    expect(products[0].images).toBeNull();
  });
});

describe("applyPlanVisibility — destaques", () => {
  it("mantém só os primeiros maxFeaturedProducts em destaque", () => {
    const rows = Array.from({ length: 6 }, (_, i) =>
      produto({ id: `p${i}`, is_featured: true })
    );
    const { products } = applyPlanVisibility(rows, [], starter);
    expect(products.filter((p) => p.is_featured).map((p) => p.id)).toEqual([
      "p0", "p1", "p2",
    ]);
  });

  it("Free zera todos os destaques", () => {
    const rows = [produto({ id: "p1", is_featured: true })];
    const { products } = applyPlanVisibility(rows, [], free);
    expect(products[0].is_featured).toBe(false);
  });

  it("Pro mantém destaques ilimitados", () => {
    const rows = Array.from({ length: 40 }, (_, i) =>
      produto({ id: `p${i}`, is_featured: true })
    );
    const { products } = applyPlanVisibility(rows, [], pro);
    expect(products.every((p) => p.is_featured)).toBe(true);
  });
});

describe("applyPlanVisibility — categorias", () => {
  it("só devolve categorias que têm produto visível", () => {
    const rows = [produto({ id: "p1", category_id: "c1" })];
    const { categories } = applyPlanVisibility(rows, cats, starter);
    expect(categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("ignora categoria cujos produtos foram cortados pelo limite", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => produto({ id: `p${i}`, category_id: "c1" })),
      produto({ id: "p9", category_id: "c2" }),
    ];
    const { categories } = applyPlanVisibility(rows, cats, free);
    expect(categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("corta no maxCategories respeitando position", () => {
    const rows = [
      produto({ id: "p1", category_id: "c1" }),
      produto({ id: "p2", category_id: "c2" }),
    ];
    const { categories } = applyPlanVisibility(rows, cats, free);
    expect(categories.map((c) => c.id)).toEqual(["c1"]);
  });

  it("produto de categoria cortada perde o vínculo (cai em Todos)", () => {
    const rows = [
      produto({ id: "p1", category_id: "c1" }),
      produto({ id: "p2", category_id: "c2" }),
    ];
    const { products } = applyPlanVisibility(rows, cats, free);
    expect(products.find((p) => p.id === "p1")?.category_id).toBe("c1");
    expect(products.find((p) => p.id === "p2")?.category_id).toBeNull();
  });
});

describe("applyPlanVisibility — pureza", () => {
  it("não muta a entrada", () => {
    const rows = [produto({ id: "p1", images: ["1.jpg", "2.jpg"], is_featured: true })];
    const copia = structuredClone(rows);
    applyPlanVisibility(rows, cats, free);
    expect(rows).toEqual(copia);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/plan-visibility.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/plan-visibility"`.

- [ ] **Step 3: Implementar o módulo**

Criar `lib/plan-visibility.ts`:

```ts
import type { PlanLimits } from "@/lib/plan-limits";
import type { PublicCategoryRow, PublicProductRow } from "@/lib/catalog";

export interface VisibleCatalog {
  products: PublicProductRow[];
  categories: PublicCategoryRow[];
}

function takeFirst<T>(items: T[], max: number): T[] {
  return Number.isFinite(max) ? items.slice(0, max) : items;
}

/**
 * Recorta o catálogo pelo que o plano permite EXIBIR. Espelho de leitura dos
 * limites que as Server Actions já aplicam na escrita — é o que impede uma loja
 * rebaixada de continuar entregando vitrine premium.
 *
 * Pré-condição: `products` já vem na ordenação canônica (created_at desc,
 * id desc). PublicProductRow não carrega created_at, então esta função nunca
 * ordena: preserva a ordem recebida e corta.
 *
 * Nada é apagado — o corte é só de leitura e tudo reaparece no re-upgrade.
 */
export function applyPlanVisibility(
  products: PublicProductRow[],
  categories: PublicCategoryRow[],
  limits: PlanLimits
): VisibleCatalog {
  const visibleProducts = takeFirst(products, limits.maxProducts);

  // Categorias derivam dos produtos sobreviventes: cortar a lista de categorias
  // direto exibiria filtros que não retornam nada, o que lê como bug e não como
  // limite de plano.
  const usedCatIds = new Set(
    visibleProducts.map((p) => p.category_id).filter((id): id is string => !!id)
  );
  const visibleCategories = takeFirst(
    categories.filter((c) => usedCatIds.has(c.id)),
    limits.maxCategories
  );
  const visibleCatIds = new Set(visibleCategories.map((c) => c.id));

  let featuredLeft = limits.maxFeaturedProducts;
  const capped = visibleProducts.map((p) => {
    const keepFeatured = p.is_featured && featuredLeft > 0;
    if (keepFeatured) featuredLeft -= 1;
    return {
      ...p,
      images: p.images ? p.images.slice(0, limits.maxPhotos) : null,
      is_featured: keepFeatured,
      // Produto de categoria cortada cai em "Todos" — mapPublicProduct já trata
      // category_id nulo dessa forma.
      category_id:
        p.category_id && visibleCatIds.has(p.category_id) ? p.category_id : null,
    };
  });

  return { products: capped, categories: visibleCategories };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/plan-visibility.test.ts`
Expected: PASS — 14 testes.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-visibility.ts __tests__/plan-visibility.test.ts
git commit -m "feat: módulo puro de recorte do catálogo por plano"
```

---

### Task 4: Ordenação determinística e ligação com `resolveCatalog`

**Files:**
- Modify: `lib/server/catalog.ts:56` (desempate por `id`)
- Modify: `lib/catalog.ts:104-125` (`mapPublicProduct` perde `allowFeatured`) e `lib/catalog.ts:167-185` (`resolveCatalog`)
- Test: `__tests__/catalog.test.ts`

**Interfaces:**
- Consumes: `applyPlanVisibility` (Task 3).
- Produces: `mapPublicProduct(row, categoryName)` — dois parâmetros. `resolveCatalog` mantém a assinatura atual.

- [ ] **Step 1: Escrever o teste de integração do rebaixamento**

Adicionar ao final de `__tests__/catalog.test.ts` (reusando `storeRow` já definido no arquivo):

```ts
describe("resolveCatalog — degradação por plano", () => {
  function row(id: string, over: Partial<PublicProductRow> = {}): PublicProductRow {
    return {
      id,
      name: `Produto ${id}`,
      price_cents: 1000,
      description: null,
      category_id: null,
      sizes: null,
      sold_sizes: null,
      colors: null,
      images: ["1.jpg", "2.jpg", "3.jpg", "4.jpg", "5.jpg"],
      stock: 5,
      is_active: true,
      is_new: false,
      is_featured: false,
      ...over,
    };
  }

  const categorias: PublicCategoryRow[] = [
    { id: "c1", name: "Vestidos", position: 1 },
    { id: "c2", name: "Blusas", position: 2 },
  ];

  it("loja Pro rebaixada para Free exibe 8 produtos, 1 foto e nenhum destaque", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row(`p${i}`, { is_featured: true, category_id: i < 20 ? "c1" : "c2" })
    );
    const result = resolveCatalog(storeRow, rows, categorias, "free");
    if (result.status !== "ok") throw new Error("esperava status ok");

    expect(result.products).toHaveLength(8);
    expect(result.products[0].images).toEqual(["1.jpg"]);
    expect(result.products.some((p) => p.isFeatured)).toBe(false);
    expect(result.store.categories).toEqual(["Todos", "Vestidos"]);
  });

  it("mesma loja em Pro exibe tudo", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      row(`p${i}`, { is_featured: true, category_id: i < 20 ? "c1" : "c2" })
    );
    const result = resolveCatalog(storeRow, rows, categorias, "pro");
    if (result.status !== "ok") throw new Error("esperava status ok");

    expect(result.products).toHaveLength(30);
    expect(result.products[0].images).toHaveLength(5);
    expect(result.products.every((p) => p.isFeatured)).toBe(true);
    expect(result.store.categories).toEqual(["Todos", "Vestidos", "Blusas"]);
  });

  it("produto de categoria cortada aparece como Todos", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => row(`p${i}`, { category_id: "c1" })),
      row("p9", { category_id: "c2" }),
    ];
    const result = resolveCatalog(storeRow, rows, categorias, "free");
    if (result.status !== "ok") throw new Error("esperava status ok");

    expect(result.store.categories).toEqual(["Todos", "Vestidos"]);
    expect(result.products.every((p) => p.category !== "Blusas")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: FAIL — o catálogo devolve 30 produtos com 5 fotos e destaques ativos.

- [ ] **Step 3: Tirar `allowFeatured` de `mapPublicProduct`**

A contagem de destaques passou a ser responsabilidade de `applyPlanVisibility`; o parâmetro booleano viraria vestígio. Em `lib/catalog.ts`, a assinatura passa a:

```ts
export function mapPublicProduct(
  row: PublicProductRow,
  categoryName: string | null
): Product {
```

e a linha 120 passa a:

```ts
    isFeatured: row.is_featured,
```

- [ ] **Step 4: Ligar `applyPlanVisibility` em `resolveCatalog`**

Substituir o corpo a partir da linha 177:

```ts
  const limits = getPlanLimits(effectivePlan, null);
  const { products: visibleRows, categories: visibleCategories } =
    applyPlanVisibility(productRows, categoryRows, limits);
  const nameById = new Map(visibleCategories.map((c) => [c.id, c.name]));
  const products = visibleRows.map((p) =>
    mapPublicProduct(p, p.category_id ? nameById.get(p.category_id) ?? null : null)
  );
  const pills = computePills(visibleCategories, visibleRows);
  return { status: "ok", store: mapPublicStore(storeRow, pills, effectivePlan), products };
```

Adicionar o import no topo do arquivo:

```ts
import { applyPlanVisibility } from "@/lib/plan-visibility";
```

- [ ] **Step 5: Corrigir as chamadas antigas de `mapPublicProduct` nos testes**

Em `__tests__/catalog.test.ts`, remover o terceiro argumento de toda chamada direta a `mapPublicProduct`. Onde um teste verificava que `allowFeatured: false` zerava o destaque, a asserção passa a valer para `resolveCatalog` com plano Free — o caso já está coberto pelo primeiro teste do Step 1, então o teste antigo pode ser removido.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: PASS.

- [ ] **Step 7: Adicionar o desempate na query pública**

Em `lib/server/catalog.ts`, a query de produtos passa a:

```ts
    supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
```

Sem o desempate, produtos importados no mesmo lote de CSV compartilham `created_at` e o conjunto dos N sobreviventes muda entre requests.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/catalog.ts lib/server/catalog.ts __tests__/catalog.test.ts
git commit -m "feat: vitrine pública respeita os limites do plano"
```

---

### Task 5: Migration `resolve_custom_domain`

**Files:**
- Create: `supabase/migrations/20260730000000_resolve_custom_domain.sql`

**Interfaces:**
- Consumes: nada.
- Produces: RPC `resolve_custom_domain(p_hostname text)` devolvendo linhas `{ store_slug: string; domain_verified: boolean; effective_plan: string }`. Task 6 consome exatamente esses nomes de coluna.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260730000000_resolve_custom_domain.sql`:

```sql
-- O middleware precisa do plano efetivo para decidir se o domínio próprio ainda
-- resolve, mas o anon não tem select em plan/trial_ends_at (20260709000000) —
-- mesma restrição que motivou get_effective_plan. Esta função repete aquele
-- padrão: security definer, o anon ganha EXECUTE aqui e nada nas colunas.
--
-- Devolve tudo o que o middleware precisa numa chamada só. A alternativa
-- (select de id + rpc get_effective_plan) colocaria duas round-trips no caminho
-- crítico de todo request de domínio próprio, antes de qualquer byte de HTML.
--
-- Devolve o plano CRU já resolvido pela regra de expiração — quem decide se
-- aquele plano inclui domínio próprio é getPlanLimits em lib/plan-limits.ts.
-- Nada de 'pro' hardcoded aqui: o dia que o recurso mudar de plano, o banco não
-- muda.
--
-- Os nomes de saída são prefixados (store_slug/domain_verified) para não
-- colidirem com as colunas homônimas de public.stores dentro do corpo.
create or replace function public.resolve_custom_domain(p_hostname text)
returns table (
  store_slug text,
  domain_verified boolean,
  effective_plan text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.slug,
    s.custom_domain_verified,
    case
      when s.plan <> 'free' and s.trial_ends_at is not null and s.trial_ends_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.custom_domain = p_hostname;
$$;

grant execute on function public.resolve_custom_domain(text) to anon;
```

- [ ] **Step 2: Aplicar a migration localmente**

Run: `npx supabase db push`
Expected: a migration aplica sem erro.

Se o Supabase local não estiver rodando, subir com `npx supabase start` antes.

- [ ] **Step 3: Conferir o grant e o retorno**

Run:
```bash
npx supabase db execute --sql "select has_function_privilege('anon', 'public.resolve_custom_domain(text)', 'execute');"
```
Expected: `t`.

- [ ] **Step 4: Conferir que o anon continua sem ler as colunas de plano**

Run:
```bash
npx supabase db execute --sql "select has_column_privilege('anon', 'public.stores', 'plan', 'select');"
```
Expected: `f` — a função é o único caminho, exatamente como em `get_effective_plan`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260730000000_resolve_custom_domain.sql
git commit -m "feat: função resolve_custom_domain para o middleware"
```

---

### Task 6: Domínio próprio deixa de resolver no rebaixamento

**Files:**
- Modify: `middleware.ts:19-43`
- Test: `__tests__/middleware.test.ts`

**Interfaces:**
- Consumes: RPC `resolve_custom_domain` (Task 5), `getPlanLimits` (Tasks 1-2).
- Produces: nada consumido por tasks posteriores.

- [ ] **Step 1: Escrever os testes dos três desfechos**

O arquivo hoje só mocka `@supabase/ssr`; o caminho de domínio usa `createAnonClient` de `@/lib/supabase/server`. Adicionar o mock no topo, junto dos existentes:

```ts
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createAnonClient: () => ({ rpc }),
}));

function makeDomainRequest(host: string) {
  const request = new NextRequest("http://localhost:3000/");
  Object.defineProperty(request, "headers", {
    value: new Headers({ host }),
    configurable: true,
  });
  return request;
}

function domainResolves(
  row: { store_slug: string; domain_verified: boolean; effective_plan: string } | null
) {
  rpc.mockResolvedValue({ data: row ? [row] : [], error: null });
}
```

E o bloco de testes:

```ts
describe("middleware — domínio próprio e plano", () => {
  beforeEach(() => {
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SITE_URL = "https://vtrine.com.br";
  });

  it("plano com domínio próprio → rewrite transparente para a vitrine", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: true,
      effective_plan: "pro",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/atelie-mira");
  });

  it("plano sem domínio próprio → redirect 307 para o slug", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: true,
      effective_plan: "starter",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://vtrine.com.br/atelie-mira");
  });

  it("rebaixado para free também redireciona", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: true,
      effective_plan: "free",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.status).toBe(307);
  });

  it("domínio não verificado → rewrite para /dominio-pendente", async () => {
    domainResolves({
      store_slug: "atelie-mira",
      domain_verified: false,
      effective_plan: "pro",
    });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/dominio-pendente");
  });

  it("host desconhecido → segue o fluxo normal (landing)", async () => {
    domainResolves(null);
    const res = await middleware(makeDomainRequest("dominio-qualquer.com"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("erro na RPC não derruba o site — segue para a landing", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const res = await middleware(makeDomainRequest("atelie-mira.com.br"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/middleware.test.ts`
Expected: FAIL — o middleware ainda chama `.from('stores')` e nunca redireciona.

- [ ] **Step 3: Reescrever o bloco de domínio do middleware**

Substituir as linhas 19-43 de `middleware.ts`:

```ts
    const anon = createAnonClient()
    const { data, error } = await anon.rpc('resolve_custom_domain', {
      p_hostname: stripWwwPrefix(hostname),
    })

    if (error) {
      console.error('[middleware] falha ao resolver domínio próprio:', error)
    }

    const store = data?.[0] ?? null

    // Quatro desfechos:
    // 1. Nenhuma loja usa esse domínio (ou a RPC falhou) → host desconhecido,
    //    segue o fluxo normal. Fail-open: preferível a derrubar o site inteiro.
    // 2. Domínio ainda não verificado → página de espera, para não exibir a
    //    landing da Vtrine no domínio do lojista durante a verificação.
    // 3. Verificado, mas o plano não inclui domínio próprio (rebaixamento) →
    //    redirect para o slug. 307 e nunca 301: o rebaixamento é reversível e
    //    um 301 fica cacheado no browser do visitante mesmo após o re-upgrade.
    // 4. Verificado e plano com domínio → rewrite transparente.
    if (store) {
      const url = request.nextUrl.clone()

      if (!store.domain_verified) {
        url.pathname = '/dominio-pendente'
        return NextResponse.rewrite(url)
      }

      const limits = getPlanLimits(store.effective_plan as Plan, null)
      if (!limits.customDomain) {
        return NextResponse.redirect(
          new URL(`/${store.store_slug}`, process.env.NEXT_PUBLIC_SITE_URL),
          307
        )
      }

      url.pathname = `/${store.store_slug}`
      return NextResponse.rewrite(url)
    }
```

E os imports no topo:

```ts
import { getPlanLimits, type Plan } from '@/lib/plan-limits'
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/middleware.test.ts`
Expected: PASS — incluindo os testes de sessão/painel que já existiam.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add middleware.ts __tests__/middleware.test.ts
git commit -m "feat: domínio próprio deixa de resolver no rebaixamento"
```

---

### Task 7: Painel mostra o que está oculto na vitrine

**Files:**
- Modify: `app/painel/produtos/page.tsx`
- Modify: `app/painel/produtos/ProdutosClient.tsx`
- Test: `__tests__/ProdutosClient.test.tsx`

**Interfaces:**
- Consumes: `getPlanLimits` (Tasks 1-2).
- Produces: props novas de `ProdutosClient` — `hiddenCount: number` e `visibleIds: string[]`.

**Base de cálculo:** produtos **ativos**, não o total. A vitrine filtra `is_active = true`, então o número sai de `storeTotal - inactive` — contagens que a página já faz. O `active` existente é `is_active AND stock > 0` e não serve: a vitrine exibe esgotados.

- [ ] **Step 1: Escrever os testes do banner e do selo**

Adicionar a `__tests__/ProdutosClient.test.tsx`, usando os helpers que o arquivo já tem (`makeProduct`, `baseLimits`, `baseCounts`, `noFilters`):

```tsx
describe("ProdutosClient — produtos ocultos pelo limite do plano", () => {
  function renderComOcultos(
    over: {
      products?: StoreProduct[];
      hiddenCount: number;
      visibleIds: string[];
    }
  ) {
    return render(
      <ProdutosClient
        products={over.products ?? [makeProduct()]}
        maxProducts={50}
        limits={{ ...baseLimits, maxProducts: 50 }}
        counts={baseCounts}
        hiddenCount={over.hiddenCount}
        visibleIds={over.visibleIds}
        page={1}
        totalPages={1}
        categories={[]}
        {...noFilters}
      />
    );
  }

  it("sem truncamento não mostra banner", () => {
    renderComOcultos({ hiddenCount: 0, visibleIds: [] });
    expect(screen.queryByText(/ocultos na sua vitrine/i)).toBeNull();
  });

  it("com truncamento mostra o banner com a contagem", () => {
    renderComOcultos({ hiddenCount: 32, visibleIds: [] });
    expect(screen.getByText(/32 produtos estão ocultos na sua vitrine/i)).toBeTruthy();
  });

  it("usa singular quando só um produto está oculto", () => {
    renderComOcultos({ hiddenCount: 1, visibleIds: [] });
    expect(screen.getByText(/1 produto está oculto na sua vitrine/i)).toBeTruthy();
  });

  it("marca com selo o produto ativo fora de visibleIds", () => {
    renderComOcultos({
      products: [
        makeProduct({ id: "p1", isActive: true }),
        makeProduct({ id: "p2", name: "Blusa linho", isActive: true }),
      ],
      hiddenCount: 1,
      visibleIds: ["p1"],
    });
    // Dois layouts (mobile + desktop) renderizam o selo do mesmo produto.
    expect(screen.getAllByText("Oculto na vitrine")).toHaveLength(2);
  });

  it("não marca produto inativo — ele já está fora da vitrine pelo toggle", () => {
    renderComOcultos({
      products: [makeProduct({ id: "p2", isActive: false })],
      hiddenCount: 1,
      visibleIds: ["p1"],
    });
    expect(screen.queryByText("Oculto na vitrine")).toBeNull();
  });
});
```

O `ProdutosClient` renderiza cada produto duas vezes (card mobile e linha desktop, alternados por `lg:`), então `getAllByText` conta dois nós por produto marcado — o mesmo comportamento vale para qualquer asserção de conteúdo de card neste arquivo.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: FAIL — props `hiddenCount`/`visibleIds` não existem.

- [ ] **Step 3: Calcular no servidor**

Em `app/painel/produtos/page.tsx`, mover `const limits = getPlanLimits(store.plan, store.trialEndsAt);` para logo depois de `if (!store) redirect("/login");`, e adicionar depois do bloco de contagens:

```ts
  // A vitrine exibe apenas is_active = true (lib/server/catalog.ts), então o
  // truncamento incide só sobre ativos. `active` não serve aqui: ele é
  // is_active AND stock > 0, e a vitrine exibe esgotados.
  const activeOnVitrine = (storeTotal ?? 0) - (inactive ?? 0);
  const hiddenCount = Number.isFinite(limits.maxProducts)
    ? Math.max(0, activeOnVitrine - limits.maxProducts)
    : 0;

  let visibleIds: string[] = [];
  if (hiddenCount > 0) {
    // Mesma ordenação e mesmo filtro da vitrine — sem isso o painel marcaria
    // como oculto um produto que a vitrine está exibindo.
    const { data: visibleRows } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limits.maxProducts);
    visibleIds = (visibleRows ?? []).map((r) => r.id);
  }
```

E passar as duas props no JSX, removendo a linha `const limits = ...` que ficou órfã no final:

```tsx
    <ProdutosClient
      products={products}
      maxProducts={limits.maxProducts}
      limits={limits}
      hiddenCount={hiddenCount}
      visibleIds={visibleIds}
```

- [ ] **Step 4: Renderizar banner e selo**

Em `app/painel/produtos/ProdutosClient.tsx`, adicionar à interface de props:

```ts
  hiddenCount: number;
  visibleIds: string[];
```

Desestruturar `hiddenCount` e `visibleIds` junto das demais props e derivar o conjunto logo depois:

```ts
  const visibleIdSet = new Set(visibleIds);
```

Adicionar o import do ícone na linha 6 (`import { Plus, Pencil, Trash2, Package, Search, Star, EyeOff } from "lucide-react";`) e o import do helper de contato:

```ts
import { vtrineWhatsAppHref } from "@/lib/contact";
```

Inserir o banner logo depois do `<div className="flex flex-col gap-6 w-full lg:max-w-content">` de abertura:

```tsx
      {hiddenCount > 0 && (
        <Card className="flex flex-col sm:flex-row sm:items-center gap-3 border-gold/40">
          <div className="flex items-start gap-3 flex-1">
            <EyeOff size={18} className="text-gold flex-shrink-0 mt-0.5" />
            <p className="font-body text-[14px] text-graphite">
              {hiddenCount === 1
                ? "1 produto está oculto na sua vitrine"
                : `${hiddenCount} produtos estão ocultos na sua vitrine`}{" "}
              porque o seu plano exibe até {maxProducts}. Nada foi apagado — tudo
              volta ao fazer upgrade.
            </p>
          </div>
          <a
            href={vtrineWhatsAppHref(
              "Olá! Quero fazer upgrade para exibir todos os meus produtos na vitrine."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display font-semibold text-[14px] text-gold hover:underline whitespace-nowrap"
          >
            Fazer upgrade →
          </a>
        </Card>
      )}
```

Dentro do `products.map((p, i) => {`, logo após `const isSoldOut = p.stock === 0;`:

```tsx
                  const hiddenByPlan = p.isActive && !visibleIdSet.has(p.id);
```

E o selo, nos dois layouts. No card mobile, dentro do `<div className="min-w-0 flex-1">`, depois do preço:

```tsx
                            {hiddenByPlan && <HiddenBadge />}
```

Na linha desktop, dentro do `<div className="min-w-0">`, depois do preço:

```tsx
                            {hiddenByPlan && <HiddenBadge />}
```

Definir o componente ao lado dos outros helpers do arquivo (`ProductThumbnail`, `StockLabel`):

```tsx
function HiddenBadge() {
  return (
    <span className="inline-flex items-center gap-1 mt-1 font-body text-[11px] text-gold">
      <EyeOff size={12} />
      Oculto na vitrine
    </span>
  );
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte inteira e o lint**

Run: `npx vitest run && npx eslint .`
Expected: PASS, sem erros de lint.

- [ ] **Step 7: Verificar no navegador**

Subir o dev server e abrir `/painel/produtos` numa loja com mais produtos ativos que o limite do plano. Confirmar: banner com a contagem no topo, selo "Oculto na vitrine" nos cards excedentes, e nenhum selo em produto inativo.

- [ ] **Step 8: Commit**

```bash
git add app/painel/produtos/page.tsx app/painel/produtos/ProdutosClient.tsx __tests__/ProdutosClient.test.tsx
git commit -m "feat: painel sinaliza produtos ocultos pelo limite do plano"
```
