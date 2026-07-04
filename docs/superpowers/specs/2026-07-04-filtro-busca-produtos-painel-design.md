# Filtro de busca por nome e categoria na listagem de produtos do painel

**Data:** 2026-07-04
**Status:** Aprovado para planejamento

## Objetivo

Hoje `/painel/produtos` só permite navegar por página ([page.tsx](../../../app/painel/produtos/page.tsx), ver [2026-07-03-paginacao-painel-produtos-design.md](2026-07-03-paginacao-painel-produtos-design.md)). Lojas com muitos produtos não têm como localizar um item específico sem folhear páginas manualmente.

O objetivo é adicionar busca por nome e filtro por categoria à listagem, cobrindo **todos os produtos da loja** (não só a página atual), reaproveitando o padrão de URL-como-fonte-da-verdade já usado pela paginação.

Este projeto ficou explicitamente fora de escopo da spec de paginação anterior ("Busca ou filtro por nome/categoria na listagem do painel... fica pra uma rodada futura se for pedido").

## Escopo

**Dentro:**
- Input de busca por nome (substring, case-insensitive) via `?q=`.
- Dropdown de filtro por categoria via `?categoria=` (inclui opção "Sem categoria" para produtos com `category_id` nulo).
- Busca automática com debounce (~400ms) enquanto o lojista digita; filtro de categoria aplica imediatamente ao selecionar.
- Filtros combinam entre si (nome + categoria ao mesmo tempo) e resetam a paginação para a página 1.
- Botão "Limpar filtros", visível só quando algum filtro está ativo.
- Estado vazio específico ("Nenhum produto encontrado" + limpar filtros) quando o filtro não retorna resultados, distinto do estado vazio de loja sem produtos.
- Preservação de `q`/`categoria` nos links de paginação e no redirecionamento pós-exclusão do último produto de uma página.

**Fora desta rodada:**
- Filtro por status (ativo/esgotado/inativo) — os contadores do card continuam mostrando sempre os totais da loja, sem filtro.
- Ordenação customizável (a listagem continua ordenada por `created_at desc`).
- Busca no catálogo público (`/[slug]`) — superfície e sub-projeto separados.
- Persistência do filtro entre sessões (ex: localStorage) — o filtro vive só na URL da navegação atual.

## Estratégia

### Busca de produtos filtrada (server component)

`app/painel/produtos/page.tsx` passa a receber `q` e `categoria` em `searchParams`, além de `page`:

```ts
export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; categoria?: string }>;
}) {
  const { page: pageParam, q, categoria } = await searchParams;
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();

  const categories = await fetchCategories(supabase, store.id); // id, name
  const validCategoria =
    categoria === "sem-categoria" || categories.some((c) => c.id === categoria)
      ? categoria
      : undefined;

  const applyFilters = <T,>(query: T) => {
    let q2 = query as any;
    if (q) q2 = q2.ilike("name", `%${q}%`);
    if (validCategoria === "sem-categoria") q2 = q2.is("category_id", null);
    else if (validCategoria) q2 = q2.eq("category_id", validCategoria);
    return q2;
  };

  const [{ count: total }, { count: active }, { count: soldOut }, { count: inactive }] =
    await Promise.all([
      applyFilters(
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id)
      ),
      // active/soldOut/inactive continuam SEM applyFilters — refletem sempre a loja inteira
      supabase.from("products").select("id", { count: "exact", head: true })
        .eq("store_id", store.id).eq("is_active", true).gt("stock", 0),
      supabase.from("products").select("id", { count: "exact", head: true })
        .eq("store_id", store.id).eq("stock", 0),
      supabase.from("products").select("id", { count: "exact", head: true })
        .eq("store_id", store.id).eq("is_active", false),
    ]);

  const totalPages = getTotalPages(total ?? 0, PRODUCTS_PAGE_SIZE);
  const page = clampPage(Number(pageParam ?? "1"), totalPages);
  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const to = from + PRODUCTS_PAGE_SIZE - 1;

  const { data } = await applyFilters(
    supabase
      .from("products")
      .select("id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new")
      .eq("store_id", store.id)
  )
    .order("created_at", { ascending: false })
    .range(from, to);

  // ...passa products, categories, counts (sempre totais), page, totalPages, q, validCategoria para ProdutosClient
}
```

