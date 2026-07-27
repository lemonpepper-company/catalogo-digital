# Domínio Próprio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar uma loja Pro acessível pelo domínio próprio dela (ex: `boutiquedaana.com.br`) em vez de só `catalogo.digital/{slug}`, mantendo a ativação real manual (você adiciona o domínio na Vercel depois que o lojista aponta o DNS).

**Architecture:** Duas colunas novas em `stores` (`custom_domain`, `custom_domain_verified`). O lojista cadastra o domínio numa nova seção de Configurações; a gravação nunca marca `custom_domain_verified = true` sozinha — isso só acontece por edição manual sua no Supabase, depois de confirmar o DNS. O `middleware.ts` ganha um branch que, pra qualquer request cujo `Host` não seja o domínio principal da aplicação, consulta `stores` por `custom_domain` (só considerando `custom_domain_verified = true`) e reescreve a rota internamente para `/{slug}` — sem o visitante perceber a troca de URL.

**Tech Stack:** Next.js Middleware (Edge runtime), Supabase (Postgres), Zod, Vitest.

## Global Constraints

- Gating aditivo: recurso exclusivo de Pro (`customDomain` flag em `PlanLimits`).
- Toda validação de plano é feita no servidor (server action), nunca só na UI.
- `custom_domain`/`custom_domain_verified` **não são sensíveis** (um domínio é, por definição, informação pública assim que o DNS existe) — diferente de `plan`/`trial_ends_at`, podem ser lidos pelo `anon` sem reabrir o achado de segurança MEDIA-03 (`docs/superpowers/specs/2026-07-06-remediacao-seguranca-design.md`).
- A ativação real (`custom_domain_verified = true`) é **sempre manual**, feita por você direto no Supabase depois de confirmar o DNS e adicionar o domínio no projeto Vercel — nenhuma server action deste plano jamais grava `true` nessa coluna.
- Referência de design/spec: `docs/superpowers/specs/2026-07-25-diferenciacao-planos-design.md` (§3, §4, §5.3, §6, §8).
- Este plano assume que `2026-07-25-personalizacao-visual-avancada.md` (Tasks 1-2) já rodou ou pode rodar de forma independente — a Task 2 deste plano só adiciona um campo a mais em `PlanLimits`; se a outra plan já tiver sido aplicada, aplicar o diff da Task 2 sobre o estado atual do arquivo em vez do estado descrito aqui.

---

## Mapa de arquivos

**Novos:**
- `supabase/migrations/20260725110000_custom_domain_columns.sql`
- `supabase/migrations/20260725110100_grant_anon_custom_domain.sql`
- `lib/domain-routing.ts`
- `__tests__/domain-routing.test.ts`
- `components/loja/DominioField.tsx`
- `app/painel/configuracoes/use-dominio.ts`

**Modificados:**
- `lib/plan-limits.ts`, `__tests__/plan-limits.test.ts`
- `lib/types.ts`
- `lib/server/store.ts`
- `lib/validation/painel.ts`
- `app/actions/store.ts`
- `app/painel/configuracoes/ConfiguracoesClient.tsx`
- `middleware.ts`
- `app/landing/data.tsx`

---

### Task 1: Migração de banco — colunas e grants

**Files:**
- Create: `supabase/migrations/20260725110000_custom_domain_columns.sql`
- Create: `supabase/migrations/20260725110100_grant_anon_custom_domain.sql`

**Interfaces:**
- Produces: colunas `stores.custom_domain` (text, `unique`, nullable), `stores.custom_domain_verified` (boolean, default `false`); grant de `select` para `anon` em `stores(custom_domain, custom_domain_verified)` — consumido pela Task 7 (middleware).

- [ ] **Step 1: Escrever a migration de colunas**

```sql
-- supabase/migrations/20260725110000_custom_domain_columns.sql
alter table stores add column custom_domain text unique;
alter table stores add column custom_domain_verified boolean not null default false;
```

- [ ] **Step 2: Escrever a migration de grant**

