# Paginação da listagem de produtos no painel

**Data:** 2026-07-03
**Status:** Aprovado para planejamento

## Objetivo

Hoje `/painel/produtos` busca **todos** os produtos da loja em uma única query, sem `.range()`/`.limit()` ([page.tsx:12-18](../../../app/painel/produtos/page.tsx#L12-L18)). Isso não escala: o plano Pro tem `maxProducts: Infinity` ([plan-limits.ts:10](../../../lib/plan-limits.ts#L10)), então uma loja Pro grande carregaria uma lista sem limite nenhum a cada acesso ao painel.

O objetivo é introduzir paginação de verdade no servidor — buscar só um pedaço de produtos por vez — sem quebrar os contadores de status ("X ativos, Y esgotados, Z inativos") nem o aviso de limite do plano, que precisam continuar refletindo a loja inteira, não a página atual.

Este é o primeiro de três sub-projetos independentes de listagem (os outros dois — scroll progressivo no catálogo público e reordenação de categorias — têm specs próprias, feitas depois desta).

## Escopo

**Dentro:**
- Paginação server-side da listagem `/painel/produtos` (20 produtos por página).
- Navegação por URL (`/painel/produtos?page=N`), com botão voltar do navegador e links compartilháveis funcionando.
- Contadores de status (ativos/esgotados/inativos) e o aviso de "limite do plano atingido" recalculados via contagens separadas, sempre sobre a loja inteira — não afetados pela paginação.
- Controle de navegação entre páginas (Anterior / números / Próxima) na UI.
- Tratamento de: página inválida na URL, e exclusão do último produto de uma página que não seja a primeira.

**Fora desta rodada:**
- Busca ou filtro por nome/categoria na listagem do painel (não existe hoje; fica pra uma rodada futura se for pedido).
- Catálogo público (`/[slug]`) — sub-projeto separado, com abordagem diferente (mantém buscando tudo, pagina só a renderização).
- Reordenação de categorias — sub-projeto separado.

## Estratégia

### Busca de produtos (server component)

`app/painel/produtos/page.tsx` passa a receber `searchParams` (padrão Next.js App Router já usado no projeto em `app/(auth)/login/page.tsx` e outras rotas de auth) e usa `.range()` do Supabase:

```ts
const PAGE_SIZE = 20;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const { data: countRow } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  const total = countRow ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const requestedPage = Number((await searchParams).page ?? "1");
  const page = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, requestedPage), totalPages)
    : 1;

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data } = await supabase
    .from("products")
    .select("id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false })
    .range(from, to);
  // ...
}
```

Página inválida ou fora do intervalo (`?page=999` quando só há 3 páginas) é sempre `clamp`ada (agarrada) entre 1 e `totalPages` — nunca gera erro, apenas mostra a página válida mais próxima.

### Contadores de status (independentes da página)

Três contagens leves, em paralelo (mesmo padrão de `Promise.all` já usado em [catalog.ts:31](../../../lib/server/catalog.ts#L31)), usando `count: "exact", head: true` — o Supabase retorna só o número, sem transferir as linhas:

```ts
const [{ count: active }, { count: soldOut }, { count: inactive }] = await Promise.all([
  supabase.from("products").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).eq("is_active", true).gt("stock", 0),
  supabase.from("products").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).eq("stock", 0),
  supabase.from("products").select("id", { count: "exact", head: true })
    .eq("store_id", store.id).eq("is_active", false),
]);
```

Essas contagens (e o `total` usado para `totalPages`) sobem para `ProdutosClient` como props separadas dos `products` da página atual — o componente não recalcula mais `active`/`soldOut`/`inactive`/`limitReached` a partir do array de produtos (`use-produtos.ts:20-23`), apenas recebe os números prontos.

### Navegação entre páginas (UI)

Novo componente `components/ui/Pagination.tsx`: recebe `currentPage`, `totalPages`, e `basePath` (`/painel/produtos`). Renderiza links (`<Link href="/painel/produtos?page=N">`, não botões — preserva a navegação nativa do navegador) no estilo:

`‹ Anterior   1  2  [3]  4  5  …  12   Próxima ›`

- Página atual destacada com o mesmo tratamento visual do item ativo do menu do painel (`bg-linen text-obsidian`).
- Com mais de 7 páginas, mostra primeira, última, a atual, uma vizinha de cada lado, e `…` no meio (padrão comum de paginação numerada).
- "Anterior" fica desabilitado na página 1; "Próxima" desabilitado na última página.
- Não renderiza nada se `totalPages <= 1`.

### Exclusão do último item de uma página

`removeProduct` em `use-produtos.ts` já sabe quantos produtos existem na página atual (via a prop `products`). Se, após excluir, a página atual ficaria vazia **e** não é a página 1, o hook navega para `page - 1` (via `router.push`) em vez de recarregar a mesma página vazia.

## Testes

- Testes automatizados (Vitest) para a lógica de paginação pura: cálculo de `totalPages`, clamp de página inválida (`page=0`, `page=999`, `page=abc`), e a lista de páginas exibidas pelo componente `Pagination` (incluindo os casos com `…`).
- Teste manual no navegador: navegar entre páginas via clique e via URL direta, confirmar que os contadores não mudam ao trocar de página, e confirmar o redirecionamento ao excluir o último produto de uma página não-inicial.
