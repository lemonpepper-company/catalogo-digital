# Otimização de latência do backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir a latência das chamadas em produção eliminando round-trips redundantes ao Supabase (middleware + painel) e adicionando cache com invalidação por tag ao catálogo público, seguindo `docs/superpowers/specs/2026-07-03-otimizacao-latencia-backend-design.md`.

**Architecture:** Middleware passa a autenticar só as rotas que exigem sessão. `getCurrentStore()` (painel) ganha memoização por-request via `cache()` do React, e `app/painel/layout.tsx` para de duplicar sua própria query. O catálogo público (`app/[slug]`) passa a usar a diretiva `'use cache'` do Next 16 Cache Components, com um Supabase client sem `cookies()` (exigência da diretiva) e invalidação imediata via `updateTag()` disparada pelas Server Actions que alteram produtos/categorias/configurações da loja. `@vercel/speed-insights` é adicionado para medir o resultado em produção.

**Tech Stack:** Next.js 16.2.9 (App Router, Cache Components), React 19, `@supabase/ssr` + `@supabase/supabase-js`, TypeScript, Vitest.

## Global Constraints

- Nenhuma mudança de UI ou de regra de negócio — só estratégia de cache/gating (spec, seção "Escopo").
- Suite `vitest` existente precisa continuar passando após cada task.
- Sem instrumentação além de `@vercel/speed-insights` nesta rodada (spec, seção "Fora desta rodada").
- Sem cache de dados do painel (dashboard, listagem de produtos) — fora de escopo (spec, seção "Fora desta rodada").

---

### Task 1: Habilitar Cache Components no Next.config

**Files:**
- Modify: `next.config.mjs`
- Test: `__tests__/next-config.test.ts`

**Interfaces:**
- Produces: `nextConfig.cacheComponents === true` — consumido pela Task 4 (só é seguro usar a diretiva `'use cache'` com essa flag ativa).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `__tests__/next-config.test.ts` (mesmo arquivo, novo `describe`):

```ts
describe("next.config cacheComponents", () => {
  it("is enabled", async () => {
    vi.resetModules();
    const mod = await import("@/next.config.mjs");
    expect(mod.default.cacheComponents).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/next-config.test.ts`
Expected: FAIL — `expected undefined to be true`

- [ ] **Step 3: Implementar**

Editar `next.config.mjs` — adicionar `cacheComponents: true` como chave de topo do objeto `nextConfig` (antes de `experimental`):

```js
const nextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    dangerouslyAllowLocalIP: allowLocalImageHost,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(supabaseHost
        ? [
            {
              protocol: supabaseProtocol,
              hostname: supabaseHost,
            },
          ]
        : []),
    ],
  },
};
```

O restante do arquivo (declaração de `supabaseUrl`, `supabaseHost`, `supabaseProtocol`, `allowLocalImageHost` e o `export default nextConfig;` final) não muda.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/next-config.test.ts`
Expected: PASS (3 testes: os 2 existentes de `remotePatterns` + o novo)

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs __tests__/next-config.test.ts
git commit -m "feat: habilita Cache Components no next.config"
```

---

### Task 2: Middleware só autentica rotas que exigem sessão

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Nenhuma interface nova exposta — mudança interna de comportamento (mesma matcher, mesmos redirecionamentos para `/login`, `/painel/*`, `/escolha-de-plano`).

- [ ] **Step 1: Implementar**

