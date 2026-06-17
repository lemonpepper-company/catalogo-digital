# Painel do lojista — backend real (Escopo 3.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar as quatro telas do painel do lojista (Dashboard, Produtos, Categorias, Configurações) a um backend real no Supabase — persistência de produtos/categorias/ajustes, upload de fotos via Storage e enforcement de limites de plano.

**Architecture:** Server Components fazem a leitura (Supabase server client) e passam dados por props; mutações vão por Server Actions em `app/actions/*.ts` (zod v4 + `getUser()` + enforcement). RLS cuida da autorização. Limites de plano são autoritativos no servidor e preventivos na UI. O catálogo público segue mockado (`lib/data.ts`) — não faz parte desta rodada.

**Tech Stack:** Next.js 16 App Router, React 19 (`useActionState`/`useTransition`), Supabase (`@supabase/ssr`, Storage), Zod v4, Vitest + Testing Library.

**Design spec:** `docs/superpowers/specs/2026-06-16-painel-lojista-backend-design.md`

---

## Decisão de tipos (desvio consciente da spec)

A spec diz "`Product` ganha `images`/`categoryId`/`priceCents`". Porém o **catálogo público continua usando o `Product` legado** (`price: string`, `image: string`, `category: string`) vindo de `lib/data.ts`, e há testes (`__tests__/data.test.ts`) que dependem desse contrato. Para não quebrar o catálogo nesta rodada, **introduzimos tipos novos** (`StoreProduct`, `StoreCategory`, `StoreSettings`) para o painel/DB e deixamos `Product`/`Store` legados intactos. A unificação acontece na rodada 3.3, quando o catálogo migra para o backend.

---

## Mapa de arquivos

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| CRIAR | `supabase/migrations/20260616120000_painel_backend.sql` | Schema (products, categories, extensão de stores), RLS, bucket + policies de Storage |
| MODIFICAR | `lib/types.ts` | `StoreProduct`, `StoreCategory`, `StoreSettings` |
| CRIAR | `lib/plan-limits.ts` | `getPlanLimits`, `isTrialActive` (puro) |
| CRIAR | `__tests__/plan-limits.test.ts` | Testes de limites/trial |
| MODIFICAR | `lib/utils.ts` | `parseReaisToCents`, `formatCents` |
| MODIFICAR | `__tests__/utils.test.ts` | Testes de conversão preço↔cents |
| CRIAR | `lib/server/store.ts` | `getCurrentStore` + mappers DB→camelCase |
| CRIAR | `lib/validation/painel.ts` | Schemas zod + `canDeleteCategory` (guard puro) |
| CRIAR | `__tests__/painel-validation.test.ts` | Testes dos schemas + guard |
| CRIAR | `app/actions/produtos.ts` | create/update/delete/toggle produto + upload |
| CRIAR | `app/actions/categorias.ts` | create/rename/delete categoria |
| CRIAR | `app/actions/store.ts` | `updateStoreSettings` + upload de logo |
| MODIFICAR | `next.config.ts` | remotePattern do host de Storage do Supabase |
| MODIFICAR | `app/painel/page.tsx` | Server Component: contagens + slug |
| MODIFICAR | `app/painel/DashboardClient.tsx` | Consome props (sem `lib/data`) |
| MODIFICAR | `app/painel/use-dashboard.ts` | Recebe dados por argumento |
| MODIFICAR | `app/painel/produtos/page.tsx` | Server Component: lista + contagens + limite |
| MODIFICAR | `app/painel/produtos/ProdutosClient.tsx` | Lista por prop; actions toggle/delete |
| MODIFICAR | `app/painel/produtos/use-produtos.ts` | Source-of-truth = props; chama actions |
| MODIFICAR | `app/painel/produtos/[id]/page.tsx` | Busca produto + categorias |
| MODIFICAR | `app/painel/produtos/novo/page.tsx` | Busca categorias + limite |
| MODIFICAR | `app/painel/produtos/ProdutoFormClient.tsx` | `<form action>`, file inputs, hidden fields |
| MODIFICAR | `app/painel/produtos/use-produto-form.ts` | `useActionState` + estado de fotos/variações |
| MODIFICAR | `app/painel/categorias/page.tsx` | Busca categorias + contagem |
| MODIFICAR | `app/painel/categorias/CategoriasClient.tsx` | Lista por prop; actions |
| MODIFICAR | `app/painel/categorias/use-categorias.ts` | Props + actions |
| MODIFICAR | `app/painel/configuracoes/page.tsx` | Busca settings |
| MODIFICAR | `app/painel/configuracoes/ConfiguracoesClient.tsx` | `<form action>` + props |
| MODIFICAR | `app/painel/configuracoes/use-configuracoes.ts` | `useActionState` + settings iniciais |

---

## Task 1: Migration — schema, RLS e Storage

**Files:**
- Create: `supabase/migrations/20260616120000_painel_backend.sql`

- [ ] **Step 1: Escrever a migration**

Crie `supabase/migrations/20260616120000_painel_backend.sql` com:

```sql
-- Painel backend: produtos, categorias, ajustes da loja e Storage

-- 1. Ajustes da loja (1:1 em stores)
alter table public.stores
  add column whatsapp         text,
  add column accent_color     text default '#C9A96E',
  add column logo_url         text,
  add column description      text,
  add column monogram         text,
  add column analytics_id     text,
  add column pixel_id         text,
  add column message_template text;

-- 2. Categorias
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  name       text not null,
  position   int default 0,
  created_at timestamptz default now(),
  unique (store_id, name)
);

-- 3. Produtos
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  price_cents int not null,
  description text,
  category_id uuid references public.categories(id) on delete restrict,
  sizes       text[] default '{}',
  sold_sizes  text[] default '{}',
  colors      jsonb default '[]',
  images      text[] default '{}',
  stock       int default 0,
  is_active   boolean default true,
  is_new      boolean default false,
  created_at  timestamptz default now()
);

create index categories_store_id_idx on public.categories(store_id);
create index products_store_id_idx   on public.products(store_id);
create index products_category_id_idx on public.products(category_id);

-- 4. RLS — own store only
alter table public.categories enable row level security;
alter table public.products enable row level security;

create policy "categories: own store only" on public.categories for all
  using (exists (
    select 1 from public.stores s
    where s.id = categories.store_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.stores s
    where s.id = categories.store_id and s.owner_id = auth.uid()));

create policy "products: own store only" on public.products for all
  using (exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = auth.uid()))
  with check (exists (
    select 1 from public.stores s
    where s.id = products.store_id and s.owner_id = auth.uid()));

grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.products   to authenticated;

-- 5. Storage — bucket público, escrita só do dono na pasta da própria loja
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: public read" on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product-images: owner insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()));

create policy "product-images: owner update" on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()));

create policy "product-images: owner delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.stores s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = auth.uid()));
```

- [ ] **Step 2: Aplicar a migration no banco linkado**

Run: `supabase db push`
Expected: a CLI lista a migration `20260616120000_painel_backend.sql` e aplica sem erro (`Finished supabase db push`).

> Se o projeto não estiver linkado: `supabase link --project-ref <ref>` antes. Para banco local em vez do remoto, use `supabase db reset` (recria do zero aplicando todas as migrations).

- [ ] **Step 3: Verificar as tabelas e o bucket**

Run: `supabase db push --dry-run`
Expected: "Remote database is up to date." (nenhuma migration pendente).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260616120000_painel_backend.sql
git commit -m "feat(db): schema de produtos, categorias e ajustes da loja + storage"
```

---

## Task 2: Tipos do painel

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Adicionar os tipos do painel**

No fim de `lib/types.ts`, adicione (mantenha `Product`/`Store` legados intactos):

```ts
export interface StoreProduct {
  id: string;
  name: string;
  priceCents: number;
  description: string | null;
  categoryId: string | null;
  sizes: string[];
  soldSizes: string[];
  colors: ProductColor[];
  images: string[];
  stock: number;
  isActive: boolean;
  isNew: boolean;
}

export interface StoreCategory {
  id: string;
  name: string;
  position: number;
  productCount: number;
}

export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | null;
  trialEndsAt: string;
  whatsapp: string | null;
  accentColor: string;
  logoUrl: string | null;
  description: string | null;
  monogram: string | null;
  analyticsId: string | null;
  pixelId: string | null;
  messageTemplate: string | null;
}
```

- [ ] **Step 2: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): StoreProduct, StoreCategory, StoreSettings"
```

---

## Task 3: Limites de plano (TDD)

**Files:**
- Create: `lib/plan-limits.ts`
- Test: `__tests__/plan-limits.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `__tests__/plan-limits.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";

describe("isTrialActive", () => {
  it("é true quando trial_ends_at está no futuro", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isTrialActive(future)).toBe(true);
  });

  it("é false quando trial_ends_at já passou", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isTrialActive(past)).toBe(false);
  });
});