```sql
-- supabase/migrations/20260725110100_grant_anon_custom_domain.sql
-- custom_domain/custom_domain_verified não são sensíveis (um domínio próprio é
-- informação pública assim que o DNS existe) — diferente de plan/trial_ends_at
-- (achado MEDIA-03), este grant não reabre nenhuma proteção de segurança.
-- Necessário para o middleware resolver a loja pelo host da request usando o
-- mesmo cliente anon já usado no catálogo público (ver lib/supabase/server.ts).
grant select (custom_domain, custom_domain_verified) on public.stores to anon;
```

- [ ] **Step 3: Aplicar as migrations localmente**

Run: `npx supabase db reset` (ou `npx supabase migration up`)
Expected: as duas migrations aplicadas sem erro; `select custom_domain, custom_domain_verified from stores limit 1;` roda sem erro de permissão pro papel `anon`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260725110000_custom_domain_columns.sql supabase/migrations/20260725110100_grant_anon_custom_domain.sql
git commit -m "feat(db): adiciona colunas de domínio próprio e grant para o anon"
```

---

### Task 2: Flag `customDomain` em `lib/plan-limits.ts`

**Files:**
- Modify: `lib/plan-limits.ts`
- Modify: `__tests__/plan-limits.test.ts`

**Interfaces:**
- Produces: `PlanLimits.customDomain: boolean` (`true` só no Pro). Consumido pelas Tasks 5, 6, 7.

- [ ] **Step 1: Escrever o teste que falha primeiro**

Adicionar a `__tests__/plan-limits.test.ts`:

```ts
describe("getPlanLimits — domínio próprio", () => {
  it("free e starter não têm domínio próprio", () => {
    expect(getPlanLimits("free", null).customDomain).toBe(false);
    expect(getPlanLimits("starter", null).customDomain).toBe(false);
  });

  it("pro tem domínio próprio", () => {
    expect(getPlanLimits("pro", null).customDomain).toBe(true);
  });

  it("pro com trial_ends_at expirado perde o domínio próprio (cai para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(getPlanLimits("pro", past).customDomain).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: FAIL — `customDomain` é `undefined`.

- [ ] **Step 3: Implementar a flag**

Se a Task 2 de `2026-07-25-personalizacao-visual-avancada.md` já rodou, `PlanLimits`/`FREE_LIMITS`/`STARTER_LIMITS`/`PRO_LIMITS` já existem estendidos — só adicionar `customDomain` a cada um. Se não rodou ainda, `PlanLimits` ganha (ao lado dos campos já existentes hoje: `maxProducts`, `maxCategories`, `maxPhotos`):

```ts
export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
  customDomain: boolean;
}
```

Com `customDomain: false` em `FREE_LIMITS` e `STARTER_LIMITS`, `customDomain: true` em `PRO_LIMITS`.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS em todos os testes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-limits.ts __tests__/plan-limits.test.ts
git commit -m "feat: adiciona flag customDomain (Pro) ao PlanLimits"
```

---

### Task 3: `lib/domain-routing.ts` — regra pura de host próprio vs. domínio externo

Função pura e testável, separada do middleware (que não roda em ambiente de teste padrão) — mesmo raciocínio de `resolveCatalog` em `lib/catalog.ts`.

**Files:**
- Create: `lib/domain-routing.ts`
- Create: `__tests__/domain-routing.test.ts`

**Interfaces:**
- Produces: `isOwnHost(hostname: string, siteUrl: string | undefined): boolean`. Consumido pela Task 7 (middleware).

- [ ] **Step 1: Escrever os testes que falham primeiro**

```ts
// __tests__/domain-routing.test.ts
import { describe, it, expect } from "vitest";
import { isOwnHost } from "@/lib/domain-routing";

describe("isOwnHost", () => {
  const siteUrl = "https://catalogo.digital";

  it("reconhece o domínio principal da aplicação", () => {
    expect(isOwnHost("catalogo.digital", siteUrl)).toBe(true);
  });

  it("reconhece localhost (dev)", () => {
    expect(isOwnHost("localhost", siteUrl)).toBe(true);
  });

  it("reconhece qualquer preview da Vercel (*.vercel.app)", () => {
    expect(isOwnHost("catalogo-digital-git-main-time.vercel.app", siteUrl)).toBe(true);
  });

  it("um domínio de loja não bate com nenhum dos anteriores", () => {
    expect(isOwnHost("boutiquedaana.com.br", siteUrl)).toBe(false);
  });

  it("sem NEXT_PUBLIC_SITE_URL configurado, trata tudo como próprio (nunca tenta rotear por domínio)", () => {
    expect(isOwnHost("qualquer-coisa.com", undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/domain-routing.test.ts`
Expected: FAIL com `Cannot find module '@/lib/domain-routing'`.

- [ ] **Step 3: Implementar `lib/domain-routing.ts`**

```ts
export function isOwnHost(hostname: string, siteUrl: string | undefined): boolean {
  if (!siteUrl) return true;

  let ownHostname: string;
  try {
    ownHostname = new URL(siteUrl).hostname;
  } catch {
    return true;
  }

  return (
    hostname === ownHostname ||
    hostname === "localhost" ||
    hostname.endsWith(".vercel.app")
  );
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/domain-routing.test.ts`
Expected: PASS em todos os casos.

- [ ] **Step 5: Commit**

```bash
git add lib/domain-routing.ts __tests__/domain-routing.test.ts
git commit -m "feat: adiciona isOwnHost, regra pura de host próprio vs. domínio de loja"
```

---

### Task 4: Threading de tipos

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/server/store.ts`

**Interfaces:**
- Produces: `StoreSettings.customDomain: string | null`, `StoreSettings.customDomainVerified: boolean`. Consumido pelas Tasks 5 e 6.

- [ ] **Step 1: Estender `StoreSettings` em `lib/types.ts`**

Após `deliveryMethods: string[];` (ou após os campos de tema, se a outra plan já rodou):

```ts
  customDomain: string | null;
  customDomainVerified: boolean;
```

- [ ] **Step 2: Estender `StoreRow`/`mapStore`/`getCurrentStore` em `lib/server/store.ts`**

No `type StoreRow`, após `delivery_methods: string[] | null;`:

```ts
  custom_domain: string | null;
  custom_domain_verified: boolean;
```

Em `mapStore`, após `deliveryMethods: row.delivery_methods ?? [],`:

```ts
    customDomain: row.custom_domain,
    customDomainVerified: row.custom_domain_verified,
```

No SELECT de `getCurrentStore`, adicionar `custom_domain, custom_domain_verified` à string de colunas (esta é a query autenticada do painel, via RLS de `authenticated` — não passa pelo grant restrito do `anon`, então não tem relação com a Task 1).

- [ ] **Step 3: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/server/store.ts
git commit -m "feat: adiciona customDomain/customDomainVerified a StoreSettings"
```

---

### Task 5: Validação e server action `updateCustomDomain`

**Files:**
- Modify: `lib/validation/painel.ts`
- Modify: `app/actions/store.ts`

**Interfaces:**
- Consumes: `getPlanLimits` (Task 2), `StoreSettings.customDomain` (Task 4).
- Produces: `updateCustomDomain(prevState, formData): Promise<StoreActionState>`. Consumido pela Task 6.

- [ ] **Step 1: Adicionar `domainSchema` a `lib/validation/painel.ts`**

```ts
// Hostname puro: sem protocolo, sem path, sem porta. Ex: "boutiquedaana.com.br".
export const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    "Domínio inválido — use o formato exemplo.com.br, sem http:// e sem barras"
  )
  .nullable();
```

- [ ] **Step 2: Adicionar `updateCustomDomain` em `app/actions/store.ts`**

Ler o arquivo inteiro antes de editar (já lido nesta sessão). Adicionar ao final:

```ts
import { domainSchema } from "@/lib/validation/painel";
import { getPlanLimits } from "@/lib/plan-limits";

export async function updateCustomDomain(
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

  const limits = getPlanLimits(store.plan, store.trialEndsAt);
  if (!limits.customDomain) {
    return { error: "Domínio próprio disponível apenas no plano Pro. Fale conosco para liberar." };
  }

  const raw = (formData.get("customDomain") as string) || "";
  const parsed = domainSchema.safeParse(raw === "" ? null : raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const nextDomain = parsed.data;
  // Qualquer mudança no domínio (incluindo remoção) zera a verificação — a
  // ativação real é sempre manual, feita por você direto no Supabase depois
  // de confirmar o DNS. Esta action NUNCA grava custom_domain_verified = true.
  const domainChanged = nextDomain !== store.customDomain;

  const { error } = await supabase
    .from("stores")
    .update({
      custom_domain: nextDomain,
      ...(domainChanged ? { custom_domain_verified: false } : {}),
    })
    .eq("id", store.id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Esse domínio já está em uso por outra loja." };
    }
    return { error: "Erro ao salvar o domínio." };
  }

  revalidatePath("/painel/configuracoes");
  return { ok: true };
}
```

- [ ] **Step 3: Verificação manual da validação de plano no servidor**

Com uma loja `plan = 'starter'`, montar a request manualmente (ou via DevTools) chamando `updateCustomDomain` com um domínio válido.
Expected: retorna `{ error: "Domínio próprio disponível apenas no plano Pro..." }`; `custom_domain` no Supabase continua `null`.

- [ ] **Step 4: Commit**

```bash
git add lib/validation/painel.ts app/actions/store.ts
git commit -m "feat: adiciona updateCustomDomain com validação de plano e formato"
```

---

### Task 6: UI — seção "Domínio" em Configurações

**Files:**
- Create: `components/loja/DominioField.tsx`
- Create: `app/painel/configuracoes/use-dominio.ts`
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`

**Interfaces:**
- Consumes: `updateCustomDomain` (Task 5), `StoreSettings.customDomain/customDomainVerified` (Task 4), `PlanLimits.customDomain` (Task 2).

- [ ] **Step 1: Criar `app/painel/configuracoes/use-dominio.ts`**

Form e Server Action independentes do resto de Configurações, seguindo o padrão já estabelecido em `use-personalizacao.ts` ("uma action por concern, um hook por feature").

```ts
"use client";

import { useActionState, useState } from "react";
import { updateCustomDomain } from "@/app/actions/store";
import type { StoreSettings, ToastState } from "@/lib/types";

type State = { error: string } | { ok: true } | null;

export function useDominio(settings: StoreSettings) {
  const [domain, setDomain] = useState(settings.customDomain ?? "");
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("customDomain", domain);
      const res = await updateCustomDomain(prev, formData);
      if (res && "ok" in res) flash("Domínio salvo — aguardando verificação");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  return { domain, setDomain, state, formAction, pending, toast };
}
```

- [ ] **Step 2: Criar `components/loja/DominioField.tsx`**

```tsx
"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface DominioFieldProps {
  domain: string;
  onDomainChange: (value: string) => void;
  verified: boolean;
  hasDomain: boolean;
  unlocked: boolean;
  pending: boolean;
}

export function DominioField({
  domain,
  onDomainChange,
  verified,
  hasDomain,
  unlocked,
  pending,
}: DominioFieldProps) {
  if (!unlocked) {
    return (
      <p className="font-body text-[13px] text-graphite">
        Domínio próprio disponível no plano Pro.{" "}
        <a
          href="https://wa.me/5535999931678?text=Ol%C3%A1!%20Quero%20saber%20mais%20sobre%20dom%C3%ADnio%20pr%C3%B3prio."
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Fale conosco
        </a>
        .
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        name="customDomain"
        label="Domínio"
        placeholder="minhaloja.com.br"
        value={domain}
        onChange={(e) => onDomainChange(e.target.value)}
      />
      {hasDomain && (
        <span
          className={
            verified
              ? "inline-flex w-fit items-center h-6 px-2.5 rounded-pill bg-[#e6f4ee] text-[#1a9c6e] font-body text-[12px]"
              : "inline-flex w-fit items-center h-6 px-2.5 rounded-pill bg-linen text-graphite font-body text-[12px]"
          }
        >
          {verified ? "Verificado" : "Aguardando verificação"}
        </span>
      )}
      <p className="font-body text-[13px] text-graphite">
        Aponte um registro CNAME do seu domínio para nós e avise pelo WhatsApp — a
        ativação é feita manualmente após a verificação do DNS.
      </p>
      <Button type="submit" variant="ghost" size="sm" disabled={pending} className="self-start">
        {pending ? "Salvando…" : "Salvar domínio"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar a seção em `ConfiguracoesClient.tsx`**

Ler o arquivo inteiro antes de editar (já lido nesta sessão). Como o domínio é uma concern independente do form principal de Configurações, ele ganha o próprio `<form>`, separado do `<form action={f.formAction}>` existente — evita que salvar identidade/mensagem também reenvie o domínio, e vice-versa. Adicionar após o `</form>` que fecha o form principal:

```tsx
<form action={dominio.formAction}>
  <Card>
    <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
      Domínio próprio
    </h2>
    <p className="font-body text-[13px] text-graphite mb-4">
      Acesse sua vitrine pelo seu próprio domínio em vez de catalogo.digital/{settings.slug}.
    </p>
    <DominioField
      domain={dominio.domain}
      onDomainChange={dominio.setDomain}
      verified={settings.customDomainVerified}
      hasDomain={!!settings.customDomain}
      unlocked={limits.customDomain}
      pending={dominio.pending}
    />
    {dominio.toast && <Toast msg={dominio.toast.msg} tone={dominio.toast.tone} />}
  </Card>
</form>
```

Importar `useDominio` de `./use-dominio`, `DominioField` de `@/components/loja/DominioField`, e `getPlanLimits`/`PlanLimits` — a página `app/painel/configuracoes/page.tsx` precisa calcular `const limits = getPlanLimits(store.plan, store.trialEndsAt);` e passar como prop nova `<ConfiguracoesClient settings={store} limits={limits} />` (mesmo padrão da Task 5/Step 2 do plano de personalização). Chamar `const dominio = useDominio(settings);` no topo do componente.

- [ ] **Step 4: Verificação manual**

Run: `npm run dev`, abrir `/painel/configuracoes` com uma loja `plan = 'starter'`.
Expected: seção mostra só o texto "Domínio próprio disponível no plano Pro... Fale conosco", sem campo de input. Mudar a loja para `plan = 'pro'` no Supabase e recarregar: campo de input aparece; salvar um domínio válido mostra o badge "Aguardando verificação"; salvar um domínio com formato inválido (ex: `http://foo`) mostra o erro da validação.

- [ ] **Step 5: Commit**

```bash
git add components/loja/DominioField.tsx app/painel/configuracoes/use-dominio.ts app/painel/configuracoes/ConfiguracoesClient.tsx app/painel/configuracoes/page.tsx
git commit -m "feat: UI de domínio próprio em Configurações (Pro)"
```

---

### Task 7: Roteamento por domínio no `middleware.ts`

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `isOwnHost` (Task 3), `createAnonClient` (já existe em `lib/supabase/server.ts`).

- [ ] **Step 1: Ler o middleware completo antes de editar**

Ler `middleware.ts` inteiro (já lido nesta sessão) para preservar exatamente a lógica de auth existente (`needsAuth`, redirects de `/login` e `/painel`) sem alterá-la.

- [ ] **Step 2: Adicionar o branch de roteamento por domínio**

No topo da função `middleware`, antes do cálculo de `needsAuth`:

```ts
import { createAnonClient } from '@/lib/supabase/server'
import { isOwnHost } from '@/lib/domain-routing'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host')?.split(':')[0] ?? ''

  if (pathname === '/' && !isOwnHost(hostname, process.env.NEXT_PUBLIC_SITE_URL)) {
    const anon = createAnonClient()
    const { data: store } = await anon
      .from('stores')
      .select('slug')
      .eq('custom_domain', hostname)
      .eq('custom_domain_verified', true)
      .maybeSingle()

    if (store) {
      const url = request.nextUrl.clone()
      url.pathname = `/${store.slug}`
      return NextResponse.rewrite(url)
    }
    // Domínio desconhecido ou ainda não verificado: segue o fluxo normal
    // (a rota "/" sem loja correspondente cai no 404 padrão do Next).
  }

  const needsAuth = pathname === '/login' || pathname.startsWith('/painel')

  // ... (resto da função continua exatamente igual)
}
```

- [ ] **Step 3: Verificação manual local (sem domínio real)**

Simular localmente com `curl`, apontando um `Host` arbitrário contra o dev server:

Run: `npm run dev` (em outro terminal) e depois:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: dominio-nao-cadastrado.com" http://localhost:3000/
```
Expected: `404` (nenhuma loja com esse `custom_domain`) — confirma que hosts desconhecidos não quebram a aplicação.

Depois, gravar `custom_domain = 'dominio-nao-cadastrado.com'` e `custom_domain_verified = true` numa loja de teste no Supabase local, repetir o mesmo `curl`.
Expected: a resposta reflete o conteúdo de `/{slug}` daquela loja (o `rewrite` interno é transparente pro `curl`, então o corpo da resposta é o HTML da vitrine daquela loja, com `200`).

- [ ] **Step 4: Rodar a suíte completa**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — nenhuma regressão nos testes existentes (o middleware em si não tem testes unitários diretos, seguindo o padrão do projeto de só testar funções puras; a lógica pura já está coberta em `__tests__/domain-routing.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add middleware.ts
git commit -m "feat: roteia domínio próprio verificado para o catálogo da loja"
```

---

### Task 8: Atualizar a landing page com o novo diferencial

**Files:**
- Modify: `app/landing/data.tsx`

**Interfaces:**
- Nenhuma — só texto estático consumido por `app/page.tsx` (já existente, não muda).

- [ ] **Step 1: Adicionar a linha em `proFeatures`**

Ler `app/landing/data.tsx` linhas 106-122 antes de editar (já lido nesta sessão). `proFeatures` é exclusiva de Pro — domínio próprio é só Pro, então só essa lista ganha a linha nova:

```ts
export const proFeatures = [
  "Produtos ilimitados",
  "Categorias ilimitadas",
  "5 fotos por produto",
  "Domínio próprio",
];
```

Se outro plano deste pacote (personalização ou CSV) já tiver adicionado uma linha a `proFeatures` antes deste, **adicionar a linha nova junto às existentes**, não sobrescrever o array.

- [ ] **Step 2: Verificação manual**

Run: `npm run dev`, abrir `/` e rolar até a seção "Planos".
Expected: o card Pro lista "Domínio próprio" como um dos itens, com o mesmo ícone de check dos demais.

- [ ] **Step 3: Commit**

```bash
git add app/landing/data.tsx
git commit -m "feat: adiciona domínio próprio às features do plano Pro na landing"
```

---

## Self-Review

**Cobertura da spec (§3, §4, §5.3, §6, §8 de `2026-07-25-diferenciacao-planos-design.md`):**
- §3.1 (colunas `custom_domain`/`custom_domain_verified`) → Task 1.
- §4 (flag `customDomain` em `PlanLimits`) → Task 2.
- §5.3 (UI de domínio em Configurações, ativação manual) → Tasks 5 e 6.
- §6 (roteamento por domínio no middleware) → Task 7.
- §8 (validação de formato, unicidade, `custom_domain_verified = true` só via middleware) → Task 5 (formato + unicidade) e Task 7 (middleware só resolve quando verificado).
- Carência de 3 dias e exceção do domínio continuar funcionando durante a carência (§8 da spec) — fora deste plano: a carência em si é implementada em `getEffectivePlan()` por outra rodada; este plano já não desliga o roteamento de domínio com base em plano nenhum (Task 7 só verifica `custom_domain_verified`, nunca o plano), então a exceção já está satisfeita estruturalmente sem trabalho extra.
- Automação de compra/renovação de domínio e SSL — fora de escopo (§11.2 da spec), não há task correspondente.
- Atualização da landing page com o novo diferencial → Task 8.

**Checagem de tipos:** `isOwnHost(hostname: string, siteUrl: string | undefined): boolean` (Task 3) é chamada com a mesma assinatura no teste (Task 3) e no middleware (Task 7). `StoreSettings.customDomain`/`customDomainVerified` (Task 4) usados com os mesmos nomes em `use-dominio.ts`, `DominioField.tsx` e `updateCustomDomain` (Task 5).

**Segurança:** `custom_domain`/`custom_domain_verified` são as únicas colunas novas expostas ao `anon` neste plano — nenhuma delas é sensível, e nenhuma task reabre o achado MEDIA-03 (`plan`/`trial_ends_at` continuam fora do alcance do `anon`; a Task 7 não precisa dessas colunas, só de `custom_domain`/`custom_domain_verified`/`slug`).

**Placeholders:** nenhum "TBD" — a Task 6 nomeia o botão "Salvar domínio" (não "Verificar") deliberadamente, para não sugerir uma verificação automática que não existe.

---

Plano completo e salvo em `docs/superpowers/plans/2026-07-25-dominio-proprio.md`.