Substituir o conteúdo de `middleware.ts` por:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const needsAuth =
    pathname === '/login' ||
    pathname.startsWith('/painel') ||
    pathname === '/escolha-de-plano'

  if (!needsAuth) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Rota de login: redireciona usuários já autenticados para o painel
  if (pathname === '/login') {
    if (user) {
      const { data: store } = await supabase
        .from('stores')
        .select('plan')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!store) {
        return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
      }
      if (!store.plan) {
        return NextResponse.redirect(new URL('/escolha-de-plano', request.url))
      }
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  // Painel: exige sessão, loja criada e plano definido
  if (pathname.startsWith('/painel')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const { data: store } = await supabase
      .from('stores')
      .select('plan')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
    }
    if (!store.plan) {
      return NextResponse.redirect(new URL('/escolha-de-plano', request.url))
    }
  }

  // Escolha de plano: exige sessão e loja criada; redireciona se já tem plano
  if (pathname === '/escolha-de-plano') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: store } = await supabase
      .from('stores')
      .select('plan')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
    }
    if (store.plan) {
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/slug|auth/callback|landing).*)',
  ],
}
```

A única mudança de lógica é o bloco `needsAuth` no topo: se a rota não é `/login`, `/painel/*` nem `/escolha-de-plano`, o middleware retorna imediatamente sem criar o client Supabase nem chamar `auth.getUser()`. Isso cobre o catálogo público `/{slug}` — que continua batendo no matcher (não está na lista de exclusões), mas agora passa direto sem custo de rede.

- [ ] **Step 2: Rodar a suite completa para confirmar que nada quebrou**

Run: `npm test`
Expected: PASS — nenhum teste existente cobre `middleware.ts` diretamente (não há `middleware.test.ts` no repositório), então isso só confirma ausência de regressão em outros arquivos.

- [ ] **Step 3: Verificação manual**

Rodar `npm run dev` e, com o servidor de pé:
- Acessar uma URL de catálogo público existente (`/{slug}` de uma loja de teste) sem estar logado — deve carregar normalmente.
- Acessar `/painel` sem estar logado — deve redirecionar para `/login?next=/painel`.
- Fazer login e acessar `/painel` — deve carregar o painel normalmente.
- Acessar `/login` já logado — deve redirecionar para `/painel`.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "perf: middleware só autentica rotas que exigem sessão"
```

---

### Task 3: Deduplicar busca de usuário/loja no painel

**Files:**
- Modify: `lib/server/store.ts`
- Modify: `app/painel/layout.tsx`

**Interfaces:**
- Produces: `getCurrentStore(): Promise<StoreSettings | null>` — mesma assinatura pública de antes, agora memoizada por request via `cache()` do React. Todas as `page.tsx` do painel que já chamam `getCurrentStore()` (dashboard, produtos, categorias, configurações, novo/editar produto) continuam funcionando sem nenhuma mudança nelas.

- [ ] **Step 1: Implementar o dedup em `lib/server/store.ts`**

No topo do arquivo, adicionar o import de `cache`:

```ts
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  StoreSettings,
  StoreProduct,
  StoreCategory,
  ProductColor,
} from "@/lib/types";
```

Substituir a função `getCurrentStore` (que hoje é `export async function getCurrentStore()`) por uma constante envolvida em `cache()`, mantendo o corpo idêntico:

```ts
/** Resolve a loja do usuário logado. Borda de segurança — o middleware já garante loja+plano. */
export const getCurrentStore = cache(async (): Promise<StoreSettings | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("stores")
    .select(
      "id, name, slug, plan, trial_ends_at, whatsapp, accent_color, logo_url, description, monogram, analytics_id, pixel_id, message_template"
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return data ? mapStore(data as StoreRow) : null;
});
```

- [ ] **Step 2: Reescrever `app/painel/layout.tsx` para usar `getCurrentStore()`**

Substituir o conteúdo de `app/painel/layout.tsx` por:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentStore } from '@/lib/server/store'
import { Sidebar } from '@/components/painel/Sidebar'
import { MobileTabBar } from '@/components/painel/MobileTabBar'

export const metadata = {
  title: 'Painel — Vtrine Digital',
  robots: { index: false, follow: false },
}

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const store = await getCurrentStore()

  if (!store) {
    redirect('/login')
  }

  const trialDaysLeft = store.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(store.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const showTrialBanner = !store.plan

  return (
    <div className="h-screen flex flex-col bg-ivory overflow-hidden">
      {showTrialBanner && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Trial Pro</span>
          <span className="opacity-55">·</span>
          <span>{trialDaysLeft} dias restantes</span>
          <span className="opacity-55">·</span>
          <a
            href="/escolha-de-plano"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Assinar agora →
          </a>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          name={store.name}
          monogram={store.monogram}
          logoUrl={store.logoUrl}
          slug={store.slug}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-24 lg:px-12 lg:py-10 lg:pb-10">{children}</div>
        </main>
      </div>

      <MobileTabBar />
    </div>
  )
}
```

