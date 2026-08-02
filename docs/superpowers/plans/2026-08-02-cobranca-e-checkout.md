# Cobrança e Checkout com Asaas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O lojista assina sozinho, o Asaas cobra, e o acesso sobe e desce sem ninguém no meio.

**Architecture:** Um módulo puro traduz eventos do Asaas em mudanças de estado; a rota de webhook é a única coisa que concede ou estende acesso. Server Actions criam recursos no gateway e gravam apenas identificadores. Cartão passa por checkout hospedado; Pix é assinatura criada pela API — dois caminhos, confirmados no sandbox.

**Tech Stack:** Next.js App Router (Server Actions + Route Handlers), Supabase (service role), Asaas API v3, TypeScript, Vitest.

## Global Constraints

- **Spec de referência:** `docs/superpowers/specs/2026-08-01-cobranca-e-checkout-design.md` (commits `caa25e5`, `015e3aa`).
- **Só o webhook concede ou estende acesso.** Server Actions gravam identificadores (`asaas_customer_id`, `asaas_subscription_id`) e `pending_plan`; nunca `plan` nem `plan_expires_at` para cima. Cancelar é a única escrita síncrona de `subscription_status`, e só restringe — nunca libera.
- **Nenhum dado de cartão passa pelo Vtrine.** Sem tokenização, sem campo de cartão, sem exceção.
- **Checkout recorrente é só cartão** (confirmado no sandbox): `POST /v3/checkouts` com `chargeTypes: ["RECURRENT"]` e Pix em `billingTypes` devolve `400`. Pix usa `POST /v3/subscriptions` com `billingType: "PIX"`.
- **Header do webhook:** `asaas-access-token`, comparado com `timingSafeEqual`, nunca `===`.
- **A fila do Asaas pausa após 15 respostas não-2xx consecutivas.** Evento não tratado responde `200`. Só erro de escrita responde 5xx.
- **Graça é absoluta:** `plan_expires_at = dueDate + 3 dias`. Nunca somar sobre o valor atual da coluna — o Asaas reenvia eventos e a soma acumularia.
- **`PAYMENT_CONFIRMED`, não `PAYMENT_RECEIVED`.** Confirmado é o cliente ter pago; recebido é o dinheiro cair, dias depois.
- **Preços:** Starter R$ 29,90/mês e R$ 299/ano; Pro R$ 59,90/mês e R$ 599/ano. Anual à vista — assinatura no Asaas não aceita parcelamento.
- **Coluna de estado de acesso não entra no grant de `authenticated` nem no de `anon`.** Vale para `plan`, `plan_expires_at`, `subscription_status` e `pending_plan` — dar escrita ao lojista seria auto-promoção. O grant de `authenticated` é allowlist nominal (`20260728110000`); o select do `anon` é por coluna (`20260709000000`).
- **`document` é a exceção, e de propósito.** É dado de identidade da loja, da mesma natureza de `name` e `whatsapp`, que `authenticated` já escreve. Entra no grant de `authenticated` (insert e update) e no do `anon` não entra em nada.
- **Fora de escopo:** Pix Automático, anual parcelado, histórico de faturas, cupom, e-mail transacional.
- **Comandos:** `npx vitest run <caminho>`, `npx tsc --noEmit`, `npx supabase db push`, `npx eslint .`.

---

### Task 1: Migration `pending_plan` e guard no CI

`pending_plan` representa "muda para X na virada". Sem ela, o downgrade não é expressável: gravar `plan` na hora derruba o acesso pago, e não gravar nada deixa o webhook do próximo ciclo sem saber o que fazer.

**Files:**
- Create: `supabase/migrations/20260802000000_pending_plan.sql`
- Modify: `.github/workflows/supabase-migrations-check.yml:303-305,319-322,290-293`

**Interfaces:**
- Consumes: colunas da Spec 2A.
- Produces: coluna `pending_plan text null` em `public.stores`, gravável só por `service_role`. Tasks 2, 5 e 6 dependem dela.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260802000000_pending_plan.sql`:

```sql
-- Downgrade só vale na virada do ciclo: a loja segue no plano pago até
-- plan_expires_at e só então cai para o plano menor. A Spec 2A modelou o plano
-- EM VIGOR, não uma mudança futura — sem esta coluna o downgrade não é
-- expressável. Gravar plan na hora do pedido derrubaria o acesso que o lojista
-- já pagou (getEffectivePlan devolve plan enquanto a data não vence); não
-- gravar nada deixaria o webhook do próximo ciclo sem saber que o plano mudou.
--
-- A alternativa descartada foi o webhook deduzir o plano pelo `value` da
-- cobrança: funciona, mas amarra a resolução de plano à tabela de preços, e
-- mudar R$ 59,90 no futuro quebraria a promoção de plano de todo mundo com o
-- sintoma aparecendo longe da causa.
alter table public.stores
  add column pending_plan text
    check (pending_plan in ('free', 'starter', 'pro'));

-- Mesma regra das colunas de assinatura (20260801000000): só o webhook escreve,
-- e ele roda com service_role. authenticated/anon não recebem nada — o grant de
-- authenticated é allowlist nominal (20260728110000) e o select do anon é por
-- coluna (20260709000000), então a coluna já nasce inacessível para os dois.
grant update (pending_plan) on public.stores to service_role;
```

- [ ] **Step 2: Aplicar e verificar privilégios**

Run: `npx supabase db push`
Expected: aplica sem erro.

Run:
```bash
npx supabase db execute --sql "select has_column_privilege('service_role','public.stores','pending_plan','update') as svc, has_column_privilege('authenticated','public.stores','pending_plan','update') as auth, has_column_privilege('anon','public.stores','pending_plan','select') as anon;"
```
Expected: `svc = t`, `auth = f`, `anon = f`.

- [ ] **Step 3: Incluir a coluna nos três arrays do guard**

Em `.github/workflows/supabase-migrations-check.yml`, adicionar `'pending_plan'` aos três `array[...]` que hoje listam as cinco colunas de assinatura. Os três blocos ficam assim:

```sql
              from unnest(array[
                'plan_expires_at', 'subscription_status', 'billing_cycle',
                'asaas_customer_id', 'asaas_subscription_id', 'pending_plan'
              ]) as col
             where not has_column_privilege('service_role', 'public.stores', col, 'update');
```

```sql
              from unnest(array[
                'plan_expires_at', 'subscription_status', 'billing_cycle',
                'asaas_customer_id', 'asaas_subscription_id', 'pending_plan'
              ]) as col
             where has_column_privilege('anon', 'public.stores', col, 'select');
```

```sql
              from unnest(array[
                     'plan_expires_at', 'subscription_status', 'billing_cycle',
                     'asaas_customer_id', 'asaas_subscription_id', 'pending_plan'
                   ]) as col
              cross join unnest(array['insert', 'update']) as priv
              cross join unnest(array['authenticated', 'anon']) as role
             where has_column_privilege(role, 'public.stores', col, priv);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260802000000_pending_plan.sql .github/workflows/supabase-migrations-check.yml
git commit -m "feat: coluna pending_plan para downgrade na virada do ciclo"
```

---

### Task 1B: Documento do lojista (CPF/CNPJ)

Numerada `1B` para não renumerar as tasks seguintes. Roda depois da Task 1 e **antes da Task 6**, que depende dela para o caminho Pix.

`POST /v3/customers` exige `cpfCnpj` e o Vtrine nunca coletou esse dado. No cartão não aparece — o checkout hospedado pede na tela do Asaas. No Pix, a chamada falharia.

**Files:**
- Create: `supabase/migrations/20260802010000_store_document.sql`
- Create: `lib/validation/documento.ts`
- Modify: `lib/validation/auth.ts:6` (`storeSchema`), `app/actions/auth.ts:172-183` (insert)
- Modify: `lib/server/store.ts:62,114`, `lib/types.ts`
- Test: `__tests__/documento.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: coluna `stores.document text null`; `validarDocumento(valor: string): boolean` e `normalizarDocumento(valor: string): string` em `lib/validation/documento.ts`; campo `document: string | null` em `StoreSettings`. Tasks 6 e 7 consomem.

- [ ] **Step 1: Escrever os testes de validação**

