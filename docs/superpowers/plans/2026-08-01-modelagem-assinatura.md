# Modelagem de Assinatura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `stores.trial_ends_at` sobrecarregado por um modelo explícito de assinatura, sem integrar gateway nenhum.

**Architecture:** Três tasks encadeadas, cada uma deixando a aplicação funcionando. A primeira adiciona as colunas novas e reescreve as duas funções `security definer` sobre `plan_expires_at` — como `trial_ends_at` está nulo em todas as lojas, o comportamento não muda. A segunda migra o TypeScript para a coluna nova. A terceira remove a coluna antiga, que a essa altura ninguém mais referencia.

**Tech Stack:** Supabase (Postgres, funções `security definer`, GRANT por coluna), TypeScript, Next.js App Router, Vitest.

## Global Constraints

- **Spec de referência:** `docs/superpowers/specs/2026-08-01-modelagem-assinatura-design.md` (commits `2861807`, `769ac63`).
- **Duas funções replicam a regra de expiração**, não uma: `get_effective_plan` ([20260725100200](../../../supabase/migrations/20260725100200_get_effective_plan_function.sql)) e `resolve_custom_domain` ([20260730020000:32](../../../supabase/migrations/20260730020000_resolve_custom_domain.sql)). As duas precisam ser reescritas **antes** do `drop column`. Postgres não rastreia dependências dentro do corpo de funções SQL: o drop passa sem erro e a quebra só aparece em runtime.
- **`resolve_custom_domain` falha em silêncio.** O middleware faz *fail-open* — erro logado, visitante vê a landing da Vtrine no domínio do lojista. Não há 500 nem alarme, então essa função nunca deve ser testada só "olhando se o site subiu".
- **`subscription_status` não entra na regra de acesso.** Acesso é decidido só por `plan` + `plan_expires_at`. O status é informativo e será consumido pela Spec 2B.
- **`plan` nunca é rebaixado por código.** Expiração é derivada na leitura; a coluna guarda o plano contratado.
- **Nada depende de cron.** Nenhum estado precisa de job agendado para ficar correto.
- **Colunas novas não entram nos tipos TypeScript nesta rodada.** Só `plan_expires_at` é lida, e apenas pelas funções SQL. `subscription_status`, `billing_cycle` e os dois IDs do Asaas ficam inertes até a Spec 2B.
- **Coluna nova em `stores` já nasce protegida:** `authenticated` teve `insert, update` revogados com re-grant nominal ([20260728110000](../../../supabase/migrations/20260728110000_replace_trigger_with_column_revoke.sql)) e `anon` tem `select` por coluna ([20260709000000](../../../supabase/migrations/20260709000000_restringe_colunas_publicas_stores.sql)). **Não adicionar as colunas novas a nenhum desses grants.**
- **Fora de escopo (Spec 2B):** Asaas, webhook, página de assinatura, preços em `app/page.tsx`, CTAs de upsell, proporcional no upgrade, dunning.
- **Comandos:** `npx vitest run <caminho>` para arquivo único, `npx vitest run` para a suíte, `npx tsc --noEmit` para tipos, `npx supabase db push` para migrations.

---

### Task 1: Colunas novas e reescrita das duas funções

Ao final desta task, `trial_ends_at` ainda existe mas ninguém mais a lê. Como ela está nula em todas as lojas desde [20260725000000](../../../supabase/migrations/20260725000000_backfill_null_trial_ends_at.sql), e `plan_expires_at` nasce nula, o comportamento observável é idêntico ao de hoje.

**Files:**
- Create: `supabase/migrations/20260801000000_subscription_columns.sql`