Duas mudanças importantes em relação ao arquivo original:
1. O layout não cria mais seu próprio Supabase client nem faz sua própria query a `stores` — usa só `getCurrentStore()`.
2. O layout também não chama mais `supabase.auth.getUser()` separadamente para decidir o redirect — usa `!store` (que já é `null` se não houver usuário autenticado) como condição de redirect para `/login`. Isso é seguro porque o middleware (Task 2) já garante que ninguém sem sessão e sem loja chega em `/painel/*`; esse `if (!store) redirect('/login')` é só uma rede de segurança para casos de borda (ex: cookie expirou entre o middleware e a renderização). É essa mudança que faz o número de round-trips no render cair de 2 pares (auth+store no layout, auth+store repetido na page) para 1 par único, compartilhado entre layout e page via `cache()`.

Note que os nomes de campo mudam de snake_case (query raw anterior: `store?.logo_url`, `store?.trial_ends_at`) para camelCase (`StoreSettings` mapeado: `store.logoUrl`, `store.trialEndsAt`), e `store` deixa de ser opcional depois do `if (!store) redirect(...)` — o TypeScript já estreita o tipo para `StoreSettings` (não-null) no restante da função, então não são mais necessários os `?.` nem os `?? ''` / `?? null` de fallback.

- [ ] **Step 3: Rodar a suite completa**

Run: `npm test`
Expected: PASS — nenhum teste existente cobre `lib/server/store.ts` ou `app/painel/layout.tsx` diretamente, então isso confirma ausência de regressão em outros arquivos (ex: `__tests__/Sidebar.test.tsx`, que testa o componente `Sidebar` isoladamente, não o layout).

- [ ] **Step 4: Verificação manual**

Com `npm run dev` rodando e logado como lojista de teste:
- Acessar `/painel` — dashboard carrega, nome/logo/slug da loja aparecem corretamente na sidebar.
- Navegar para `/painel/produtos`, `/painel/categorias`, `/painel/configuracoes` — cada uma carrega os dados da loja corretamente (nada quebrou com a troca de snake_case para camelCase).
- Deslogar e acessar `/painel` diretamente — redireciona para `/login`.

- [ ] **Step 5: Commit**

```bash
git add lib/server/store.ts app/painel/layout.tsx
git commit -m "perf: deduplica busca de usuário/loja no painel via cache()"
```

---

### Task 4: Cache do catálogo público com invalidação por tag

**Files:**
- Modify: `lib/supabase/server.ts`
- Modify: `lib/server/catalog.ts`
- Modify: `app/[slug]/page.tsx`

**Interfaces:**
- Produces: `createAnonClient(): SupabaseClient` (síncrona, sem `cookies()`) — usada só por `getPublicCatalog`.
- Produces: `getPublicCatalog(slug: string): Promise<PublicCatalog>` — mesma assinatura pública de antes; agora cacheada via `'use cache'` com tag `` `catalog-${slug}` ``. Essa string de tag (`catalog-${slug}`) é o contrato que as Tasks 5, 6 e 7 precisam replicar exatamente ao chamar `updateTag()`.

- [ ] **Step 1: Adicionar `createAnonClient` em `lib/supabase/server.ts`**

A diretiva `'use cache'` do Next 16 proíbe o uso de `cookies()`/`headers()`/`searchParams` dentro da função cacheada. O `createClient()` atual desse arquivo depende de `cookies()` (via `next/headers`), então não pode ser usado dentro de `getPublicCatalog` depois que ela virar `'use cache'`. Como o catálogo público é sempre uma leitura RLS anônima (não depende de quem está logado no navegador), a solução é um client separado que não toca em `cookies()`.

Substituir o conteúdo de `lib/supabase/server.ts` por:

```ts
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — middleware atualiza os cookies
          }
        },
      },
    }
  )
}

/**
 * Client sem acesso a cookies() — seguro para uso dentro de funções `'use cache'`,
 * que proíbem APIs de runtime. Usa só a anon key: correto para o catálogo público,
 * cujas políticas RLS já são de leitura anônima, independente de sessão do lojista.
 */
export function createAnonClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Adicionar cache + tag em `lib/server/catalog.ts`**

Substituir o conteúdo de `lib/server/catalog.ts` por:

```ts
import "server-only";
import { cacheTag } from "next/cache";
import { createAnonClient } from "@/lib/supabase/server";
import {
  resolveCatalog,
  type PublicCatalog,
  type PublicStoreRow,
  type PublicProductRow,
  type PublicCategoryRow,
} from "@/lib/catalog";

const STORE_COLS =
  "id, name, slug, is_active, whatsapp, accent_color, logo_url, description, monogram, analytics_id, pixel_id, message_template";
const PRODUCT_COLS =
  "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new";

/** Resolve o catálogo público de uma loja pelo slug. RLS + filtros explícitos garantem apenas produtos visíveis. */
export async function getPublicCatalog(slug: string): Promise<PublicCatalog> {
  "use cache";
  cacheTag(`catalog-${slug}`);

  const supabase = createAnonClient();

  const { data: storeRow } = await supabase
    .from("stores")
    .select(STORE_COLS)
    .eq("slug", slug)
    .maybeSingle();

  if (!storeRow) return resolveCatalog(null, [], []);
  if (!(storeRow as PublicStoreRow).is_active) {
    return resolveCatalog(storeRow as PublicStoreRow, [], []);
  }

  const [{ data: productRows }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("products")
      .select(PRODUCT_COLS)
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .eq("is_active", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("id, name, position")
      .eq("store_id", (storeRow as PublicStoreRow).id)
      .order("position", { ascending: true }),
  ]);

  return resolveCatalog(
    storeRow as PublicStoreRow,
    (productRows ?? []) as PublicProductRow[],
    (categoryRows ?? []) as PublicCategoryRow[]
  );
}
```

Mudanças em relação ao original: `cache` do React sai (a diretiva `'use cache'` já cobre memoização — agora persistente entre requests, não só dentro do mesmo render); `createClient` vira `createAnonClient` (sem cookies, exigência da diretiva); a função deixa de ser `export const getPublicCatalog = cache(async (slug) => {...})` e passa a ser `export async function getPublicCatalog(slug) { "use cache"; ... }`.

- [ ] **Step 3: Remover `force-dynamic` de `app/[slug]/page.tsx`**

Editar `app/[slug]/page.tsx` — remover a linha:

```ts
export const dynamic = "force-dynamic";
```

O restante do arquivo (imports, `generateMetadata`, `CatalogoSlugPage`) não muda — `getPublicCatalog` agora traz seu próprio cache via `'use cache'`, então a rota não precisa mais forçar renderização dinâmica total.

- [ ] **Step 4: Rodar a suite completa**

Run: `npm test`
Expected: PASS — `__tests__/catalog.test.ts` testa só as funções puras de `lib/catalog.ts` (`resolveCatalog`, `mapPublicStore`, etc.), que não mudaram. `lib/server/catalog.ts` (server-only, com I/O real) não tem teste automatizado direto, hoje ou depois desta task.

- [ ] **Step 5: Verificação manual**

Com `npm run dev` rodando (`cacheComponents: true` já habilitado na Task 1):
- Acessar `/{slug}` de uma loja de teste — catálogo carrega normalmente, produtos e categorias aparecem.
- Acessar de novo a mesma URL — confirmar que ainda reflete os dados corretos (cache não quebrou nada visualmente).
- Acessar `/{slug}` de uma loja inexistente — continua caindo em `notFound()`.
- Acessar `/{slug}` de uma loja com `is_active=false` — continua mostrando `CatalogExpired`.

- [ ] **Step 6: Commit**

```bash
git add lib/supabase/server.ts lib/server/catalog.ts "app/[slug]/page.tsx"
git commit -m "perf: cacheia catálogo público via Cache Components"
```

---

### Task 5: Invalidação de cache nas actions de produtos

**Files:**
- Modify: `app/actions/produtos.ts`

**Interfaces:**
- Consumes: tag `` `catalog-${slug}` `` definida na Task 4 (`lib/server/catalog.ts`).

- [ ] **Step 1: Implementar**

Em `app/actions/produtos.ts`, trocar o import:

```ts
import { revalidatePath } from "next/cache";
```

por:

```ts
import { revalidatePath, updateTag } from "next/cache";
```

Em `createProduct`, logo após `revalidatePath("/painel/produtos");` e antes do `redirect("/painel/produtos");`, adicionar:

```ts
  revalidatePath("/painel/produtos");
  updateTag(`catalog-${store.slug}`);
  redirect("/painel/produtos");
