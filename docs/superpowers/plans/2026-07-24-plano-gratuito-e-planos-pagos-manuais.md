# Plano Gratuito e Volta dos Planos Pagos (Liberação Manual) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduzir um plano Free (porta de entrada automática no cadastro), trazer Starter e Pro de volta para a landing page com CTA "Fale conosco" (liberação manual, sem gateway de pagamento), e garantir que os limites de cada plano são de fato aplicados no código.

**Architecture:** `lib/plan-limits.ts` passa a ser a única fonte de verdade sobre limites e "plano efetivo" (com rebaixamento automático quando um Starter/Pro liberado manualmente expira). Todo o resto — Server Actions, páginas do painel, landing, middleware — consome essa função. A página `/escolha-de-plano` e a Server Action `selectPlan` são removidas por completo; o cadastro sempre cria a loja no plano Free.

**Tech Stack:** Next.js App Router (Server Actions, Route Handlers, middleware), Supabase (Postgres + RLS), Vitest + Testing Library.

## Global Constraints

- Limites: Free = 8 produtos / 1 categoria / 1 foto. Starter = 30 / 5 / 3 (já existente). Pro = ilimitado / ilimitado / 5 (já existente).
- Personalização (cor de destaque + capa), mensagem de pedido customizada e formas de pagamento/entrega continuam liberadas em **todos** os planos — não ficam atrás de paywall.
- CTA "Fale conosco" (Starter/Pro) abre `https://wa.me/5535999931678` (mesmo número do `WhatsAppFloatingButton` já existente) com mensagem pré-preenchida específica do plano.
- Liberação/renovação de Starter/Pro é sempre manual, direto na tabela `stores` do Supabase — sem tela ou Server Action de admin nesta fase.
- Rebaixamento de Starter/Pro expirado para Free é calculado a cada checagem (via `getEffectivePlan`), nunca grava nada no banco, nunca usa cron/job.
- Nenhum produto/categoria existente é apagado ou desativado quando uma loja é rebaixada — só a criação de itens além do limite Free fica bloqueada.

---

## File Structure

| Arquivo | Mudança |
|---|---|
| `lib/plan-limits.ts` | Reescrito: `Plan = "free" \| "starter" \| "pro"`, `FREE_LIMITS`, `getEffectivePlan()`, `getPlanLimits()` recebe `trialEndsAt` diretamente (troca `isTrialActive`) |
| `__tests__/plan-limits.test.ts` | Reescrito para os 3 planos + rebaixamento por expiração |
| `lib/types.ts` | `StoreSettings.plan` passa a usar `Plan` importado de `lib/plan-limits.ts` |
| `lib/server/store.ts` | `StoreRow.plan` passa a usar `Plan` importado |
| `app/actions/categorias.ts` | Chamada de `getPlanLimits` atualizada; mensagem de erro generalizada |
| `app/actions/produtos.ts` | Duas chamadas de `getPlanLimits` atualizadas; mensagem de erro generalizada |
| `app/painel/categorias/page.tsx` | Chamada de `getPlanLimits` atualizada |
| `app/painel/produtos/page.tsx` | Chamada de `getPlanLimits` atualizada |
| `app/painel/produtos/novo/page.tsx` | Chamada de `getPlanLimits` atualizada |
| `supabase/migrations/20260724000000_add_free_plan.sql` | Novo — relaxa o CHECK de `stores.plan` para incluir `'free'` |
| `lib/contact.ts` | Novo — constante `VTRINE_WHATSAPP_NUMBER` compartilhada |
| `components/landing/WhatsAppFloatingButton.tsx` | Passa a importar o número de `lib/contact.ts` |
| `app/actions/auth.ts` | `createStore` grava `plan: 'free'`; `selectPlan` removida |
| `app/auth/callback/route.ts` | Redirect simplificado (loja sempre tem plano) |
| `middleware.ts` | Remove checagens de `plan` nulo e o bloco `/escolha-de-plano` |
| `app/robots.ts` | Remove entrada `/escolha-de-plano` |
| `app/(auth)/escolha-de-plano/` | Diretório inteiro removido (`page.tsx`, `PlanosContent.tsx`, `data.ts`) |
| `app/painel/layout.tsx` | Faixa de trial vira aviso de upgrade para plano efetivo Free |
| `app/landing/data.tsx` | `freeFeatures` novo; `starterFeatures`/`proFeatures` reescritos (só os 3 limites numéricos) |
| `app/page.tsx` | Seção de preços reativada com 3 cards (Free/Starter/Pro) |
| `app/termos-de-uso/page.tsx` | Seção 4 reescrita; seção 5 sem menção a fatura |
| `docs/ARCHITECTURE.md` | Atualizado — remove framing de "modo demo" |
| `docs/roadmap/Escopo.md` | Atualizado — remove framing de "modo demo" |

---

### Task 1: `lib/plan-limits.ts` — modelo de 3 planos e rebaixamento por expiração

**Files:**
- Modify: `lib/plan-limits.ts`
- Test: `__tests__/plan-limits.test.ts`

**Interfaces:**
- Produces: `Plan = "free" | "starter" | "pro"`, `PlanLimits { maxProducts, maxCategories, maxPhotos }`, `getEffectivePlan(plan: Plan, trialEndsAt: string | null): Plan`, `getPlanLimits(plan: Plan, trialEndsAt: string | null): PlanLimits`. Estas são as assinaturas que todos os demais tasks consomem — `isTrialActive` deixa de existir.

- [ ] **Step 1: Escrever o teste com o novo comportamento (substitui o arquivo inteiro)**

```typescript
// __tests__/plan-limits.test.ts
import { describe, it, expect } from "vitest";
import { getPlanLimits, getEffectivePlan } from "@/lib/plan-limits";

describe("getEffectivePlan", () => {
  it("mantém free como free", () => {
    expect(getEffectivePlan("free", null)).toBe("free");
  });

  it("mantém starter/pro quando trial_ends_at é nulo (indeterminado)", () => {
    expect(getEffectivePlan("starter", null)).toBe("starter");
    expect(getEffectivePlan("pro", null)).toBe("pro");
  });

  it("mantém starter/pro quando trial_ends_at está no futuro", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(getEffectivePlan("starter", future)).toBe("starter");
    expect(getEffectivePlan("pro", future)).toBe("pro");
  });

  it("rebaixa starter/pro para free quando trial_ends_at já passou", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getEffectivePlan("starter", past)).toBe("free");
    expect(getEffectivePlan("pro", past)).toBe("free");
  });
});

describe("getPlanLimits", () => {
  it("free tem limites reduzidos", () => {
    expect(getPlanLimits("free", null)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
    });
  });

  it("starter tem limites intermediários", () => {
    expect(getPlanLimits("starter", null)).toEqual({
      maxProducts: 30,
      maxCategories: 5,
      maxPhotos: 3,
    });
  });

  it("pro tem produtos/categorias ilimitados e 5 fotos", () => {
    expect(getPlanLimits("pro", null)).toEqual({
      maxProducts: Infinity,
      maxCategories: Infinity,
      maxPhotos: 5,
    });
  });

  it("starter com trial_ends_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("starter", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
    });
  });

  it("pro com trial_ends_at expirado cai para os limites do Free", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past)).toEqual({
      maxProducts: 8,
      maxCategories: 1,
      maxPhotos: 1,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: FAIL — `getEffectivePlan` não existe em `lib/plan-limits.ts` (export ausente).

- [ ] **Step 3: Reescrever `lib/plan-limits.ts`**

```typescript
// lib/plan-limits.ts
export type Plan = "free" | "starter" | "pro";