Criar `__tests__/documento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarDocumento, normalizarDocumento } from "@/lib/validation/documento";

describe("normalizarDocumento", () => {
  it("remove pontuação", () => {
    expect(normalizarDocumento("529.982.247-25")).toBe("52998224725");
    expect(normalizarDocumento("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("validarDocumento — CPF", () => {
  it("aceita CPF válido, com ou sem máscara", () => {
    expect(validarDocumento("529.982.247-25")).toBe(true);
    expect(validarDocumento("52998224725")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarDocumento("529.982.247-26")).toBe(false);
  });

  it("rejeita sequência repetida", () => {
    expect(validarDocumento("111.111.111-11")).toBe(false);
  });
});

describe("validarDocumento — CNPJ", () => {
  it("aceita CNPJ válido", () => {
    expect(validarDocumento("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarDocumento("11.222.333/0001-82")).toBe(false);
  });
});

describe("validarDocumento — entradas inválidas", () => {
  it.each(["", "   ", "123", "abcdefghijk", "5299822472"])("%s é inválido", (v) => {
    expect(validarDocumento(v)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/documento.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar a validação**

Criar `lib/validation/documento.ts`:

```ts
/** Só dígitos — é como o Asaas espera e como gravamos. */
export function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, "");
}

function digitosIguais(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

function validarCpf(cpf: string): boolean {
  if (cpf.length !== 11 || digitosIguais(cpf)) return false;

  const dv = (ate: number, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return dv(9, 10) === Number(cpf[9]) && dv(10, 11) === Number(cpf[10]);
}

function validarCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || digitosIguais(cnpj)) return false;

  const dv = (ate: number) => {
    let soma = 0;
    let peso = ate - 7;
    for (let i = 0; i < ate; i++) {
      soma += Number(cnpj[i]) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return dv(12) === Number(cnpj[12]) && dv(13) === Number(cnpj[13]);
}

/**
 * Aceita CPF ou CNPJ, com ou sem máscara. Validado ANTES de qualquer chamada ao
 * Asaas: erro de dígito verificador é diagnóstico nosso, e devolver a mensagem
 * crua de um terceiro para algo que sabemos explicar é ruim para o lojista.
 */
export function validarDocumento(valor: string): boolean {
  const d = normalizarDocumento(valor);
  if (d.length === 11) return validarCpf(d);
  if (d.length === 14) return validarCnpj(d);
  return false;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/documento.test.ts`
Expected: PASS.

- [ ] **Step 5: Escrever a migration**

Criar `supabase/migrations/20260802010000_store_document.sql`:

```sql
-- CPF ou CNPJ do lojista, só dígitos. Exigido pelo Asaas em POST /v3/customers,
-- que é o caminho do Pix (no cartão, o checkout hospedado coleta na tela deles).
--
-- Opcional: quem cria a loja para experimentar não é barrado por um formulário
-- maior. A coleta obrigatória acontece na modal, no momento de assinar.
alter table public.stores add column document text;

-- Ao contrário das colunas de plano, esta ENTRA no grant de authenticated: é
-- dado de identidade da própria loja, da mesma natureza de name e whatsapp, e
-- exigir service_role para uma edição de perfil seria desproporcional. O risco
-- que o grant restrito de 20260728110000 existe para conter é auto-promoção de
-- plano — document não concede acesso a nada.
grant insert (document), update (document) on public.stores to authenticated;
```

- [ ] **Step 6: Aplicar e verificar**

Run: `npx supabase db push`

Run:
```bash
npx supabase db execute --sql "select has_column_privilege('authenticated','public.stores','document','update') as auth_update, has_column_privilege('anon','public.stores','document','select') as anon_select;"
```
Expected: `auth_update = t`, `anon_select = f`. O `anon` continua sem enxergar — o select dele é por coluna e `document` não foi adicionada lá.

- [ ] **Step 7: Adicionar o campo ao cadastro**

Em `lib/validation/auth.ts`, dentro de `storeSchema`:

```ts
  document: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || validarDocumento(v), {
      message: "CPF ou CNPJ inválido.",
    }),
```

Em `app/actions/auth.ts`, incluir no insert (linhas 172-183):

```ts
      document: result.data.document ? normalizarDocumento(result.data.document) : null,
```

No formulário de cadastro, um campo com rótulo `CPF ou CNPJ` e a legenda `Opcional — necessário apenas para assinar um plano pago`.

- [ ] **Step 8: Expor em `getCurrentStore`**

Em `lib/server/store.ts`, adicionar `document` à string do `.select(...)` (linha 114) e `document: row.document` ao mapeamento (linha 62). Em `lib/types.ts`, `document: string | null` em `StoreSettings`.

- [ ] **Step 9: Verificar tipos e rodar a suíte**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/20260802010000_store_document.sql lib/validation/documento.ts lib/validation/auth.ts app/actions/auth.ts lib/server/store.ts lib/types.ts __tests__/documento.test.ts
git commit -m "feat: campo de documento opcional no cadastro"
```

---

### Task 2: `lib/asaas/events.ts` — tradução pura

O coração da integração. Puro, sem I/O, sem `Date.now()` implícito — é onde o vocabulário do Asaas vira o nosso e onde a idempotência é garantida.

**Files:**
- Create: `lib/asaas/events.ts`
- Test: `__tests__/asaas-events.test.ts`

**Interfaces:**
- Consumes: `Plan` de `@/lib/plan-limits`.
- Produces:
  - `type SubscriptionStatus = "active" | "past_due" | "canceled"`
  - `type BillingCycle = "monthly" | "annual"`
  - `interface AsaasWebhookEvent { event: string; payment?: { dueDate: string; subscription?: string | null; externalReference?: string | null } | null }`
  - `interface SubscriptionChange { subscriptionStatus: SubscriptionStatus; planExpiresAt: string; applyPendingPlan: boolean }`
  - `function translateEvent(event: AsaasWebhookEvent, cycle: BillingCycle, now: Date): SubscriptionChange | null`
  - `function storeIdFromEvent(event: AsaasWebhookEvent): string | null`

Task 5 consome exatamente essas assinaturas.

- [ ] **Step 1: Escrever os testes**

Criar `__tests__/asaas-events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { translateEvent, storeIdFromEvent } from "@/lib/asaas/events";
import type { AsaasWebhookEvent } from "@/lib/asaas/events";

const AGORA = new Date("2026-08-02T12:00:00.000Z");

function evento(event: string, dueDate = "2026-09-01"): AsaasWebhookEvent {
  return {
    event,
    payment: { dueDate, subscription: "sub_123", externalReference: "loja-1" },
  };
}

describe("translateEvent — pagamento confirmado", () => {
  it("mensal estende o acesso por um mês a partir do vencimento", () => {
    const r = translateEvent(evento("PAYMENT_CONFIRMED"), "monthly", AGORA);
    expect(r).toEqual({
      subscriptionStatus: "active",
      planExpiresAt: "2026-10-01T00:00:00.000Z",
      applyPendingPlan: true,
    });
  });

  it("anual estende por um ano", () => {
    const r = translateEvent(evento("PAYMENT_CONFIRMED"), "annual", AGORA);
    expect(r?.planExpiresAt).toBe("2027-09-01T00:00:00.000Z");
  });

  it("PAYMENT_RECEIVED é ignorado — confirmado já liberou o acesso", () => {
    expect(translateEvent(evento("PAYMENT_RECEIVED"), "monthly", AGORA)).toBeNull();
  });
});

describe("translateEvent — cobrança vencida e período de graça", () => {
  it("dá 3 dias contados do vencimento", () => {
    const r = translateEvent(evento("PAYMENT_OVERDUE"), "monthly", AGORA);
    expect(r).toEqual({
      subscriptionStatus: "past_due",
      planExpiresAt: "2026-09-04T00:00:00.000Z",
      applyPendingPlan: false,
    });
  });

  /**
   * O Asaas reenvia eventos (entrega at-least-once). Se a graça fosse somada
   * sobre o valor atual da coluna, dois envios dariam 6 dias. Calcular a partir
   * do dueDate torna o reenvio inofensivo.
   */
  it("é idempotente: o mesmo evento duas vezes dá a mesma data", () => {
    const a = translateEvent(evento("PAYMENT_OVERDUE"), "monthly", AGORA);
    const b = translateEvent(evento("PAYMENT_OVERDUE"), "monthly", AGORA);
    expect(a).toEqual(b);
  });
});

describe("translateEvent — estorno e chargeback", () => {
  it("estorno encerra o acesso imediatamente", () => {
    const r = translateEvent(evento("PAYMENT_REFUNDED"), "monthly", AGORA);
    expect(r).toEqual({
      subscriptionStatus: "canceled",
      planExpiresAt: AGORA.toISOString(),
      applyPendingPlan: false,
    });
  });

  it("chargeback encerra o acesso imediatamente", () => {
    const r = translateEvent(evento("PAYMENT_CHARGEBACK_REQUESTED"), "monthly", AGORA);
    expect(r?.subscriptionStatus).toBe("canceled");
    expect(r?.planExpiresAt).toBe(AGORA.toISOString());
  });
});

describe("translateEvent — eventos ignorados", () => {
  it.each([
    "PAYMENT_CREATED",
    "PAYMENT_UPDATED",
    "PAYMENT_CHECKOUT_VIEWED",
    "PAYMENT_BANK_SLIP_VIEWED",
    "EVENTO_QUE_NAO_EXISTE",
  ])("%s não muda nada", (nome) => {
    expect(translateEvent(evento(nome), "monthly", AGORA)).toBeNull();
  });

  it("evento sem payment não quebra", () => {
    expect(translateEvent({ event: "PAYMENT_CONFIRMED" }, "monthly", AGORA)).toBeNull();
  });
});

describe("storeIdFromEvent", () => {
  it("lê o externalReference", () => {
    expect(storeIdFromEvent(evento("PAYMENT_CONFIRMED"))).toBe("loja-1");
  });

  it("devolve null quando não há externalReference", () => {
    expect(storeIdFromEvent({ event: "PAYMENT_CONFIRMED", payment: { dueDate: "2026-09-01" } })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/asaas-events.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/asaas/events"`.

- [ ] **Step 3: Implementar o módulo**

Criar `lib/asaas/events.ts`:

```ts
export type SubscriptionStatus = "active" | "past_due" | "canceled";
export type BillingCycle = "monthly" | "annual";

export interface AsaasWebhookEvent {
  event: string;
  payment?: {
    dueDate: string;
    subscription?: string | null;
    externalReference?: string | null;
  } | null;
}

export interface SubscriptionChange {
  subscriptionStatus: SubscriptionStatus;
  /** ISO 8601. Absoluto — nunca derivado do valor atual da coluna. */
  planExpiresAt: string;
  /** true só na confirmação de pagamento, quando um downgrade agendado vira o plano em vigor. */
  applyPendingPlan: boolean;
}

const GRACA_EM_DIAS = 3;

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString();
}

function somarCiclo(iso: string, cycle: BillingCycle): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (cycle === "annual") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

/**
 * Traduz um evento do Asaas na mudança de estado que ele implica. Puro: não lê
 * relógio nem banco — `now` entra por parâmetro.
 *
 * Devolve null para todo evento que não nos interessa, e a rota responde 200
 * nesse caso: a fila do Asaas pausa após 15 respostas não-2xx consecutivas, e
 * devolver erro para evento irrelevante congelaria o estado de toda a base.
 *
 * O período de graça é calculado a partir do VENCIMENTO, nunca somado sobre o
 * valor atual da coluna — a entrega é at-least-once e a soma acumularia a cada
 * reenvio.
 */
export function translateEvent(
  event: AsaasWebhookEvent,
  cycle: BillingCycle,
  now: Date
): SubscriptionChange | null {
  const dueDate = event.payment?.dueDate;
  if (!dueDate) return null;

  switch (event.event) {
    // Confirmado, não recebido: recebido é o dinheiro cair na conta, dias
    // depois. Punir o lojista por latência bancária seria errado.
    case "PAYMENT_CONFIRMED":
      return {
        subscriptionStatus: "active",
        planExpiresAt: somarCiclo(dueDate, cycle),
        applyPendingPlan: true,
      };

    case "PAYMENT_OVERDUE":
      return {
        subscriptionStatus: "past_due",
        planExpiresAt: somarDias(dueDate, GRACA_EM_DIAS),
        applyPendingPlan: false,
      };

    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
      return {
        subscriptionStatus: "canceled",
        planExpiresAt: now.toISOString(),
        applyPendingPlan: false,
      };

    default:
      return null;
  }
}

/** O store.id vai em externalReference na criação — mais robusto que mapear por customer. */
export function storeIdFromEvent(event: AsaasWebhookEvent): string | null {
  return event.payment?.externalReference ?? null;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/asaas-events.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/asaas/events.ts __tests__/asaas-events.test.ts
git commit -m "feat: tradução pura de eventos do Asaas"
```

---

### Task 3: `lib/asaas/client.ts` — HTTP

**Files:**
- Create: `lib/asaas/client.ts`
- Test: `__tests__/asaas-client.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `function asaasFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>`. Task 4 consome.

- [ ] **Step 1: Escrever os testes**

Criar `__tests__/asaas-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.ASAAS_BASE_URL = "https://api-sandbox.asaas.com/v3";
  process.env.ASAAS_API_KEY = "chave-de-teste";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("asaasFetch", () => {
  it("envia a chave no header access_token e devolve o JSON", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "sub_1" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { asaasFetch } = await import("@/lib/asaas/client");
    const r = await asaasFetch<{ id: string }>("/subscriptions", {
      method: "POST",
      body: { value: 29.9 },
    });

    expect(r).toEqual({ id: "sub_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api-sandbox.asaas.com/v3/subscriptions");
    expect((init as RequestInit).headers).toMatchObject({
      access_token: "chave-de-teste",
      "Content-Type": "application/json",
    });
  });

  it("lança com a descrição do erro devolvida pelo Asaas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ errors: [{ description: "O campo subscription é inválido." }] }),
          { status: 400 }
        )
      )
    );

    const { asaasFetch } = await import("@/lib/asaas/client");
    await expect(asaasFetch("/subscriptions", { method: "POST", body: {} })).rejects.toThrow(
      "O campo subscription é inválido."
    );
  });

  it("lança quando ASAAS_API_KEY não está configurada", async () => {
    delete process.env.ASAAS_API_KEY;
    const { asaasFetch } = await import("@/lib/asaas/client");
    await expect(asaasFetch("/subscriptions")).rejects.toThrow(/ASAAS_API_KEY/);
  });

  it("nunca inclui a chave na mensagem de erro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("erro opaco", { status: 500 }))
    );
    const { asaasFetch } = await import("@/lib/asaas/client");
    await expect(asaasFetch("/subscriptions")).rejects.not.toThrow(/chave-de-teste/);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/asaas-client.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `lib/asaas/client.ts`:

```ts
import "server-only";

/**
 * Cliente HTTP do Asaas. Não conhece assinatura, plano nem loja — só fala o
 * protocolo. A chave nunca tem prefixo NEXT_PUBLIC_ (não pode entrar no bundle)
 * e nunca aparece em mensagem de erro.
 */
export async function asaasFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada — a cobrança está indisponível.");
  }
  const baseUrl = process.env.ASAAS_BASE_URL?.trim() ?? "https://api-sandbox.asaas.com/v3";

  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });

  const texto = await response.text();

  if (!response.ok) {
    // O Asaas devolve { errors: [{ code, description }] }. Preferimos a
    // descrição dele à nossa: ela costuma dizer exatamente qual campo recusou.
    let detalhe = `HTTP ${response.status}`;
    try {
      const corpo = JSON.parse(texto) as { errors?: { description?: string }[] };
      const primeira = corpo.errors?.[0]?.description;
      if (primeira) detalhe = primeira;
    } catch {
      // corpo não-JSON: mantém o status. Nunca ecoa o texto cru, que pode
      // conter dados da requisição.
    }
    throw new Error(`Asaas: ${detalhe}`);
  }

  return (texto ? JSON.parse(texto) : {}) as T;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/asaas-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/asaas/client.ts __tests__/asaas-client.test.ts
git commit -m "feat: cliente HTTP do Asaas"
```

---

### Task 4: `lib/asaas/subscriptions.ts` — operações

**Files:**
- Create: `lib/asaas/plans.ts`
- Create: `lib/asaas/subscriptions.ts`
- Test: `__tests__/asaas-subscriptions.test.ts`