```

Em `updateProduct`, mesma mudança (após `revalidatePath`, antes do `redirect`):

```ts
  revalidatePath("/painel/produtos");
  updateTag(`catalog-${store.slug}`);
  redirect("/painel/produtos");
```

Em `deleteProduct`, adicionar antes do `return { ok: true };` final:

```ts
  revalidatePath("/painel/produtos");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
```

Em `toggleProductActive`, mesma mudança:

```ts
  revalidatePath("/painel/produtos");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
```

Em todos os 4 casos, `store` já está disponível no escopo (cada função já chama `const store = await getCurrentStore();` mais acima) — nenhuma query adicional é necessária.

- [ ] **Step 2: Rodar a suite completa**

Run: `npm test`
Expected: PASS — não há testes automatizados para `app/actions/produtos.ts` hoje (nenhum `produtos.test.ts` no repositório); isso confirma ausência de regressão em outros arquivos.

- [ ] **Step 3: Verificação manual**

Com `npm run dev` rodando, logado como lojista de teste, em duas abas (uma no painel, outra no catálogo público da mesma loja):
- Criar um produto novo no painel → recarregar o catálogo público → produto aparece.
- Editar o preço/estoque de um produto existente → recarregar o catálogo público → mudança aparece.
- Desativar um produto (`toggleProductActive`) → recarregar o catálogo público → produto some da vitrine.
- Excluir um produto → recarregar o catálogo público → produto some.

- [ ] **Step 4: Commit**

```bash
git add app/actions/produtos.ts
git commit -m "perf: invalida cache do catálogo ao alterar produtos"
```

---

### Task 6: Invalidação de cache nas actions de categorias

**Files:**
- Modify: `app/actions/categorias.ts`

**Interfaces:**
- Consumes: tag `` `catalog-${slug}` `` definida na Task 4 (`lib/server/catalog.ts`).

- [ ] **Step 1: Implementar**

Em `app/actions/categorias.ts`, trocar o import:

```ts
import { revalidatePath } from "next/cache";
```

por:

```ts
import { revalidatePath, updateTag } from "next/cache";
```

Em `createCategory`, após `revalidatePath("/painel/categorias");` e antes do `return { ok: true, id: data.id };`:

```ts
  revalidatePath("/painel/categorias");
  updateTag(`catalog-${store.slug}`);
  return { ok: true, id: data.id };
```

Em `renameCategory`, após `revalidatePath("/painel/categorias");` e antes do `return { ok: true };`:

```ts
  revalidatePath("/painel/categorias");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
```

Em `deleteCategory`, mesma mudança:

```ts
  revalidatePath("/painel/categorias");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
```

Em todos os 3 casos, `store` já está disponível no escopo (cada função já chama `const store = await getCurrentStore();`).

- [ ] **Step 2: Rodar a suite completa**

Run: `npm test`
Expected: PASS — não há testes automatizados para `app/actions/categorias.ts` hoje.

- [ ] **Step 3: Verificação manual**

Com `npm run dev` rodando, logado como lojista de teste:
- Criar uma categoria nova → um produto dessa categoria no catálogo público reflete o nome/agrupamento corretamente após recarregar.
- Renomear uma categoria existente → recarregar o catálogo público → nome atualizado no filtro de categorias.
- Excluir uma categoria sem produtos vinculados → recarregar o catálogo público → categoria some do filtro.

- [ ] **Step 4: Commit**

```bash
git add app/actions/categorias.ts
git commit -m "perf: invalida cache do catálogo ao alterar categorias"
```

---

### Task 7: Invalidação de cache na action de configurações da loja

**Files:**
- Modify: `app/actions/store.ts`

**Interfaces:**
- Consumes: tag `` `catalog-${slug}` `` definida na Task 4 (`lib/server/catalog.ts`).

- [ ] **Step 1: Implementar**

Em `app/actions/store.ts`, trocar o import:

```ts
import { revalidatePath } from "next/cache";
```

por:

```ts
import { revalidatePath, updateTag } from "next/cache";
```

Em `updateStoreSettings`, após os dois `revalidatePath` já existentes e antes do `return { ok: true };` final:

```ts
  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
  updateTag(`catalog-${store.slug}`);
  return { ok: true };
