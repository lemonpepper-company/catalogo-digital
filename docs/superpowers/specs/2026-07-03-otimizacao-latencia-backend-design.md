# Otimização de latência — backend

**Data:** 2026-07-03
**Status:** Aprovado para planejamento

> **Atualização (2026-07-03, durante implementação):** a Seção 3 originalmente especificava Next.js Cache Components (`cacheComponents: true` + `'use cache'` + `updateTag`). Na prática, habilitar `cacheComponents: true` globalmente quebrou o build em toda página que lê `cookies()`/`headers()`/`searchParams`/`params` fora de `'use cache'` ou `<Suspense>` — não só o catálogo, mas `/cadastro`, `/login` e todo `/painel/*` (confirmado ao vivo: `/painel/categorias` quebrava pelo mesmo motivo). Corrigir isso exigiria reestruturar ~8-10 arquivos fora do escopo original com decisões de loading state. Optamos por recuar para `unstable_cache` + `revalidateTag` — mecanismo clássico do Next.js, funciona sem `cacheComponents`, mesmo resultado prático (catálogo cacheado, invalidado ao editar), sem tocar em nenhuma página de painel ou autenticação. A Seção 3 abaixo já reflete essa decisão.

## Objetivo

Chamadas em produção estão levando 1-2s, sentidas tanto no catálogo público quanto no painel do lojista. Uma causa raiz já foi corrigida antes deste spec (desalinhamento de região: Vercel estava em North America enquanto o Supabase está em South America — já migrado, com melhora confirmada). Este spec cobre as otimizações de código que restam depois desse fix de infraestrutura.

Investigação no código (ver seção "Diagnóstico") encontrou três causas concretas de latência desnecessária, sem precisar de instrumentação nova para confirmá-las — são round-trips redundantes ou ausência de cache, visíveis diretamente na leitura do código. A quarta parte do trabalho é adicionar Speed Insights para medir o ganho real após o deploy.

## Diagnóstico

1. **Middleware autentica toda requisição, mesmo rotas públicas.** `middleware.ts` chama `supabase.auth.getUser()` incondicionalmente para qualquer request que bate no matcher — matcher que só exclui `_next/static`, `_next/image`, `favicon.ico`, `api/slug`, `auth/callback` e `landing`. Isso inclui o catálogo público `/{slug}`, que não usa autenticação, mas paga o custo de uma chamada ao Supabase Auth antes de renderizar.

2. **Painel busca usuário/loja de forma redundante em 3 camadas.** Para uma única página do painel:
   - `middleware.ts`: `auth.getUser()` + `SELECT stores (plan)` — necessário para gating de rota.
   - `app/painel/layout.tsx`: `auth.getUser()` de novo + `SELECT stores` (6 campos) de novo.
   - `page.tsx` de cada rota (`produtos`, `categorias`, `configuracoes`, etc.): `getCurrentStore()` → `auth.getUser()` de novo + `SELECT stores` de novo.

   Até 6 round-trips ao Supabase para uma página, sendo 4 deles buscando exatamente o mesmo usuário e a mesma loja.

3. **Catálogo público sem cache.** `app/[slug]/` usa `force-dynamic` (decisão documentada em `docs/ARCHITECTURE.md`). `getPublicCatalog(slug)` em `lib/server/catalog.ts` faz 1 query (loja) + 2 queries em paralelo (produtos, categorias) — a cada visita, sem exceção. É a superfície de maior tráfego (vitrine do cliente final), então é onde o cache tem maior impacto.

4. **Sem observabilidade de produção.** Nem `@vercel/analytics` nem `@vercel/speed-insights` estão instalados — hoje não há como confirmar ganhos além de medição manual.

## Escopo

**Dentro:**
- Middleware só autentica quando a rota exige (`/login`, `/painel/*`, `/escolha-de-plano`).
- Dedup das queries de usuário/loja no painel via `cache()` do React.
- Cache do catálogo público via `unstable_cache` (Next.js), com invalidação por tag (`revalidateTag`) nas Server Actions que alteram produtos/categorias/configurações da loja.
- Instalação do `@vercel/speed-insights` para medir o resultado em produção.

**Fora desta rodada:**
- Mudança de região Vercel/Supabase — já feita antes deste spec, fora do escopo de código.
- `@vercel/analytics` e logging estruturado adicional — não necessários para validar esta otimização especificamente.
- Cache de dados do painel (dashboard, listagem de produtos) — é conteúdo por-usuário, pouco cacheável; o ganho não compensa a complexidade frente ao catálogo público.
- Qualquer mudança de UI ou de regras de negócio.

## 1. Middleware (`middleware.ts`)

A chamada a `supabase.auth.getUser()` (hoje na linha 30, antes de qualquer verificação de `pathname`) move para dentro de cada bloco condicional que efetivamente precisa de autenticação: `/login`, `/painel/*`, `/escolha-de-plano`. Para qualquer outra rota que bate no matcher (incluindo `/{slug}` do catálogo público), o middleware retorna `NextResponse.next()` sem instanciar nem chamar o Supabase.