describe("getPlanLimits", () => {
  it("starter tem limites finitos", () => {
    expect(getPlanLimits("starter", false)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
    });
  });

  it("pro tem produtos/categorias ilimitados e 5 fotos", () => {
    expect(getPlanLimits("pro", false)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
    });
  });

  it("trial ativo (plan null + trial futuro) usa limites Pro", () => {
    expect(getPlanLimits(null, true)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
    });
  });

  it("plan null com trial expirado cai para Starter", () => {
    expect(getPlanLimits(null, false)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/plan-limits"`.

- [ ] **Step 3: Implementar**

Crie `lib/plan-limits.ts`:

```ts
export type Plan = "starter" | "pro" | null;

export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
}

const PRO_LIMITS: PlanLimits = {
  maxProducts: Infinity,
  maxCategories: Infinity,
  maxPhotos: 5,
};

const STARTER_LIMITS: PlanLimits = {
  maxProducts: 30,
  maxCategories: 5,
  maxPhotos: 3,
};

export function isTrialActive(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() > Date.now();
}

export function getPlanLimits(plan: Plan, trialActive: boolean): PlanLimits {
  if (plan === "pro" || (plan === null && trialActive)) return PRO_LIMITS;
  return STARTER_LIMITS;
}
```

- [ ] **Step 4: Rodar o teste e confirmar verde**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add lib/plan-limits.ts __tests__/plan-limits.test.ts
git commit -m "feat(plan): getPlanLimits e isTrialActive com testes"
```

---

## Task 4: Conversão preço↔centavos (TDD)

**Files:**
- Modify: `lib/utils.ts`
- Test: `__tests__/utils.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

No fim de `__tests__/utils.test.ts`, adicione (e o import correspondente no topo se ainda não existir — veja Step 3):

```ts
import { parseReaisToCents, formatCents } from "@/lib/utils";

describe("parseReaisToCents", () => {
  it("converte '289,90' em 28990", () => {
    expect(parseReaisToCents("289,90")).toBe(28990);
  });

  it("aceita prefixo R$ e espaços", () => {
    expect(parseReaisToCents("R$ 1.299,00")).toBe(129900);
  });

  it("trata inteiro sem centavos", () => {
    expect(parseReaisToCents("50")).toBe(5000);
  });

  it("retorna NaN para entrada vazia", () => {
    expect(Number.isNaN(parseReaisToCents(""))).toBe(true);
  });
});

describe("formatCents", () => {
  it("formata 28990 como 'R$ 289,90'", () => {
    expect(formatCents(28990)).toBe("R$ 289,90");
  });

  it("formata 5000 como 'R$ 50,00'", () => {
    expect(formatCents(5000)).toBe("R$ 50,00");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npx vitest run __tests__/utils.test.ts`
Expected: FAIL — `parseReaisToCents`/`formatCents` não exportados.

- [ ] **Step 3: Implementar**

No fim de `lib/utils.ts`, adicione:

```ts
export function parseReaisToCents(input: string): number {
  const cleaned = input.replace(/R\$\s*/, "").replace(/\./g, "").trim();
  if (cleaned === "") return NaN;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(",", ".")
    : cleaned;
  const reais = parseFloat(normalized);
  if (Number.isNaN(reais)) return NaN;
  return Math.round(reais * 100);
}

export function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
```

- [ ] **Step 4: Rodar o teste e confirmar verde**

Run: `npx vitest run __tests__/utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts __tests__/utils.test.ts
git commit -m "feat(utils): conversão preço↔centavos com testes"
```

---

## Task 5: Schemas de validação + guard de exclusão (TDD)

**Files:**
- Create: `lib/validation/painel.ts`
- Test: `__tests__/painel-validation.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `__tests__/painel-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  productSchema,
  categoryNameSchema,
  canDeleteCategory,
} from "@/lib/validation/painel";

describe("productSchema", () => {
  it("aceita um produto válido", () => {
    const r = productSchema.safeParse({
      name: "Vestido midi",
      priceCents: 28990,
      stock: 12,
      categoryId: null,
      description: "linho",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const r = productSchema.safeParse({
      name: "",
      priceCents: 1000,
      stock: 0,
      categoryId: null,
      description: null,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/nome/i);
  });

  it("rejeita preço <= 0", () => {
    const r = productSchema.safeParse({
      name: "X",
      priceCents: 0,
      stock: 0,
      categoryId: null,
      description: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("categoryNameSchema", () => {
  it("rejeita nome curto", () => {
    expect(categoryNameSchema.safeParse("").success).toBe(false);
  });
  it("aceita nome válido", () => {
    expect(categoryNameSchema.safeParse("Acessórios").success).toBe(true);
  });
});

describe("canDeleteCategory", () => {
  it("permite excluir categoria sem produtos", () => {
    expect(canDeleteCategory(0)).toBe(true);
  });
  it("bloqueia categoria com produtos", () => {
    expect(canDeleteCategory(3)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar a falha**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/validation/painel"`.

- [ ] **Step 3: Implementar**

Crie `lib/validation/painel.ts`:

```ts
import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2, "Nome do produto é obrigatório"),
  priceCents: z.number().int().positive("Preço deve ser maior que zero"),
  stock: z.number().int().min(0, "Estoque não pode ser negativo"),
  categoryId: z.string().uuid().nullable(),
  description: z.string().nullable(),
});

export const categoryNameSchema = z
  .string()
  .min(2, "Nome da categoria deve ter ao menos 2 caracteres")
  .max(40, "Nome da categoria muito longo");

export const storeSettingsSchema = z.object({
  name: z.string().min(2, "Nome da loja é obrigatório"),
  whatsapp: z.string().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  description: z.string().nullable(),
  monogram: z.string().max(3, "Monograma deve ter no máximo 3 letras").nullable(),
  analyticsId: z.string().nullable(),
  pixelId: z.string().nullable(),
  messageTemplate: z.string().nullable(),
});

export function canDeleteCategory(productCount: number): boolean {
  return productCount === 0;
}
```

- [ ] **Step 4: Rodar o teste e confirmar verde**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/painel.ts __tests__/painel-validation.test.ts
git commit -m "feat(validation): schemas do painel + guard de exclusão de categoria"
```

---

## Task 6: Helper de loja — `getCurrentStore`

**Files:**
- Create: `lib/server/store.ts`

- [ ] **Step 1: Implementar o helper + mappers**

Crie `lib/server/store.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  StoreSettings,
  StoreProduct,
  StoreCategory,
  ProductColor,
} from "@/lib/types";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | null;
  trial_ends_at: string;
  whatsapp: string | null;
  accent_color: string | null;
  logo_url: string | null;
  description: string | null;
  monogram: string | null;
  analytics_id: string | null;
  pixel_id: string | null;
  message_template: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  price_cents: number;
  description: string | null;
  category_id: string | null;
  sizes: string[];
  sold_sizes: string[];
  colors: ProductColor[];
  images: string[];
  stock: number;
  is_active: boolean;
  is_new: boolean;
};

export function mapStore(row: StoreRow): StoreSettings {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    trialEndsAt: row.trial_ends_at,
    whatsapp: row.whatsapp,
    accentColor: row.accent_color ?? "#C9A96E",
    logoUrl: row.logo_url,
    description: row.description,
    monogram: row.monogram,
    analyticsId: row.analytics_id,
    pixelId: row.pixel_id,
    messageTemplate: row.message_template,
  };
}

export function mapProduct(row: ProductRow): StoreProduct {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    description: row.description,
    categoryId: row.category_id,
    sizes: row.sizes ?? [],
    soldSizes: row.sold_sizes ?? [],
    colors: row.colors ?? [],
    images: row.images ?? [],
    stock: row.stock,
    isActive: row.is_active,
    isNew: row.is_new,
  };
}

/** Resolve a loja do usuário logado. Borda de segurança — o middleware já garante loja+plano. */
export async function getCurrentStore(): Promise<StoreSettings | null> {
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
}

export type { StoreCategory };
```

- [ ] **Step 2: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/server/store.ts
git commit -m "feat(server): getCurrentStore + mappers DB→camelCase"
```

---

## Task 7: Server Actions — categorias

**Files:**
- Create: `app/actions/categorias.ts`

- [ ] **Step 1: Implementar as actions**

Crie `app/actions/categorias.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { categoryNameSchema, canDeleteCategory } from "@/lib/validation/painel";

export type CategoryActionState = { error: string } | { ok: true } | null;

export async function createCategory(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const parsed = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
  if ((count ?? 0) >= limits.maxCategories) {
    return {
      error: "Limite de categorias do plano Starter atingido. Faça upgrade para Pro.",
    };
  }

  const { error } = await supabase
    .from("categories")
    .insert({ store_id: store.id, name: parsed.data });

  if (error) {
    if (error.code === "23505") return { error: "Essa categoria já existe." };
    return { error: "Erro ao criar categoria." };
  }

  revalidatePath("/painel/categorias");
  return { ok: true };
}

export async function renameCategory(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");
  const parsed = categoryNameSchema.safeParse(formData.get("name"));
  if (typeof id !== "string") return { error: "Categoria inválida." };
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { error } = await supabase
    .from("categories")
    .update({ name: parsed.data })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) {
    if (error.code === "23505") return { error: "Essa categoria já existe." };
    return { error: "Erro ao renomear categoria." };
  }

  revalidatePath("/painel/categorias");
  return { ok: true };
}

export async function deleteCategory(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Categoria inválida." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id)
    .eq("category_id", id);

  if (!canDeleteCategory(count ?? 0)) {
    return {
      error: "Não é possível excluir uma categoria com produtos vinculados.",
    };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao excluir categoria." };

  revalidatePath("/painel/categorias");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/actions/categorias.ts
git commit -m "feat(actions): CRUD de categorias com enforcement e guard"
```

---

## Task 8: Server Actions — produtos (com upload)

**Files:**
- Create: `app/actions/produtos.ts`

- [ ] **Step 1: Implementar as actions**

Crie `app/actions/produtos.ts`. As fotos chegam como `File[]` no campo `photos`; as imagens mantidas (em edição) chegam como JSON em `existing_images`. `sizes`, `soldSizes` e `colors` chegam como JSON. Preço chega como string e é convertido para centavos.

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { productSchema } from "@/lib/validation/painel";
import { parseReaisToCents } from "@/lib/utils";
import type { ProductColor } from "@/lib/types";

const BUCKET = "product-images";

export type ProductActionState = { error: string } | null;
export type ToggleActionState = { error: string } | { ok: true } | null;

function publicUrlToPath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function uploadPhotos(
  storeId: string,
  files: File[]
): Promise<string[]> {
  const supabase = await createClient();
  const urls: string[] = [];
  for (const file of files) {
    if (!file || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type });
    if (error) throw new Error("Falha no upload da foto.");
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

function parseFormProduct(formData: FormData) {
  const priceCents = parseReaisToCents((formData.get("price") as string) ?? "");
  const stockRaw = parseInt((formData.get("stock") as string) ?? "0", 10);
  const categoryIdRaw = formData.get("categoryId");
  const categoryId =
    typeof categoryIdRaw === "string" && categoryIdRaw !== ""
      ? categoryIdRaw
      : null;

  const base = productSchema.safeParse({
    name: formData.get("name"),
    priceCents: Number.isNaN(priceCents) ? -1 : priceCents,
    stock: Number.isNaN(stockRaw) ? 0 : stockRaw,
    categoryId,
    description: (formData.get("description") as string) || null,
  });

  return base;
}

function jsonArray<T>(formData: FormData, key: string): T[] {
  try {
    const raw = formData.get(key);
    return typeof raw === "string" && raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export async function createProduct(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const parsed = parseFormProduct(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store.id);
  if ((count ?? 0) >= limits.maxProducts) {
    return {
      error: "Limite de produtos do plano Starter atingido. Faça upgrade para Pro.",
    };
  }

  const files = formData.getAll("photos") as File[];
  const realFiles = files.filter((f) => f && f.size > 0);
  if (realFiles.length > limits.maxPhotos) {
    return { error: `Seu plano permite no máximo ${limits.maxPhotos} fotos por produto.` };
  }

  let images: string[];
  try {
    images = await uploadPhotos(store.id, realFiles);
  } catch {
    return { error: "Falha no upload das fotos. Tente novamente." };
  }

  const { error } = await supabase.from("products").insert({
    store_id: store.id,
    name: parsed.data.name,
    price_cents: parsed.data.priceCents,
    description: parsed.data.description,
    category_id: parsed.data.categoryId,
    sizes: jsonArray<string>(formData, "sizes"),
    sold_sizes: jsonArray<string>(formData, "soldSizes"),
    colors: jsonArray<ProductColor>(formData, "colors"),
    images,
    stock: parsed.data.stock,
    is_active: formData.get("isActive") === "true",
    is_new: formData.get("isNew") === "true",
  });

  if (error) return { error: "Erro ao salvar o produto." };

  revalidatePath("/painel/produtos");
  redirect("/painel/produtos");
}

export async function updateProduct(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const parsed = parseFormProduct(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  const { data: current } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();
  if (!current) return { error: "Produto não encontrado." };

  const keptImages = jsonArray<string>(formData, "existing_images");
  const files = (formData.getAll("photos") as File[]).filter(
    (f) => f && f.size > 0
  );

  if (keptImages.length + files.length > limits.maxPhotos) {
    return { error: `Seu plano permite no máximo ${limits.maxPhotos} fotos por produto.` };
  }

  let uploaded: string[];
  try {
    uploaded = await uploadPhotos(store.id, files);
  } catch {
    return { error: "Falha no upload das fotos. Tente novamente." };
  }
  const images = [...keptImages, ...uploaded];

  const removed = (current.images as string[]).filter(
    (url) => !keptImages.includes(url)
  );
  if (removed.length > 0) {
    const paths = removed
      .map(publicUrlToPath)
      .filter((p): p is string => p !== null);
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      price_cents: parsed.data.priceCents,
      description: parsed.data.description,
      category_id: parsed.data.categoryId,
      sizes: jsonArray<string>(formData, "sizes"),
      sold_sizes: jsonArray<string>(formData, "soldSizes"),
      colors: jsonArray<ProductColor>(formData, "colors"),
      images,
      stock: parsed.data.stock,
      is_active: formData.get("isActive") === "true",
      is_new: formData.get("isNew") === "true",
    })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao atualizar o produto." };

  revalidatePath("/painel/produtos");
  redirect("/painel/produtos");
}

export async function deleteProduct(
  prevState: ToggleActionState,
  formData: FormData
): Promise<ToggleActionState> {
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { data: current } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (current?.images?.length) {
    const paths = (current.images as string[])
      .map(publicUrlToPath)
      .filter((p): p is string => p !== null);
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao excluir o produto." };

  revalidatePath("/painel/produtos");
  return { ok: true };
}

export async function toggleProductActive(
  prevState: ToggleActionState,
  formData: FormData
): Promise<ToggleActionState> {
  const id = formData.get("id");
  const next = formData.get("isActive") === "true";
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const { error } = await supabase
    .from("products")
    .update({ is_active: next })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao atualizar visibilidade." };

  revalidatePath("/painel/produtos");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/actions/produtos.ts
git commit -m "feat(actions): CRUD de produtos com upload e enforcement de plano"
```

---

## Task 9: Server Action — ajustes da loja (com logo)

**Files:**
- Create: `app/actions/store.ts`

- [ ] **Step 1: Implementar a action**

Crie `app/actions/store.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { storeSettingsSchema } from "@/lib/validation/painel";

const BUCKET = "product-images";

export type StoreActionState = { error: string } | { ok: true } | null;

export async function updateStoreSettings(
  prevState: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const parsed = storeSettingsSchema.safeParse({
    name: formData.get("name"),
    whatsapp: (formData.get("whatsapp") as string) || null,
    accentColor: formData.get("accentColor"),
    description: (formData.get("description") as string) || null,
    monogram: (formData.get("monogram") as string) || null,
    analyticsId: (formData.get("analyticsId") as string) || null,
    pixelId: (formData.get("pixelId") as string) || null,
    messageTemplate: (formData.get("messageTemplate") as string) || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let logoUrl = store.logoUrl;
  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const ext = logo.name.split(".").pop() || "png";
    const path = `${store.id}/logo/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, logo, { contentType: logo.type });
    if (upErr) return { error: "Falha no upload do logo." };
    logoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase
    .from("stores")
    .update({
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      accent_color: parsed.data.accentColor,
      description: parsed.data.description,
      monogram: parsed.data.monogram,
      analytics_id: parsed.data.analyticsId,
      pixel_id: parsed.data.pixelId,
      message_template: parsed.data.messageTemplate,
      logo_url: logoUrl,
    })
    .eq("id", store.id);

  if (error) return { error: "Erro ao salvar as configurações." };

  revalidatePath("/painel/configuracoes");
  revalidatePath("/painel");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/actions/store.ts
git commit -m "feat(actions): updateStoreSettings com upload de logo"
```

---

## Task 10: `next.config` — host de Storage

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Adicionar o remotePattern do Supabase**

`next/image` precisa autorizar o host das URLs públicas do Storage. Substitua o conteúdo de `next.config.ts`:

```ts
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "";

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https" as const,
        hostname: "images.unsplash.com",
      },
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verificar build de config**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore(next): autoriza host de Storage do Supabase em next/image"
```

---

## Task 11: Wiring do Dashboard

**Files:**
- Modify: `app/painel/page.tsx`
- Modify: `app/painel/use-dashboard.ts`
- Modify: `app/painel/DashboardClient.tsx`

- [ ] **Step 1: Server Component busca dados**

Substitua `app/painel/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const products = (data ?? []).map(mapProduct);
  const catalogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/catalogo/${store.slug}`;

  return (
    <DashboardClient
      products={products}
      storeName={store.name}
      catalogUrl={catalogUrl}
    />
  );
}
```

- [ ] **Step 2: Hook recebe dados por argumento**

Substitua `app/painel/use-dashboard.ts`:

```ts
"use client";

import { useState } from "react";
import type { StoreProduct } from "@/lib/types";

export function useDashboard(products: StoreProduct[], catalogUrl: string) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(catalogUrl).catch(() => {});
    setCopied(true);
    flash("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeProducts = products.filter((p) => p.isActive && p.stock > 0);
  const soldOutProducts = products.filter((p) => p.stock === 0);
  const recent = products.slice(0, 4);

  return {
    copied,
    toast,
    handleCopy,
    activeProducts,
    soldOutProducts,
    recent,
    total: products.length,
  };
}
```

- [ ] **Step 3: Client consome props**

Substitua `app/painel/DashboardClient.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { formatCents } from "@/lib/utils";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  catalogUrl: string;
}

export function DashboardClient({
  products,
  storeName,
  catalogUrl,
}: DashboardClientProps) {
  const { copied, toast, handleCopy, activeProducts, soldOutProducts, recent, total } =
    useDashboard(products, catalogUrl);

  return (
    <div className="flex flex-col gap-6 max-w-content">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Olá, {storeName}
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            Aqui está um resumo da sua loja hoje.
          </p>
        </div>
        <Link
          href="/painel/produtos/novo"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
        >
          <Plus size={18} />
          Cadastrar produto
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard value={activeProducts.length} label="Produtos ativos" />
        <StatCard
          value={soldOutProducts.length}
          label="Produtos esgotados"
          tone="soldout"
        />
        <StatCard value={total} label="Produtos no catálogo" />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Link do catálogo
            </div>
            <div className="font-display font-medium text-[18px] text-obsidian mt-1.5">
              {catalogUrl}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="ghost"
              iconLeft={<ExternalLink size={18} />}
              onClick={() => window.open(catalogUrl, "_blank")}
            >
              Abrir
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              iconLeft={
                copied ? <Check size={18} className="text-gold" /> : <Copy size={18} />
              }
            >
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="font-display font-medium text-[18px] text-obsidian">
            Produtos recentes
          </h2>
          <Link
            href="/painel/produtos"
            className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
          >
            Ver todos
          </Link>
        </div>
        <Card pad={0} className="overflow-hidden">
          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center font-body text-[15px] text-graphite">
              Nenhum produto cadastrado ainda.
            </div>
          ) : (
            recent.map((p, i) => (
              <Link
                key={p.id}
                href={`/painel/produtos/${p.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-linen/50 transition-colors"
                style={{ borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none" }}
              >
                <div className="relative w-12 h-12 rounded-[8px] overflow-hidden bg-linen flex-shrink-0">
                  {p.images[0] && (
                    <Image
                      src={p.images[0]}
                      alt={p.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-medium text-[15px] text-obsidian truncate">
                    {p.name}
                  </div>
                  <div className="font-body text-[13px] text-graphite mt-0.5">
                    {formatCents(p.priceCents)}
                  </div>
                </div>
                {p.stock === 0 ? (
                  <span className="inline-flex h-[22px] items-center px-2.5 rounded-pill bg-soldout text-white font-body font-medium text-[11px] tracking-[0.06em] uppercase">
                    Esgotado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-body text-[13px] text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    Ativo
                  </span>
                )}
              </Link>
            ))
          )}
        </Card>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}
```

- [ ] **Step 3b: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Verificação manual**

Run: `npm run dev` e acesse `/painel`.
Expected: dashboard carrega; contagens refletem o banco (zero produtos → "Nenhum produto cadastrado ainda"); botão "Copiar link" copia a URL com o slug real.

- [ ] **Step 5: Commit**

```bash
git add app/painel/page.tsx app/painel/use-dashboard.ts app/painel/DashboardClient.tsx
git commit -m "feat(painel): dashboard consome dados reais do banco"
```

---

## Task 12: Wiring da lista de Produtos

**Files:**
- Modify: `app/painel/produtos/page.tsx`
- Modify: `app/painel/produtos/use-produtos.ts`
- Modify: `app/painel/produtos/ProdutosClient.tsx`

- [ ] **Step 1: Server Component busca produtos + limite**

Substitua `app/painel/produtos/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import { ProdutosClient } from "./ProdutosClient";

export default async function ProdutosPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const products = (data ?? []).map(mapProduct);
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return (
    <ProdutosClient products={products} maxProducts={limits.maxProducts} />
  );
}
```

- [ ] **Step 2: Hook usa props como fonte e chama actions**

A lista é re-renderizada pelo `revalidatePath`, então a fonte de verdade é a prop — sem `useState` de produtos. `useTransition` cobre o estado pendente.

Substitua `app/painel/produtos/use-produtos.ts`:

```ts
"use client";

import { useState, useTransition } from "react";
import {
  toggleProductActive,
  deleteProduct,
} from "@/app/actions/produtos";
import type { StoreProduct, ToastState } from "@/lib/types";

export function useProdutos(products: StoreProduct[], maxProducts: number) {
  const [confirm, setConfirm] = useState<StoreProduct | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const active = products.filter((p) => p.isActive && p.stock > 0).length;
  const soldOut = products.filter((p) => p.stock === 0).length;
  const inactive = products.filter((p) => !p.isActive).length;
  const limitReached = products.length >= maxProducts;

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
      if (res && "error" in res) flash(res.error, "error");
      else flash("Produto excluído", "error");
      setConfirm(null);
    });
  };

  return {
    products,
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
  };
}
```

- [ ] **Step 3: Client recebe props + limite**

Substitua `app/painel/produtos/ProdutosClient.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { cn, formatCents } from "@/lib/utils";
import type { StoreProduct } from "@/lib/types";
import { useProdutos } from "./use-produtos";

interface ProdutosClientProps {
  products: StoreProduct[];
  maxProducts: number;
}

export function ProdutosClient({ products, maxProducts }: ProdutosClientProps) {
  const {
    confirm,
    setConfirm,
    toast,
    active,
    soldOut,
    inactive,
    limitReached,
    toggleActive,
    removeProduct,
  } = useProdutos(products, maxProducts);

  return (
    <div className="flex flex-col gap-6 max-w-content">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Produtos
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            {products.length}{" "}
            {products.length === 1 ? "produto cadastrado" : "produtos cadastrados"}
            {Number.isFinite(maxProducts) ? ` · limite ${maxProducts}` : ""}
          </p>
        </div>
        {limitReached ? (
          <span className="inline-flex items-center h-11 px-6 rounded-btn bg-linen text-graphite font-display font-medium text-[15px] cursor-not-allowed">
            Limite atingido — faça upgrade
          </span>
        ) : (
          <Link
            href="/painel/produtos/novo"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
          >
            <Plus size={18} />
            Novo produto
          </Link>
        )}
      </div>

      {products.length === 0 ? (
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
              className="inline-flex items-center gap-2 h-11 px-6 rounded-btn bg-gold text-white font-display font-medium text-[15px] hover:bg-gold-hover transition-colors"
            >
              <Plus size={18} />
              Cadastrar primeiro produto →
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <Card className="bg-linen">
            <div className="flex items-center gap-10 flex-wrap">
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

          <Card pad={0} className="overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3 bg-linen">
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
                  className="flex items-center gap-4 px-5 py-3.5"
                  style={{
                    borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="relative w-[52px] h-16 rounded-[8px] overflow-hidden bg-linen flex-shrink-0"
                      style={{ opacity: p.isActive ? 1 : 0.5 }}
                    >
                      {p.images[0] && (
                        <Image
                          src={p.images[0]}
                          alt={p.name}
                          fill
                          sizes="52px"
                          className="object-cover"
                        />
                      )}
                    </div>
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
                    <span className={cn("font-body text-[13px]", stockTone)}>
                      {isSoldOut ? "Esgotado" : `${p.stock} em estoque`}
                    </span>
                  </div>

                  <div className="w-[140px] flex-shrink-0 flex items-center gap-2.5">
                    <Switch
                      checked={p.isActive}
                      onChange={() => toggleActive(p)}
                    />
                    <span
                      className={cn(
                        "font-body text-[13px]",
                        p.isActive ? "text-success" : "text-inactive"
                      )}
                    >
                      {p.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="flex gap-1 flex-shrink-0 w-[76px]">
                    <Link
                      href={`/painel/produtos/${p.id}`}
                      aria-label="Editar"
                      className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => setConfirm(p)}
                      aria-label="Excluir"
                      className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
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
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              onClick={() => removeProduct(confirm.id)}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Acesse `/painel/produtos`. Expected: lista reflete o banco; toggle de visibilidade persiste após reload; excluir remove a linha. Com 0 produtos aparece o estado vazio.

- [ ] **Step 6: Commit**

```bash
git add app/painel/produtos/page.tsx app/painel/produtos/use-produtos.ts app/painel/produtos/ProdutosClient.tsx
git commit -m "feat(painel): lista de produtos real com toggle/delete e badge de limite"
```

---

## Task 13: Wiring do formulário de Produto

**Files:**
- Modify: `app/painel/produtos/[id]/page.tsx`
- Modify: `app/painel/produtos/novo/page.tsx`
- Modify: `app/painel/produtos/use-produto-form.ts`
- Modify: `app/painel/produtos/ProdutoFormClient.tsx`

- [ ] **Step 1: Page de edição busca produto + categorias**

Substitua `app/painel/produtos/[id]/page.tsx` (remove `generateStaticParams` — agora é dinâmico):

```tsx
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import type { StoreCategory } from "@/lib/types";
import { ProdutoFormClient } from "../ProdutoFormClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditarProdutoPage({ params }: Props) {
  const { id } = await params;
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new"
    )
    .eq("id", id)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!product) notFound();

  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("store_id", store.id)
    .order("position", { ascending: true });

  const categories: StoreCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    productCount: 0,
  }));

  return (
    <ProdutoFormClient product={mapProduct(product)} categories={categories} />
  );
}
```

- [ ] **Step 2: Page de criação busca categorias + limite de fotos**

Substitua `app/painel/produtos/novo/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import type { StoreCategory } from "@/lib/types";
import { ProdutoFormClient } from "../ProdutoFormClient";

export const metadata = {
  title: "Novo produto — Painel",
};

export default async function NovoProdutoPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("store_id", store.id)
    .order("position", { ascending: true });

  const categories: StoreCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    productCount: 0,
  }));

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return <ProdutoFormClient categories={categories} maxPhotos={limits.maxPhotos} />;
}
```

- [ ] **Step 3: Hook usa `useActionState` + estado de fotos/variações**

Substitua `app/painel/produtos/use-produto-form.ts`. O hook gerencia: fotos existentes (URLs) e novas (`File`), variações, cores, categoria selecionada e criação inline de categoria. As fotos novas são guardadas em estado e anexadas ao `FormData` no submit (via `action` wrapper).

```ts
"use client";

import { useActionState, useState } from "react";
import { createProduct, updateProduct } from "@/app/actions/produtos";
import { createCategory } from "@/app/actions/categorias";
import { formatCents } from "@/lib/utils";
import type { StoreProduct, StoreCategory, ProductColor } from "@/lib/types";

type FormState = { error: string } | null;

export function useProdutoForm(
  categories: StoreCategory[],
  maxPhotos: number,
  product?: StoreProduct
) {
  const editing = !!product;
  const boundAction = editing ? updateProduct : createProduct;

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      if (editing && product) formData.set("id", product.id);
      formData.set("existing_images", JSON.stringify(existingPhotos));
      newPhotos.forEach((f) => formData.append("photos", f));
      formData.set("sizes", JSON.stringify(sizes));
      formData.set("soldSizes", JSON.stringify(soldSizes));
      formData.set("colors", JSON.stringify(colors));
      formData.set("categoryId", category);
      formData.set("isActive", String(visible));
      formData.set("isNew", String(isNew));
      return boundAction(prev, formData);
    },
    null
  );

  const [existingPhotos, setExistingPhotos] = useState<string[]>(
    product?.images ?? []
  );
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? ["PP", "P", "M", "G"]);
  const [soldSizes, setSoldSizes] = useState<string[]>(product?.soldSizes ?? []);
  const [colors, setColors] = useState<ProductColor[]>(product?.colors ?? []);
  const [category, setCategory] = useState(product?.categoryId ?? "");
  const [catList, setCatList] = useState<StoreCategory[]>(categories);
  const [visible, setVisible] = useState(product?.isActive ?? true);
  const [isNew, setIsNew] = useState(product?.isNew ?? false);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(
    null
  );
  const [deleteModal, setDeleteModal] = useState(false);
  const [quickCat, setQuickCat] = useState(false);
  const [catDraft, setCatDraft] = useState("");

  const totalPhotos = existingPhotos.length + newPhotos.length;
  const photosFull = totalPhotos >= maxPhotos;

  const flash = (msg: string, tone: "success" | "error" = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const room = maxPhotos - totalPhotos;
    if (room <= 0) {
      flash(`Seu plano permite no máximo ${maxPhotos} fotos`, "error");
      return;
    }
    setNewPhotos((prev) => [...prev, ...Array.from(files).slice(0, room)]);
  };

  const removeExisting = (url: string) =>
    setExistingPhotos((prev) => prev.filter((u) => u !== url));
  const removeNew = (idx: number) =>
    setNewPhotos((prev) => prev.filter((_, i) => i !== idx));

  const createCat = async () => {
    const v = catDraft.trim();
    if (!v) return;
    if (catList.some((c) => c.name === v)) {
      flash("Essa categoria já existe", "error");
      setQuickCat(false);
      setCatDraft("");
      return;
    }
    const fd = new FormData();
    fd.set("name", v);
    const res = await createCategory(null, fd);
    if (res && "error" in res) {
      flash(res.error, "error");
      return;
    }
    setCatList((prev) => [
      ...prev,
      { id: v, name: v, position: prev.length, productCount: 0 },
    ]);
    setCategory(v);
    setQuickCat(false);
    setCatDraft("");
    flash("Categoria criada");
  };

  const priceDefault = product ? formatCents(product.priceCents).replace("R$ ", "") : "";

  return {
    editing,
    state,
    formAction,
    pending,
    existingPhotos,
    newPhotos,
    photosFull,
    addPhotos,
    removeExisting,
    removeNew,
    sizes,
    setSizes,
    soldSizes,
    setSoldSizes,
    colors,
    setColors,
    category,
    setCategory,
    catList,
    visible,
    setVisible,
    isNew,
    setIsNew,
    toast,
    deleteModal,
    setDeleteModal,
    quickCat,
    setQuickCat,
    catDraft,
    setCatDraft,
    priceDefault,
    createCat,
  };
}
```

> **Nota de execução:** após criar uma categoria inline, a opção é adicionada localmente com `id = name` para uso imediato; o `revalidatePath` da action re-busca a lista canônica no próximo render do Server Component. Como o `category_id` é resolvido por nome no submit (ver Step 4), isso é seguro — mas se preferir robustez total, recarregue a página após criar categoria. Mantemos o fluxo inline conforme a spec.

**Importante (correção de contrato):** o `categoryId` enviado precisa ser um UUID válido (a coluna é `uuid`). Como a criação inline ainda não tem o UUID real, o submit deve mapear o nome selecionado para o `id` da `catList`. Ajuste o wrapper do `useActionState` para resolver o id:

Substitua a linha `formData.set("categoryId", category);` por:

```ts
      const selected = catList.find((c) => c.id === category || c.name === category);
      formData.set("categoryId", selected && selected.id !== selected.name ? selected.id : "");
```

> Se a categoria recém-criada (id == name, sem UUID) estiver selecionada, envia vazio (sem categoria) — evita erro de UUID. O lojista re-seleciona a categoria após o reload, quando o UUID real já está disponível. Documente esse comportamento como aceitável nesta rodada.

- [ ] **Step 4: Reescrever o ProdutoFormClient como `<form action>`**

Substitua `app/painel/produtos/ProdutoFormClient.tsx`. Mudanças-chave: recebe `categories` e `maxPhotos`; envolve tudo em `<form action={formAction}>`; inputs com `name=`; uploader usa `<input type="file">`; cores/tamanhos via estado; botão salvar é `type="submit"`.

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Upload, Star, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ToggleRow } from "@/components/ui/Switch";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { FASHION_COLORS } from "@/lib/data";
import type { StoreProduct, StoreCategory } from "@/lib/types";
import { useProdutoForm } from "./use-produto-form";

interface ProdutoFormClientProps {
  product?: StoreProduct;
  categories: StoreCategory[];
  maxPhotos?: number;
}

export function ProdutoFormClient({
  product,
  categories,
  maxPhotos = 5,
}: ProdutoFormClientProps) {
  const f = useProdutoForm(categories, maxPhotos, product);

  return (
    <form action={f.formAction} className="max-w-form flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link
          href="/painel/produtos"
          className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
        >
          ← Produtos
        </Link>
      </div>

      <h1 className="font-display font-semibold text-[28px] text-obsidian">
        {f.editing ? "Editar produto" : "Novo produto"}
      </h1>

      {/* Fotos */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Fotos{" "}
          <span className="text-graphite font-normal">
            · mínimo 1, máximo {maxPhotos}
          </span>
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {f.existingPhotos.map((src, i) => (
            <div
              key={src}
              className="relative aspect-square rounded-[12px] overflow-hidden border border-sand/50"
            >
              <Image src={src} alt="" fill sizes="20vw" className="object-cover" />
              {i === 0 && (
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 h-[22px] px-2 rounded-pill bg-obsidian/80 text-white font-body font-medium text-[10px] tracking-[0.06em] uppercase">
                  <Star size={9} fill="currentColor" /> Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => f.removeExisting(src)}
                aria-label="Remover foto"
                className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full bg-white/90 text-obsidian flex items-center justify-center hover:bg-white transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {f.newPhotos.map((file, i) => (
            <div
              key={`new-${i}`}
              className="relative aspect-square rounded-[12px] overflow-hidden border border-sand/50"
            >
              <Image
                src={URL.createObjectURL(file)}
                alt=""
                fill
                sizes="20vw"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => f.removeNew(i)}
                aria-label="Remover foto"
                className="absolute top-2 right-2 w-[26px] h-[26px] rounded-full bg-white/90 text-obsidian flex items-center justify-center hover:bg-white transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!f.photosFull && (
            <label className="aspect-square rounded-[12px] border-[1.5px] border-dashed border-sand bg-linen flex flex-col items-center justify-center gap-1.5 text-graphite hover:bg-surface-hover transition-colors cursor-pointer">
              <Upload size={22} />
              <span className="font-body text-[12px]">Adicionar</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => f.addPhotos(e.target.files)}
              />
            </label>
          )}
        </div>
      </Card>

      {/* Informações */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Informações
        </h2>
        <div className="grid grid-cols-2 gap-[18px]">
          <div className="col-span-2">
            <Input
              name="name"
              label="Nome do produto"
              defaultValue={product?.name ?? ""}
              placeholder="Ex: Vestido midi linho"
            />
          </div>
          <div className="col-span-2">
            <Textarea
              name="description"
              label="Descrição"
              rows={3}
              defaultValue={product?.description ?? ""}
              placeholder="Conte sobre o caimento, tecido e cuidados…"
            />
          </div>
          <Input
            name="price"
            label="Preço"
            prefix="R$"
            defaultValue={f.priceDefault}
            placeholder="0,00"
          />
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-medium text-[13px] text-obsidian">
              Categoria
            </label>
            <Select
              value={
                f.catList.find((c) => c.id === f.category)?.name ?? f.category
              }
              placeholder="Selecione uma categoria"
              options={f.catList.map((c) => c.name)}
              onChange={(name) => {
                const found = f.catList.find((c) => c.name === name);
                f.setCategory(found ? found.id : name);
              }}
              footer={{
                label: "Nova categoria",
                onClick: () => {
                  f.setCatDraft("");
                  f.setQuickCat(true);
                },
              }}
            />
          </div>
        </div>
      </Card>

      {/* Variações */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Variações
        </h2>
        <ChipEditor title="Tamanhos" items={f.sizes} setItems={f.setSizes} />
        <ColorEditor selected={f.colors} setSelected={f.setColors} />
      </Card>

      {/* Estoque */}
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Estoque & visibilidade
        </h2>
        <div className="grid grid-cols-2 gap-[18px] pb-2">
          <Input
            name="stock"
            label="Quantidade em estoque"
            type="number"
            defaultValue={product?.stock?.toString() ?? "0"}
          />
        </div>
        <ToggleRow
          label="Marcar como novidade"
          desc="Mostra o selo Novo no catálogo"
          checked={f.isNew}
          onChange={f.setIsNew}
          accent
        />
        <ToggleRow
          label="Visível no catálogo"
          desc="Produtos inativos não aparecem para o cliente"
          checked={f.visible}
          onChange={f.setVisible}
        />
      </Card>

      <div className="flex justify-between gap-3 pb-6">
        {f.editing ? (
          <Button
            type="button"
            variant="destructive"
            iconLeft={<Trash2 size={18} />}
            onClick={() => f.setDeleteModal(true)}
          >
            Excluir produto
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={f.pending}>
            {f.pending ? "Salvando…" : "Salvar produto"}
          </Button>
        </div>
      </div>

      {f.state?.error && (
        <Toast msg={f.state.error} tone="error" />
      )}

      {f.editing && f.deleteModal && (
        <DeleteProductModal
          productId={product!.id}
          onClose={() => f.setDeleteModal(false)}
        />
      )}

      {f.quickCat && (
        <Modal title="Nova categoria" onClose={() => f.setQuickCat(false)}>
          <div className="flex flex-col gap-1.5">
            <label className="font-body font-medium text-[13px] text-obsidian">
              Nome da categoria
            </label>
            <input
              autoFocus
              value={f.catDraft}
              onChange={(e) => f.setCatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  f.createCat();
                }
                if (e.key === "Escape") f.setQuickCat(false);
              }}
              placeholder="Ex: Acessórios"
              className="h-11 w-full rounded-input border border-sand bg-white px-4 font-body text-[15px] text-obsidian outline-none focus:border-obsidian transition-colors"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => f.setQuickCat(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={() => f.createCat()}>
              Criar categoria
            </Button>
          </div>
        </Modal>
      )}

      {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
    </form>
  );
}

/* ─── Chip editor (tamanhos) ─── */
function ChipEditor({
  title,
  items,
  setItems,
}: {
  title: string;
  items: string[];
  setItems: (items: string[]) => void;
}) {
  return (
    <div className="py-1 pb-4">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-pill bg-linen border border-sand font-body text-[13px] text-obsidian"
          >
            {it}
            <button
              type="button"
              onClick={() => setItems(items.filter((x) => x !== it))}
              aria-label={`Remover ${it}`}
              className="w-5 h-5 rounded-full text-graphite hover:text-obsidian flex items-center justify-center transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <ChipInput onAdd={(v) => !items.includes(v) && setItems([...items, v])} />
      </div>
    </div>
  );
}

function ChipInput({ onAdd }: { onAdd: (v: string) => void }) {
  return (
    <input
      placeholder="Novo…"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const v = (e.target as HTMLInputElement).value.trim();
          if (v) {
            onAdd(v);
            (e.target as HTMLInputElement).value = "";
          }
        }
      }}
      className="w-24 h-8 px-3 rounded-pill border border-sand bg-white font-body text-[13px] text-obsidian outline-none focus:border-obsidian"
    />
  );
}

/* ─── Color editor ─── */
function ColorEditor({
  selected,
  setSelected,
}: {
  selected: { label: string; hex: string }[];
  setSelected: (s: { label: string; hex: string }[]) => void;
}) {
  const toggle = (label: string, hex: string) => {
    const exists = selected.some((c) => c.label === label);
    setSelected(
      exists ? selected.filter((c) => c.label !== label) : [...selected, { label, hex }]
    );
  };
  return (
    <div className="py-1.5 pb-4">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">Cores</div>
      <div className="flex flex-wrap gap-3">
        {FASHION_COLORS.map((c) => {
          const isSel = selected.some((s) => s.label === c.name);
          return (
            <button
              key={c.name}
              type="button"
              onClick={() => toggle(c.name, c.hex)}
              aria-label={c.name}
              title={c.name}
              className="w-9 h-9 rounded-full transition-all duration-200"
              style={{
                background: c.hex,
                border: isSel
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
                outline: isSel ? "2px solid #fff" : "none",
                outlineOffset: isSel ? "-4px" : "0",
                boxSizing: "border-box",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Modal de exclusão (form action) ─── */
function DeleteProductModal({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  return (
    <Modal title="Excluir produto" onClose={onClose}>
      <p className="font-body text-[15px] text-graphite leading-relaxed">
        Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita.
      </p>
      <form
        action={async () => {
          const { deleteProduct } = await import("@/app/actions/produtos");
          const { useRouter } = await import("next/navigation");
          void useRouter;
        }}
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <DeleteSubmit productId={productId} />
      </div>
    </Modal>
  );
}

function DeleteSubmit({ productId }: { productId: string }) {
  return (
    <form
      action={async () => {
        "use server";
      }}
    >
      <input type="hidden" name="id" value={productId} />
      <button type="submit" className="hidden" />
    </form>
  );
}
```

> **Correção obrigatória do modal de exclusão:** o esboço acima de `DeleteProductModal`/`DeleteSubmit` é inválido (não se pode declarar `"use server"` inline num client component, nem importar action dinamicamente assim). Implemente o botão de exclusão como um client handler que chama a action e navega:

Substitua os dois componentes `DeleteProductModal` e `DeleteSubmit` por:

```tsx
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProduct } from "@/app/actions/produtos";

function DeleteProductModal({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const handleDelete = () =>
    start(async () => {
      const fd = new FormData();
      fd.set("id", productId);
      const res = await deleteProduct(null, fd);
      if (res && "error" in res) return;
      router.push("/painel/produtos");
    });

  return (
    <Modal title="Excluir produto" onClose={onClose}>
      <p className="font-body text-[15px] text-graphite leading-relaxed">
        Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita.
      </p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="destructive"
          iconLeft={<Trash2 size={18} />}
          disabled={pending}
          onClick={handleDelete}
        >
          {pending ? "Excluindo…" : "Excluir"}
        </Button>
      </div>
    </Modal>
  );
}
```

E adicione no topo do arquivo os imports `useRouter`, `useTransition` e `deleteProduct` (a `Trash2` já está importada). Remova `DeleteSubmit`.

- [ ] **Step 5: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros. (Se `Select`/`Input`/`Textarea` não aceitarem `name`, ajuste-os — ver nota abaixo.)

> **Nota:** os componentes `Input`/`Textarea`/`Select` em `components/ui/` precisam repassar `name` ao `<input>/<textarea>` nativo e (no caso do `Select`) renderizar um `<input type="hidden" name=...>` com o valor, para que entrem no `FormData`. Verifique e, se necessário, adicione o prop `name`. Como `category`, `sizes`, `soldSizes`, `colors`, `isActive`, `isNew`, `existing_images` e `photos` já são injetados pelo wrapper do hook, só `name`, `description`, `price` e `stock` precisam vir de inputs nativos com `name`.

- [ ] **Step 6: Verificação manual — criar produto**

Acesse `/painel/produtos/novo`, preencha nome, preço `289,90`, estoque, selecione fotos, salve.
Expected: redireciona para `/painel/produtos` com o produto novo na lista, foto exibida, preço `R$ 289,90`.

- [ ] **Step 7: Verificação manual — editar e excluir**

Edite o produto (troque uma foto, salve) e depois exclua.
Expected: edição persiste; foto antiga some do Storage; exclusão remove da lista.

- [ ] **Step 8: Commit**

```bash
git add app/painel/produtos
git commit -m "feat(painel): formulário de produto real com upload e categorias"
```

---

## Task 14: Wiring de Categorias

**Files:**
- Modify: `app/painel/categorias/page.tsx`
- Modify: `app/painel/categorias/use-categorias.ts`
- Modify: `app/painel/categorias/CategoriasClient.tsx`

- [ ] **Step 1: Server Component busca categorias + contagem**

Substitua `app/painel/categorias/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
import type { StoreCategory } from "@/lib/types";
import { CategoriasClient } from "./CategoriasClient";

export default async function CategoriasPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("categories")
    .select("id, name, position")
    .eq("store_id", store.id)
    .order("position", { ascending: true });

  const { data: products } = await supabase
    .from("products")
    .select("category_id")
    .eq("store_id", store.id);

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.category_id)
      counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }

  const categories: StoreCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    position: c.position,
    productCount: counts.get(c.id) ?? 0,
  }));

  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));

  return (
    <CategoriasClient
      categories={categories}
      maxCategories={limits.maxCategories}
    />
  );
}
```

- [ ] **Step 2: Hook usa props + actions**

Substitua `app/painel/categorias/use-categorias.ts`:

```ts
"use client";

import { useState, useTransition } from "react";
import {
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/app/actions/categorias";
import type { StoreCategory, ToastState } from "@/lib/types";

export function useCategorias(
  categories: StoreCategory[],
  maxCategories: number
) {
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoreCategory | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [, startTransition] = useTransition();

  const limitReached = categories.length >= maxCategories;

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const create = () => {
    const v = createDraft.trim();
    if (!v) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", v);
      const res = await createCategory(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
        return;
      }
      setCreateDraft("");
      setCreating(false);
      flash("Categoria criada");
    });
  };

  const save = (cat: StoreCategory) => {
    const v = editDraft.trim();
    if (!v) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", cat.id);
      fd.set("name", v);
      const res = await renameCategory(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
        return;
      }
      setEditingCat(null);
      flash("Categoria atualizada");
    });
  };

  const remove = (cat: StoreCategory) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", cat.id);
      const res = await deleteCategory(null, fd);
      if (res && "error" in res) {
        flash(res.error, "error");
        setDeleteTarget(null);
        return;
      }
      setDeleteTarget(null);
      flash("Categoria excluída", "error");
    });
  };

  return {
    categories,
    limitReached,
    creating,
    setCreating,
    createDraft,
    setCreateDraft,
    editingCat,
    setEditingCat,
    editDraft,
    setEditDraft,
    deleteTarget,
    setDeleteTarget,
    toast,
    create,
    save,
    remove,
  };
}
```

- [ ] **Step 3: Client recebe props**

Substitua `app/painel/categorias/CategoriasClient.tsx`. Mudanças: tipa por `StoreCategory`; `countFor` vira `cat.productCount`; botão "Nova categoria" desabilita quando `limitReached`; delete bloqueia quando `productCount > 0`.

```tsx
"use client";

import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import type { StoreCategory } from "@/lib/types";
import { useCategorias } from "./use-categorias";

interface CategoriasClientProps {
  categories: StoreCategory[];
  maxCategories: number;
}

export function CategoriasClient({
  categories,
  maxCategories,
}: CategoriasClientProps) {
  const {
    limitReached,
    creating,
    setCreating,
    createDraft,
    setCreateDraft,
    editingCat,
    setEditingCat,
    editDraft,
    setEditDraft,
    deleteTarget,
    setDeleteTarget,
    toast,
    create,
    save,
    remove,
  } = useCategorias(categories, maxCategories);

  return (
    <div className="max-w-form flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Categorias
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            Organize as peças do seu catálogo.
          </p>
        </div>
        {!creating &&
          (limitReached ? (
            <span className="font-body text-[13px] text-graphite">
              Limite de {maxCategories} atingido — faça upgrade
            </span>
          ) : (
            <Button
              variant="primary"
              iconLeft={<Plus size={18} />}
              onClick={() => setCreating(true)}
            >
              Nova categoria
            </Button>
          ))}
      </div>

      <Card pad={0} className="overflow-hidden">
        {creating && (
          <div className="flex items-center gap-2.5 px-5 py-3.5 bg-linen border-b border-sand/50">
            <input
              autoFocus
              value={createDraft}
              onChange={(e) => setCreateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") {
                  setCreateDraft("");
                  setCreating(false);
                }
              }}
              placeholder="Nome da categoria"
              className="flex-1 h-11 px-4 rounded-input bg-white font-body text-[15px] text-obsidian outline-none"
              style={{ border: "1px solid var(--color-primary)" }}
            />
            <Button variant="primary" onClick={create}>
              Salvar
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setCreateDraft("");
                setCreating(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        )}

        {categories.length === 0 && !creating ? (
          <div className="px-5 py-10 text-center font-body text-[15px] text-graphite">
            Nenhuma categoria ainda. Crie a primeira acima.
          </div>
        ) : (
          categories.map((cat, i) =>
            editingCat === cat.id ? (
              <div
                key={cat.id}
                className="flex items-center gap-2.5 px-5 py-3.5"
                style={{ borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none" }}
              >
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(cat);
                    if (e.key === "Escape") setEditingCat(null);
                  }}
                  className="flex-1 h-10 px-3.5 rounded-input bg-white font-body text-[15px] text-obsidian outline-none"
                  style={{ border: "1px solid var(--color-primary)" }}
                />
                <Button variant="primary" size="sm" onClick={() => save(cat)}>
                  Salvar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingCat(null)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div
                key={cat.id}
                className="flex items-center gap-4 px-5 py-3.5"
                style={{ borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none" }}
              >
                <div className="w-9 h-9 rounded-[8px] bg-linen flex items-center justify-center text-graphite flex-shrink-0">
                  <Layers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-medium text-[15px] text-obsidian">
                    {cat.name}
                  </div>
                  <div className="font-body text-[13px] text-graphite mt-0.5">
                    {cat.productCount}{" "}
                    {cat.productCount === 1 ? "produto" : "produtos"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditDraft(cat.name);
                      setEditingCat(cat.id);
                    }}
                    aria-label="Editar"
                    className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    disabled={cat.productCount > 0}
                    aria-label="Excluir"
                    className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          )
        )}
      </Card>

      {deleteTarget && (
        <Modal title="Excluir categoria" onClose={() => setDeleteTarget(null)}>
          <p className="font-body text-[15px] text-graphite leading-relaxed">
            Tem certeza que deseja excluir{" "}
            <strong className="text-obsidian font-semibold">
              {deleteTarget.name}
            </strong>
            ?
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              iconLeft={<Trash2 size={18} />}
              onClick={() => remove(deleteTarget)}
            >
              Excluir
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Acesse `/painel/categorias`. Crie, renomeie e tente excluir uma categoria com produtos (botão desabilitado) e uma vazia (exclui).
Expected: cada operação persiste após reload; contagem por categoria correta.

- [ ] **Step 6: Commit**

```bash
git add app/painel/categorias
git commit -m "feat(painel): categorias reais com contagem, limite e guard de exclusão"
```

---

## Task 15: Wiring de Configurações

**Files:**
- Modify: `app/painel/configuracoes/page.tsx`
- Modify: `app/painel/configuracoes/use-configuracoes.ts`
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`

- [ ] **Step 1: Server Component busca settings**

Substitua `app/painel/configuracoes/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { ConfiguracoesClient } from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  return <ConfiguracoesClient settings={store} />;
}
```

- [ ] **Step 2: Hook usa `useActionState` + settings iniciais**

Substitua `app/painel/configuracoes/use-configuracoes.ts`:

```ts
"use client";

import { useActionState, useState, useRef } from "react";
import { updateStoreSettings } from "@/app/actions/store";
import type { StoreSettings, ToastState } from "@/lib/types";

export const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export const MSG_VARS = [
  { token: "{saudacao}", desc: "saudação inicial" },
  { token: "{itens}", desc: "lista de itens da sacola" },
  { token: "{total}", desc: "valor total do pedido" },
];

type State = { error: string } | { ok: true } | null;

export function useConfiguracoes(settings: StoreSettings) {
  const [accent, setAccent] = useState(settings.accentColor);
  const [msgTpl, setMsgTpl] = useState(settings.messageTemplate ?? MSG_DEFAULT);
  const [logo, setLogo] = useState<File | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("accentColor", accent);
      formData.set("messageTemplate", msgTpl);
      if (logo) formData.set("logo", logo);
      const res = await updateStoreSettings(prev, formData);
      if (res && "ok" in res) flash("Configurações salvas");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const insertToken = (token: string) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : msgTpl.length;
    const end = el ? el.selectionEnd : msgTpl.length;
    const next = msgTpl.slice(0, start) + token + msgTpl.slice(end);
    setMsgTpl(next);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const resetTemplate = () => {
    setMsgTpl(MSG_DEFAULT);
    flash("Mensagem restaurada");
  };

  return {
    settings,
    accent,
    setAccent,
    msgTpl,
    setMsgTpl,
    logo,
    setLogo,
    state,
    formAction,
    pending,
    toast,
    textareaRef,
    insertToken,
    resetTemplate,
  };
}
```

- [ ] **Step 3: Client vira `<form action>` e consome settings**

Substitua o componente em `app/painel/configuracoes/ConfiguracoesClient.tsx`. Mantenha os helpers `MSG_MOCK`, `renderTemplate`, `WhatsPreviewText` no topo. Mudanças: recebe `settings`; o conteúdo do form vira `<form action={f.formAction}>`; inputs ganham `name=` (`name`, `whatsapp`, `monogram`, `description`, `analyticsId`, `pixelId`); o logo via `<input type="file">`; `accentColor` e `messageTemplate` são injetados pelo wrapper do hook; botão salvar é `type="submit"`.

Pontos de edição obrigatórios (aplicar sobre o arquivo atual):

1. Trocar a assinatura e o import:

```tsx
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";
import type { StoreSettings } from "@/lib/types";
// remover: import { STORE, ACCENT_COLOR_OPTIONS } from "@/lib/data";
import { ACCENT_COLOR_OPTIONS } from "@/lib/data";

export function ConfiguracoesClient({ settings }: { settings: StoreSettings }) {
  const f = useConfiguracoes(settings);
```

2. Envolver o conteúdo retornado em `<form action={f.formAction}>` no lugar da `<div ...>` raiz (mantendo as classes na `<form>`), e fechar com `</form>`.

3. Substituir referências a `STORE.*` por `settings.*` e o monograma:

```tsx
{settings.monogram ?? settings.name.slice(0, 2).toUpperCase()}
```

4. Logo uploader — trocar o `<Button>Enviar logo</Button>` por:

```tsx
<label className="inline-flex items-center gap-2 h-11 px-5 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] cursor-pointer hover:bg-surface-hover transition-colors">
  <Upload size={18} />
  {f.logo ? f.logo.name : "Enviar logo"}
  <input
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) => f.setLogo(e.target.files?.[0] ?? null)}
  />
</label>
```

5. Inputs com `name` e `defaultValue` vindos de `settings`:

```tsx
<Input name="name" label="Nome da loja" defaultValue={settings.name} />
<Input
  name="whatsapp"
  label="WhatsApp para pedidos"
  prefix="+55"
  defaultValue={settings.whatsapp ?? ""}
/>
```

E, de forma análoga, `name="monogram"`, `name="description"`, `name="analyticsId"`, `name="pixelId"` nos campos correspondentes (use `settings.*` como `defaultValue`, com `?? ""`).

6. O seletor de cor de destaque controla `f.accent`/`f.setAccent` (já injetado no submit). O `<textarea>` do template usa `ref={f.textareaRef}`, `value={f.msgTpl}` e `onChange={(e) => f.setMsgTpl(e.target.value)}`.

7. Botão salvar:

```tsx
<Button type="submit" variant="primary" disabled={f.pending}>
  {f.pending ? "Salvando…" : "Salvar configurações"}
</Button>
```

8. No fim, render do toast: `{f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}`.

- [ ] **Step 4: Verificar tipo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual**

Acesse `/painel/configuracoes`. Altere nome, WhatsApp, cor de destaque, template e envie um logo. Salve e recarregue.
Expected: tudo persiste; logo aparece; o banner/preview reflete os novos valores.

- [ ] **Step 6: Commit**

```bash
git add app/painel/configuracoes
git commit -m "feat(painel): configurações reais com upload de logo e template"
```

---

## Task 16: Verificação final

**Files:** nenhum (verificação)

- [ ] **Step 1: Rodar toda a suíte de testes**

Run: `npx vitest run`
Expected: todos os testes verdes (inclui os novos: plan-limits, utils, painel-validation).

- [ ] **Step 2: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: sem erros. (`lib/data.ts` segue importado só pelo catálogo — sem imports residuais no painel.)

- [ ] **Step 4: Confirmar que o painel não importa mais `lib/data` para dados**

Run: `grep -rn "lib/data" app/painel`
Expected: apenas `FASHION_COLORS`/`ACCENT_COLOR_OPTIONS` (constantes de UI) — nenhuma referência a `PRODUCTS`, `STORE` ou `getProductById`.

- [ ] **Step 5: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 6: Smoke manual end-to-end**

Com `npm run dev`: criar categoria → criar produto com foto → ver no dashboard e na lista → editar → alternar visibilidade → excluir produto → excluir categoria → salvar configurações.
Expected: cada passo persiste após reload.

- [ ] **Step 7: Commit final (se houver ajustes)**

```bash
git add -A
git commit -m "chore(painel): ajustes finais da rodada de backend (3.2)"
```

---

## Self-review notes

- **Cobertura da spec:** schema/RLS/storage (Task 1) ✓; camada de leitura via Server Components (Tasks 11–15) ✓; Server Actions em `app/actions/` (Tasks 7–9) ✓; upload múltiplo (Task 8/13) ✓; limites de plano servidor+UI (Tasks 3, 8, 12, 13, 14) ✓; helper `getCurrentStore` (Task 6) ✓; `getPlanLimits` (Task 3) ✓; tipos (Task 2) ✓; testes Vitest puros — plan-limits, preço↔cents, guard, schemas (Tasks 3, 4, 5) ✓; caso de borda do trial→starter (enforcement só impede novas criações, sem remoção forçada — implementado nas checagens de `count >= max`) ✓.
- **Desvios conscientes documentados:** (1) tipos novos `Store*` em vez de estender `Product` (catálogo segue legado); (2) criação inline de categoria envia `categoryId` vazio quando o UUID ainda não existe localmente, resolvido no reload — comportamento aceitável nesta rodada.
- **Consistência de tipos:** `StoreProduct.isActive/stock/priceCents/images`, `StoreCategory.id/name/productCount`, `StoreSettings.*` usados de forma consistente entre actions, mappers, hooks e clients.
- **Pré-requisito de UI:** `Input`/`Textarea`/`Select` precisam repassar `name`/`hidden input` (nota na Task 13/15). Verificar antes de assumir que o `FormData` recebe os campos nativos.