export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
}

const FREE_LIMITS: PlanLimits = {
  maxProducts: 8,
  maxCategories: 1,
  maxPhotos: 1,
};

const STARTER_LIMITS: PlanLimits = {
  maxProducts: 30,
  maxCategories: 5,
  maxPhotos: 3,
};

const PRO_LIMITS: PlanLimits = {
  maxProducts: Infinity,
  maxCategories: Infinity,
  maxPhotos: 5,
};

function isPaidAccessExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() <= Date.now();
}

/**
 * Starter/Pro liberado manualmente cai para Free quando trial_ends_at vence.
 * trial_ends_at nulo = acesso indeterminado, nunca expira.
 */
export function getEffectivePlan(plan: Plan, trialEndsAt: string | null): Plan {
  if (plan !== "free" && isPaidAccessExpired(trialEndsAt)) return "free";
  return plan;
}

export function getPlanLimits(plan: Plan, trialEndsAt: string | null): PlanLimits {
  switch (getEffectivePlan(plan, trialEndsAt)) {
    case "pro":
      return PRO_LIMITS;
    case "starter":
      return STARTER_LIMITS;
    default:
      return FREE_LIMITS;
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS — 9 testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-limits.ts __tests__/plan-limits.test.ts
git commit -m "feat: adiciona plano Free e rebaixamento automático em lib/plan-limits"
```

---

### Task 2: Propagar o tipo `Plan` para `lib/types.ts` e `lib/server/store.ts`

**Files:**
- Modify: `lib/types.ts:89`
- Modify: `lib/server/store.ts:16`

**Interfaces:**
- Consumes: `Plan` de `lib/plan-limits.ts` (Task 1).
- Produces: `StoreSettings.plan: Plan` (sem `null`) — consumido por toda a UI do painel a partir de agora.

- [ ] **Step 1: Importar `Plan` e atualizar `StoreSettings` em `lib/types.ts`**

No topo do arquivo, adicionar:

```typescript
import type { Plan } from "./plan-limits";
```

E trocar a linha 89 de:

```typescript
  plan: "starter" | "pro" | null;
```

para:

```typescript
  plan: Plan;
```

- [ ] **Step 2: Importar `Plan` e atualizar `StoreRow` em `lib/server/store.ts`**

No topo do arquivo, junto aos demais imports:

```typescript
import type { StoreSettings, StoreProduct, StoreCategory, ProductColor, Plan } from "@/lib/types";
```

(substituindo o import múltiplo existente por essa versão com `Plan` incluído — `Plan` é re-exportado por `lib/types.ts` porque foi importado lá no Step 1, então este import continua vindo de `@/lib/types`).

E trocar a linha 16 de:

```typescript
  plan: "starter" | "pro" | null;
```

para:

```typescript
  plan: Plan;
```

- [ ] **Step 3: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: Sem erros novos relacionados a `plan` (erros pré-existentes não relacionados, se houver, não são deste task).

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/server/store.ts
git commit -m "refactor: usa o tipo Plan compartilhado em StoreSettings/StoreRow"
```

---

### Task 3: Atualizar chamadas de `getPlanLimits` e mensagens de erro

**Files:**
- Modify: `app/actions/categorias.ts:6,35,38`
- Modify: `app/actions/produtos.ts:7,63,71,130`
- Modify: `app/painel/categorias/page.tsx:4,37`
- Modify: `app/painel/produtos/page.tsx:4,116` (linha exata do import a confirmar no arquivo — já importa `getPlanLimits, isTrialActive` de `@/lib/plan-limits`)
- Modify: `app/painel/produtos/novo/page.tsx:4,30`

**Interfaces:**
- Consumes: `getPlanLimits(plan: Plan, trialEndsAt: string | null): PlanLimits` (Task 1). `store.plan` e `store.trialEndsAt` já existem em `StoreSettings` (Task 2).

- [ ] **Step 1: `app/actions/categorias.ts`**

Trocar o import (linha 6) de:

```typescript
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
```

para:

```typescript
import { getPlanLimits } from "@/lib/plan-limits";
```

Trocar a linha 35 de:

```typescript
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
```

para:

```typescript
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
```

Trocar a linha 38 de:

```typescript
      error: "Limite de categorias do plano Starter atingido. Faça upgrade para Pro.",
```

para:

```typescript
      error: "Limite de categorias do seu plano atingido. Fale conosco para aumentar o limite.",
```

- [ ] **Step 2: `app/actions/produtos.ts`**

Trocar o import (linha 7) de:

```typescript
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
```

para:

```typescript
import { getPlanLimits } from "@/lib/plan-limits";
```

Trocar a linha 63 (dentro de `createProduct`) de:

```typescript
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
```

para:

```typescript
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
```

Trocar a linha 71 de:

```typescript
      error: "Limite de produtos do plano Starter atingido. Faça upgrade para Pro.",
```

para:

```typescript
      error: "Limite de produtos do seu plano atingido. Fale conosco para aumentar o limite.",
```

Trocar a linha 130 (dentro de `updateProduct`) de:

```typescript
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
```

para:

```typescript
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
```

- [ ] **Step 3: `app/painel/categorias/page.tsx`**

Trocar o import (linha 4) de:

```typescript
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
```

para:

```typescript
import { getPlanLimits } from "@/lib/plan-limits";
```

Trocar a linha 37 de:

```typescript
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
```

para:

```typescript
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
```

- [ ] **Step 4: `app/painel/produtos/page.tsx`**

Trocar o import de `getPlanLimits, isTrialActive` (mesma linha usada hoje) para importar só `getPlanLimits` de `@/lib/plan-limits`.

Trocar a linha 116 de:

```typescript
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
```

para:

```typescript
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
```

- [ ] **Step 5: `app/painel/produtos/novo/page.tsx`**

Trocar o import (linha 4) de:

```typescript
import { getPlanLimits, isTrialActive } from "@/lib/plan-limits";
```

para:

```typescript
import { getPlanLimits } from "@/lib/plan-limits";
```

Trocar a linha 30 de:

```typescript
  const limits = getPlanLimits(store.plan, isTrialActive(store.trialEndsAt));
```

para:

```typescript
  const limits = getPlanLimits(store.plan, store.trialEndsAt);
```

- [ ] **Step 6: Rodar typecheck e a suíte de testes completa**

Run: `npx tsc --noEmit && npx vitest run`
Expected: Sem erros de tipo; nenhum teste existente quebrado (nenhum teste hoje cobre estes call-sites diretamente, mas `plan-limits.test.ts` do Task 1 continua passando).

- [ ] **Step 7: Commit**

```bash
git add app/actions/categorias.ts app/actions/produtos.ts app/painel/categorias/page.tsx app/painel/produtos/page.tsx app/painel/produtos/novo/page.tsx
git commit -m "refactor: atualiza call-sites de getPlanLimits para o novo modelo de 3 planos"
```

---

### Task 4: Migration — permitir `'free'` no plano da loja

**Files:**
- Create: `supabase/migrations/20260724000000_add_free_plan.sql`

**Interfaces:**
- Produces: coluna `stores.plan` aceita `'free' | 'starter' | 'pro'` no banco (hoje só aceita `'starter' | 'pro'`).

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/20260724000000_add_free_plan.sql
-- Adiciona 'free' como valor válido de stores.plan. Lojas existentes (todas em
-- plan='starter', trial_ends_at=null do modo demo) não são afetadas — o
-- default de novas lojas passa a ser 'free' na aplicação (app/actions/auth.ts),
-- não no banco.
alter table public.stores
  drop constraint if exists stores_plan_check;

alter table public.stores
  add constraint stores_plan_check check (plan in ('free', 'starter', 'pro'));
```

Não é necessário GRANT novo ao `anon` — `plan` não está em `STORE_COLS` (`lib/server/catalog.ts`), não é lido pelo catálogo público. Ver regra em `AGENTS.md`.

- [ ] **Step 2: Aplicar a migration no banco local**

Run: `supabase db reset` (ambiente local — recria o banco do zero aplicando todas as migrations em ordem) ou, se preferir não resetar dados locais, `supabase migration up`.
Expected: Migration aplicada sem erro; `\d public.stores` no `psql` (ou o painel do Supabase Studio local) mostra a constraint `stores_plan_check` com os 3 valores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260724000000_add_free_plan.sql
git commit -m "feat: adiciona 'free' aos valores permitidos de stores.plan"
```

---

### Task 5: Constante compartilhada de WhatsApp da Vtrine

**Files:**
- Create: `lib/contact.ts`
- Modify: `components/landing/WhatsAppFloatingButton.tsx`

**Interfaces:**
- Produces: `VTRINE_WHATSAPP_NUMBER: string` — consumido pelo Task 7 (banner do painel) e Task 8 (cards de preço da landing).

- [ ] **Step 1: Criar `lib/contact.ts`**

```typescript
// lib/contact.ts
/** Número de WhatsApp comercial da Vtrine Digital (não é o WhatsApp do lojista). */
export const VTRINE_WHATSAPP_NUMBER = "5535999931678";
```

- [ ] **Step 2: Atualizar `components/landing/WhatsAppFloatingButton.tsx` para usar a constante**

Conteúdo completo do arquivo depois da mudança:

```typescript
import { MessageCircle } from "lucide-react";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

const WHATSAPP_MESSAGE = "Olá! Tenho uma dúvida sobre o Vtrine Digital.";

export function WhatsAppFloatingButton() {
  const href = `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Ficou com dúvida? Fale conosco pelo WhatsApp"
      className="fixed bottom-6 right-4 sm:right-8 z-40 inline-flex items-center gap-2 h-12 px-5 rounded-pill bg-gold text-white font-display font-medium text-[14px] hover:bg-gold-hover transition-colors"
    >
      <MessageCircle size={20} />
      Ficou com dúvida?
    </a>
  );
}
```

- [ ] **Step 3: Verificar visualmente**

Run: inicie o dev server (`npm run dev`) e abra `/landing` no navegador. O botão flutuante de WhatsApp deve continuar aparecendo no canto inferior direito e abrir o WhatsApp com a mesma mensagem de antes.

- [ ] **Step 4: Commit**

```bash
git add lib/contact.ts components/landing/WhatsAppFloatingButton.tsx
git commit -m "refactor: extrai número de WhatsApp da Vtrine para lib/contact.ts"
```

---

### Task 6: Cadastro nasce no Free; remove o fluxo `/escolha-de-plano`

**Files:**
- Modify: `app/actions/auth.ts:174-253`
- Modify: `app/auth/callback/route.ts:65-76`
- Modify: `middleware.ts`
- Modify: `app/robots.ts:18`
- Delete: `app/(auth)/escolha-de-plano/page.tsx`
- Delete: `app/(auth)/escolha-de-plano/PlanosContent.tsx`
- Delete: `app/(auth)/escolha-de-plano/data.ts`

**Interfaces:**
- Consumes: nenhuma nova — só remove código morto e troca o valor gravado em `plan`.
- Produces: toda loja nova nasce com `plan: 'free'`; nenhuma rota do app aponta mais para `/escolha-de-plano`.

- [ ] **Step 1: `app/actions/auth.ts` — trocar o plano padrão e remover `selectPlan`**

Trocar o bloco de comentário (linhas 174-180) de:

```typescript
  // MODO DEMO (a partir de jul/2026): toda loja nasce Starter, sem expiração.
  // Para voltar ao modelo com trial + escolha de plano, restaurar o bloco abaixo:
  //
  // const trialEndsAt = new Date()
  // trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  //
  // ... e trocar o redirect final para '/escolha-de-plano'