O client Supabase (`createServerClient`) continua sendo criado uma única vez no topo da função — só a chamada de rede (`auth.getUser()`) é que passa a ser condicional.

## 2. Painel — dedup de queries (`lib/server/store.ts`, `app/painel/layout.tsx`)

- `getCurrentStore()` em `lib/server/store.ts` passa a ser envolvida em `cache()` do React (mesmo padrão já usado em `getPublicCatalog()` em `lib/server/catalog.ts`), garantindo que chamadas repetidas dentro do mesmo request/render resolvam da memória.
- `app/painel/layout.tsx` para de fazer sua própria query a `stores` e passa a chamar `getCurrentStore()`. Os campos que o layout usa (`trial_ends_at`, `plan`, `name`, `monogram`, `logo_url`, `slug`) já estão todos cobertos pelo retorno de `getCurrentStore()` (ver `StoreSettings` em `lib/types.ts`).
- Toda `page.tsx` do painel que já chama `getCurrentStore()` (dashboard, produtos, categorias, configurações, novo/editar produto) automaticamente se beneficia do cache por request, sem mudança de código nelas.
- O middleware mantém sua própria query enxuta (só `plan`) — não é deduplicável com o `cache()` do React porque middleware roda numa fase de request separada do render de Server Components.

Resultado esperado: de ~6 round-trips por página do painel para ~4 (2 no middleware, que ficam; 2 deduplicados no render em vez de 4).

## 3. Catálogo público — cache com invalidação por tag

- `getPublicCatalog(slug)` em `lib/server/catalog.ts` passa a envolver sua busca de dados com `unstable_cache(fn, [slug], { tags: [`catalog-${slug}`] })` — o `slug` entra tanto na `keyParts` (diferencia a chave de cache por loja) quanto na tag (permite invalidar só aquela loja). `app/[slug]/page.tsx` continua com `force-dynamic` (sem mudança) — o ganho de performance vem inteiramente de pular as queries ao Supabase quando o cache está quente, não de mudar o modo de renderização da página.
- A leitura ao Supabase dentro da função cacheada não pode depender de `cookies()` (restrição do `unstable_cache`, igual à de `'use cache'`) — por isso `lib/supabase/server.ts` ganha `createAnonClient()`, um client síncrono sem cookies, usado só aqui (a leitura já é RLS anônima, independente de sessão).
- As Server Actions que alteram dados visíveis no catálogo passam a chamar `revalidateTag(`catalog-${slug}`)` ao final:
  - `createProduct`, `updateProduct`, `deleteProduct`, `toggleProductActive` (`app/actions/produtos.ts`)
  - `createCategory`, `updateCategory`, `deleteCategory` (`app/actions/categorias.ts`)
  - `updateStoreSettings` (`app/actions/store.ts`)
- Todas essas actions já chamam `getCurrentStore()` para resolver a loja do usuário autenticado, então o `slug` necessário para montar a tag já está disponível em cada uma, sem query adicional.
- Diferença prática frente a `updateTag` (Cache Components): `revalidateTag` invalida em background — a próxima requisição já pode vir com dado fresco, mas não há garantia de que a *mesma* requisição da Server Action já reflita a mudança. Para o caso de uso (lojista edita produto, cliente final vê a mudança na próxima visita ao catálogo, minutos ou mais depois), essa diferença é imperceptível.

Resultado esperado: a maioria das visitas ao catálogo público passa a servir do cache, sem tocar o Supabase; só recalcula quando o lojista de fato muda algo.

## 4. Observabilidade (`app/layout.tsx`)

Adicionar a dependência `@vercel/speed-insights` e o componente `<SpeedInsights />` no layout raiz da aplicação. Funciona no dashboard padrão da Vercel, sem exigir plano Pro nem Drains — é o suficiente para comparar Core Web Vitals antes/depois desta mudança.

## Testes e verificação

- Suite existente (`vitest`) precisa continuar passando — nenhuma mudança de lógica de negócio, só estratégia de cache/gating de rotas.
- Validação manual local: `next dev`, confirmar que o catálogo carrega normalmente; editar um produto no painel e verificar que o catálogo público reflete a mudança (valida a invalidação por `revalidateTag`).
- `npm run build` precisa suceder sem erros (sem flags experimentais novas — `unstable_cache` não exige `cacheComponents`).
- Validação manual de rotas do painel: confirmar que login, redirecionamentos (`/login` → `/painel`, usuário sem loja → `/cadastro?step=loja`, etc.) continuam funcionando após a mudança no middleware.
- Comparação de tempo de resposta antes/depois em produção (`curl -w "%{time_total}"` ou Speed Insights) nas duas superfícies: catálogo público e painel.