- `total` usado no cálculo de `totalPages` é o **count filtrado** — a paginação reflete o resultado da busca, não a loja inteira.
- `active`/`soldOut`/`inactive` continuam com as queries atuais, sem filtro — decisão explícita para manter os contadores como visão geral da loja.
- `categoria` inválido (não existe entre as categorias da loja e não é `"sem-categoria"`) é descartado silenciosamente, mesmo espírito do `clampPage` para `page` inválido.

### Hook de filtro (client)

Novo `app/painel/produtos/use-produtos-filtros.ts`, co-locado na feature folder:

```ts
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function useProdutosFiltros(initialQ: string, initialCategoria: string) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [, startTransition] = useTransition();

  const pushFilters = (nextQ: string, nextCategoria: string) => {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextCategoria) params.set("categoria", nextCategoria);
    startTransition(() => {
      router.replace(`/painel/produtos${params.toString() ? `?${params}` : ""}`, { scroll: false });
    });
  };

  // debounce de ~400ms no onChange do input de nome antes de chamar pushFilters
  // mudança do <select> de categoria chama pushFilters imediatamente

  const clearFilters = () => {
    setQ("");
    router.replace("/painel/produtos", { scroll: false });
  };

  return { q, setQ, pushFilters, clearFilters };
}
```

Como `initialQ`/`initialCategoria` chegam via props do Server Component (mesmo padrão já usado para `page`), não é necessário `useSearchParams()` nem `<Suspense>` adicional no client.

### UI (`ProdutosClient.tsx`)

Nova barra de filtros, posicionada **entre o card de contadores e a tabela de produtos**:

- Input de busca (ícone `Search` do lucide-react, placeholder "Buscar por nome...").
- `<select>` de categoria: "Todas as categorias" (vazio/default) → categorias da loja → "Sem categoria" por último.
- Botão "Limpar filtros" (ghost), renderizado só quando `q` ou `categoria` está ativo.
- Layout mobile-first: `flex flex-col sm:flex-row gap-3`.

**Estado vazio filtrado:** quando `q`/`categoria` ativos e `products.length === 0`, mostra card com ícone `Search`, texto "Nenhum produto encontrado" / "Tente ajustar sua busca ou filtro.", e botão "Limpar filtros" — distinto do estado vazio atual de loja sem produtos (ícone `Package`, "Nenhum produto cadastrado ainda").

### Preservação do filtro em paginação e exclusão

- `components/ui/Pagination.tsx` ganha um novo prop opcional `extraParams?: Record<string, string>`, incluído nos `href` gerados (`?page=N&q=...&categoria=...`).
- `use-produtos.ts`: o redirecionamento pós-exclusão do último produto de uma página (`router.push(`/painel/produtos?page=${page - 1}`)`) passa a preservar `q`/`categoria` também.

## Testes

- **`use-produtos-filtros.test.ts`** (novo): debounce dispara `router.replace` com os params corretos após ~400ms; mudança de categoria dispara imediatamente, sem esperar debounce; `clearFilters` remove `q`/`categoria` da URL.
- **`Pagination.test.tsx`** (estender): `extraParams` aparece nos `href` gerados junto com `page`.
- **`use-produtos.test.ts`** / testes de painel (estender): redirecionamento pós-exclusão do último produto preserva `q`/`categoria` na URL de destino.
- Teste manual no navegador: digitar um nome parcial e ver a lista atualizar após a pausa; selecionar categoria e ver atualização imediata; combinar nome + categoria; limpar filtros; confirmar que os contadores do card não mudam com o filtro ativo; confirmar paginação e exclusão preservando o filtro.
