# Perfil da Loja e Checkout com Pagamento/Entrega — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Instagram ao perfil da loja (cadastro + configurações), exibir descrição/links de contato no catálogo público, permitir configurar formas de pagamento e entrega por loja, exigir essa escolha no checkout via WhatsApp, e atualizar o template de mensagem e a documentação.

**Architecture:** Três colunas novas em `stores` (`instagram`, `payment_methods`, `delivery_methods`, arrays vazios por padrão). O painel (`Configurações` e `Cadastro`) ganha os campos de captura; o catálogo público (`StoreHeader`, `BagDrawer`, `use-catalogo`) ganha a exibição e o fluxo de seleção; `lib/utils.ts` ganha as funções que formatam as novas linhas da mensagem do WhatsApp e uma regra de limpeza de linhas em branco.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres + `@supabase/ssr`), Zod v4, Tailwind CSS v3, Vitest + Testing Library.

## Global Constraints

- Mobile-first; sem lógica em `page.tsx`; toda lógica de estado vive em hooks `use-*.ts`.
- Componentes de UI (`BagDrawer`, `StoreHeader`) não computam regra de negócio — recebem tudo pronto via props.
- Server Actions sempre validam com Zod antes de tocar no banco; erro retorna `{ error: string }`.
- Ícones sempre Lucide React, outline, ~2px stroke, importados nomeadamente (`import { X } from 'lucide-react'`).
- Sem `box-shadow`; cores/espaçamentos sempre pelos tokens de `tailwind.config.ts`/`app/globals.css`.
- Transições no máximo 200ms ease.
- Lojas existentes nascem com `payment_methods = '{}'` e `delivery_methods = '{}'` — checkout deve continuar idêntico ao atual até o lojista configurar manualmente.

---

### Task 1: Migration — `instagram`, `payment_methods`, `delivery_methods` em `stores`

**Files:**
- Create: `supabase/migrations/20260705010000_perfil_loja_pagamento_entrega.sql`

**Interfaces:**
- Produces: colunas `stores.instagram (text, nullable)`, `stores.payment_methods (text[], not null default '{}')`, `stores.delivery_methods (text[], not null default '{}')`.

- [ ] **Step 1: Criar a migration**

```sql
-- Perfil social da loja (Instagram) e formas de pagamento/entrega configuráveis.
-- Arrays vazios por padrão: lojas existentes mantêm o checkout sem seletor até
-- o lojista habilitar manualmente ao menos uma opção de cada grupo.
alter table public.stores
  add column instagram text,
  add column payment_methods text[] not null default '{}',
  add column delivery_methods text[] not null default '{}';
```

- [ ] **Step 2: Aplicar a migration no Supabase local**