```

`store` já está disponível no escopo (a função já chama `const store = await getCurrentStore();` mais acima).

- [ ] **Step 2: Rodar a suite completa**

Run: `npm test`
Expected: PASS — não há testes automatizados para `app/actions/store.ts` hoje.

- [ ] **Step 3: Verificação manual**

Com `npm run dev` rodando, logado como lojista de teste:
- Alterar o nome da loja, cor de destaque ou WhatsApp em Configurações → recarregar o catálogo público → mudanças refletidas (nome no header, cor de destaque nos elementos, número do WhatsApp no botão de compra).
- Trocar o logo → recarregar o catálogo público → novo logo aparece.

- [ ] **Step 4: Commit**

```bash
git add app/actions/store.ts
git commit -m "perf: invalida cache do catálogo ao alterar configurações da loja"
```

---

### Task 8: Adicionar Speed Insights

**Files:**
- Modify: `package.json`
- Modify: `app/layout.tsx`

**Interfaces:**
- Nenhuma interface nova — só instrumentação visual (componente `<SpeedInsights />` sem props obrigatórias).

- [ ] **Step 1: Instalar a dependência**

Run: `npm install @vercel/speed-insights`
Expected: `package.json` e `package-lock.json` atualizados com `@vercel/speed-insights` em `dependencies`.

- [ ] **Step 2: Adicionar o componente ao layout raiz**

Em `app/layout.tsx`, adicionar o import:

```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
```

junto aos imports já existentes (`Metadata`, `Sora`, `DM_Sans`, `./globals.css`).

Alterar o `return` de `RootLayout` de:

```tsx
  return (
    <html lang="pt-BR" className={`${sora.variable} ${dmSans.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
```

para:

```tsx
  return (
    <html lang="pt-BR" className={`${sora.variable} ${dmSans.variable}`}>
      <body suppressHydrationWarning>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
```

- [ ] **Step 3: Rodar a suite completa**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Verificação manual**

Run: `npm run build`
Expected: build conclui sem erros (confirma que o novo import resolve corretamente e não quebra a compilação).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/layout.tsx
git commit -m "feat: adiciona Vercel Speed Insights"
```

---

### Task 9: Verificação final end-to-end e medição

**Files:**
- Nenhum arquivo novo — task de verificação.

- [ ] **Step 1: Rodar a suite completa uma última vez**

Run: `npm test`
Expected: PASS — todos os testes (novos e existentes).

- [ ] **Step 2: Build de produção local**

Run: `npm run build`
Expected: build conclui sem erros, sem warnings novos relacionados a `cacheComponents`, `use cache` ou `cookies()` dentro de função cacheada (se aparecer um erro do tipo "cookies() was called inside 'use cache'", significa que algum ponto ainda usa `createClient()` em vez de `createAnonClient()` dentro do caminho do catálogo — revisar Task 4).

- [ ] **Step 3: Deploy e medição em produção**

Depois do deploy (fora do escopo deste plano — usar o fluxo normal de deploy do projeto):
- Medir tempo de resposta do catálogo público antes/depois: `curl -w "\n%{time_total}s\n" -o /dev/null -s https://<seu-dominio>/<slug-de-teste>`
- Medir tempo de resposta do painel (`/painel`) antes/depois logado.
- Checar o dashboard de Speed Insights na Vercel (`https://vercel.com/{team}/{project}/speed-insights`) após acumular tráfego real, comparando LCP/TTFB com o baseline anterior à mudança de região + esta rodada de otimizações.

- [ ] **Step 4: Nenhum commit nesta task** — é só verificação; se algo falhar, volte à task correspondente, corrija e recommite lá.