```

para:

```typescript
  // Toda loja nasce no plano Free, sem expiração. Starter/Pro são liberados
  // manualmente depois, direto na tabela stores do Supabase (ver AGENTS.md /
  // docs/roadmap/Escopo.md §4.3).
```

Trocar a linha 188 de:

```typescript
      plan: 'starter',
```

para:

```typescript
      plan: 'free',
```

Remover por completo a função `selectPlan` (linhas 226-253, do `export async function selectPlan` até o `}` de fechamento antes do próximo bloco/EOF):

```typescript
export async function selectPlan(plan: 'starter' | 'pro'): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!store) redirect('/cadastro?step=loja')

  const { error } = await supabase
    .from('stores')
    .update({ plan })
    .eq('owner_id', user.id)
    .is('plan', null)

  if (error) {
    redirect('/escolha-de-plano?error=plan')
  }

  redirect('/painel')
}
```

- [ ] **Step 2: `app/auth/callback/route.ts` — simplificar o redirect**

Trocar (linhas 65-76) de:

```typescript
  // Verifica se loja já existe (usuário existente, ex.: login Google)
  const { data: store } = await supabase
    .from('stores')
    .select('plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (store) {
    return NextResponse.redirect(
      `${origin}${store.plan ? '/painel' : '/escolha-de-plano'}`
    )
  }
```

para:

```typescript
  // Verifica se loja já existe (usuário existente, ex.: login Google)
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (store) {
    return NextResponse.redirect(`${origin}/painel`)
  }
```

- [ ] **Step 3: `middleware.ts` — remover checagens de `plan` nulo e o bloco de `/escolha-de-plano`**

Conteúdo completo do arquivo depois da mudança:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const needsAuth = pathname === '/login' || pathname.startsWith('/painel')

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
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!store) {
        return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
      }
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  // Painel: exige sessão e loja criada
  if (pathname.startsWith('/painel')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
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

- [ ] **Step 4: `app/robots.ts` — remover a entrada `/escolha-de-plano`**

Trocar o array `disallow` de:

```typescript
        disallow: [
          "/painel",
          "/api/",
          "/login",
          "/cadastro",
          "/recuperar-senha",
          "/redefinir-senha",
          "/verificar-email",
          "/escolha-de-plano",
        ],