**Interfaces:**
- Consumes: `asaasFetch` (Task 3), `BillingCycle` (Task 2).
- Produces:
  - `lib/asaas/plans.ts`: `PRECOS: Record<"starter"|"pro", Record<BillingCycle, number>>`, `function precoDe(plan, cycle): number`, `function proporcional(de, para, cycle, planExpiresAt, now): number`
  - `lib/asaas/subscriptions.ts`: `criarCliente`, `criarCheckoutCartao`, `criarAssinaturaPix`, `atualizarAssinatura`, `cancelarAssinatura`, `criarCobrancaAvulsa`

Task 6 consome.

- [ ] **Step 1: Escrever os testes de preço e proporcional**

Criar `__tests__/asaas-subscriptions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { precoDe, proporcional } from "@/lib/asaas/plans";

describe("precoDe", () => {
  it("reflete a tabela fechada", () => {
    expect(precoDe("starter", "monthly")).toBe(29.9);
    expect(precoDe("starter", "annual")).toBe(299);
    expect(precoDe("pro", "monthly")).toBe(59.9);
    expect(precoDe("pro", "annual")).toBe(599);
  });
});

describe("proporcional", () => {
  const agora = new Date("2026-08-02T00:00:00.000Z");

  it("cobra metade da diferença quando falta metade do ciclo mensal", () => {
    // Ciclo de 30 dias terminando em 01/09; faltam 30 dias de 30? Não:
    // de 02/08 a 01/09 são 30 dias — ciclo inteiro restante.
    const expira = "2026-09-01T00:00:00.000Z";
    const valor = proporcional("starter", "pro", "monthly", expira, agora);
    // Diferença mensal cheia: 59,90 - 29,90 = 30,00
    expect(valor).toBe(30);
  });

  it("cobra proporcionalmente quando falta parte do ciclo", () => {
    const expira = "2026-08-17T00:00:00.000Z"; // faltam 15 de 30 dias
    const valor = proporcional("starter", "pro", "monthly", expira, agora);
    expect(valor).toBe(15);
  });

  it("nunca devolve valor negativo", () => {
    const expira = "2026-07-01T00:00:00.000Z"; // já venceu
    expect(proporcional("starter", "pro", "monthly", expira, agora)).toBe(0);
  });

  it("downgrade não gera cobrança", () => {
    const expira = "2026-09-01T00:00:00.000Z";
    expect(proporcional("pro", "starter", "monthly", expira, agora)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/asaas-subscriptions.test.ts`
Expected: FAIL — `@/lib/asaas/plans` não existe.

- [ ] **Step 3: Implementar `lib/asaas/plans.ts`**

```ts
import type { BillingCycle } from "@/lib/asaas/events";

export type PaidPlan = "starter" | "pro";

/** Anual = 10 meses pagos (17% off). À vista: assinatura no Asaas não parcela. */
export const PRECOS: Record<PaidPlan, Record<BillingCycle, number>> = {
  starter: { monthly: 29.9, annual: 299 },
  pro: { monthly: 59.9, annual: 599 },
};

export function precoDe(plan: PaidPlan, cycle: BillingCycle): number {
  return PRECOS[plan][cycle];
}

const DIAS_DO_CICLO: Record<BillingCycle, number> = { monthly: 30, annual: 365 };

/**
 * Diferença proporcional ao que resta do ciclo corrente. O Asaas não faz pro
 * rata — "alterações de valor afetam somente cobranças futuras" — então o
 * upgrade cobra esta diferença como cobrança avulsa.
 *
 * Devolve 0 para downgrade e para ciclo já vencido: nunca cobramos a mais, e o
 * downgrade só vale na virada.
 */
export function proporcional(
  de: PaidPlan,
  para: PaidPlan,
  cycle: BillingCycle,
  planExpiresAt: string,
  now: Date
): number {
  const diferencaCheia = precoDe(para, cycle) - precoDe(de, cycle);
  if (diferencaCheia <= 0) return 0;

  const restanteMs = new Date(planExpiresAt).getTime() - now.getTime();
  if (restanteMs <= 0) return 0;

  const diasRestantes = restanteMs / 86_400_000;
  const fracao = Math.min(1, diasRestantes / DIAS_DO_CICLO[cycle]);
  return Math.round(diferencaCheia * fracao * 100) / 100;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/asaas-subscriptions.test.ts`
Expected: PASS.

- [ ] **Step 5: Implementar `lib/asaas/subscriptions.ts`**

```ts
import "server-only";
import { asaasFetch } from "@/lib/asaas/client";
import type { BillingCycle } from "@/lib/asaas/events";
import { precoDe, type PaidPlan } from "@/lib/asaas/plans";

const CICLO_ASAAS: Record<BillingCycle, string> = {
  monthly: "MONTHLY",
  annual: "YEARLY",
};

function emIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function criarCliente(params: {
  name: string;
  cpfCnpj: string;
  email: string;
  externalReference: string;
}): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/customers", { method: "POST", body: params });
}

/**
 * Cartão: checkout hospedado. Confirmado no sandbox que chargeTypes RECURRENT
 * só aceita CREDIT_CARD — Pix devolve 400 e usa criarAssinaturaPix.
 * Nenhum dado de cartão passa por nós: o lojista digita no Asaas.
 */
export async function criarCheckoutCartao(params: {
  plan: PaidPlan;
  cycle: BillingCycle;
  storeId: string;
  primeiroVencimento: Date;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
}): Promise<{ id: string; link: string }> {
  const valor = precoDe(params.plan, params.cycle);
  const fim = new Date(params.primeiroVencimento);
  fim.setUTCFullYear(fim.getUTCFullYear() + 10);

  return asaasFetch<{ id: string; link: string }>("/checkouts", {
    method: "POST",
    body: {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      externalReference: params.storeId,
      callback: {
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        expiredUrl: params.expiredUrl,
      },
      items: [{ name: `Vtrine ${params.plan}`, quantity: 1, value: valor }],
      subscription: {
        cycle: CICLO_ASAAS[params.cycle],
        nextDueDate: emIso(params.primeiroVencimento),
        endDate: emIso(fim),
      },
    },
  });
}

/** Pix: assinatura direta. O Asaas gera uma cobrança por ciclo e o lojista paga cada uma. */
export async function criarAssinaturaPix(params: {
  customerId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
  storeId: string;
  primeiroVencimento: Date;
}): Promise<{ id: string }> {
  return asaasFetch<{ id: string }>("/subscriptions", {
    method: "POST",
    body: {
      customer: params.customerId,
      billingType: "PIX",
      value: precoDe(params.plan, params.cycle),
      nextDueDate: emIso(params.primeiroVencimento),
      cycle: CICLO_ASAAS[params.cycle],
      externalReference: params.storeId,
      description: `Vtrine ${params.plan}`,
    },
  });
}

export async function atualizarAssinatura(params: {
  subscriptionId: string;
  plan: PaidPlan;
  cycle: BillingCycle;
}): Promise<void> {
  await asaasFetch(`/subscriptions/${params.subscriptionId}`, {
    method: "PUT",
    body: {
      value: precoDe(params.plan, params.cycle),
      cycle: CICLO_ASAAS[params.cycle],
      // Cobranças pendentes ficam como estão: o proporcional do ciclo corrente
      // é cobrado à parte, e mexer nelas duplicaria a diferença.
      updatePendingPayments: false,
    },
  });
}

export async function cancelarAssinatura(subscriptionId: string): Promise<void> {
  await asaasFetch(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

/** Diferença proporcional do upgrade. externalReference leva o store.id para o webhook. */
export async function criarCobrancaAvulsa(params: {
  customerId: string;
  valor: number;
  storeId: string;
  vencimento: Date;
  descricao: string;
}): Promise<{ id: string; invoiceUrl: string }> {
  return asaasFetch<{ id: string; invoiceUrl: string }>("/payments", {
    method: "POST",
    body: {
      customer: params.customerId,
      billingType: "UNDEFINED",
      value: params.valor,
      dueDate: emIso(params.vencimento),
      externalReference: params.storeId,
      description: params.descricao,
    },
  });
}
```