**Interfaces:**
- Consumes: nada.
- Produces: colunas `plan_expires_at timestamptz`, `subscription_status text`, `billing_cycle text`, `asaas_customer_id text`, `asaas_subscription_id text` em `public.stores`. `get_effective_plan(uuid) → text` e `resolve_custom_domain(text) → table(store_slug text, domain_verified boolean, effective_plan text)` passam a derivar de `plan_expires_at`. Task 2 consome `plan_expires_at`; Task 3 remove `trial_ends_at`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260801000000_subscription_columns.sql`:

```sql
-- Substitui o trial_ends_at sobrecarregado (trial de 14 dias → "liberação
-- manual expira em" → seria também "fim do período pago" e "fim da graça")
-- por um modelo explícito. A coluna antiga sai na migration seguinte, depois
-- que o TypeScript migrar — nada aqui a remove.
--
-- Vocabulário de subscription_status é NOSSO, não o do Asaas: a tradução dos
-- eventos do gateway acontece num único ponto do webhook (Spec 2B). Sem
-- estado 'expired': expiração é comparação de data, e um estado que precisa
-- de job agendado para ficar correto é um estado que vai ficar errado.
alter table public.stores
  add column plan_expires_at timestamptz,
  add column subscription_status text
    check (subscription_status in ('active', 'past_due', 'canceled')),
  add column billing_cycle text
    check (billing_cycle in ('monthly', 'annual')),
  add column asaas_customer_id text,
  add column asaas_subscription_id text;

-- DUAS funções replicam a regra de expiração. Ambas precisam migrar ANTES do
-- drop da coluna antiga: Postgres não rastreia dependências dentro do corpo
-- de funções SQL, então o drop passaria sem erro e a quebra só apareceria em
-- runtime.

-- 1/2 — vitrine por slug. Continua devolvendo o plano JÁ resolvido, nunca
-- plan/plan_expires_at crus: o anon tem EXECUTE aqui e nada nas colunas.
create or replace function public.get_effective_plan(p_store_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when s.plan <> 'free'
        and s.plan_expires_at is not null
        and s.plan_expires_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.id = p_store_id;
$$;

-- 2/2 — vitrine por domínio próprio. Esta é a que falha em SILÊNCIO se for
-- esquecida: o middleware faz fail-open, então o visitante veria a landing da
-- Vtrine no domínio do lojista, sem 500 e sem alarme.
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
      when s.plan <> 'free'
        and s.plan_expires_at is not null
        and s.plan_expires_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.custom_domain = p_hostname;
$$;

-- O webhook (Spec 2B) roda com service_role, que hoje só tem update em
-- (plan, trial_ends_at) e (custom_domain, custom_domain_verified). Sem este
-- grant a escrita falha com "permission denied for table stores" — e, como
-- toda a suíte mocka o Supabase, a suíte fica verde. É o cuidado crítico do
-- AGENTS.md.
--
-- authenticated e anon NÃO recebem nada: o grant de authenticated é uma
-- allowlist nominal (20260728110000) e o select do anon é por coluna
-- (20260709000000), então as colunas novas já nascem inacessíveis para os
-- dois. Adicionar qualquer uma delas àqueles grants reabriria a
-- auto-promoção a Pro via PostgREST.
grant update (
  plan_expires_at,
  subscription_status,
  billing_cycle,
  asaas_customer_id,
  asaas_subscription_id
) on public.stores to service_role;
```

- [ ] **Step 2: Aplicar a migration**

Run: `npx supabase db push`
Expected: aplica sem erro. Se o Supabase local não estiver rodando, `npx supabase start` antes.

- [ ] **Step 3: Verificar os privilégios das colunas novas**

Run:
```bash
npx supabase db execute --sql "select has_column_privilege('service_role','public.stores','plan_expires_at','update') as svc_update, has_column_privilege('authenticated','public.stores','plan_expires_at','update') as auth_update, has_column_privilege('anon','public.stores','subscription_status','select') as anon_select;"
```
Expected: `svc_update = t`, `auth_update = f`, `anon_select = f`.

As duas últimas são as que importam: elas travam a auto-promoção a Pro e o vazamento do estado de assinatura para o público.

- [ ] **Step 4: Verificar que as duas funções migraram**

Run:
```bash
npx supabase db execute --sql "select proname from pg_proc where proname in ('get_effective_plan','resolve_custom_domain') and prosrc like '%plan_expires_at%';"
```
Expected: duas linhas — `get_effective_plan` e `resolve_custom_domain`. Se vier só uma, a outra ficou para trás e o `drop` da Task 3 vai quebrá-la em silêncio.

- [ ] **Step 5: Rodar a suíte**

Run: `npx vitest run`
Expected: PASS. Nada em TypeScript mudou ainda.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260801000000_subscription_columns.sql
git commit -m "feat: colunas de assinatura e funções sobre plan_expires_at"
```

---

### Task 2: Migrar o TypeScript para `plan_expires_at`

**Files:**
- Modify: `lib/plan-limits.ts:51-72`
- Modify: `lib/types.ts:124`
- Modify: `lib/server/store.ts:62,114`
- Modify: `lib/catalog-url.ts:6,10`
- Modify: 13 arquivos de `app/` que chamam `getPlanLimits`/`getEffectivePlan`
- Test: 11 arquivos em `__tests__/`

**Interfaces:**
- Consumes: coluna `plan_expires_at` (Task 1).
- Produces: `getEffectivePlan(plan: Plan, planExpiresAt: string | null): Plan` e `getPlanLimits(plan: Plan, planExpiresAt: string | null): PlanLimits`. `Store`/`StoreSettings` passam a expor `planExpiresAt: string | null`. Task 3 depende de nenhuma referência a `trial_ends_at` restar.

- [ ] **Step 1: Atualizar os testes da derivação**

Em `__tests__/plan-limits.test.ts`, substituir o bloco `describe("getEffectivePlan")` inicial por:

```ts
describe("getEffectivePlan", () => {
  const futuro = new Date(Date.now() + 86_400_000).toISOString();
  const passado = "2020-01-01T00:00:00.000Z";

  it("free continua free, independente da data", () => {
    expect(getEffectivePlan("free", passado)).toBe("free");
    expect(getEffectivePlan("free", futuro)).toBe("free");
    expect(getEffectivePlan("free", null)).toBe("free");
  });

  it("mantém starter/pro quando plan_expires_at é nulo (indeterminado)", () => {
    expect(getEffectivePlan("starter", null)).toBe("starter");
    expect(getEffectivePlan("pro", null)).toBe("pro");
  });

  it("mantém starter/pro quando plan_expires_at está no futuro", () => {
    expect(getEffectivePlan("starter", futuro)).toBe("starter");
    expect(getEffectivePlan("pro", futuro)).toBe("pro");
  });

  it("rebaixa starter/pro para free quando plan_expires_at já passou", () => {
    expect(getEffectivePlan("starter", passado)).toBe("free");
    expect(getEffectivePlan("pro", passado)).toBe("free");
  });
});
```

- [ ] **Step 2: Travar o período de graça como propriedade da data**

Adicionar, ainda em `__tests__/plan-limits.test.ts`:

```ts
describe("getEffectivePlan — período de graça", () => {
  /**
   * A graça de 3 dias é implementada empurrando plan_expires_at (Spec 2B),
   * nunca lendo subscription_status. Este teste existe para travar isso: se
   * alguém tentar fazer o acesso depender do status, ele quebra.
   */
  it("cobrança falhada com data no futuro continua liberando o plano", () => {
    const dentroDaGraca = new Date(Date.now() + 2 * 86_400_000).toISOString();
    expect(getEffectivePlan("pro", dentroDaGraca)).toBe("pro");
  });

  it("graça vencida cai para free", () => {
    const gracaVencida = new Date(Date.now() - 1000).toISOString();
    expect(getEffectivePlan("pro", gracaVencida)).toBe("free");
  });
});
```

- [ ] **Step 3: Rodar e confirmar que passam — sim, passam**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS.

Isto **não** é uma falha do processo. Renomear um parâmetro não muda comportamento nenhum em JavaScript, então não existe estado vermelho honesto aqui: os testes dos Steps 1 e 2 passam antes e depois da mudança, por construção. Eles são testes de caracterização — existem para provar que a renomeação **não** alterou a regra, e para travar o desenho do período de graça contra quem no futuro tentar fazer o acesso depender de `subscription_status`.

O sinal vermelho real desta task vem do compilador, não do Vitest: assim que `lib/types.ts` deixar de expor `trialEndsAt` (Step 5), `npx tsc --noEmit` quebra em todos os pontos não migrados. É esse o teste que guia o trabalho aqui, e ele roda no Step 9.

- [ ] **Step 4: Reescrever `lib/plan-limits.ts`**

Substituir as linhas 51-72:

```ts
function isPlanAccessExpired(planExpiresAt: string | null): boolean {
  if (!planExpiresAt) return false;
  return new Date(planExpiresAt).getTime() <= Date.now();
}

/**
 * O plano contratado (`plan`) vale até `plan_expires_at`. Nulo = não expira:
 * loja free, ou liberação manual indeterminada feita direto no banco.
 *
 * `subscription_status` NÃO entra aqui de propósito. Acesso é decidido só por
 * data — é o que mantém esta regra barata o bastante para rodar a cada request
 * de vitrine (get_effective_plan roda fora do unstable_cache em
 * lib/server/catalog.ts) e o que faz o período de graça funcionar sem que a
 * leitura conheça o conceito: a graça é a data empurrada, não um estado.
 */
export function getEffectivePlan(plan: Plan, planExpiresAt: string | null): Plan {
  if (plan !== "free" && isPlanAccessExpired(planExpiresAt)) return "free";
  return plan;
}

export function getPlanLimits(plan: Plan, planExpiresAt: string | null): PlanLimits {
  switch (getEffectivePlan(plan, planExpiresAt)) {
    case "pro":
      return PRO_LIMITS;
    case "starter":
      return STARTER_LIMITS;
    default:
      return FREE_LIMITS;
  }
}
```

- [ ] **Step 5: Renomear o identificador em todo o código**

Run:
```bash
grep -rl "trialEndsAt" app/ lib/ components/ __tests__/ | xargs sed -i '' 's/trialEndsAt/planExpiresAt/g'
```

Isso cobre `lib/types.ts:124`, `lib/catalog-url.ts:6,10`, `lib/server/store.ts:62`, os 13 arquivos de `app/` e os 11 de `__tests__/`. O TypeScript pega qualquer ponto esquecido, porque o campo deixa de existir no tipo.

- [ ] **Step 6: Renomear a coluna nas strings de SQL e nos títulos de teste**

Run:
```bash
grep -rl "trial_ends_at" app/ lib/ components/ __tests__/ | xargs sed -i '' 's/trial_ends_at/plan_expires_at/g'
```

**Atenção especial a `lib/server/store.ts:114`**: a lista de colunas do `.select()` é uma string literal — o TypeScript não valida o conteúdo, então um erro ali só aparece em runtime.

- [ ] **Step 7: Conferir a linha do `select` manualmente**

Run: `grep -n "plan_expires_at" lib/server/store.ts`
Expected: duas linhas — o mapeamento (`planExpiresAt: row.plan_expires_at`) e a string do `.select(...)`. Se aparecer só uma, a string ficou para trás.

- [ ] **Step 8: Confirmar que nenhuma referência restou**

Run: `grep -rn "trialEndsAt\|trial_ends_at" app/ lib/ components/ __tests__/`
Expected: nenhuma saída.

- [ ] **Step 9: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 10: Rodar a suíte inteira**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 11: Rodar o lint**

Run: `npx eslint .`
Expected: sem erros.

- [ ] **Step 12: Commit**

```bash
git add app/ lib/ components/ __tests__/
git commit -m "refactor: trialEndsAt vira planExpiresAt em todo o código"
```

---

### Task 3: Remover `trial_ends_at`

**Files:**
- Create: `supabase/migrations/20260801010000_drop_trial_ends_at.sql`

**Interfaces:**
- Consumes: as duas funções já migradas (Task 1) e nenhuma referência em TypeScript (Task 2).
- Produces: `public.stores` sem `trial_ends_at`.

- [ ] **Step 1: Confirmar que nada mais referencia a coluna**

Run:
```bash
npx supabase db execute --sql "select proname from pg_proc where prosrc like '%trial_ends_at%' and pronamespace = 'public'::regnamespace;"
```
Expected: nenhuma linha. Se alguma função aparecer, ela precisa migrar antes — o `drop` não vai reclamar e a quebra só aparece em runtime.

- [ ] **Step 2: Escrever a migration**

Criar `supabase/migrations/20260801010000_drop_trial_ends_at.sql`:

```sql
-- Última referência a trial_ends_at. As duas funções que replicavam a regra
-- de expiração (get_effective_plan e resolve_custom_domain) migraram para
-- plan_expires_at em 20260801000000, e o TypeScript migrou junto.
--
-- Nenhum backfill: a coluna está nula em TODAS as linhas desde
-- 20260725000000, e plan_expires_at nulo significa exatamente o mesmo que
-- aquele nulo significava — não expira.
--
-- O grant de update (plan, trial_ends_at) concedido a service_role em
-- 20260728120000 some junto com a coluna; o grant de plan permanece.
alter table public.stores drop column trial_ends_at;
```

- [ ] **Step 3: Aplicar a migration**

Run: `npx supabase db push`
Expected: aplica sem erro.

- [ ] **Step 4: Confirmar que a coluna sumiu e as novas ficaram**

Run:
```bash
npx supabase db execute --sql "select column_name from information_schema.columns where table_name = 'stores' and column_name in ('trial_ends_at','plan_expires_at','subscription_status','billing_cycle','asaas_customer_id','asaas_subscription_id') order by column_name;"
```
Expected: cinco linhas, sem `trial_ends_at`.

- [ ] **Step 5: Exercitar as duas funções contra o banco**

Run:
```bash
npx supabase db execute --sql "select public.get_effective_plan(id) as plano, slug from public.stores limit 5;"
```
Expected: uma linha por loja com o plano resolvido. Erro aqui significa que `get_effective_plan` ficou referenciando a coluna removida.

Run:
```bash
npx supabase db execute --sql "select * from public.resolve_custom_domain('exemplo-inexistente.com.br');"
```
Expected: zero linhas, **sem erro**. Zero linhas prova que a função executou — se ela referenciasse a coluna removida, viria `column s.trial_ends_at does not exist`. Este é o teste que a Spec 1 não tinha e que faltou: o middleware faz fail-open, então essa quebra nunca apareceria como 500.

- [ ] **Step 6: Rodar a suíte e os tipos**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260801010000_drop_trial_ends_at.sql
git commit -m "refactor: remove a coluna trial_ends_at"
```