Run: `supabase db reset`
Expected: saída termina em `Finished supabase db reset` sem erros, e `supabase db diff` (ou `\d stores` no `psql`) mostra as três colunas novas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260705010000_perfil_loja_pagamento_entrega.sql
git commit -m "feat: adiciona instagram e formas de pagamento/entrega em stores"
```

---

### Task 2: `lib/data.ts` — listas de formas de pagamento e entrega

**Files:**
- Modify: `lib/data.ts` (final do arquivo, depois de `FASHION_COLORS`)
- Test: `__tests__/data.test.ts`

**Interfaces:**
- Produces: `PAYMENT_METHOD_VALUES: readonly ["pix", "cartao", "dinheiro"]`, `PAYMENT_METHODS: { value: string; label: string }[]`, `DELIVERY_METHOD_VALUES: readonly ["retirada", "entrega"]`, `DELIVERY_METHODS: { value: string; label: string }[]`. Consumidas por: `lib/validation/painel.ts` (Task 4), `lib/utils.ts` (Task 3), `components/catalogo/BagDrawer.tsx` (Task 11), `app/painel/configuracoes/ConfiguracoesClient.tsx` (Task 8).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao final de `__tests__/data.test.ts`:

```ts
import { PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";

describe("PAYMENT_METHODS", () => {
  it("tem os três métodos esperados, na ordem", () => {
    expect(PAYMENT_METHODS.map((m) => m.value)).toEqual(["pix", "cartao", "dinheiro"]);
    expect(PAYMENT_METHODS.map((m) => m.label)).toEqual(["Pix", "Cartão", "Dinheiro"]);
  });
});

describe("DELIVERY_METHODS", () => {
  it("tem os dois métodos esperados, na ordem", () => {
    expect(DELIVERY_METHODS.map((m) => m.value)).toEqual(["retirada", "entrega"]);
    expect(DELIVERY_METHODS.map((m) => m.label)).toEqual(["Retirar no local", "Enviar no endereço"]);
  });
});
```

(Atualizar o `import` já existente no topo do arquivo para incluir `PAYMENT_METHODS, DELIVERY_METHODS` junto com `PRODUCTS, STORE`.)

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/data.test.ts`
Expected: FAIL — `PAYMENT_METHODS`/`DELIVERY_METHODS` não exportados por `@/lib/data`.

- [ ] **Step 3: Implementar em `lib/data.ts`**

Adicionar ao final do arquivo:

```ts
export const PAYMENT_METHOD_VALUES = ["pix", "cartao", "dinheiro"] as const;

export const PAYMENT_METHODS: { value: (typeof PAYMENT_METHOD_VALUES)[number]; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
];

export const DELIVERY_METHOD_VALUES = ["retirada", "entrega"] as const;

export const DELIVERY_METHODS: { value: (typeof DELIVERY_METHOD_VALUES)[number]; label: string }[] = [
  { value: "retirada", label: "Retirar no local" },
  { value: "entrega", label: "Enviar no endereço" },
];
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/data.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts __tests__/data.test.ts
git commit -m "feat: adiciona listas de formas de pagamento e entrega"
```

---

### Task 3: `lib/utils.ts` — formatação de pagamento/entrega na mensagem do WhatsApp

**Files:**
- Modify: `lib/utils.ts`
- Test: `__tests__/utils.test.ts`

**Interfaces:**
- Consumes: `PAYMENT_METHODS`, `DELIVERY_METHODS` de `@/lib/data` (Task 2).
- Produces: `formatPaymentLine(payment?: string | null): string`, `formatDeliveryLine(delivery?: string | null, address?: string | null): string`, `type OrderInfo = { payment?: string | null; delivery?: string | null; address?: string | null }`. `buildWhatsAppMessage(items, order?: OrderInfo)` e `renderWhatsAppMessage(template, items, order?: OrderInfo)` passam a aceitar o 3º parâmetro opcional. Consumidas por `app/[slug]/use-catalogo.ts` (Task 10).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `__tests__/utils.test.ts`:

```ts
import { formatPaymentLine, formatDeliveryLine } from "@/lib/utils";

describe("formatPaymentLine", () => {
  it("retorna a linha formatada para um método conhecido", () => {
    expect(formatPaymentLine("pix")).toBe("Forma de pagamento: Pix");
    expect(formatPaymentLine("cartao")).toBe("Forma de pagamento: Cartão");
  });

  it("retorna vazio para método desconhecido, null ou undefined", () => {
    expect(formatPaymentLine("boleto")).toBe("");
    expect(formatPaymentLine(null)).toBe("");
    expect(formatPaymentLine(undefined)).toBe("");
  });
});

describe("formatDeliveryLine", () => {
  it("retorna a linha de retirada", () => {
    expect(formatDeliveryLine("retirada")).toBe("Entrega: Retirar no local");
  });

  it("retorna a linha de entrega com o endereço embutido", () => {
    expect(formatDeliveryLine("entrega", "Rua X, 123")).toBe(
      "Entrega: Enviar no endereço — Rua X, 123"
    );
  });

  it("retorna a linha de entrega sem endereço quando ele não é informado", () => {
    expect(formatDeliveryLine("entrega", "")).toBe("Entrega: Enviar no endereço");
    expect(formatDeliveryLine("entrega")).toBe("Entrega: Enviar no endereço");
  });

  it("retorna vazio para método desconhecido, null ou undefined", () => {
    expect(formatDeliveryLine("sedex")).toBe("");
    expect(formatDeliveryLine(null)).toBe("");
    expect(formatDeliveryLine(undefined)).toBe("");
  });
});

describe("buildWhatsAppMessage — pagamento e entrega (novo)", () => {
  const items = [
    { product: { name: "Blusa", price: "R$ 80,00" }, size: null, color: null, qty: 1 },
  ];

  it("inclui as linhas de pagamento e entrega quando informadas", () => {
    const msg = buildWhatsAppMessage(items, { payment: "pix", delivery: "retirada" });
    expect(msg).toContain("Forma de pagamento: Pix");
    expect(msg).toContain("Entrega: Retirar no local");
  });

  it("não deixa linhas em branco soltas quando pagamento/entrega não são informados", () => {
    const msg = buildWhatsAppMessage(items);
    expect(msg).not.toMatch(/\n{3,}/);
    expect(msg).not.toContain("Forma de pagamento:");
    expect(msg).not.toContain("Entrega:");
  });
});

describe("renderWhatsAppMessage — pagamento e entrega (novo)", () => {
  const items = [
    { product: { name: "Blusa", price: "R$ 80,00" }, size: null, color: null, qty: 1 },
  ];

  it("substitui {pagamento} e {entrega} quando informados", () => {
    const msg = renderWhatsAppMessage("{pagamento}\n{entrega}", items, {
      payment: "cartao",
      delivery: "entrega",
      address: "Rua Y, 45",
    });
    expect(msg).toBe("Forma de pagamento: Cartão\nEntrega: Enviar no endereço — Rua Y, 45");
  });

  it("colapsa linhas em branco quando pagamento/entrega ficam vazios", () => {
    const msg = renderWhatsAppMessage("Início\n\n{pagamento}\n\n{entrega}\n\nFim", items);
    expect(msg).toBe("Início\n\nFim");
  });
});
```

(Atualizar o `import` já existente no topo de `__tests__/utils.test.ts` para incluir `formatPaymentLine, formatDeliveryLine`.)

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/utils.test.ts`
Expected: FAIL — `formatPaymentLine`/`formatDeliveryLine` não exportados por `@/lib/utils`.

- [ ] **Step 3: Implementar em `lib/utils.ts`**

Adicionar o import no topo do arquivo:

```ts
import { PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";
```

Adicionar logo após a declaração de `WHATSAPP_SEPARATOR`:

```ts
export interface OrderInfo {
  payment?: string | null;
  delivery?: string | null;
  address?: string | null;
}

export function formatPaymentLine(payment?: string | null): string {
  const method = PAYMENT_METHODS.find((m) => m.value === payment);
  return method ? `Forma de pagamento: ${method.label}` : "";
}

export function formatDeliveryLine(delivery?: string | null, address?: string | null): string {
  const method = DELIVERY_METHODS.find((m) => m.value === delivery);
  if (!method) return "";
  if (method.value === "entrega" && address?.trim()) {
    return `Entrega: ${method.label} — ${address.trim()}`;
  }
  return `Entrega: ${method.label}`;
}

// {pagamento}/{entrega} podem resolver para string vazia quando a loja não
// configurou aquele grupo — colapsa as quebras de linha extras que sobram.
function collapseBlankLines(message: string): string {
  return message.replace(/\n{3,}/g, "\n\n").trim();
}
```

Substituir a função `buildWhatsAppMessage` existente por:

```ts
export function buildWhatsAppMessage(items: WhatsAppItem[], order?: OrderInfo): string {
  const total = cartTotal(items);
  const pagamento = formatPaymentLine(order?.payment);
  const entrega = formatDeliveryLine(order?.delivery, order?.address);
  const message = `${WHATSAPP_GREETING}\n\n${formatItemsBlock(items)}\n\n${pagamento}\n\n${entrega}\n\n${WHATSAPP_SEPARATOR}\n*Total: ${formatMoney(total)}*\n${WHATSAPP_SEPARATOR}`;
  return collapseBlankLines(message);
}
```

Substituir a função `renderWhatsAppMessage` existente por:

```ts
export function renderWhatsAppMessage(
  template: string | null | undefined,
  items: WhatsAppItem[],
  order?: OrderInfo
): string {
  const trimmed = template?.trim();
  if (!trimmed) return buildWhatsAppMessage(items, order);
  const rendered = trimmed
    .replaceAll("{saudacao}", WHATSAPP_GREETING)
    .replaceAll("{itens}", formatItemsBlock(items))
    .replaceAll("{total}", formatMoney(cartTotal(items)))
    .replaceAll("{pagamento}", formatPaymentLine(order?.payment))
    .replaceAll("{entrega}", formatDeliveryLine(order?.delivery, order?.address));
  return collapseBlankLines(rendered);
}
```

- [ ] **Step 4: Rodar todos os testes de `utils.test.ts` e confirmar que passam**

Run: `npx vitest run __tests__/utils.test.ts`
Expected: PASS — incluindo os testes já existentes (`buildWhatsAppMessage — formato padrão (§8)`, `renderWhatsAppMessage (CAT-07, CAT-08)`), que não devem quebrar.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts __tests__/utils.test.ts
git commit -m "feat: adiciona pagamento e entrega à mensagem do WhatsApp"
```

---

### Task 4: `lib/validation/painel.ts` — validação de pagamento/entrega/instagram

**Files:**
- Modify: `lib/validation/painel.ts`
- Test: `__tests__/painel-validation.test.ts`

**Interfaces:**
- Consumes: `PAYMENT_METHOD_VALUES`, `DELIVERY_METHOD_VALUES` de `@/lib/data` (Task 2).
- Produces: `storeSettingsSchema` passa a exigir `instagram: string | null`, `paymentMethods: string[]` (subconjunto de `PAYMENT_METHOD_VALUES`), `deliveryMethods: string[]` (subconjunto de `DELIVERY_METHOD_VALUES`). Consumida por `app/actions/store.ts` (Task 7).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao início de `__tests__/painel-validation.test.ts`, ajustando o `import`:

```ts
import {
  productSchema,
  categoryNameSchema,
  canDeleteCategory,
  storeSettingsSchema,
} from "@/lib/validation/painel";
```

Adicionar ao final do arquivo:

```ts
describe("storeSettingsSchema — pagamento, entrega e instagram (novo)", () => {
  const base = {
    name: "Ateliê Mira",
    whatsapp: null,
    accentColor: "#C9A96E",
    description: null,
    monogram: null,
    instagram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
  };

  it("aceita arrays vazios de pagamento e entrega", () => {
    const r = storeSettingsSchema.safeParse({ ...base, paymentMethods: [], deliveryMethods: [] });
    expect(r.success).toBe(true);
  });

  it("aceita valores válidos de pagamento e entrega", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      paymentMethods: ["pix", "cartao"],
      deliveryMethods: ["retirada"],
    });
    expect(r.success).toBe(true);
  });

  it("rejeita forma de pagamento desconhecida", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      paymentMethods: ["boleto"],
      deliveryMethods: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejeita forma de entrega desconhecida", () => {
    const r = storeSettingsSchema.safeParse({
      ...base,
      paymentMethods: [],
      deliveryMethods: ["motoboy"],
    });
    expect(r.success).toBe(false);
  });

  it("aceita instagram nulo ou preenchido", () => {
    expect(
      storeSettingsSchema.safeParse({
        ...base,
        paymentMethods: [],
        deliveryMethods: [],
        instagram: "atelieming",
      }).success
    ).toBe(true);
    expect(
      storeSettingsSchema.safeParse({ ...base, paymentMethods: [], deliveryMethods: [] }).success
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: FAIL — `storeSettingsSchema` ainda não aceita `instagram`/`paymentMethods`/`deliveryMethods` (campos extras são ignorados pelo Zod por padrão, mas os testes de rejeição vão falhar porque o schema não valida esses campos ainda).

- [ ] **Step 3: Implementar em `lib/validation/painel.ts`**

Atualizar o import no topo:

```ts
import { z } from "zod";
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from "@/lib/data";
```

Substituir `storeSettingsSchema` por:

```ts
export const storeSettingsSchema = z.object({
  name: z.string().min(2, "Nome da loja é obrigatório"),
  whatsapp: z.string().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  description: z.string().nullable(),
  monogram: z.string().max(3, "Monograma deve ter no máximo 3 letras").nullable(),
  instagram: z.string().nullable(),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
  analyticsId: z.string().nullable(),
  pixelId: z.string().nullable(),
  messageTemplate: z.string().nullable(),
});
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validation/painel.ts __tests__/painel-validation.test.ts
git commit -m "feat: valida instagram e formas de pagamento/entrega em storeSettingsSchema"
```

---

### Task 5: Catálogo público — `Store.instagram`/`paymentMethods`/`deliveryMethods`

**Files:**
- Modify: `lib/types.ts:26-35` (interface `Store`)
- Modify: `lib/catalog.ts:8-19,58-70` (`PublicStoreRow`, `mapPublicStore`)
- Modify: `lib/server/catalog.ts:12-13` (`STORE_COLS`)
- Test: `__tests__/catalog.test.ts`

**Interfaces:**
- Produces: `Store.instagram?: string`, `Store.paymentMethods?: string[]`, `Store.deliveryMethods?: string[]`. Consumidas por `components/catalogo/StoreHeader.tsx` (Task 6) e `app/[slug]/use-catalogo.ts` (Task 10).

- [ ] **Step 1: Escrever os testes que falham**

Atualizar o fixture `storeRow` no topo de `__tests__/catalog.test.ts` para incluir as 3 colunas novas:

```ts
const storeRow: PublicStoreRow = {
  id: "s1",
  name: "Ateliê Mira",
  slug: "atelie-mira",
  is_active: true,
  whatsapp: "5511999990000",
  accent_color: "#C9A96E",
  logo_url: null,
  description: "Vitrine premium",
  monogram: "AM",
  analytics_id: null,
  pixel_id: null,
  message_template: null,
  instagram: null,
  payment_methods: null,
  delivery_methods: null,
};
```

Adicionar ao final do arquivo:

```ts
describe("mapPublicStore — perfil social e checkout (novo)", () => {
  it("mapeia instagram, payment_methods e delivery_methods quando presentes", () => {
    const store = mapPublicStore(
      {
        ...storeRow,
        instagram: "atelieming",
        payment_methods: ["pix"],
        delivery_methods: ["retirada", "entrega"],
      },
      []
    );
    expect(store.instagram).toBe("atelieming");
    expect(store.paymentMethods).toEqual(["pix"]);
    expect(store.deliveryMethods).toEqual(["retirada", "entrega"]);
  });

  it("usa arrays vazios quando payment_methods/delivery_methods são null", () => {
    const store = mapPublicStore(storeRow, []);
    expect(store.paymentMethods).toEqual([]);
    expect(store.deliveryMethods).toEqual([]);
    expect(store.instagram).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: FAIL — `PublicStoreRow` não tem `instagram`/`payment_methods`/`delivery_methods`, e `mapPublicStore` não retorna esses campos.

- [ ] **Step 3: Implementar**

Em `lib/types.ts`, dentro da interface `Store` (logo após `whatsapp: string;`):

```ts
export interface Store {
  name: string;
  monogram: string;
  logoUrl?: string | null;
  whatsapp: string;
  instagram?: string;
  categories: string[];
  description: string;
  accentColor: string;
  catalogUrl: string;
  analyticsId?: string;
  pixelId?: string;
  messageTemplate?: string | null;
  paymentMethods?: string[];
  deliveryMethods?: string[];
}
```

Em `lib/catalog.ts`, adicionar campos em `PublicStoreRow`:

```ts
export interface PublicStoreRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  whatsapp: string | null;
  accent_color: string | null;
  logo_url: string | null;
  description: string | null;
  monogram: string | null;
  analytics_id: string | null;
  pixel_id: string | null;
  message_template: string | null;
  instagram: string | null;
  payment_methods: string[] | null;
  delivery_methods: string[] | null;
}
```

E em `mapPublicStore`, adicionar ao objeto retornado (após `messageTemplate: row.message_template,`):

```ts
    messageTemplate: row.message_template,
    instagram: row.instagram ?? undefined,
    paymentMethods: row.payment_methods ?? [],
    deliveryMethods: row.delivery_methods ?? [],
  };
}
```

Em `lib/server/catalog.ts`, atualizar `STORE_COLS`:

```ts
const STORE_COLS =
  "id, name, slug, is_active, whatsapp, accent_color, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods";
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: PASS

- [ ] **Step 5: Rodar a suíte completa para checar regressões de tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos (os consumidores de `Store`/`PublicStoreRow` ainda não usam os campos novos, mas o tipo é retrocompatível pois todos são opcionais/nullable).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/catalog.ts lib/server/catalog.ts __tests__/catalog.test.ts
git commit -m "feat: mapeia instagram e formas de pagamento/entrega no catálogo público"
```

---

### Task 6: `StoreHeader` — descrição e links de WhatsApp/Instagram

**Files:**
- Modify: `components/catalogo/StoreHeader.tsx`
- Test: `__tests__/StoreHeader.test.tsx`

**Interfaces:**
- Consumes: `Store.description`, `Store.whatsapp`, `Store.instagram` (Task 5); `normalizeWhatsapp` de `@/lib/utils`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `__tests__/StoreHeader.test.tsx`:

```ts
describe("StoreHeader — descrição e links (novo)", () => {
  it("mostra a descrição da loja quando presente", () => {
    renderHeader(baseStore);
    expect(screen.getByText("Vitrine premium")).toBeTruthy();
  });

  it("não renderiza a descrição quando vazia", () => {
    renderHeader({ ...baseStore, description: "" });
    expect(screen.queryByText("Vitrine premium")).toBeNull();
  });

  it("mostra o link de WhatsApp sem mensagem pré-preenchida", () => {
    renderHeader(baseStore);
    const link = screen.getByRole("link", { name: /WhatsApp/i });
    expect(link.getAttribute("href")).toBe("https://wa.me/5511999990000");
  });

  it("mostra o link de Instagram com o @ do usuário", () => {
    renderHeader({ ...baseStore, instagram: "atelieming" });
    const link = screen.getByRole("link", { name: /@atelieming/i });
    expect(link.getAttribute("href")).toBe("https://instagram.com/atelieming");
  });

  it("não mostra a linha de links quando não há whatsapp nem instagram", () => {
    renderHeader({ ...baseStore, whatsapp: "" });
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^@/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/StoreHeader.test.tsx`
Expected: FAIL — nenhum link/descrição é renderizado ainda.

- [ ] **Step 3: Implementar em `components/catalogo/StoreHeader.tsx`**

Atualizar o import de ícones e adicionar o de `normalizeWhatsapp`:

```tsx
import { Search, ShoppingBag, X, MessageCircle, Instagram } from "lucide-react";
import type { Store } from "@/lib/types";
import { normalizeWhatsapp } from "@/lib/utils";
```

Inserir, logo depois do `</div>` que fecha a linha `flex items-center gap-3` (nome/logo/botões) e antes do bloco `{searchOpen && (...)}`:

```tsx
      {(store.description || store.whatsapp || store.instagram) && (
        <div className="flex flex-col gap-1.5">
          {store.description && (
            <p className="font-body text-[13px] text-graphite leading-snug">
              {store.description}
            </p>
          )}
          {(store.whatsapp || store.instagram) && (
            <div className="flex items-center gap-4">
              {store.whatsapp && (
                <a
                  href={`https://wa.me/${normalizeWhatsapp(store.whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-body text-[12px] text-graphite hover:text-obsidian transition-colors"
                >
                  <MessageCircle size={14} />
                  WhatsApp
                </a>
              )}
              {store.instagram && (
                <a
                  href={`https://instagram.com/${store.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-body text-[12px] text-graphite hover:text-obsidian transition-colors"
                >
                  <Instagram size={14} />@{store.instagram}
                </a>
              )}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/StoreHeader.test.tsx`
Expected: PASS — incluindo os testes já existentes do arquivo.

- [ ] **Step 5: Commit**

```bash
git add components/catalogo/StoreHeader.tsx __tests__/StoreHeader.test.tsx
git commit -m "feat: exibe descrição e links de WhatsApp/Instagram no header do catálogo"
```

---

### Task 7: Painel — `StoreSettings` e persistência (`store.ts`)

**Files:**
- Modify: `lib/types.ts` (interface `StoreSettings`)
- Modify: `lib/server/store.ts` (`StoreRow`, `mapStore`, `getCurrentStore`)
- Modify: `app/actions/store.ts` (`updateStoreSettings`)

**Interfaces:**
- Consumes: `storeSettingsSchema` (Task 4).
- Produces: `StoreSettings.instagram: string | null`, `StoreSettings.paymentMethods: string[]`, `StoreSettings.deliveryMethods: string[]`. Consumidas por `app/painel/configuracoes/use-configuracoes.ts` (Task 8).

- [ ] **Step 1: Atualizar `lib/types.ts`**

Adicionar campos em `StoreSettings` (após `messageTemplate: string | null;`):

```ts
export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | null;
  trialEndsAt: string | null;
  whatsapp: string | null;
  accentColor: string;
  logoUrl: string | null;
  description: string | null;
  monogram: string | null;
  analyticsId: string | null;
  pixelId: string | null;
  messageTemplate: string | null;
  instagram: string | null;
  paymentMethods: string[];
  deliveryMethods: string[];
}
```

- [ ] **Step 2: Atualizar `lib/server/store.ts`**

Adicionar campos em `StoreRow`:

```ts
type StoreRow = {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "pro" | null;
  trial_ends_at: string | null;
  whatsapp: string | null;
  accent_color: string | null;
  logo_url: string | null;
  description: string | null;
  monogram: string | null;
  analytics_id: string | null;
  pixel_id: string | null;
  message_template: string | null;
  instagram: string | null;
  payment_methods: string[] | null;
  delivery_methods: string[] | null;
};
```

Atualizar `mapStore` (após `messageTemplate: row.message_template,`):

```ts
    messageTemplate: row.message_template,
    instagram: row.instagram,
    paymentMethods: row.payment_methods ?? [],
    deliveryMethods: row.delivery_methods ?? [],
  };
}
```

Atualizar a string de `select` em `getCurrentStore`:

```ts
    .select(
      "id, name, slug, plan, trial_ends_at, whatsapp, accent_color, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods"
    )
```

- [ ] **Step 3: Atualizar `app/actions/store.ts`**

No `storeSettingsSchema.safeParse(...)`, adicionar os campos novos:

```ts
  const parsed = storeSettingsSchema.safeParse({
    name: formData.get("name"),
    whatsapp: (formData.get("whatsapp") as string) || null,
    accentColor: formData.get("accentColor"),
    description: (formData.get("description") as string) || null,
    monogram: (formData.get("monogram") as string) || null,
    instagram: (formData.get("instagram") as string)?.replace(/^@+/, "").trim() || null,
    paymentMethods: JSON.parse((formData.get("paymentMethods") as string) || "[]"),
    deliveryMethods: JSON.parse((formData.get("deliveryMethods") as string) || "[]"),
    // analyticsId e pixelId não vêm do formData (UI oculta) — preserva valores existentes no banco
    analyticsId: store.analyticsId,
    pixelId: store.pixelId,
    messageTemplate: (formData.get("messageTemplate") as string) || null,
  });
```

No `.update({...})`, adicionar as colunas novas:

```ts
  const { error } = await supabase
    .from("stores")
    .update({
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      accent_color: parsed.data.accentColor,
      description: parsed.data.description,
      monogram: parsed.data.monogram,
      instagram: parsed.data.instagram,
      payment_methods: parsed.data.paymentMethods,
      delivery_methods: parsed.data.deliveryMethods,
      analytics_id: parsed.data.analyticsId,
      pixel_id: parsed.data.pixelId,
      message_template: parsed.data.messageTemplate,
      logo_url: logoUrl,
    })
    .eq("id", store.id);
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit`
Expected: um único erro, em `__tests__/ConfiguracoesClient.test.tsx`, porque o fixture `baseSettings` ainda não tem `instagram`/`paymentMethods`/`deliveryMethods` (campos agora obrigatórios em `StoreSettings`). Esse erro é esperado nesta task e será corrigido na Task 8, que atualiza esse mesmo fixture. Confirme que não há erros em nenhum outro arquivo.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/server/store.ts app/actions/store.ts
git commit -m "feat: persiste instagram e formas de pagamento/entrega da loja"
```

---

### Task 8: Configurações — Instagram e card "Pagamento e entrega"

**Files:**
- Modify: `app/painel/configuracoes/use-configuracoes.ts`
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`
- Test: `__tests__/ConfiguracoesClient.test.tsx`

**Interfaces:**
- Consumes: `StoreSettings.instagram/paymentMethods/deliveryMethods` (Task 7); `PAYMENT_METHODS`, `DELIVERY_METHODS` de `@/lib/data` (Task 2); `ToggleRow` de `@/components/ui/Switch`.
- Produces: `useConfiguracoes` expõe `instagram`, `setInstagram`, `paymentMethods`, `togglePaymentMethod`, `deliveryMethods`, `toggleDeliveryMethod`.

- [ ] **Step 1: Escrever os testes que falham**

Atualizar o import e o fixture `baseSettings` em `__tests__/ConfiguracoesClient.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ConfiguracoesClient } from "@/app/painel/configuracoes/ConfiguracoesClient";
import type { StoreSettings } from "@/lib/types";

vi.mock("@/app/actions/store", () => ({
  updateStoreSettings: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (f: File) => f),
}));

const baseSettings: StoreSettings = {
  id: "store1",
  name: "Ateliê Mira",
  slug: "ateliemira",
  plan: "pro",
  trialEndsAt: new Date().toISOString(),
  whatsapp: "5511999990000",
  accentColor: "#C9A96E",
  logoUrl: null,
  description: "Vitrine premium",
  monogram: "AM",
  analyticsId: null,
  pixelId: null,
  messageTemplate: null,
  instagram: null,
  paymentMethods: [],
  deliveryMethods: [],
};
```

Adicionar ao final do arquivo:

```tsx
describe("ConfiguracoesClient — Instagram (novo)", () => {
  it("renderiza o instagram salvo", () => {
    render(<ConfiguracoesClient settings={{ ...baseSettings, instagram: "atelieming" }} />);
    expect(screen.getByLabelText(/Instagram/i)).toHaveValue("atelieming");
  });
});

describe("ConfiguracoesClient — pagamento e entrega (novo)", () => {
  it("renderiza todas as opções desmarcadas por padrão", () => {
    render(<ConfiguracoesClient settings={baseSettings} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!;
    expect(within(pixRow).getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("marca a forma de pagamento salva anteriormente", () => {
    render(<ConfiguracoesClient settings={{ ...baseSettings, paymentMethods: ["pix"] }} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!;
    expect(within(pixRow).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("alterna a forma de pagamento ao clicar no switch", () => {
    render(<ConfiguracoesClient settings={baseSettings} />);
    const pixRow = screen.getByText("Pix").closest("div")!.parentElement!;
    const toggle = within(pixRow).getByRole("switch");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("marca a forma de entrega salva anteriormente", () => {
    render(<ConfiguracoesClient settings={{ ...baseSettings, deliveryMethods: ["entrega"] }} />);
    const entregaRow = screen.getByText("Enviar no endereço").closest("div")!.parentElement!;
    expect(within(entregaRow).getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: FAIL — campo de Instagram e card de pagamento/entrega ainda não existem; TS também reclama de `StoreSettings` faltando campos até o Step 3.

- [ ] **Step 3: Implementar em `app/painel/configuracoes/use-configuracoes.ts`**

Atualizar `MSG_DEFAULT` e `MSG_VARS`:

```ts
export const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n{pagamento}\n\n{entrega}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export const MSG_VARS = [
  { token: "{saudacao}", desc: "saudação inicial" },
  { token: "{itens}", desc: "lista de itens da sacola" },
  { token: "{total}", desc: "valor total do pedido" },
  { token: "{pagamento}", desc: "forma de pagamento escolhida" },
  { token: "{entrega}", desc: "forma de entrega escolhida" },
];
```

No corpo de `useConfiguracoes`, adicionar estado (após `storeDescription`):

```ts
  const [instagram, setInstagram] = useState(settings.instagram ?? '');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(settings.paymentMethods ?? []);
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(settings.deliveryMethods ?? []);

  const togglePaymentMethod = (value: string) => {
    setPaymentMethods((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleDeliveryMethod = (value: string) => {
    setDeliveryMethods((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };
```

No wrapper de `useActionState`, adicionar antes de `if (logo) formData.set("logo", logo);`:

```ts
      formData.set("accentColor", accent);
      formData.set("messageTemplate", msgTpl);
      formData.set("instagram", instagram);
      formData.set("paymentMethods", JSON.stringify(paymentMethods));
      formData.set("deliveryMethods", JSON.stringify(deliveryMethods));
      if (logo) formData.set("logo", logo);
```

No objeto retornado pelo hook, adicionar:

```ts
    instagram,
    setInstagram,
    paymentMethods,
    togglePaymentMethod,
    deliveryMethods,
    toggleDeliveryMethod,
```

- [ ] **Step 4: Implementar em `app/painel/configuracoes/ConfiguracoesClient.tsx`**

Atualizar os imports:

```tsx
import { Upload, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { ToggleRow } from "@/components/ui/Switch";
import { ACCENT_COLOR_OPTIONS, PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";
import { signOut } from "@/app/actions/auth";
import type { StoreSettings } from "@/lib/types";
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";
```

Atualizar `MSG_MOCK` e `renderTemplate`:

```tsx
const MSG_MOCK = {
  saudacao: "Olá! Gostaria de fazer um pedido:",
  itens:
    "01. Produto Exemplo\n    Quantidade: 2x | Valor unitário: R$ 50,00\n    Tamanho: M\n    Cor: Preto\n    Subtotal: R$ 100,00",
  total: "R$ 100,00",
  pagamento: "Forma de pagamento: Pix",
  entrega: "Entrega: Retirar no local",
};

function renderTemplate(tpl: string) {
  return tpl
    .replace(/\{saudacao\}/g, MSG_MOCK.saudacao)
    .replace(/\{itens\}/g, MSG_MOCK.itens)
    .replace(/\{total\}/g, MSG_MOCK.total)
    .replace(/\{pagamento\}/g, MSG_MOCK.pagamento)
    .replace(/\{entrega\}/g, MSG_MOCK.entrega);
}
```

Substituir o placeholder `<div className="hidden sm:block" />` (dentro do grid do card "Identidade") pelo campo de Instagram:

```tsx
          <Input
            name="instagram"
            label="Instagram (opcional)"
            prefix="@"
            value={f.instagram}
            onChange={(e) => f.setInstagram(e.target.value)}
          />
```

Adicionar um novo `<Card>` logo depois do card "Mensagem do pedido" (antes do comentário `{/* Integrações ... */}`):

```tsx
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
          Pagamento e entrega
        </h2>
        <p className="font-body text-[13px] text-graphite mb-4">
          O cliente só vê essas opções no checkout se você marcar ao menos uma aqui.
        </p>

        <h3 className="font-body font-medium text-[13px] tracking-[0.04em] uppercase text-graphite mb-1">
          Formas de pagamento aceitas
        </h3>
        <div className="mb-5">
          {PAYMENT_METHODS.map((method) => (
            <ToggleRow
              key={method.value}
              label={method.label}
              checked={f.paymentMethods.includes(method.value)}
              onChange={() => f.togglePaymentMethod(method.value)}
            />
          ))}
        </div>

        <h3 className="font-body font-medium text-[13px] tracking-[0.04em] uppercase text-graphite mb-1">
          Formas de entrega
        </h3>
        <div>
          {DELIVERY_METHODS.map((method) => (
            <ToggleRow
              key={method.value}
              label={method.label}
              checked={f.deliveryMethods.includes(method.value)}
              onChange={() => f.toggleDeliveryMethod(method.value)}
            />
          ))}
        </div>
      </Card>
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS — incluindo os testes já existentes (`ConfiguracoesClient logo avatar`).

- [ ] **Step 6: Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add app/painel/configuracoes/use-configuracoes.ts app/painel/configuracoes/ConfiguracoesClient.tsx __tests__/ConfiguracoesClient.test.tsx
git commit -m "feat: adiciona Instagram e configuração de pagamento/entrega no painel"
```

---

### Task 9: Cadastro — campo de Instagram na etapa "loja"

**Files:**
- Modify: `app/actions/auth.ts` (`storeSchema`, `createStore`)
- Modify: `app/(auth)/cadastro/use-cadastro-form.ts`
- Modify: `app/(auth)/cadastro/CadastroForm.tsx`

**Interfaces:**
- Consumes: coluna `stores.instagram` (Task 1).

- [ ] **Step 1: Atualizar `app/actions/auth.ts`**

Atualizar `storeSchema`:

```ts
const storeSchema = z.object({
  store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Link inválido'),
  instagram: z.string().nullable(),
})
```

Em `createStore`, atualizar o `safeParse`:

```ts
  const result = storeSchema.safeParse({
    store_name: formData.get('store_name'),
    slug: formData.get('slug'),
    instagram: (formData.get('instagram') as string)?.replace(/^@+/, '').trim() || null,
  })
```

E o `insert`:

```ts
  const { error } = await supabase.from('stores').insert({
    owner_id: user.id,
    name: result.data.store_name,
    slug: result.data.slug,
    plan: 'starter',
    trial_ends_at: null,
    instagram: result.data.instagram,
  })
```

- [ ] **Step 2: Atualizar `app/(auth)/cadastro/use-cadastro-form.ts`**

Adicionar estado (após `slug`):

```ts
  const [instagram, setInstagram] = useState('')
```

Adicionar ao objeto retornado:

```ts
    instagram,
    setInstagram,
```

- [ ] **Step 3: Atualizar `app/(auth)/cadastro/CadastroForm.tsx`**

Atualizar o import de ícones:

```tsx
import { User, Mail, ArrowLeft, ArrowRight, Store, Instagram } from 'lucide-react'
```

Desestruturar `instagram, setInstagram` do hook:

```tsx
  const {
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    storeName, handleStoreNameChange,
    slug, setSlug,
    instagram, setInstagram,
    state, action, pending,
  } = useCadastroForm(stepLoja)
```

Adicionar, dentro da seção "Sua loja", logo após o bloco do `SlugInput`:

```tsx
              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Instagram <span className="text-graphite font-normal">(opcional)</span>
                </label>
                <div className={inputWrap}>
                  <Instagram size={18} className="text-graphite flex-shrink-0" />
                  <span className="font-body text-[15px] text-graphite flex-shrink-0">@</span>
                  <input
                    type="text"
                    name="instagram"
                    placeholder="seu.usuario"
                    autoComplete="off"
                    className={inputBase}
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                  />
                </div>
              </div>
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual no navegador**

Run: `npm run dev`, abrir `http://localhost:3000/cadastro?step=loja` e conferir visualmente que o campo "Instagram (opcional)" aparece com o prefixo `@`, abaixo do link da loja.

- [ ] **Step 6: Commit**

```bash
git add app/actions/auth.ts app/\(auth\)/cadastro/use-cadastro-form.ts app/\(auth\)/cadastro/CadastroForm.tsx
git commit -m "feat: adiciona campo de Instagram na etapa de loja do cadastro"
```

---

### Task 10: `use-catalogo` — seleção de pagamento/entrega e gating do checkout

**Files:**
- Modify: `app/[slug]/use-catalogo.ts`
- Test: `__tests__/use-catalogo.test.ts` (novo arquivo)

**Interfaces:**
- Consumes: `Store.paymentMethods/deliveryMethods` (Task 5); `renderWhatsAppMessage(template, items, order?)` (Task 3).
- Produces: `useCatalogo` passa a retornar `paymentMethods: string[]`, `selectedPayment: string | null`, `setSelectedPayment`, `deliveryMethods: string[]`, `selectedDelivery: string | null`, `setSelectedDelivery`, `address: string`, `setAddress`, `canCheckout: boolean`. Consumidos por `app/[slug]/CatalogoClient.tsx` (Task 11).

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/use-catalogo.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCatalogo } from "@/app/[slug]/use-catalogo";
import type { Product, Store } from "@/lib/types";

const baseStore: Store = {
  name: "Ateliê Mira",
  monogram: "AM",
  whatsapp: "5511999990000",
  categories: ["Todos"],
  description: "",
  accentColor: "#C9A96E",
  catalogUrl: "vtrinedigital.com.br/ateliemira",
};

const products: Product[] = [];

describe("useCatalogo — canCheckout com pagamento e entrega (novo)", () => {
  it("fica false quando a loja não tem whatsapp, mesmo sem pagamento/entrega configurados", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, whatsapp: "" }, products })
    );
    expect(result.current.canCheckout).toBe(false);
  });

  it("fica true com whatsapp e sem pagamento/entrega configurados (comportamento atual preservado)", () => {
    const { result } = renderHook(() => useCatalogo({ store: baseStore, products }));
    expect(result.current.canCheckout).toBe(true);
  });

  it("fica false quando há formas de pagamento configuradas e nenhuma selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, paymentMethods: ["pix", "cartao"] }, products })
    );
    expect(result.current.canCheckout).toBe(false);
  });

  it("fica true após selecionar uma forma de pagamento", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, paymentMethods: ["pix", "cartao"] }, products })
    );
    act(() => result.current.setSelectedPayment("pix"));
    expect(result.current.canCheckout).toBe(true);
  });

  it("exige endereço quando 'entrega' é selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, deliveryMethods: ["retirada", "entrega"] }, products })
    );
    act(() => result.current.setSelectedDelivery("entrega"));
    expect(result.current.canCheckout).toBe(false);
    act(() => result.current.setAddress("Rua X, 123"));
    expect(result.current.canCheckout).toBe(true);
  });

  it("não exige endereço quando 'retirada' é selecionada", () => {
    const { result } = renderHook(() =>
      useCatalogo({ store: { ...baseStore, deliveryMethods: ["retirada", "entrega"] }, products })
    );
    act(() => result.current.setSelectedDelivery("retirada"));
    expect(result.current.canCheckout).toBe(true);
  });
});