- [ ] **Step 6: Verificar tipos e rodar a suíte**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sem erros de tipo, todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add lib/asaas/plans.ts lib/asaas/subscriptions.ts __tests__/asaas-subscriptions.test.ts
git commit -m "feat: operações de assinatura no Asaas e cálculo proporcional"
```

---

### Task 5: Rota de webhook

**Files:**
- Create: `app/api/webhooks/asaas/route.ts`
- Test: `__tests__/asaas-webhook-route.test.ts`

**Interfaces:**
- Consumes: `translateEvent`, `storeIdFromEvent` (Task 2), `createAdminClient` de `@/lib/supabase/admin`.
- Produces: `POST /api/webhooks/asaas`.

- [ ] **Step 1: Escrever os testes**

Criar `__tests__/asaas-webhook-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const eq = vi.fn();
const single = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: single }) }),
      update: (v: unknown) => {
        update(v);
        return { eq };
      },
    }),
  }),
}));

function req(body: unknown, token = "segredo") {
  return new Request("http://localhost:3000/api/webhooks/asaas", {
    method: "POST",
    headers: { "asaas-access-token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CONFIRMADO = {
  event: "PAYMENT_CONFIRMED",
  payment: { dueDate: "2026-09-01", subscription: "sub_1", externalReference: "loja-1" },
};

beforeEach(() => {
  process.env.ASAAS_WEBHOOK_TOKEN = "segredo";
  update.mockReset();
  eq.mockReset().mockResolvedValue({ error: null });
  single.mockReset().mockResolvedValue({
    data: { id: "loja-1", billing_cycle: "monthly", pending_plan: null },
    error: null,
  });
  vi.resetModules();
});

describe("POST /api/webhooks/asaas — autenticação", () => {
  it("token errado devolve 401 e não escreve nada", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req(CONFIRMADO, "errado"));
    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("token de comprimento diferente devolve 401 sem lançar", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    expect((await POST(req(CONFIRMADO, "x"))).status).toBe(401);
  });
});

describe("POST /api/webhooks/asaas — aplicação", () => {
  it("PAYMENT_CONFIRMED grava status, validade e limpa pending_plan", async () => {
    single.mockResolvedValue({
      data: { id: "loja-1", billing_cycle: "monthly", pending_plan: "starter" },
      error: null,
    });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req(CONFIRMADO));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "active",
        plan_expires_at: "2026-10-01T00:00:00.000Z",
        plan: "starter",
        pending_plan: null,
      })
    );
  });

  it("sem pending_plan não mexe na coluna plan", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    await POST(req(CONFIRMADO));
    const gravado = update.mock.calls[0][0] as Record<string, unknown>;
    expect(gravado).not.toHaveProperty("plan");
  });

  /**
   * A fila do Asaas pausa após 15 respostas não-2xx consecutivas. Evento que
   * não tratamos precisa sair com 200, ou um evento comum e irrelevante
   * congelaria o estado de assinatura de toda a base.
   */
  it("evento não tratado devolve 200 sem escrever", async () => {
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    const res = await POST(req({ ...CONFIRMADO, event: "PAYMENT_CHECKOUT_VIEWED" }));
    expect(res.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("loja inexistente devolve 200 — reenviar não resolveria", async () => {
    single.mockResolvedValue({ data: null, error: null });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    expect((await POST(req(CONFIRMADO))).status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });

  it("erro de escrita devolve 500 para o Asaas reenviar", async () => {
    eq.mockResolvedValue({ error: { message: "banco fora" } });
    const { POST } = await import("@/app/api/webhooks/asaas/route");
    expect((await POST(req(CONFIRMADO))).status).toBe(500);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/asaas-webhook-route.test.ts`
Expected: FAIL — rota inexistente.

- [ ] **Step 3: Implementar a rota**

Criar `app/api/webhooks/asaas/route.ts`:

```ts
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  translateEvent,
  storeIdFromEvent,
  type AsaasWebhookEvent,
  type BillingCycle,
} from "@/lib/asaas/events";

function autorizado(request: Request): boolean {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado) return false;

  const recebido = request.headers.get("asaas-access-token") ?? "";
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // timingSafeEqual lança se os comprimentos diferirem — comparar antes.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Única superfície que concede ou estende acesso. Server Actions gravam
 * identificadores e pending_plan; a promoção de plano e a validade vêm daqui.
 *
 * Política de status: 200 para tudo que não seja falha nossa. A entrega do
 * Asaas é at-least-once, mas 15 respostas não-2xx consecutivas PAUSAM a fila
 * — os eventos seguem sendo gerados e param de ser entregues até reativação
 * manual. Devolver erro para evento irrelevante congelaria o estado de
 * assinatura de toda a base, em silêncio.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const evento = (await request.json().catch(() => null)) as AsaasWebhookEvent | null;
  if (!evento?.event) return NextResponse.json({ ok: true });

  const storeId = storeIdFromEvent(evento);
  if (!storeId) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const { data: loja } = await supabase
    .from("stores")
    .select("id, billing_cycle, pending_plan")
    .eq("id", storeId)
    .maybeSingle();

  // Loja inexistente é 200 de propósito: reenviar não faria a loja aparecer, e
  // insistir queimaria as 15 tentativas que pausam a fila.
  if (!loja) return NextResponse.json({ ok: true });

  const cycle = (loja.billing_cycle ?? "monthly") as BillingCycle;
  const mudanca = translateEvent(evento, cycle, new Date());
  if (!mudanca) return NextResponse.json({ ok: true });

  const patch: Record<string, unknown> = {
    subscription_status: mudanca.subscriptionStatus,
    plan_expires_at: mudanca.planExpiresAt,
  };

  // Downgrade agendado vira o plano em vigor quando o ciclo novo é pago.
  if (mudanca.applyPendingPlan && loja.pending_plan) {
    patch.plan = loja.pending_plan;
    patch.pending_plan = null;
  }

  const { error } = await supabase.from("stores").update(patch).eq("id", storeId);

  if (error) {
    // Único caso de 5xx: falha nossa, e queremos o reenvio.
    console.error(`[webhook asaas] falha ao gravar loja ${storeId}:`, error);
    return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/asaas-webhook-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/asaas/route.ts __tests__/asaas-webhook-route.test.ts
git commit -m "feat: rota de webhook do Asaas"
```

---

### Task 6: Server Actions de assinatura

**Files:**
- Create: `app/actions/assinatura.ts`
- Test: `__tests__/assinatura-actions.test.ts`

**Interfaces:**
- Consumes: Tasks 3 e 4, `getCurrentStore` de `@/lib/server/store`, `createAdminClient`.
- Produces: `iniciarAssinatura`, `trocarPlano`, `cancelarAssinatura` — todas devolvendo `AssinaturaState = { error: string } | { ok: true; redirectUrl?: string } | null`.

> **Depende da Task 1B.** `POST /v3/customers` exige `cpfCnpj`, coletado pela coluna `document`. Quando ela estiver vazia, `iniciarAssinatura` com Pix devolve `{ error: "DOCUMENTO_NECESSARIO" }` — um código, não uma frase, porque a Task 7 usa esse retorno para abrir a modal de coleta em vez de exibir um erro.
>
> O caminho de cartão não depende de `document`: o checkout hospedado coleta os dados do pagador na tela do Asaas.

- [ ] **Step 1: Escrever os testes**

Criar `__tests__/assinatura-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getCurrentStore = vi.fn();
const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
const criarCheckoutCartao = vi.fn();
const criarAssinaturaPix = vi.fn();
const criarCliente = vi.fn();
const atualizarAssinatura = vi.fn();
const cancelarNoAsaas = vi.fn();
const criarCobrancaAvulsa = vi.fn();

vi.mock("@/lib/server/store", () => ({ getCurrentStore }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => ({ update }) }),
}));
vi.mock("@/lib/asaas/subscriptions", () => ({
  criarCliente,
  criarCheckoutCartao,
  criarAssinaturaPix,
  atualizarAssinatura,
  cancelarAssinatura: cancelarNoAsaas,
  criarCobrancaAvulsa,
}));

const LOJA_FREE = {
  id: "loja-1",
  name: "Ateliê Mira",
  plan: "free",
  planExpiresAt: null,
  asaasCustomerId: null,
  asaasSubscriptionId: null,
  billingCycle: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentStore.mockResolvedValue(LOJA_FREE);
  criarCliente.mockResolvedValue({ id: "cus_1" });
  criarCheckoutCartao.mockResolvedValue({ id: "chk_1", link: "https://sandbox.asaas.com/c/1" });
  criarAssinaturaPix.mockResolvedValue({ id: "sub_1" });
});

describe("iniciarAssinatura", () => {
  it("cartão devolve o link do checkout hospedado", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("pro", "monthly", "CREDIT_CARD");
    expect(r).toEqual({ ok: true, redirectUrl: "https://sandbox.asaas.com/c/1" });
    expect(criarAssinaturaPix).not.toHaveBeenCalled();
  });

  it("Pix cria a assinatura direto, sem checkout", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    const r = await iniciarAssinatura("starter", "annual", "PIX");
    expect(r).toEqual({ ok: true });
    expect(criarCheckoutCartao).not.toHaveBeenCalled();
    expect(criarAssinaturaPix).toHaveBeenCalled();
  });

  it("nunca grava plan nem plan_expires_at — isso é do webhook", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    await iniciarAssinatura("pro", "monthly", "PIX");
    for (const [patch] of update.mock.calls) {
      expect(patch).not.toHaveProperty("plan");
      expect(patch).not.toHaveProperty("plan_expires_at");
    }
  });

  it("sem loja devolve erro", async () => {
    getCurrentStore.mockResolvedValue(null);
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    expect(await iniciarAssinatura("pro", "monthly", "PIX")).toEqual({
      error: "Loja não encontrada.",
    });
  });
});