```

para:

```typescript
        disallow: [
          "/painel",
          "/api/",
          "/login",
          "/cadastro",
          "/recuperar-senha",
          "/redefinir-senha",
          "/verificar-email",
        ],
```

- [ ] **Step 5: Apagar o diretório `app/(auth)/escolha-de-plano/`**

Run: `rm -rf "app/(auth)/escolha-de-plano"`
Expected: Diretório e os 3 arquivos (`page.tsx`, `PlanosContent.tsx`, `data.ts`) removidos.

- [ ] **Step 6: Rodar typecheck, lint e testes**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: Sem erros — nenhum teste existente referencia `selectPlan` ou `/escolha-de-plano`.

- [ ] **Step 7: Verificar o fluxo de cadastro no navegador**

Run: `npm run dev`, abra `/cadastro`, complete as duas etapas com um e-mail de teste (Mailpit local em `http://localhost:54324` para confirmar).
Expected: Depois de confirmar o e-mail e preencher os dados da loja, cai direto em `/painel` — nunca em `/escolha-de-plano` (rota não existe mais, retornaria 404 se algo ainda apontasse pra lá).

- [ ] **Step 8: Commit**

```bash
git add app/actions/auth.ts app/auth/callback/route.ts middleware.ts app/robots.ts
git rm -r "app/(auth)/escolha-de-plano"
git commit -m "feat: cadastro nasce direto no plano Free e remove o fluxo /escolha-de-plano"
```

---

### Task 7: Aviso de upgrade no painel para lojas no plano Free

**Files:**
- Modify: `app/painel/layout.tsx`

**Interfaces:**
- Consumes: `getEffectivePlan(plan, trialEndsAt)` (Task 1), `VTRINE_WHATSAPP_NUMBER` (Task 5), `store.plan` / `store.trialEndsAt` (Task 2).

- [ ] **Step 1: Reescrever a faixa de trial**

Conteúdo completo do arquivo depois da mudança:

```typescript
import { redirect } from 'next/navigation'
import { getCurrentStore } from '@/lib/server/store'
import { getEffectivePlan } from '@/lib/plan-limits'
import { VTRINE_WHATSAPP_NUMBER } from '@/lib/contact'
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

  const showUpgradeBanner = getEffectivePlan(store.plan, store.trialEndsAt) === 'free'
  const upgradeWhatsAppHref = `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Olá! Quero saber mais sobre os planos pagos da Vtrine.'
  )}`

  return (
    <div className="h-dvh flex flex-col bg-ivory overflow-hidden">
      {showUpgradeBanner && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Plano Free</span>
          <span className="opacity-55">·</span>
          <span>Fale conosco para liberar mais produtos</span>
          <a
            href={upgradeWhatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Falar no WhatsApp →
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

- [ ] **Step 2: Verificar visualmente**

Run: `npm run dev`, logue com uma loja de teste (nasce Free pelo Task 6). Abra `/painel`.
Expected: A faixa "Plano Free · Fale conosco para liberar mais produtos · Falar no WhatsApp →" aparece no topo. Clicar no link abre o WhatsApp com a mensagem pré-preenchida.

Para conferir que a faixa some para planos pagos válidos: no Supabase Studio local, edite a loja de teste (`stores`) para `plan = 'pro'`, `trial_ends_at = null`, recarregue `/painel` — a faixa não deve mais aparecer.

- [ ] **Step 3: Commit**

```bash
git add app/painel/layout.tsx
git commit -m "feat: transforma a faixa de trial em aviso de upgrade para o plano Free"
```

---

### Task 8: Seção de preços na landing — Free, Starter e Pro

**Files:**
- Modify: `app/landing/data.tsx:106-119`
- Modify: `app/page.tsx:1-19` (imports) e `app/page.tsx:299-379` (seção de preços)

**Interfaces:**
- Consumes: `VTRINE_WHATSAPP_NUMBER` (Task 5), `freeFeatures` / `starterFeatures` / `proFeatures` (este task).

- [ ] **Step 1: Atualizar `app/landing/data.tsx`**

Trocar (linhas 106-119) de:

```typescript
export const starterFeatures = [
  "Até 30 produtos",
  "Link único da loja",
  "Checkout no WhatsApp",
  "Painel do lojista",
];

export const proFeatures = [
  "Produtos ilimitados",
  "Controle de estoque",
  "Categorias e destaques",
  "Personalização da marca",
  "Suporte prioritário",
];
```

para:

```typescript
export const freeFeatures = [
  "Até 8 produtos",
  "1 categoria",
  "1 foto por produto",
];

export const starterFeatures = [
  "Até 30 produtos",
  "5 categorias",
  "3 fotos por produto",
];