describe("useCatalogo — handleCheckout com pagamento e entrega (novo)", () => {
  const productA: Product = {
    id: "p1",
    name: "Blusa",
    price: "R$ 80,00",
    category: "Blusas",
    image: "https://example.com/p1.jpg",
    desc: "",
    sizes: [],
    soldSizes: [],
    colors: [],
  };

  beforeEach(() => {
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("inclui pagamento e entrega selecionados na mensagem enviada", () => {
    const store: Store = {
      ...baseStore,
      paymentMethods: ["pix"],
      deliveryMethods: ["retirada"],
    };
    const { result } = renderHook(() => useCatalogo({ store, products: [productA] }));
    act(() => result.current.handleAdd(productA, null, null, 1));
    act(() => result.current.setSelectedPayment("pix"));
    act(() => result.current.setSelectedDelivery("retirada"));
    act(() => result.current.handleCheckout());

    const openMock = window.open as ReturnType<typeof vi.fn>;
    const [url] = openMock.mock.calls[0];
    const message = decodeURIComponent(url.split("?text=")[1]);
    expect(message).toContain("Forma de pagamento: Pix");
    expect(message).toContain("Entrega: Retirar no local");
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/use-catalogo.test.ts`
Expected: FAIL — `useCatalogo` não retorna `canCheckout`/`selectedPayment`/`setSelectedPayment`/`selectedDelivery`/`setSelectedDelivery`/`address`/`setAddress`/`paymentMethods`/`deliveryMethods`, e não aceita `store.paymentMethods`/`store.deliveryMethods` (já existem no tipo `Store` desde a Task 5, então isso é só falta de implementação).

- [ ] **Step 3: Implementar em `app/[slug]/use-catalogo.ts`**

Adicionar estado (após `const [visibleCount, ...]`):

```ts
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);
  const [address, setAddress] = useState("");
```

Substituir a linha `const hasWhatsapp = !!store.whatsapp;` por:

```ts
  const hasWhatsapp = !!store.whatsapp;
  const paymentMethods = store.paymentMethods ?? [];
  const deliveryMethods = store.deliveryMethods ?? [];
  const paymentComplete = paymentMethods.length === 0 || !!selectedPayment;
  const deliveryComplete =
    deliveryMethods.length === 0 ||
    (!!selectedDelivery && (selectedDelivery !== "entrega" || address.trim() !== ""));
  const canCheckout = hasWhatsapp && paymentComplete && deliveryComplete;
```

Substituir `handleCheckout` por:

```ts
  const handleCheckout = useCallback(() => {
    if (!store.whatsapp) {
      flash("Esta loja ainda não configurou o WhatsApp.");
      return;
    }
    const msg = renderWhatsAppMessage(store.messageTemplate, cart, {
      payment: selectedPayment,
      delivery: selectedDelivery,
      address,
    });
    flash("Abrindo o WhatsApp…");
    window.open(
      `https://wa.me/${normalizeWhatsapp(store.whatsapp)}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  }, [cart, store.whatsapp, store.messageTemplate, selectedPayment, selectedDelivery, address, flash]);
```

No objeto retornado pelo hook, adicionar:

```ts
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    deliveryMethods,
    selectedDelivery,
    setSelectedDelivery,
    address,
    setAddress,
    canCheckout,
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/use-catalogo.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/\[slug\]/use-catalogo.ts __tests__/use-catalogo.test.ts
git commit -m "feat: adiciona seleção de pagamento/entrega e gating do checkout"
```

---

### Task 11: `BagDrawer` + `CatalogoClient` — UI de checkout

**Files:**
- Modify: `components/catalogo/BagDrawer.tsx`
- Modify: `app/[slug]/CatalogoClient.tsx`
- Test: `__tests__/BagDrawer.test.tsx`

**Interfaces:**
- Consumes: `PAYMENT_METHODS`, `DELIVERY_METHODS` de `@/lib/data` (Task 2); `useCatalogo` (Task 10).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `__tests__/BagDrawer.test.tsx`:

```tsx
describe("BagDrawer — pagamento e entrega (novo)", () => {
  it("não mostra seletor de pagamento quando a loja não configurou nenhuma forma", () => {
    renderDrawer({ paymentMethods: [] });
    expect(screen.queryByText("Forma de pagamento")).toBeNull();
  });

  it("mostra as opções de pagamento configuradas, nenhuma pré-selecionada", () => {
    renderDrawer({ paymentMethods: ["pix", "cartao"], selectedPayment: null });
    const pix = screen.getByRole("button", { name: "Pix" });
    const cartao = screen.getByRole("button", { name: "Cartão" });
    expect(pix.className).not.toContain("text-white");
    expect(cartao.className).not.toContain("text-white");
  });

  it("aciona onSelectPayment ao clicar em uma opção", () => {
    const onSelectPayment = vi.fn();
    renderDrawer({ paymentMethods: ["pix", "cartao"], onSelectPayment });
    fireEvent.click(screen.getByRole("button", { name: "Pix" }));
    expect(onSelectPayment).toHaveBeenCalledWith("pix");
  });

  it("não mostra seletor de entrega quando a loja não configurou nenhuma forma", () => {
    renderDrawer({ deliveryMethods: [] });
    expect(screen.queryByText("Entrega")).toBeNull();
  });

  it("mostra o campo de endereço somente quando 'entrega' está selecionada", () => {
    const { rerender } = render(
      <BagDrawer
        open
        items={items}
        deliveryMethods={["retirada", "entrega"]}
        selectedDelivery="retirada"
        onClose={vi.fn()}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/Endereço completo/i)).toBeNull();

    rerender(
      <BagDrawer
        open
        items={items}
        deliveryMethods={["retirada", "entrega"]}
        selectedDelivery="entrega"
        onClose={vi.fn()}
        onQty={vi.fn()}
        onRemove={vi.fn()}
        onCheckout={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/Endereço completo/i)).toBeTruthy();
  });

  it("aciona onAddressChange ao digitar no campo de endereço", () => {
    const onAddressChange = vi.fn();
    renderDrawer({
      deliveryMethods: ["retirada", "entrega"],
      selectedDelivery: "entrega",
      onAddressChange,
    });
    fireEvent.change(screen.getByLabelText(/Endereço completo/i), {
      target: { value: "Rua X, 123" },
    });
    expect(onAddressChange).toHaveBeenCalledWith("Rua X, 123");
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/BagDrawer.test.tsx`
Expected: FAIL — `BagDrawer` ainda não aceita/renderiza `paymentMethods`/`deliveryMethods`/etc.

- [ ] **Step 3: Implementar em `components/catalogo/BagDrawer.tsx`**

Atualizar imports:

```tsx
import Image from "next/image";
import { X, ShoppingBag, Trash2, MessageCircle } from "lucide-react";
import type { CartItem } from "@/lib/types";
import { formatMoney, parsePrice } from "@/lib/utils";
import { PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";
```

Atualizar a interface e a assinatura da função:

```tsx
interface BagDrawerProps {
  open: boolean;
  items: CartItem[];
  canCheckout?: boolean;
  paymentMethods?: string[];
  selectedPayment?: string | null;
  onSelectPayment?: (method: string) => void;
  deliveryMethods?: string[];
  selectedDelivery?: string | null;
  onSelectDelivery?: (method: string) => void;
  address?: string;
  onAddressChange?: (value: string) => void;
  onClose: () => void;
  onQty: (key: string, qty: number) => void;
  onRemove: (key: string) => void;
  onCheckout: () => void;
}

export function BagDrawer({
  open,
  items,
  canCheckout = true,
  paymentMethods = [],
  selectedPayment = null,
  onSelectPayment,
  deliveryMethods = [],
  selectedDelivery = null,
  onSelectDelivery,
  address = "",
  onAddressChange,
  onClose,
  onQty,
  onRemove,
  onCheckout,
}: BagDrawerProps) {
```

Dentro do rodapé (`{items.length > 0 && (...)}`), inserir os seletores entre o bloco de `Total` e o aviso `{!canCheckout && (...)}`:

```tsx
            {paymentMethods.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-body font-medium text-[13px] text-obsidian">
                  Forma de pagamento
                </span>
                <div className="flex gap-2 flex-wrap">
                  {paymentMethods.map((value) => {
                    const label = PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
                    const isSelected = selectedPayment === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onSelectPayment?.(value)}
                        className={[
                          "h-9 px-3.5 rounded-pill font-body font-medium text-[13px] transition-all duration-200 border",
                          isSelected
                            ? "text-white border-transparent"
                            : "border-sand text-obsidian hover:bg-surface-hover",
                        ].join(" ")}
                        style={isSelected ? { background: "var(--color-primary)" } : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {deliveryMethods.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="font-body font-medium text-[13px] text-obsidian">Entrega</span>
                <div className="flex gap-2 flex-wrap">
                  {deliveryMethods.map((value) => {
                    const label = DELIVERY_METHODS.find((m) => m.value === value)?.label ?? value;
                    const isSelected = selectedDelivery === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onSelectDelivery?.(value)}
                        className={[
                          "h-9 px-3.5 rounded-pill font-body font-medium text-[13px] transition-all duration-200 border",
                          isSelected
                            ? "text-white border-transparent"
                            : "border-sand text-obsidian hover:bg-surface-hover",
                        ].join(" ")}
                        style={isSelected ? { background: "var(--color-primary)" } : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {selectedDelivery === "entrega" && (
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => onAddressChange?.(e.target.value)}
                    placeholder="Endereço completo para entrega"
                    aria-label="Endereço completo para entrega"
                    className="w-full h-11 px-3.5 bg-white border border-sand rounded-input font-body text-[14px] text-obsidian placeholder:text-inactive outline-none focus:border-obsidian transition-colors"
                  />
                )}
              </div>
            )}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/BagDrawer.test.tsx`
Expected: PASS — incluindo os 4 testes já existentes do arquivo.

- [ ] **Step 5: Conectar `use-catalogo` ao `BagDrawer` em `app/[slug]/CatalogoClient.tsx`**

Atualizar a desestruturação de `useCatalogo`:

```tsx
  const {
    activeCategory,
    setActiveCategory,
    searchOpen,
    searchQuery,
    setSearchQuery,
    toggleSearch,
    openProduct,
    setOpenProduct,
    cart,
    bagOpen,
    setBagOpen,
    toast,
    visibleProducts,
    hasMore,
    loadMore,
    activeProducts,
    bagCount,
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    deliveryMethods,
    selectedDelivery,
    setSelectedDelivery,
    address,
    setAddress,
    canCheckout,
    handleAdd,
    handleQty,
    handleRemove,
    handleCheckout,
  } = useCatalogo({ store, products });
```

Atualizar o `<BagDrawer>`:

```tsx
      <BagDrawer
        open={bagOpen}
        items={cart}
        canCheckout={canCheckout}
        paymentMethods={paymentMethods}
        selectedPayment={selectedPayment}
        onSelectPayment={setSelectedPayment}
        deliveryMethods={deliveryMethods}
        selectedDelivery={selectedDelivery}
        onSelectDelivery={setSelectedDelivery}
        address={address}
        onAddressChange={setAddress}
        onClose={() => setBagOpen(false)}
        onQty={handleQty}
        onRemove={handleRemove}
        onCheckout={handleCheckout}
      />
```

- [ ] **Step 6: Rodar a suíte completa de testes**

Run: `npx vitest run`
Expected: PASS em todos os arquivos de teste (nenhuma regressão em `CatalogoClient.test.tsx`, que não usa pagamento/entrega e continua funcionando com os defaults).

- [ ] **Step 7: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 8: Verificação manual no navegador**

Run: `npm run dev`. Criar/editar uma loja de teste em `/painel/configuracoes`, habilitar Pix+Cartão e Retirar+Entrega, salvar. Abrir `/{slug}` da loja, adicionar um produto à sacola, abrir a sacola e confirmar que:
- os seletores de pagamento e entrega aparecem, nenhuma opção pré-marcada;
- o botão "Enviar pedido via WhatsApp" fica desabilitado até escolher as duas;
- ao escolher "Enviar no endereço", o campo de endereço aparece e também é obrigatório;
- a mensagem aberta no WhatsApp contém as linhas de pagamento e entrega.

- [ ] **Step 9: Commit**

```bash
git add components/catalogo/BagDrawer.tsx app/\[slug\]/CatalogoClient.tsx __tests__/BagDrawer.test.tsx
git commit -m "feat: adiciona seletores de pagamento e entrega na sacola"
```

---

### Task 12: Documentação — `ARCHITECTURE.md` e `DESIGN_SYSTEM.md`

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DESIGN_SYSTEM.md`

- [ ] **Step 1: Atualizar o schema em `docs/ARCHITECTURE.md`**

Substituir o bloco do schema SQL (seção "Banco de dados"):

```sql
profiles   (id → auth.users, full_name, created_at)
stores     (id, owner_id → profiles, name, slug unique, plan, trial_ends_at (nullable), is_active,
            whatsapp, accent_color, logo_url, description, monogram, instagram,
            payment_methods[], delivery_methods[],
            analytics_id, pixel_id, message_template, created_at)
categories (id, store_id → stores, name, position, created_at)
products   (id, store_id → stores, name, price_cents, description, category_id → categories,
            sizes[], sold_sizes[], colors jsonb, images[], stock, is_active, is_new, created_at)
```

- [ ] **Step 2: Atualizar a tabela "Arquivos importantes"**

Substituir a linha de `lib/utils.ts`:

```
| `lib/utils.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage`, `renderWhatsAppMessage`, `formatPaymentLine`, `formatDeliveryLine`, `formatCents` |
```

Substituir a linha de `lib/data.ts`:

```
| `lib/data.ts` | Mock data legada (`STORE`, `PRODUCTS`) mantida como referência; também guarda listas de opções usadas em produção (`ACCENT_COLOR_OPTIONS`, `FASHION_COLORS`, `PAYMENT_METHODS`, `DELIVERY_METHODS`) |
```

- [ ] **Step 3: Atualizar "Estado atual"**

Na lista de bullets da seção "Estado atual (jul/2026)", atualizar a linha do catálogo público:

```
- **Catálogo público** (`/[slug]`): dados reais do Supabase via RLS anon — grid de produtos, detalhe, sacola (drawer), checkout WhatsApp com template customizável, header com descrição e links de WhatsApp/Instagram, página de loja expirada
```

E adicionar uma nova linha logo abaixo, sobre o checkout:

```
- **Checkout**: pagamento e forma de entrega configuráveis por loja (`stores.payment_methods`/`delivery_methods`); o cliente escolhe entre as opções habilitadas antes de enviar o pedido — grupos sem nenhuma opção configurada não aparecem na sacola
```

- [ ] **Step 4: Atualizar `docs/DESIGN_SYSTEM.md`**

Adicionar, ao final da seção "5. Componentes" (depois de "5.5 Drawer / Modal"):

```markdown
### 5.6 Linha de contato do header

- Aparece abaixo do nome da loja no catálogo público, só quando há descrição, WhatsApp ou Instagram cadastrados
- Descrição: DM Sans 13px, cor Graphite
- Links: ícone Lucide (`MessageCircle` para WhatsApp, `Instagram` para Instagram) + label, 12px, cor Graphite, hover Obsidian
- Link de WhatsApp do header abre conversa vazia (sem mensagem) — diferente do CTA de checkout da sacola, que já leva o pedido

### 5.7 Seletor de pagamento/entrega (sacola)

- Mesmo estilo de chip usado na seleção de tamanho em `ProductDetail`: pílula com borda Sand, texto Obsidian; selecionado vira fundo Obsidian + texto branco
- Nenhuma opção vem pré-selecionada, mesmo havendo uma única opção configurada — padroniza com tamanho/cor
- Grupo (pagamento ou entrega) só aparece se a loja tiver ao menos 1 opção habilitada em Configurações
- Campo de endereço (input de texto livre) aparece só quando "Enviar no endereço" está selecionado
```

- [ ] **Step 5: Commit**

```bash
git add docs/ARCHITECTURE.md docs/DESIGN_SYSTEM.md
git commit -m "docs: documenta instagram, pagamento e entrega configuráveis"
```

---

## Verificação final

- [ ] **Rodar a suíte completa**

Run: `npx vitest run`
Expected: todos os testes passam (novos e existentes).

- [ ] **Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Rodar o lint**

Run: `npm run lint`
Expected: sem erros.