describe("trocarPlano", () => {
  const LOJA_STARTER = {
    ...LOJA_FREE,
    plan: "starter",
    planExpiresAt: "2026-09-01T00:00:00.000Z",
    asaasCustomerId: "cus_1",
    asaasSubscriptionId: "sub_1",
    billingCycle: "monthly",
  };

  it("upgrade cria cobrança avulsa e NÃO promove o plano", async () => {
    getCurrentStore.mockResolvedValue(LOJA_STARTER);
    criarCobrancaAvulsa.mockResolvedValue({ id: "pay_1", invoiceUrl: "https://x" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("pro");

    expect(criarCobrancaAvulsa).toHaveBeenCalled();
    for (const [patch] of update.mock.calls) {
      expect(patch).not.toHaveProperty("plan");
    }
  });

  it("downgrade grava pending_plan e não cobra nada", async () => {
    getCurrentStore.mockResolvedValue({ ...LOJA_STARTER, plan: "pro" });
    const { trocarPlano } = await import("@/app/actions/assinatura");

    await trocarPlano("starter");

    expect(criarCobrancaAvulsa).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ pending_plan: "starter" }));
  });
});

describe("cancelarAssinatura", () => {
  it("marca canceled sem tocar em plan_expires_at", async () => {
    getCurrentStore.mockResolvedValue({
      ...LOJA_FREE,
      plan: "pro",
      asaasSubscriptionId: "sub_1",
      planExpiresAt: "2026-09-01T00:00:00.000Z",
    });
    const { cancelarAssinatura } = await import("@/app/actions/assinatura");

    await cancelarAssinatura();

    expect(cancelarNoAsaas).toHaveBeenCalledWith("sub_1");
    const patch = update.mock.calls[0][0] as Record<string, unknown>;
    expect(patch).toEqual({ subscription_status: "canceled" });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/assinatura-actions.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `app/actions/assinatura.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStore } from "@/lib/server/store";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  criarCliente,
  criarCheckoutCartao,
  criarAssinaturaPix,
  atualizarAssinatura,
  cancelarAssinatura as cancelarNoAsaas,
  criarCobrancaAvulsa,
} from "@/lib/asaas/subscriptions";
import { proporcional, type PaidPlan } from "@/lib/asaas/plans";
import type { BillingCycle } from "@/lib/asaas/events";

export type AssinaturaState = { error: string } | { ok: true; redirectUrl?: string } | null;

export type MeioPagamento = "CREDIT_CARD" | "PIX";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function amanha(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Cria a assinatura no Asaas e guarda apenas identificadores. `plan` e
 * `plan_expires_at` continuam intocados — quem concede acesso é o webhook,
 * quando o pagamento confirmar.
 */
export async function iniciarAssinatura(
  plan: PaidPlan,
  cycle: BillingCycle,
  meio: MeioPagamento
): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const supabase = createAdminClient();

  try {
    if (meio === "CREDIT_CARD") {
      const checkout = await criarCheckoutCartao({
        plan,
        cycle,
        storeId: store.id,
        primeiroVencimento: amanha(),
        successUrl: `${siteUrl()}/painel/assinatura?status=ok`,
        cancelUrl: `${siteUrl()}/painel/assinatura?status=cancelado`,
        expiredUrl: `${siteUrl()}/painel/assinatura?status=expirado`,
      });

      await supabase.from("stores").update({ billing_cycle: cycle }).eq("id", store.id);
      return { ok: true, redirectUrl: checkout.link };
    }

    // Pix não é aceito em chargeTypes RECURRENT (400 no sandbox), então a
    // assinatura é criada direto e o Asaas gera uma cobrança por ciclo.
    const customerId =
      store.asaasCustomerId ??
      (
        await criarCliente({
          name: store.name,
          cpfCnpj: "",
          email: "",
          externalReference: store.id,
        })
      ).id;

    const assinatura = await criarAssinaturaPix({
      customerId,
      plan,
      cycle,
      storeId: store.id,
      primeiroVencimento: amanha(),
    });

    await supabase
      .from("stores")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: assinatura.id,
        billing_cycle: cycle,
      })
      .eq("id", store.id);

    revalidatePath("/painel/assinatura");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao iniciar a assinatura." };
  }
}

/**
 * Upgrade cobra a diferença proporcional e NÃO promove: a promoção vem do
 * webhook quando a cobrança confirmar. Downgrade agenda via pending_plan e o
 * webhook aplica na virada.
 */
export async function trocarPlano(destino: PaidPlan): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };
  if (!store.asaasSubscriptionId) return { error: "Nenhuma assinatura ativa." };

  const cycle = (store.billingCycle ?? "monthly") as BillingCycle;
  const supabase = createAdminClient();

  try {
    await atualizarAssinatura({ subscriptionId: store.asaasSubscriptionId, plan: destino, cycle });

    const valor =
      store.plan === "free"
        ? 0
        : proporcional(store.plan as PaidPlan, destino, cycle, store.planExpiresAt ?? "", new Date());

    if (valor > 0) {
      await criarCobrancaAvulsa({
        customerId: store.asaasCustomerId!,
        valor,
        storeId: store.id,
        vencimento: amanha(),
        descricao: `Upgrade para ${destino} — diferença proporcional`,
      });
      revalidatePath("/painel/assinatura");
      return { ok: true };
    }

    await supabase.from("stores").update({ pending_plan: destino }).eq("id", store.id);
    revalidatePath("/painel/assinatura");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao trocar de plano." };
  }
}

/**
 * Única escrita síncrona de estado — e ela só RESTRINGE. `plan_expires_at` fica
 * intacto: o lojista usa até o fim do período que pagou.
 */
export async function cancelarAssinatura(): Promise<AssinaturaState> {
  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };
  if (!store.asaasSubscriptionId) return { error: "Nenhuma assinatura ativa." };

  try {
    await cancelarNoAsaas(store.asaasSubscriptionId);
    const supabase = createAdminClient();
    await supabase
      .from("stores")
      .update({ subscription_status: "canceled" })
      .eq("id", store.id);
    revalidatePath("/painel/assinatura");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falha ao cancelar." };
  }
}
```

- [ ] **Step 3B: Adicionar a action que grava o documento**

Ainda em `app/actions/assinatura.ts`. Roda com o client autenticado, não com a service role: `document` é dado da própria loja e `authenticated` tem grant nela (Task 1B), então a RLS "own store only" já é a fronteira correta.

```ts
import { createClient } from "@/lib/supabase/server";
import { validarDocumento, normalizarDocumento } from "@/lib/validation/documento";

/**
 * Coletado pela modal quando o lojista tenta assinar via Pix sem documento.
 * Validado aqui antes de qualquer ida ao Asaas: dígito verificador errado é
 * diagnóstico nosso, e repassar a mensagem crua do gateway seria pior.
 */
export async function salvarDocumento(valor: string): Promise<AssinaturaState> {
  if (!validarDocumento(valor)) return { error: "CPF ou CNPJ inválido." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stores")
    .update({ document: normalizarDocumento(valor) })
    .eq("id", store.id);

  if (error) return { error: "Não foi possível salvar o documento." };

  revalidatePath("/painel/assinatura");
  return { ok: true };
}
```

E em `iniciarAssinatura`, no ramo do Pix, antes de criar o cliente:

```ts
    if (!store.document) return { error: "DOCUMENTO_NECESSARIO" };
```

O `criarCliente` passa a receber `cpfCnpj: store.document`.

- [ ] **Step 4: Expor os campos novos em `getCurrentStore`**

Em `lib/server/store.ts`, adicionar ao `.select(...)` da linha 114 as colunas `asaas_customer_id, asaas_subscription_id, billing_cycle, subscription_status, pending_plan`, e ao mapeamento (linha 62 em diante):

```ts
    asaasCustomerId: row.asaas_customer_id,
    asaasSubscriptionId: row.asaas_subscription_id,
    billingCycle: row.billing_cycle,
    subscriptionStatus: row.subscription_status,
    pendingPlan: row.pending_plan,
```

E os mesmos campos em `StoreSettings` (`lib/types.ts`), todos `string | null`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/assinatura-actions.test.ts && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add app/actions/assinatura.ts lib/server/store.ts lib/types.ts __tests__/assinatura-actions.test.ts
git commit -m "feat: server actions de assinatura, troca de plano e cancelamento"
```

---

### Task 7: Página `/painel/assinatura`

**Files:**
- Create: `app/painel/assinatura/page.tsx`
- Create: `app/painel/assinatura/AssinaturaClient.tsx`
- Test: `__tests__/AssinaturaClient.test.tsx`

**Interfaces:**
- Consumes: Task 6 (`iniciarAssinatura`, `trocarPlano`, `cancelarAssinatura`), `PRECOS` de `@/lib/asaas/plans`.
- Produces: rota `/painel/assinatura`, destino dos CTAs da Task 8.

- [ ] **Step 1: Escrever os testes de estado**

Criar `__tests__/AssinaturaClient.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssinaturaClient } from "@/app/painel/assinatura/AssinaturaClient";

vi.mock("@/app/actions/assinatura", () => ({
  iniciarAssinatura: vi.fn(),
  trocarPlano: vi.fn(),
  cancelarAssinatura: vi.fn(),
}));

const BASE = {
  plan: "free" as const,
  planExpiresAt: null,
  subscriptionStatus: null,
  billingCycle: null,
  pendingPlan: null,
};

describe("AssinaturaClient", () => {
  it("sem assinatura, oferece os planos e não mostra cancelar", () => {
    render(<AssinaturaClient {...BASE} />);
    expect(screen.getByText(/R\$ 29,90/)).toBeTruthy();
    expect(screen.getByText(/R\$ 59,90/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /cancelar assinatura/i })).toBeNull();
  });

  it("ativa mostra a data de renovação", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/renova em 12 de setembro/i)).toBeTruthy();
  });

  it("past_due avisa a falha e o prazo", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="past_due"
        planExpiresAt="2026-08-15T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/cobran(ç|c)a falhou/i)).toBeTruthy();
    expect(screen.getByText(/15 de agosto/i)).toBeTruthy();
  });

  it("cancelada diz até quando o acesso vale", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        subscriptionStatus="canceled"
        planExpiresAt="2026-08-30T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/termina em 30 de agosto/i)).toBeTruthy();
  });

  it("downgrade agendado é anunciado", () => {
    render(
      <AssinaturaClient
        {...BASE}
        plan="pro"
        pendingPlan="starter"
        subscriptionStatus="active"
        planExpiresAt="2026-09-12T00:00:00.000Z"
        billingCycle="monthly"
      />
    );
    expect(screen.getByText(/muda para Starter em 12 de setembro/i)).toBeTruthy();
  });

  it("no cartão avisa que haverá redirecionamento", () => {
    render(<AssinaturaClient {...BASE} />);
    expect(screen.getByText(/voc(ê|e) ser(á|a) redirecionado/i)).toBeTruthy();
  });
});