export const proFeatures = [
  "Produtos ilimitados",
  "Categorias ilimitadas",
  "5 fotos por produto",
];
```

- [ ] **Step 2: Atualizar os imports em `app/page.tsx`**

Trocar (linhas 4-19) de:

```typescript
import {
  CheckCircle2,
  Check,
  MessageCircle,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";
import {
  painCards,
  steps,
  features,
  starterFeatures,
  proFeatures,
  faqs,
  phoneMockProducts,
} from "./landing/data";
```

para:

```typescript
import {
  CheckCircle2,
  Check,
  MessageCircle,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";
import {
  painCards,
  steps,
  features,
  freeFeatures,
  starterFeatures,
  proFeatures,
  faqs,
  phoneMockProducts,
} from "./landing/data";
```

- [ ] **Step 3: Substituir a seção de preços comentada por uma seção ativa com 3 cards**

Localizar o bloco que começa em `{/* ─── Pricing ─── */}` (linha 299) e termina no `*/}` de fechamento (linha 379) e substituir **o bloco inteiro** por:

```typescript
      {/* ─── Pricing ─── */}
      <section id="precos" className="bg-linen py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Planos
            </span>
            <h2 className="font-display font-semibold text-[28px] md:text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Planos sob medida para sua loja.
            </h2>
            <p className="font-body text-[17px] text-graphite text-pretty">
              Todo plano inclui vitrine personalizável, link público e pedidos
              direto no WhatsApp.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:max-w-[960px] mx-auto">
            {/* Free */}
            <div className="bg-white border border-sand/50 rounded-card p-9 flex flex-col">
              <div className="font-display font-medium text-[18px] text-obsidian">
                Free
              </div>
              <div className="mt-4 mb-1.5">
                <span className="font-display font-semibold text-[28px] text-obsidian tracking-tight">
                  Grátis
                </span>
              </div>
              <p className="font-body text-[14px] text-graphite mb-6">
                Para testar a vitrine sem compromisso.
              </p>
              <ul className="flex flex-col gap-3 mb-7 flex-1">
                {freeFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 font-body text-[14px] text-graphite"
                  >
                    <Check
                      size={17}
                      className="text-success flex-shrink-0 mt-px"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <NextLink
                href="/cadastro"
                className="inline-flex items-center justify-center h-11 rounded-btn bg-gold text-white font-display font-medium text-[15px] hover:bg-gold-hover transition-colors"
              >
                Começar grátis
              </NextLink>
            </div>

            {/* Starter */}
            <div className="bg-white border border-sand/50 rounded-card p-9 flex flex-col">
              <div className="font-display font-medium text-[18px] text-obsidian">
                Starter
              </div>
              <div className="mt-4 mb-1.5">
                <span className="font-display font-semibold text-[28px] text-obsidian tracking-tight">
                  Sob consulta
                </span>
              </div>
              <p className="font-body text-[14px] text-graphite mb-6">
                Para quem já vende e quer crescer o catálogo.
              </p>
              <ul className="flex flex-col gap-3 mb-7 flex-1">
                {starterFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 font-body text-[14px] text-graphite"
                  >
                    <Check
                      size={17}
                      className="text-success flex-shrink-0 mt-px"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  "Olá! Quero saber mais sobre o plano Starter da Vtrine."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 rounded-btn border-2 border-obsidian text-obsidian font-display font-medium text-[15px] hover:bg-obsidian hover:text-white transition-colors"
              >
                Fale conosco
              </a>
            </div>

            {/* Pro */}
            <div className="relative bg-white border border-gold rounded-card p-9 flex flex-col">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-white font-body font-medium text-[10px] tracking-[0.08em] uppercase px-3.5 py-1.5 rounded-pill whitespace-nowrap">
                Mais popular
              </span>
              <div className="font-display font-medium text-[18px] text-obsidian">
                Pro
              </div>
              <div className="mt-4 mb-1.5">
                <span className="font-display font-semibold text-[28px] text-obsidian tracking-tight">
                  Sob consulta
                </span>
              </div>
              <p className="font-body text-[14px] text-graphite mb-6">
                Para a loja que vende todo dia e quer crescer sem limites.
              </p>
              <ul className="flex flex-col gap-3 mb-7 flex-1">
                {proFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 font-body text-[14px] text-graphite"
                  >
                    <Check
                      size={17}
                      className="text-success flex-shrink-0 mt-px"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  "Olá! Quero saber mais sobre o plano Pro da Vtrine."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-11 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
              >
                Fale conosco
              </a>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 4: Rodar typecheck**

Run: `npx tsc --noEmit`
Expected: Sem erros — `freeFeatures` e `VTRINE_WHATSAPP_NUMBER` resolvidos corretamente.

- [ ] **Step 5: Verificar visualmente**

Run: `npm run dev`, abra `/` (ou `/landing`, conforme a rota configurada).
Expected: A seção "Planos" aparece com 3 cards (Free/Starter/Pro). "Começar grátis" leva para `/cadastro`. "Fale conosco" nos cards Starter e Pro abre o WhatsApp com a mensagem correta para cada plano (confira o texto no destino antes de fechar a aba). Testar também em mobile (largura estreita) — os 3 cards devem empilhar em coluna única.

- [ ] **Step 6: Commit**

```bash
git add app/landing/data.tsx app/page.tsx
git commit -m "feat: reativa a seção de preços da landing com Free/Starter/Pro"
```

---

### Task 9: Termos de Uso — remove menções a trial de 14 dias, preço fixo e fatura

**Files:**
- Modify: `app/termos-de-uso/page.tsx:89-96` (seção 4)
- Modify: `app/termos-de-uso/page.tsx:111-132` (seção 5, item de fatura)

**Interfaces:** Nenhuma — só conteúdo estático.

- [ ] **Step 1: Reescrever a seção 4 "Planos e pagamento"**

Trocar o array de itens (linhas 91-96) de:

```typescript
            {[
              "Trial: 14 dias gratuitos a partir da data de criação da conta, sem necessidade de cartão de crédito.",
              "Plano Starter: R$ 49/mês — limites de produtos e categorias conforme descrito na página de planos.",
              "Plano Pro: R$ 99/mês — limites ampliados, conforme descrito na página de planos.",
              "A cobrança é recorrente mensal e pode ser cancelada a qualquer momento.",
              "Não há reembolso de períodos parciais já cobrados.",
            ].map((item) => (
```

para:

```typescript
            {[
              "A Vtrine Digital oferece um plano gratuito (Free), disponível automaticamente na criação da conta, com limites de produtos, categorias e fotos.",
              "Os planos Starter e Pro, com limites ampliados, são disponibilizados mediante contato direto com a Vtrine Digital para avaliação e liberação de acesso.",
              "A ativação dos planos pagos é feita manualmente, sem cobrança automática. As condições de pagamento são combinadas diretamente com o lojista no momento da liberação.",
              "A Vtrine Digital pode revisar os limites e as condições de cada plano a qualquer momento, mediante aviso prévio.",
            ].map((item) => (
```

- [ ] **Step 2: Remover a menção a fatura na seção 5 "Suspensão e cancelamento"**

Trocar o array de itens (linhas 117-120) de:

```typescript
            {[
              "Inadimplência superior a 30 dias após o vencimento da fatura.",
              "Publicação de conteúdo ilegal ou que viole estes Termos de Uso.",
              "Uso abusivo da plataforma, incluindo spam e automação não autorizada.",
            ].map((item) => (
```

para:

```typescript
            {[
              "Publicação de conteúdo ilegal ou que viole estes Termos de Uso.",
              "Uso abusivo da plataforma, incluindo spam e automação não autorizada.",
            ].map((item) => (
```

- [ ] **Step 3: Verificar visualmente**

Run: `npm run dev`, abra `/termos-de-uso`.
Expected: Seção 4 mostra os 4 itens novos, sem valores em R$ ou menção a trial de 14 dias. Seção 5 mostra só os 2 motivos de suspensão, sem menção a fatura/inadimplência.

- [ ] **Step 4: Commit**

```bash
git add app/termos-de-uso/page.tsx
git commit -m "docs: atualiza Termos de Uso para o modelo Free + planos pagos manuais"
```

---

### Task 10: Atualizar `docs/ARCHITECTURE.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Interfaces:** Nenhuma — documentação.

- [ ] **Step 1: Fluxo de cadastro (linha 22) e callout de modo demo (linha 26)**

Trocar:

```markdown
  → createStore (cria a loja, já com plan='starter' e o perfil completo)
  → /painel
```

```
> **Modo demo (jul/2026):** a etapa `/escolha-de-plano` foi retirada do fluxo. Toda loja nasce direto com `plan = 'starter'` e `trial_ends_at = null` (indeterminado — nunca expira). A rota `/escolha-de-plano` e a Server Action `selectPlan` continuam existindo no código, mas ficam inacessíveis na prática porque nenhuma loja nova tem `plan IS NULL`. Ver `docs/roadmap/Escopo.md` §6 para o plano de reativar cobrança.
```

por:

```markdown
  → createStore (cria a loja, já com plan='free' e o perfil completo)
  → /painel
```

```
> Toda loja nasce direto com `plan = 'free'` — sem etapa de escolha de plano no cadastro, sem cobrança. Starter e Pro são liberados manualmente (edição direta na tabela `stores` do Supabase) após contato via WhatsApp pela landing ("Fale conosco"). A rota `/escolha-de-plano` e a Server Action `selectPlan` foram removidas. Ver `docs/roadmap/Escopo.md` §4.3 e §6.
```

- [ ] **Step 2: Fluxo de login (linha 32)**

Trocar:

```markdown
  → /painel (se tem plano) | /escolha-de-plano (sem plano — não ocorre para lojas criadas em modo demo) | /cadastro?step=loja (sem loja)
```

por:

```markdown
  → /painel (tem loja) | /cadastro?step=loja (sem loja)
```

- [ ] **Step 3: Tabela de proteção de rotas (linhas 39-44)**

Trocar:

```markdown
| Situação | Destino |
|---|---|
| Não autenticado → `/painel` | `/login?next=/painel` |
| Autenticado sem loja → qualquer rota protegida | `/cadastro?step=loja` |
| Autenticado com loja, sem plano → `/painel` | `/escolha-de-plano` (não ocorre em modo demo) |
| Autenticado com plano → `/login` ou `/cadastro` | `/painel` |
```

por:

```markdown
| Situação | Destino |
|---|---|
| Não autenticado → `/painel` | `/login?next=/painel` |
| Autenticado sem loja → qualquer rota protegida | `/cadastro?step=loja` |
| Autenticado com loja → `/login` ou `/cadastro` | `/painel` |
```

- [ ] **Step 4: Tabela de arquivos importantes (linhas 102, 111)**

Trocar:

```markdown
| `lib/plan-limits.ts` | `getPlanLimits()`, `isTrialActive()` — limites por plano (Starter/Pro) |
```

por:

```markdown
| `lib/plan-limits.ts` | `getPlanLimits()`, `getEffectivePlan()` — limites por plano (Free/Starter/Pro) e rebaixamento automático quando o acesso pago liberado manualmente expira |
```

Trocar:

```markdown
| `app/actions/auth.ts` | Server Actions: `signUp`, `signIn`, `signInWithGoogle`, `createStore`, `selectPlan`, `requestPasswordReset`, `resetPassword`, `resendConfirmation`, `signOut`. `createStore` agora coleta o perfil completo (WhatsApp obrigatório, logo, monograma, Instagram, descrição, cor de destaque, formas de pagamento/entrega) durante a etapa 2 do cadastro |
```

por:

```markdown
| `app/actions/auth.ts` | Server Actions: `signUp`, `signIn`, `signInWithGoogle`, `createStore`, `requestPasswordReset`, `resetPassword`, `resendConfirmation`, `signOut`. `createStore` agora coleta o perfil completo (WhatsApp obrigatório, logo, monograma, Instagram, descrição, cor de destaque, formas de pagamento/entrega) durante a etapa 2 do cadastro |
```

- [ ] **Step 5: Tabela de páginas de autenticação (linha 139)**

Remover a linha inteira:

```markdown
| `/escolha-de-plano` | Starter (R$49/mês) ou Pro (R$99/mês) — UI original, inalterada. Inacessível no fluxo normal em modo demo — toda loja nova já nasce com plano Starter |
```

- [ ] **Step 6: Seção "Estado atual" (linhas 158, 162, 167)**

Trocar:

```markdown
- **Modo demo**: cadastro pula a escolha de plano; toda loja nova nasce com `plan = 'starter'` e `trial_ends_at = null` (indeterminado). Na landing: preços ocultos (texto "Em breve"), botões "Começar" removidos dos cards de plano, e a seção de depoimentos (fictícios) oculta. A página `/escolha-de-plano` mantém a UI original com preços — não é revisada porque fica inacessível no fluxo
```

por:

```markdown
- **Planos**: Free (automático no cadastro), Starter e Pro (liberados manualmente após contato via "Fale conosco" na landing). A landing exibe os 3 planos — preço "Grátis" no Free, "Sob consulta" em Starter/Pro. A seção de depoimentos (fictícios) segue oculta
```

Trocar:

```markdown
- **Limites de plano**: `getPlanLimits()` aplicado em Server Actions de produtos e categorias — como toda loja demo nasce Starter, os limites de Starter (30 produtos, 5 categorias, 3 fotos) se aplicam normalmente
```

por:

```markdown
- **Limites de plano**: `getPlanLimits()` aplicado em Server Actions de produtos e categorias — Free (8 produtos/1 categoria/1 foto), Starter (30/5/3) e Pro (ilimitado/ilimitado/5). Um Starter/Pro liberado manualmente cai para os limites do Free automaticamente quando `trial_ends_at` vence (`getEffectivePlan()`, calculado a cada checagem, sem job)
```

Trocar:

```markdown
Validação com lojistas em modo demo (sem cobrança). Depois: reintroduzir a página de escolha de plano no cadastro, exibir preços e integrar pagamento (Stripe ou Pagar.me) com cobrança recorrente e webhooks para ativação/cancelamento de plano. Ver `docs/roadmap/Escopo.md` §6 e §11.
```

por:

```markdown
Validação com lojistas no plano Free, com Starter/Pro liberados manualmente enquanto não há gateway de pagamento. Depois: integrar pagamento (Stripe ou Pagar.me) com cobrança recorrente automática e webhooks para ativação/cancelamento de plano. Ver `docs/roadmap/Escopo.md` §6.
```

- [ ] **Step 7: Revisão final**

Run: `grep -n "modo demo\|escolha-de-plano\|selectPlan" docs/ARCHITECTURE.md`
Expected: Nenhuma ocorrência.

- [ ] **Step 8: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: atualiza ARCHITECTURE.md para o modelo Free + planos pagos manuais"
```

---

### Task 11: Atualizar `docs/roadmap/Escopo.md`

**Files:**
- Modify: `docs/roadmap/Escopo.md`

**Interfaces:** Nenhuma — documentação.

- [ ] **Step 1: Cabeçalho (linhas 3-6)**

Trocar:

```markdown
**Versão:** 2.3  
**Data:** 2 de julho de 2026

> **Modo demo:** a partir desta versão, o produto roda em modo demo para validação com lojistas. Preços, os CTAs "Começar" e a seção de depoimentos (fictícios) ficam ocultos na landing, o cadastro pula a escolha de plano e toda loja nova nasce direto no plano Starter com expiração indeterminada (sem cobrança). Ver §4.3 e §6 para o detalhe do que muda e o que volta quando a cobrança for reativada.
```

por:

```markdown
**Versão:** 2.4  
**Data:** 24 de julho de 2026

> **Modelo de planos:** Free (automático no cadastro), Starter e Pro (liberados manualmente após contato via WhatsApp — "Fale conosco" na landing —, sem gateway de pagamento integrado ainda). A seção de depoimentos (fictícios) segue oculta na landing. Ver §4.3 e §6.
```

- [ ] **Step 2: Tabela "Fluxo de autenticação" (linhas 33, 35)**

Trocar:

```markdown
| Landing page | Hero, dor, como funciona, features, planos (sem preço, "Em breve", sem CTA), FAQ, CTA final. Seção de depoimentos oculta (fictícios, sem clientes reais ainda) | ✅ Implementado |
| Cadastro | Seção "Sua conta" + Seção "Sua loja" com preview do slug em tempo real | ✅ Implementado |
| Escolha de plano | Cards Starter R$49 e Pro R$99 (UI original, inalterada). Pulada no cadastro em modo demo — loja já nasce Starter e nunca chega nessa tela. | ⏸️ Fora do fluxo (modo demo) |
```

por:

```markdown
| Landing page | Hero, dor, como funciona, features, planos (Free, Starter, Pro — CTA "Fale conosco" para os pagos), FAQ, CTA final. Seção de depoimentos oculta (fictícios, sem clientes reais ainda) | ✅ Implementado |
| Cadastro | Seção "Sua conta" + Seção "Sua loja" com preview do slug em tempo real. Loja nasce direto no plano Free, sem etapa de escolha de plano | ✅ Implementado |
```

(A linha "Escolha de plano" é removida — a tela não existe mais.)

- [ ] **Step 3: Tabela "Painel do lojista" (linha 45)**

Trocar:

```markdown
| Dashboard | Resumo (ativos, esgotados, link do catálogo). Banner de trial durante 14 dias. Dados reais do banco. | ✅ Implementado |
```

por:

```markdown
| Dashboard | Resumo (ativos, esgotados, link do catálogo). Aviso de upgrade no topo do painel para lojas no plano Free. Dados reais do banco. | ✅ Implementado |
```

- [ ] **Step 4: Reescrever a seção 4.3 inteira (linhas 91-104)**

Trocar todo o bloco:

```markdown
### 4.3 Trial e assinatura

> **Modo demo:** toda loja cadastrada nasce com `plan = 'starter'` e `trial_ends_at = null` (indeterminado). Não há trial de 14 dias nem cobrança — é acesso ao plano Starter (com os limites normais de 30 produtos/5 categorias/3 fotos), por tempo indeterminado, enquanto durar a validação com lojistas.

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Cadastro já com plano Starter | `plan='starter'`, `trial_ends_at=null` definidos na criação da loja (`/auth/callback` e `createStore`) | ✅ Implementado (modo demo) |
| Trial de 14 dias | Substituído pelo modo demo — lógica de `trial_ends_at` continua no banco (agora nullable) e é tratada como "sem expiração" quando nula | ⏸️ Suspenso (modo demo) |
| Tela de escolha de plano | Pulada no cadastro. Rota, Server Action `selectPlan` e UI (`PlanosContent.tsx`) seguem inalteradas no código — ficam apenas inacessíveis no fluxo até a cobrança voltar. | ⏸️ Fora do fluxo (modo demo) |
| Banner de trial | Não aparece para lojas em modo demo (`showTrialBanner = !store.plan`, e `plan` nunca é nulo) | ⏸️ Suspenso (modo demo) |
| Loja oculta após expiração | Depende de `is_active`, não de `trial_ends_at` — segue funcionando para desativação manual | ✅ Implementado |
| Integração de pagamento | Stripe ou Pagar.me — cobrança recorrente | ⏳ Pendente — retomado após a validação em modo demo |
| Webhook de pagamento | Processar upgrades, cancelamentos e expiração via webhook | ⏳ Pendente |
| Cancelamento | Sem fidelidade. Catálogo oculto até reativação. Dados preservados. | ⏳ Pendente (depende do pagamento) |
```

por:

```markdown
### 4.3 Planos e liberação de acesso

> Toda loja nasce automaticamente no plano Free (`plan = 'free'`), sem cobrança e sem prazo de expiração. Starter e Pro são liberados manualmente: o lojista entra em contato pelo WhatsApp ("Fale conosco" na landing), você avalia e atualiza `plan` e `trial_ends_at` direto na tabela `stores` do Supabase. Não há gateway de pagamento integrado nesta fase.

| Funcionalidade | Detalhe | Status |
|---|---|---|
| Cadastro já com plano Free | `plan='free'`, `trial_ends_at=null` definidos na criação da loja (`/auth/callback` e `createStore`) | ✅ Implementado |
| Liberação manual de Starter/Pro | Edição direta de `plan` e `trial_ends_at` na tabela `stores` pelo Supabase, após contato via WhatsApp | ✅ Implementado |
| Rebaixamento automático ao expirar | Quando `trial_ends_at` de um Starter/Pro liberado manualmente passa, os limites efetivos caem para o Free — calculado a cada checagem (`getEffectivePlan()`), sem gravar nada no banco nem job agendado | ✅ Implementado |
| Aviso de upgrade no painel | Lojas no plano efetivo Free veem um aviso no topo do painel com link para o WhatsApp | ✅ Implementado |
| Tela de escolha de plano | Removida — Starter/Pro só existem na landing, com CTA "Fale conosco" | ❌ Removido |
| Loja oculta após expiração | Depende de `is_active`, não de `trial_ends_at` — segue funcionando para desativação manual | ✅ Implementado |
| Integração de pagamento | Stripe ou Pagar.me — cobrança recorrente automática | ⏳ Pendente — retomado após a validação |
| Webhook de pagamento | Processar upgrades, cancelamentos e expiração via webhook | ⏳ Pendente |
| Cancelamento | Sem fidelidade. Catálogo oculto até reativação. Dados preservados. | ⏳ Pendente (depende do pagamento) |
```

- [ ] **Step 5: Reescrever a seção 6 "Modelo de monetização" (linhas 124-137)**

Trocar todo o bloco:

```markdown
## 6. Modelo de monetização

> **Em modo demo, preços não são exibidos e não há cobrança.** A tabela abaixo é o modelo planejado para quando a cobrança for reativada (pós-validação).

| | Starter | Pro |
|---|---|---|
| **Preço** | A definir | A definir |
| Produtos | Até 30 | Ilimitados |
| Categorias | Até 5 | Ilimitadas |
| Fotos por produto | Até 3 | Até 5 |
| GA + Pixel | Incluso | Incluso |
| Template de mensagem | Incluso | Incluso |

**Enquanto o modo demo estiver ativo:** todo cadastro recebe o plano Starter automaticamente, com expiração indeterminada (`trial_ends_at = null`) e sem cobrança no dia 15. Não há upgrade automático para Pro — quem quiser os limites Pro precisa aguardar a reativação da cobrança.
```

por:

```markdown
## 6. Modelo de monetização

> O Free não tem preço — é a porta de entrada padrão do cadastro. Starter e Pro ainda não têm preço fixo publicado: a landing mostra "Sob consulta" e a liberação é negociada manualmente pelo WhatsApp enquanto não há gateway de pagamento integrado.

| | Free | Starter | Pro |
|---|---|---|---|
| **Preço** | Grátis | Sob consulta | Sob consulta |
| Produtos | Até 8 | Até 30 | Ilimitados |
| Categorias | 1 | Até 5 | Ilimitadas |
| Fotos por produto | 1 | Até 3 | Até 5 |
| Personalização (cor + capa) | Incluso | Incluso | Incluso |
| Mensagem de pedido customizada | Incluso | Incluso | Incluso |
| Formas de pagamento/entrega | Incluso | Incluso | Incluso |

**Liberação de Starter/Pro:** feita manualmente direto no Supabase (`plan` + `trial_ends_at`), depois de contato via WhatsApp pela landing. Quando `trial_ends_at` vence, a loja passa a valer os limites do Free automaticamente nas checagens — sem nenhum valor sendo regravado no banco.
```

- [ ] **Step 6: Tabela "Comportamentos críticos" (linhas 187, 189)**

Trocar:

```markdown
| Catálogo em modo demo | Público e ativo por tempo indeterminado (`trial_ends_at=null`, `plan='starter'`). Sem banner de trial no painel. |
```

por:

```markdown
| Catálogo em uso | Público e ativo enquanto `is_active=true`, independente do plano. Loja no plano efetivo Free tem os limites de criação mais restritos, mas o catálogo já publicado continua no ar normalmente. |
```

Trocar:

```markdown
| Limite do Starter | Ao atingir 30 produtos, botão desabilitado + mensagem de upgrade. Se aplica normalmente em modo demo, já que toda loja nasce Starter. |
```

por:

```markdown
| Limite de plano atingido | Ao atingir o limite de produtos/categorias do plano efetivo, botão desabilitado + mensagem indicando para falar com a Vtrine. |
```

- [ ] **Step 7: Tabela "Riscos e mitigações" (linhas 199, 200)**

Trocar:

```markdown
| Churn no mês 2 | Lojista cadastra e depois abandona | Notificação semanal com dados de acesso via GA. (Banner de trial/urgência volta quando a cobrança for reativada — suspenso em modo demo.) |
| Não conversão no trial | Experimenta mas não assina | Não se aplica em modo demo (sem trial nem cobrança). Retomar e-mail de recuperação no dia 12 quando o modelo pago voltar. |
```

por:

```markdown
| Churn no mês 2 | Lojista cadastra e depois abandona | Notificação semanal com dados de acesso via GA. Aviso de upgrade no painel para quem está no Free. |
| Não conversão do Free para pago | Usa o Free e nunca fala com a gente | Aviso de upgrade no painel; acompanhamento manual dos lojistas mais ativos para oferecer Starter/Pro por WhatsApp. |
```

- [ ] **Step 8: Tabela "Roadmap de implementação" (linhas 215-217)**

Trocar:

```markdown
| 6 | Modo demo — preços/CTAs ocultos, cadastro direto no plano Starter, expiração indeterminada | ✅ Concluído (jul/2026) |
| 7 | Validação com lojistas | ⏳ Em andamento — beta em modo demo, sem cobrança |
| 8 | Integração de pagamento | ⏳ Depois da validação — Stripe ou Pagar.me, cobrança recorrente, reintroduzir `/escolha-de-plano` e preços |
```

por:

```markdown
| 6 | Plano Free + volta dos planos pagos na landing (CTA "Fale conosco", liberação manual) | ✅ Concluído (jul/2026) |
| 7 | Validação com lojistas | ⏳ Em andamento — Free automático, Starter/Pro liberados manualmente |
| 8 | Integração de pagamento | ⏳ Depois da validação — Stripe ou Pagar.me, cobrança recorrente automática para Starter/Pro |
```

- [ ] **Step 9: Revisão final**

Run: `grep -n "modo demo\|escolha-de-plano\|selectPlan\|plano Starter automaticamente" docs/roadmap/Escopo.md`
Expected: Nenhuma ocorrência.

- [ ] **Step 10: Commit**

```bash
git add docs/roadmap/Escopo.md
git commit -m "docs: atualiza Escopo.md para o modelo Free + planos pagos manuais"
```

---

### Task 12: Verificação final end-to-end

**Files:** Nenhum arquivo novo — só verificação.

**Interfaces:** N/A.

- [ ] **Step 1: Suíte completa de testes, typecheck e lint**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: Tudo passando, sem warnings novos.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: Build conclui sem erros (confirma que a remoção de `app/(auth)/escolha-de-plano/` e do `selectPlan` não deixou nenhuma referência quebrada).

- [ ] **Step 3: Walkthrough no navegador**

Run: `npm run dev`

Confirmar, nesta ordem:
1. `/` (landing) — seção "Planos" mostra Free/Starter/Pro; "Começar grátis" leva a `/cadastro`; "Fale conosco" nos outros dois abre WhatsApp com a mensagem certa por plano.
2. Cadastro completo de uma loja nova (via Mailpit local) — cai em `/painel` sem passar por `/escolha-de-plano`.
3. `/painel` da loja recém-criada — mostra a faixa "Plano Free · Fale conosco para liberar mais produtos".
4. Cadastrar produtos/categorias até o limite do Free (8 produtos, 1 categoria) — a partir daí a criação é bloqueada com a mensagem "Limite de produtos do seu plano atingido. Fale conosco para aumentar o limite."
5. No Supabase Studio local, editar essa loja para `plan='pro'`, `trial_ends_at=null` — recarregar `/painel`: a faixa de upgrade desaparece e os limites de criação sobem para os do Pro.
6. Editar a mesma loja para `plan='pro'`, `trial_ends_at` no passado — recarregar `/painel`: a faixa de upgrade volta a aparecer e os limites de criação voltam para os do Free (produtos/categorias já existentes continuam visíveis).
7. `/termos-de-uso` — seção 4 sem preços/trial, seção 5 sem menção a fatura.
8. Navegar direto para `/escolha-de-plano` — deve dar 404 (rota removida).

Expected: Todos os 8 pontos conferem com o comportamento descrito na spec (`docs/superpowers/specs/2026-07-24-plano-gratuito-e-planos-pagos-manuais-design.md`).

- [ ] **Step 4: Reportar ao usuário**

Sem commit neste step — é só a checagem final antes de considerar o plano concluído. Se algum ponto do walkthrough falhar, voltar ao task correspondente, corrigir e re-rodar a suíte antes de seguir.

---

## Self-Review

**Cobertura da spec:** Modelo de planos (Task 1, 4), cadastro no Free (Task 6), landing com Fale conosco (Task 8), remoção de `/escolha-de-plano` (Task 6), rebaixamento automático (Task 1, 7), banner do painel (Task 7), enforcement técnico (Task 1-3), Termos de Uso (Task 9). Todos os itens do spec aprovado têm task correspondente.

**Placeholders:** Nenhum "TBD"/"implementar depois" — todo step tem código completo ou comando exato.

**Consistência de tipos:** `Plan`, `PlanLimits`, `getEffectivePlan`, `getPlanLimits(plan, trialEndsAt)` usados com a mesma assinatura em todos os tasks que os consomem (2, 3, 7). `VTRINE_WHATSAPP_NUMBER` definida no Task 5 e consumida sem redefinição nos Tasks 7 e 8.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-24-plano-gratuito-e-planos-pagos-manuais.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