describe("AssinaturaClient — modal de documento", () => {
  it("não aparece antes de tentar assinar", () => {
    render(<AssinaturaClient {...BASE} document={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("abre quando a action devolve DOCUMENTO_NECESSARIO", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({ error: "DOCUMENTO_NECESSARIO" });

    render(<AssinaturaClient {...BASE} document={null} />);
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText(/CPF ou CNPJ/i)).toBeTruthy();
  });

  it("nunca exibe DOCUMENTO_NECESSARIO como mensagem de erro", async () => {
    const { iniciarAssinatura } = await import("@/app/actions/assinatura");
    vi.mocked(iniciarAssinatura).mockResolvedValue({ error: "DOCUMENTO_NECESSARIO" });

    render(<AssinaturaClient {...BASE} document={null} />);
    fireEvent.click(screen.getByRole("radio", { name: /pix/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /assinar/i })[0]);

    await screen.findByRole("dialog");
    expect(screen.queryByText(/DOCUMENTO_NECESSARIO/)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/AssinaturaClient.test.tsx`
Expected: FAIL — componente inexistente.

- [ ] **Step 3: Implementar a mensagem de status**

A lógica testável da página é a escolha da frase. Em `app/painel/assinatura/AssinaturaClient.tsx`:

```tsx
import { formatarDataSP } from "@/lib/timezone-sp";

type Status = "active" | "past_due" | "canceled" | null;

function mensagemDeStatus(status: Status, planExpiresAt: string | null): string {
  if (!status || !planExpiresAt) return "Você está no plano Free.";
  const data = formatarDataSP(planExpiresAt);

  switch (status) {
    case "active":
      return `Renova em ${data}.`;
    case "past_due":
      return `Sua cobrança falhou — regularize até ${data}.`;
    case "canceled":
      return `Sua assinatura termina em ${data}.`;
  }
}
```

Se `lib/timezone-sp.ts` não expuser um formatador de data por extenso, criar um ali — o arquivo já centraliza fuso do projeto e é onde essa responsabilidade pertence. O formato esperado pelos testes é `12 de setembro`.

- [ ] **Step 4: Montar o restante do componente**

Estrutura obrigatória, seguindo os componentes de `components/ui/` e os tokens de `docs/DESIGN_SYSTEM.md`:

- Bloco de status no topo, escolhido por `subscriptionStatus`:
  - `null` → "Você está no plano Free."
  - `"active"` → `renova em {data}` (ou `termina em {data}` se `plan_expires_at` for o fim de um cancelamento)
  - `"past_due"` → "Sua cobrança falhou — regularize até {data}"
  - `"canceled"` → "Sua assinatura termina em {data}"
- Se `pendingPlan`, uma linha: `Muda para {Plano} em {data}`.
- Quatro botões de contratação, um por combinação de plano e ciclo, com os valores de `PRECOS` e o anual exibido como `R$ X/mês, cobrado anualmente`.
- Seletor de meio de pagamento com o aviso correspondente: cartão → "Você será redirecionado para o Asaas"; Pix → "Geramos uma cobrança a cada ciclo".
- Botão de cancelar só quando `subscriptionStatus` for `active` ou `past_due`.
- Datas formatadas em `pt-BR` com `America/Sao_Paulo`, reaproveitando `lib/timezone-sp.ts`.

Ao receber `{ ok: true, redirectUrl }` de `iniciarAssinatura`, navegar com `window.location.href = redirectUrl`.

**Modal de documento.** Ao receber `{ error: "DOCUMENTO_NECESSARIO" }`, em vez de exibir erro, abrir uma `Modal` (`components/ui/Modal.tsx`, já existente) com um campo `CPF ou CNPJ`. Ao confirmar, chamar `salvarDocumento` e, em caso de sucesso, refazer a chamada de `iniciarAssinatura` com o mesmo plano, ciclo e meio — o lojista não deve precisar clicar em "assinar" de novo.

`DOCUMENTO_NECESSARIO` é um código de controle e **nunca** pode chegar à tela. Se aparecer para o lojista, é bug — e há um teste para isso.

A modal também é o lugar de explicar o porquê em uma linha: *"O Asaas exige CPF ou CNPJ para emitir cobranças Pix."*

- [ ] **Step 5: Implementar o Server Component**

Criar `app/painel/assinatura/page.tsx` seguindo o padrão de `app/painel/configuracoes/page.tsx`: `getCurrentStore()`, `redirect("/login")` se ausente, e repasse dos cinco campos para `AssinaturaClient`.

- [ ] **Step 6: Adicionar a rota à navegação do painel**

Incluir "Assinatura" em `components/painel/Sidebar.tsx` e no `MobileTabBar`, se ele listar as mesmas rotas. Sem isso a página existe mas só é alcançável pelos CTAs de upsell — e quem já assina não tem por onde chegar para cancelar.

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/AssinaturaClient.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/painel/assinatura __tests__/AssinaturaClient.test.tsx
git commit -m "feat: página de assinatura no painel"
```

---

### Task 8: Preços na landing e os sete CTAs

**Files:**
- Modify: `app/page.tsx:355-359,377-386,397-401,419-428`
- Modify: `components/painel/RecursoBloqueado.tsx`
- Modify: `components/painel/UpsellHint.tsx`
- Modify: `app/painel/layout.tsx:27`
- Modify: `components/loja/DominioField.tsx:24`
- Modify: `app/painel/produtos/ProdutosClient.tsx:114,143`
- Test: `__tests__/RecursoBloqueado.test.tsx`, `__tests__/UpsellHint.test.tsx`, `__tests__/ProdutosClient.test.tsx`, `__tests__/landing-data.test.ts`

**Interfaces:**
- Consumes: rota `/painel/assinatura` (Task 7).
- Produces: nenhum CTA de upsell apontando para WhatsApp.

- [ ] **Step 1: Escrever o teste que trava a regra**

Criar `__tests__/upsell-destinos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const ARQUIVOS_DE_UPSELL = [
  "components/painel/RecursoBloqueado.tsx",
  "components/painel/UpsellHint.tsx",
  "app/painel/layout.tsx",
  "components/loja/DominioField.tsx",
  "app/painel/produtos/ProdutosClient.tsx",
];

describe("CTAs de upsell", () => {
  it.each(ARQUIVOS_DE_UPSELL)("%s não aponta para o WhatsApp", (caminho) => {
    const src = readFileSync(caminho, "utf8");
    expect(src).not.toMatch(/wa\.me/);
    expect(src).not.toMatch(/vtrineWhatsAppHref/);
  });

  it("nenhum número de telefone hardcoded sobrou", () => {
    for (const caminho of ARQUIVOS_DE_UPSELL) {
      expect(readFileSync(caminho, "utf8")).not.toMatch(/5535\d{9}/);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/upsell-destinos.test.ts`
Expected: FAIL nos cinco arquivos.

- [ ] **Step 3: Trocar os destinos**

Em cada arquivo, substituir o `<a href={...wa.me...}>` por `<Link href="/painel/assinatura">` de `next/link`, mantendo o texto e as classes existentes.

`RecursoBloqueado` e `UpsellHint` perdem props que deixam de fazer sentido: `whatsappMessage` sai da interface de `UpsellHint`, e a constante `UPGRADE_MESSAGE` sai de `RecursoBloqueado`. Atualizar todos os pontos de uso (`app/painel/DashboardClient.tsx`, `app/painel/pedidos/page.tsx`, `app/painel/page.tsx`, `app/painel/personalizacao/PersonalizacaoClient.tsx`, `app/painel/categorias/CategoriasClient.tsx`).

Em `ProdutosClient.tsx:143`, o `href` com `5535999931678` cravado sai por inteiro.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/upsell-destinos.test.ts`
Expected: PASS.

- [ ] **Step 5: Publicar os preços na landing**

Em `app/page.tsx`, substituir os dois `Sob consulta` (linhas 355-359 e 397-401) pelos valores, com o anual abaixo:

```tsx
              <div className="mt-4 mb-1.5">
                <span className="font-display font-semibold text-[28px] text-obsidian tracking-tight">
                  R$ 29,90
                </span>
                <span className="font-body text-[15px] text-graphite">/mês</span>
              </div>
              <p className="font-body text-[13px] text-graphite mb-6">
                ou R$ 24,92/mês, cobrado anualmente
              </p>
```

E o mesmo bloco no card Pro com `R$ 59,90` e `ou R$ 49,92/mês, cobrado anualmente`.

Os dois CTAs (linhas 377-386 e 419-428) viram `<NextLink href="/cadastro">` com o texto "Começar agora" — quem está deslogado não tem loja e não pode assinar.

- [ ] **Step 6: Travar os preços com teste**

Adicionar a `__tests__/landing-data.test.ts`:

```ts
import { readFileSync } from "node:fs";

describe("preços publicados na landing", () => {
  const page = readFileSync("app/page.tsx", "utf8");

  it("exibe os valores mensais", () => {
    expect(page).toMatch(/R\$ 29,90/);
    expect(page).toMatch(/R\$ 59,90/);
  });

  it("exibe o anual como mensalidade equivalente", () => {
    expect(page).toMatch(/R\$ 24,92\/mês, cobrado anualmente/);
    expect(page).toMatch(/R\$ 49,92\/mês, cobrado anualmente/);
  });

  it("não resta 'Sob consulta'", () => {
    expect(page).not.toMatch(/Sob consulta/);
  });
});
```

- [ ] **Step 7: Rodar a suíte inteira, tipos e lint**

Run: `npx vitest run && npx tsc --noEmit && npx eslint .`
Expected: tudo passando.

- [ ] **Step 8: Commit**

```bash
git add app/ components/ __tests__/
git commit -m "feat: preços na landing e upsell apontando para a assinatura"
```

---

### Task 9: Verificação local ponta a ponta

Não produz código. É o roteiro que a spec exige antes do deploy, e o passo 6 é a prova de que as três specs se encaixam.

**Files:** nenhum.

**Interfaces:**
- Consumes: Tasks 1 a 8.
- Produces: confirmação de que o ciclo funciona fora dos mocks.

- [ ] **Step 1: Conferir o ambiente**

Run: `grep -oE "^[A-Z0-9_]+" .env.local | sort`
Expected: as sete chaves — `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 2: Subir o túnel e registrar o webhook**

Run: `cloudflared tunnel --url http://localhost:3000`

No painel do Asaas (sandbox), cadastrar `https://<url-do-tunel>/api/webhooks/asaas` com o mesmo valor de `ASAAS_WEBHOOK_TOKEN`. Valor divergente produz `401` em todo evento, e 15 falhas seguidas pausam a fila.

- [ ] **Step 3: Assinar com cartão de teste**

Abrir `/painel/assinatura`, escolher Pro mensal no cartão, completar no checkout do Asaas.
Expected: redirecionamento para `/painel/assinatura?status=ok`.

- [ ] **Step 4: Confirmar o efeito no banco**

Run:
```bash
npx supabase db execute --sql "select plan, plan_expires_at, subscription_status, billing_cycle, pending_plan from public.stores where id = '<store-id>';"
```
Expected: `subscription_status = active`, `plan_expires_at` cerca de um mês à frente.

- [ ] **Step 5: Confirmar o efeito na vitrine**

Abrir `/{slug}` e verificar que os limites do Pro valem — produtos além de 50 visíveis, galeria com 5 fotos, destaques sem corte.

- [ ] **Step 6: Forçar vencimento e observar a graça**

No sandbox, marcar a cobrança como vencida.
Expected: `subscription_status = past_due` e `plan_expires_at` três dias após o vencimento, com a vitrine ainda no ar.

- [ ] **Step 7: Provar o rebaixamento automático**

Run:
```bash
npx supabase db execute --sql "update public.stores set plan_expires_at = now() - interval '1 minute' where id = '<store-id>';"
```

Abrir `/{slug}`.
Expected: a vitrine cai para os limites do Free sem nenhuma outra intervenção — 8 produtos, 1 foto, sem destaques, tema padrão.

Este é o passo que amarra tudo: prova que `getEffectivePlan` (Spec 2A), o truncamento na leitura (Spec 1) e a cobrança (esta spec) formam um ciclo fechado.
