# Cadastro Completo na Etapa 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer os campos de Configurações (Identidade, Cor de destaque, Pagamento e entrega) para `/cadastro?step=loja`, para que o lojista registre o perfil completo da loja já no primeiro acesso — exceto "Mensagem do pedido", que continua exclusiva de Configurações.

**Architecture:** Extrai um hook compartilhado (`useLojaFields`) e três componentes de apresentação (`IdentidadeFields`, `CorDestaqueFields`, `PagamentoEntregaFields`) em `components/loja/`, consumidos tanto por `useConfiguracoes`/`ConfiguracoesClient` quanto pelo `useCadastroForm`/`CadastroForm` expandidos. `createStore` passa a validar e persistir os mesmos campos que `updateStoreSettings` (exceto mensagem do pedido), com upload de logo em duas fases (a loja precisa existir antes do upload, já que o caminho no Storage usa o `id` da loja). WhatsApp passa a ser obrigatório em **ambas** as telas.

**Tech Stack:** Next.js 16 App Router (Server Actions), React 19, TypeScript strict, Supabase (Postgres + Storage), Zod v4, Tailwind CSS v3, Vitest + Testing Library.

## Global Constraints

- Componentes de UI não buscam dados nem contêm lógica de negócio — recebem tudo via props (`docs/CONVENTIONS.md`).
- Sem lógica em `page.tsx`; toda lógica de estado em hooks `use-*.ts`.
- Server Actions sempre validam com Zod antes de tocar no banco; erro retorna `{ error: string }`. Nunca `try/catch` em volta de `redirect()`.
- "Mensagem do pedido" continua exclusiva de Configurações — não entra na etapa 2 do cadastro.
- WhatsApp passa a ser obrigatório tanto em `createStore` quanto em `updateStoreSettings` — não é mais opcional em lugar nenhum do sistema.
- Falha no upload do logo (fase 2 de `createStore`) **não** desfaz a criação da loja — é ignorada silenciosamente; o lojista pode enviar o logo depois em Configurações.
- Ícones sempre Lucide React, outline, ~2px stroke.

---

### Task 1: Hook compartilhado `useLojaFields`

**Files:**
- Create: `components/loja/use-loja-fields.ts`
- Test: `__tests__/use-loja-fields.test.ts`

**Interfaces:**
- Produces: `useLojaFields(init: LojaFieldsInit)` retornando `{ whatsapp, setWhatsapp, monogram, setMonogram, storeDescription, setStoreDescription, instagram, setInstagram, accent, setAccent, paymentMethods, togglePaymentMethod, deliveryMethods, toggleDeliveryMethod, logo, logoPreview, setLogo }`. `LojaFieldsInit = { whatsapp: string | null; monogram: string | null; storeDescription: string | null; instagram: string | null; accentColor: string; paymentMethods: string[]; deliveryMethods: string[] }`. Consumida por `use-configuracoes.ts` (Task 3) e `use-cadastro-form.ts` (Task 6).

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/use-loja-fields.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLojaFields } from "@/components/loja/use-loja-fields";

vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (f: File) => f),
}));

const baseInit = {
  whatsapp: null,
  monogram: null,
  storeDescription: null,
  instagram: null,
  accentColor: "#C9A96E",
  paymentMethods: [],
  deliveryMethods: [],
};

beforeEach(() => {
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock-url"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useLojaFields", () => {
  it("inicializa com valores vazios quando init não tem valores", () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    expect(result.current.whatsapp).toBe("");
    expect(result.current.monogram).toBe("");
    expect(result.current.storeDescription).toBe("");
    expect(result.current.instagram).toBe("");
    expect(result.current.accent).toBe("#C9A96E");
    expect(result.current.paymentMethods).toEqual([]);
    expect(result.current.deliveryMethods).toEqual([]);
    expect(result.current.logo).toBeNull();
    expect(result.current.logoPreview).toBeNull();
  });

  it("inicializa com os valores fornecidos quando presentes", () => {
    const { result } = renderHook(() =>
      useLojaFields({
        whatsapp: "5511999990000",
        monogram: "AM",
        storeDescription: "Vitrine premium",
        instagram: "atelieming",
        accentColor: "#000000",
        paymentMethods: ["pix"],
        deliveryMethods: ["retirada"],
      })
    );
    expect(result.current.whatsapp).toBe("5511999990000");
    expect(result.current.monogram).toBe("AM");
    expect(result.current.storeDescription).toBe("Vitrine premium");
    expect(result.current.instagram).toBe("atelieming");
    expect(result.current.accent).toBe("#000000");
    expect(result.current.paymentMethods).toEqual(["pix"]);
    expect(result.current.deliveryMethods).toEqual(["retirada"]);
  });

  it("togglePaymentMethod adiciona e remove valores", () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    act(() => result.current.togglePaymentMethod("pix"));
    expect(result.current.paymentMethods).toEqual(["pix"]);
    act(() => result.current.togglePaymentMethod("pix"));
    expect(result.current.paymentMethods).toEqual([]);
  });

  it("toggleDeliveryMethod adiciona e remove valores", () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    act(() => result.current.toggleDeliveryMethod("retirada"));
    expect(result.current.deliveryMethods).toEqual(["retirada"]);
    act(() => result.current.toggleDeliveryMethod("retirada"));
    expect(result.current.deliveryMethods).toEqual([]);
  });

  it("setLogo comprime a imagem e gera uma preview", async () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    const file = new File(["conteudo"], "logo.png", { type: "image/png" });
    await act(async () => {
      await result.current.setLogo(file);
    });
    expect(result.current.logo).toBe(file);
    expect(result.current.logoPreview).toBe("blob:mock-url");
  });

  it("setLogo(null) limpa o arquivo e a preview", async () => {
    const { result } = renderHook(() => useLojaFields(baseInit));
    const file = new File(["conteudo"], "logo.png", { type: "image/png" });
    await act(async () => {
      await result.current.setLogo(file);
    });
    await act(async () => {
      await result.current.setLogo(null);
    });
    expect(result.current.logo).toBeNull();
    expect(result.current.logoPreview).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/use-loja-fields.test.ts`
Expected: FAIL — `@/components/loja/use-loja-fields` não existe ainda.

- [ ] **Step 3: Implementar `components/loja/use-loja-fields.ts`**

```ts
"use client";

import { useState } from "react";
import { compressImage } from "@/lib/image-compress";

export interface LojaFieldsInit {
  whatsapp: string | null;
  monogram: string | null;
  storeDescription: string | null;
  instagram: string | null;
  accentColor: string;
  paymentMethods: string[];
  deliveryMethods: string[];
}

export function useLojaFields(init: LojaFieldsInit) {
  const [whatsapp, setWhatsapp] = useState(init.whatsapp ?? "");
  const [monogram, setMonogram] = useState(init.monogram ?? "");
  const [storeDescription, setStoreDescription] = useState(init.storeDescription ?? "");
  const [instagram, setInstagram] = useState(init.instagram ?? "");
  const [accent, setAccent] = useState(init.accentColor);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(init.paymentMethods);
  const [deliveryMethods, setDeliveryMethods] = useState<string[]>(init.deliveryMethods);
  const [logo, setLogoState] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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

  const setLogo = async (file: File | null) => {
    const compressed = file ? await compressImage(file) : null;
    setLogoState(compressed);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return compressed ? URL.createObjectURL(compressed) : null;
    });
  };

  return {
    whatsapp,
    setWhatsapp,
    monogram,
    setMonogram,
    storeDescription,
    setStoreDescription,
    instagram,
    setInstagram,
    accent,
    setAccent,
    paymentMethods,
    togglePaymentMethod,
    deliveryMethods,
    toggleDeliveryMethod,
    logo,
    logoPreview,
    setLogo,
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/use-loja-fields.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/loja/use-loja-fields.ts __tests__/use-loja-fields.test.ts
git commit -m "feat: extrai hook compartilhado useLojaFields"
```

---

### Task 2: Componentes compartilhados de apresentação

**Files:**
- Create: `components/loja/IdentidadeFields.tsx`
- Create: `components/loja/CorDestaqueFields.tsx`
- Create: `components/loja/PagamentoEntregaFields.tsx`

**Interfaces:**
- Consumes: `PAYMENT_METHODS`, `DELIVERY_METHODS`, `ACCENT_COLOR_OPTIONS` de `@/lib/data`; `ToggleRow` de `@/components/ui/Switch`; `Input` de `@/components/ui/Input`.
- Produces: os três componentes abaixo, usados por `ConfiguracoesClient.tsx` (Task 3) e `CadastroForm.tsx` (Task 7). Nenhum dos três inclui `<Card>` ou `<h2>` — cada tela consumidora envolve com seu próprio wrapper visual (Configurações usa `<Card>`; Cadastro usa o padrão de seção com `<h2 uppercase>` + linha divisória, já existente em `CadastroForm.tsx`).

Não há teste dedicado para estes três componentes — são presentacionais puros, e ficam cobertos transitivamente pelos testes de `ConfiguracoesClient.test.tsx` (existentes, Task 3) e `CadastroForm.test.tsx` (Task 7), que exercitam o comportamento real (props vindas de hooks reais) nas duas telas que os consomem.

- [ ] **Step 1: Criar `components/loja/IdentidadeFields.tsx`**

```tsx
"use client";

import { Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface IdentidadeFieldsProps {
  nameForInitials: string;
  logoUrl?: string | null;
  logoPreview: string | null;
  logoFileName?: string | null;
  onLogoChange: (file: File | null) => void;
  whatsapp: string;
  onWhatsappChange: (value: string) => void;
  monogram: string;
  onMonogramChange: (value: string) => void;
  instagram: string;
  onInstagramChange: (value: string) => void;
  storeDescription: string;
  onStoreDescriptionChange: (value: string) => void;
  children?: React.ReactNode;
}

export function IdentidadeFields({
  nameForInitials,
  logoUrl,
  logoPreview,
  logoFileName,
  onLogoChange,
  whatsapp,
  onWhatsappChange,
  monogram,
  onMonogramChange,
  instagram,
  onInstagramChange,
  storeDescription,
  onStoreDescriptionChange,
  children,
}: IdentidadeFieldsProps) {
  return (
    <>
      <div className="flex gap-5 items-center mb-5">
        {logoPreview || logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoPreview ?? logoUrl!}
            alt={nameForInitials}
            className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div
            className="w-[72px] h-[72px] rounded-full text-white flex items-center justify-center font-display font-semibold text-[26px] flex-shrink-0"
            style={{ background: "var(--color-primary)" }}
          >
            {monogram || nameForInitials.slice(0, 2).toUpperCase()}
          </div>
        )}
        <label className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] cursor-pointer hover:bg-surface-hover transition-colors">
          <Upload size={18} />
          {logoFileName ?? "Enviar logo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {children}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
        <Input
          name="whatsapp"
          label="WhatsApp para pedidos"
          prefix="+55"
          value={whatsapp}
          onChange={(e) => onWhatsappChange(e.target.value)}
        />
        <Input
          name="monogram"
          label="Monograma (até 3 letras)"
          placeholder="Ex: MR"
          maxLength={3}
          value={monogram}
          onChange={(e) => onMonogramChange(e.target.value)}
        />
        <Input
          name="instagram"
          label="Instagram (opcional)"
          prefix="@"
          value={instagram}
          onChange={(e) => onInstagramChange(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Input
            name="description"
            label="Descrição curta"
            value={storeDescription}
            onChange={(e) => onStoreDescriptionChange(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
```

Nota: `nameForInitials` é só usado para o fallback do círculo de iniciais (quando não há logo nem monograma) e para o `alt` da imagem — **não** inclui um input de nome. O campo "Nome da loja" continua tratado à parte em cada tela consumidora (via `children`, no caso de Configurações — ver Task 3).

- [ ] **Step 2: Criar `components/loja/CorDestaqueFields.tsx`**

```tsx
"use client";

import { ACCENT_COLOR_OPTIONS } from "@/lib/data";

interface CorDestaqueFieldsProps {
  accent: string;
  onAccentChange: (color: string) => void;
}

export function CorDestaqueFields({ accent, onAccentChange }: CorDestaqueFieldsProps) {
  return (
    <>
      <div className="flex gap-3 flex-wrap mb-5">
        {ACCENT_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onAccentChange(c)}
            aria-label={c}
            className="w-10 h-10 rounded-full transition-all duration-200"
            style={{
              background: c,
              border:
                accent === c
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
              outline: accent === c ? "2px solid var(--color-bg)" : "none",
              outlineOffset: accent === c ? "-4px" : "0",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
      <div className="flex items-center flex-wrap gap-3">
        <span
          className="inline-flex min-h-11 items-center px-[22px] py-2.5 rounded-btn font-display font-medium text-[15px] text-white"
          style={{ background: accent }}
        >
          Comprar via WhatsApp
        </span>
        <span className="font-body text-[13px] text-graphite">
          Pré-visualização do CTA
        </span>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Criar `components/loja/PagamentoEntregaFields.tsx`**

```tsx
"use client";

import { ToggleRow } from "@/components/ui/Switch";
import { PAYMENT_METHODS, DELIVERY_METHODS } from "@/lib/data";

interface PagamentoEntregaFieldsProps {
  paymentMethods: string[];
  onTogglePaymentMethod: (value: string) => void;
  deliveryMethods: string[];
  onToggleDeliveryMethod: (value: string) => void;
}

export function PagamentoEntregaFields({
  paymentMethods,
  onTogglePaymentMethod,
  deliveryMethods,
  onToggleDeliveryMethod,
}: PagamentoEntregaFieldsProps) {
  return (
    <>
      <h3 className="font-body font-medium text-[13px] tracking-[0.04em] uppercase text-graphite mb-1">
        Formas de pagamento aceitas
      </h3>
      <div className="mb-5">
        {PAYMENT_METHODS.map((method) => (
          <ToggleRow
            key={method.value}
            label={method.label}
            checked={paymentMethods.includes(method.value)}
            onChange={() => onTogglePaymentMethod(method.value)}
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
            checked={deliveryMethods.includes(method.value)}
            onChange={() => onToggleDeliveryMethod(method.value)}
          />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (os três componentes ainda não são importados por ninguém, mas devem compilar isoladamente).

- [ ] **Step 5: Commit**

```bash
git add components/loja/IdentidadeFields.tsx components/loja/CorDestaqueFields.tsx components/loja/PagamentoEntregaFields.tsx
git commit -m "feat: extrai componentes compartilhados de identidade, cor e pagamento/entrega"
```

---

### Task 3: `ConfiguracoesClient`/`useConfiguracoes` passam a usar os componentes e o hook compartilhados

**Files:**
- Modify: `app/painel/configuracoes/use-configuracoes.ts`
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`

**Interfaces:**
- Consumes: `useLojaFields` (Task 1); `IdentidadeFields`, `CorDestaqueFields`, `PagamentoEntregaFields` (Task 2).
- Produces: nenhuma interface nova — `useConfiguracoes` continua expondo exatamente os mesmos nomes de campos que já expunha (`whatsapp`, `setWhatsapp`, `monogram`, `setMonogram`, `storeDescription`, `setStoreDescription`, `instagram`, `setInstagram`, `accent`, `setAccent`, `paymentMethods`, `togglePaymentMethod`, `deliveryMethods`, `toggleDeliveryMethod`, `logo`, `logoPreview`, `setLogo`) — só que agora vindos de `useLojaFields` por baixo, não de `useState` locais. Isso é o que garante que os testes existentes (`__tests__/ConfiguracoesClient.test.tsx`) continuam passando sem modificação: são o guarda de regressão desta refatoração.

- [ ] **Step 1: Rodar os testes existentes antes de mexer (baseline)**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS (7/7) — confirme o estado atual antes de refatorar.

- [ ] **Step 2: Atualizar `app/painel/configuracoes/use-configuracoes.ts`**

Substituir o corpo do hook para compor `useLojaFields`. Arquivo completo resultante:

```ts
"use client";

import { useActionState, useState, useRef } from "react";
import { updateStoreSettings } from "@/app/actions/store";
import { useLojaFields } from "@/components/loja/use-loja-fields";
import type { StoreSettings, ToastState } from "@/lib/types";

export const MSG_DEFAULT = `{saudacao}\n\n{itens}\n\n{pagamento}\n\n{entrega}\n\n━━━━━━━━━━━━━━━━━\n*Total: {total}*\n━━━━━━━━━━━━━━━━━`;

export const MSG_VARS = [
  { token: "{saudacao}", desc: "saudação inicial" },
  { token: "{itens}", desc: "lista de itens da sacola" },
  { token: "{total}", desc: "valor total do pedido" },
  { token: "{pagamento}", desc: "forma de pagamento escolhida" },
  { token: "{entrega}", desc: "forma de entrega escolhida" },
];

type State = { error: string } | { ok: true } | null;

export function useConfiguracoes(settings: StoreSettings) {
  const [storeName, setStoreName] = useState(settings.name);
  const loja = useLojaFields({
    whatsapp: settings.whatsapp,
    monogram: settings.monogram,
    storeDescription: settings.description,
    instagram: settings.instagram,
    accentColor: settings.accentColor,
    paymentMethods: settings.paymentMethods,
    deliveryMethods: settings.deliveryMethods,
  });
  const [msgTpl, setMsgTpl] = useState(settings.messageTemplate ?? MSG_DEFAULT);
  const [toast, setToast] = useState<ToastState | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("accentColor", loja.accent);
      formData.set("messageTemplate", msgTpl);
      formData.set("instagram", loja.instagram);
      formData.set("paymentMethods", JSON.stringify(loja.paymentMethods));
      formData.set("deliveryMethods", JSON.stringify(loja.deliveryMethods));
      if (loja.logo) formData.set("logo", loja.logo);
      const res = await updateStoreSettings(prev, formData);
      if (res && "ok" in res) flash("Configurações salvas");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

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
    storeName,
    setStoreName,
    ...loja,
    msgTpl,
    setMsgTpl,
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

- [ ] **Step 3: Atualizar `app/painel/configuracoes/ConfiguracoesClient.tsx`**

Atualizar o import (adicionar os três componentes compartilhados, remover `ACCENT_COLOR_OPTIONS`/`PAYMENT_METHODS`/`DELIVERY_METHODS`/`ToggleRow` que não são mais usados diretamente aqui):

```tsx
"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { IdentidadeFields } from "@/components/loja/IdentidadeFields";
import { CorDestaqueFields } from "@/components/loja/CorDestaqueFields";
import { PagamentoEntregaFields } from "@/components/loja/PagamentoEntregaFields";
import { signOut } from "@/app/actions/auth";
import type { StoreSettings } from "@/lib/types";
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";
```

(`Upload` deixa de ser usado diretamente neste arquivo — o ícone agora vive dentro de `IdentidadeFields`.)

Substituir os três cards "Identidade", "Cor de destaque" e "Pagamento e entrega" (o bloco entre `<form action={f.formAction} ...>` e o card "Mensagem do pedido") por:

```tsx
        <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Identidade
        </h2>
        <IdentidadeFields
          nameForInitials={f.storeName}
          logoUrl={settings.logoUrl}
          logoPreview={f.logoPreview}
          logoFileName={f.logo?.name}
          onLogoChange={f.setLogo}
          whatsapp={f.whatsapp}
          onWhatsappChange={f.setWhatsapp}
          monogram={f.monogram}
          onMonogramChange={f.setMonogram}
          instagram={f.instagram}
          onInstagramChange={f.setInstagram}
          storeDescription={f.storeDescription}
          onStoreDescriptionChange={f.setStoreDescription}
        >
          <div className="mb-[18px]">
            <Input
              name="name"
              label="Nome da loja"
              value={f.storeName}
              onChange={(e) => f.setStoreName(e.target.value)}
            />
          </div>
        </IdentidadeFields>
      </Card>

      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
          Cor de destaque{" "}
          <span className="text-graphite font-normal">
            · aplicada nos botões primários e pills ativos
          </span>
        </h2>
        <CorDestaqueFields accent={f.accent} onAccentChange={f.setAccent} />
      </Card>
```

E o card "Pagamento e entrega" (que hoje vem *depois* de "Mensagem do pedido") passa a ser:

```tsx
      <Card>
        <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
          Pagamento e entrega
        </h2>
        <p className="font-body text-[13px] text-graphite mb-4">
          O cliente só vê essas opções no checkout se você marcar ao menos uma aqui.
        </p>
        <PagamentoEntregaFields
          paymentMethods={f.paymentMethods}
          onTogglePaymentMethod={f.togglePaymentMethod}
          deliveryMethods={f.deliveryMethods}
          onToggleDeliveryMethod={f.toggleDeliveryMethod}
        />
      </Card>
```

Não mova a posição relativa desse card — mantenha exatamente onde já está hoje (depois do card "Mensagem do pedido"), só trocando o conteúdo interno pelo componente compartilhado. Todo o resto do arquivo (card "Mensagem do pedido", botões de ação, toast) não muda.

- [ ] **Step 4: Rodar os testes e confirmar que continuam passando sem modificação**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS (7/7) — os mesmos testes de antes da refatoração, sem nenhuma linha alterada no arquivo de teste. Se algum falhar, a refatoração mudou comportamento observável — não ajuste o teste, ajuste o componente até bater com o comportamento original.

- [ ] **Step 5: Rodar a suíte completa e checar tipos**

Run: `npx vitest run`
Expected: todos os arquivos passam.

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add app/painel/configuracoes/use-configuracoes.ts app/painel/configuracoes/ConfiguracoesClient.tsx
git commit -m "refactor: Configurações passa a usar hook e componentes compartilhados de loja"
```

---

### Task 4: WhatsApp obrigatório em `storeSettingsSchema`

**Files:**
- Modify: `lib/validation/painel.ts`
- Modify: `app/actions/store.ts`
- Modify: `__tests__/painel-validation.test.ts`

**Interfaces:**
- Produces: `storeSettingsSchema.whatsapp` passa de `z.string().nullable()` para `z.string().min(1, "WhatsApp é obrigatório")` — rejeita `null` e string vazia.

- [ ] **Step 1: Atualizar o fixture `base` em `__tests__/painel-validation.test.ts` (senão os testes existentes quebram)**

O fixture `base` do describe `storeSettingsSchema — pagamento, entrega e instagram (novo)` hoje usa `whatsapp: null`. Como o schema vai passar a exigir WhatsApp, esse valor precisa virar uma string válida — senão todos os testes que usam `base` (que hoje testam pagamento/entrega/instagram, não WhatsApp) passam a falhar por um motivo que não têm nada a ver com o que testam.

Trocar:

```ts
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
```

por:

```ts
  const base = {
    name: "Ateliê Mira",
    whatsapp: "5511999990000",
    accentColor: "#C9A96E",
    description: null,
    monogram: null,
    instagram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
  };
```

Adicionar, ao final do arquivo, um novo describe cobrindo a nova regra:

```ts
describe("storeSettingsSchema — whatsapp obrigatório (novo)", () => {
  const base = {
    name: "Ateliê Mira",
    accentColor: "#C9A96E",
    description: null,
    monogram: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
  };

  it("rejeita whatsapp nulo", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: null });
    expect(r.success).toBe(false);
  });

  it("rejeita whatsapp vazio", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "" });
    expect(r.success).toBe(false);
  });

  it("aceita whatsapp preenchido", () => {
    const r = storeSettingsSchema.safeParse({ ...base, whatsapp: "5511999990000" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar o estado esperado**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: FAIL apenas nos 3 novos testes do describe "whatsapp obrigatório" (o schema ainda aceita `null`/vazio); os testes existentes (incluindo os que usam `base` corrigido) devem continuar passando, já que `base.whatsapp` agora é uma string válida.

- [ ] **Step 3: Atualizar `storeSettingsSchema` em `lib/validation/painel.ts`**

Trocar:

```ts
  whatsapp: z.string().nullable(),
```

por:

```ts
  whatsapp: z.string().min(1, "WhatsApp é obrigatório"),
```

(mantém a mesma posição no objeto, entre `name` e `accentColor`).

- [ ] **Step 4: Atualizar `app/actions/store.ts` para não mandar `null` pro schema**

Em `updateStoreSettings`, trocar:

```ts
    whatsapp: (formData.get("whatsapp") as string) || null,
```

por:

```ts
    whatsapp: (formData.get("whatsapp") as string) || "",
```

(o schema agora rejeita `null`; uma string vazia é o valor que corretamente falha a validação `min(1, ...)` quando o campo não é preenchido.)

- [ ] **Step 5: Rodar os testes e confirmar que tudo passa**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: PASS — todos os testes, incluindo os 3 novos.

- [ ] **Step 6: Rodar a suíte completa e checar tipos**

Run: `npx vitest run`
Expected: PASS em todos os arquivos — em especial `__tests__/ConfiguracoesClient.test.tsx`, cujo fixture `baseSettings` já usa `whatsapp: "5511999990000"` (não deve quebrar).

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/validation/painel.ts app/actions/store.ts __tests__/painel-validation.test.ts
git commit -m "feat: torna WhatsApp obrigatório em storeSettingsSchema"
```

---

### Task 5: `createStore` passa a criar a loja com o perfil completo

**Files:**
- Modify: `app/actions/auth.ts` (`storeSchema`, `createStore`)

**Interfaces:**
- Consumes: `PAYMENT_METHOD_VALUES`, `DELIVERY_METHOD_VALUES` de `@/lib/data`; `uploadToBucket` de `@/lib/server/upload` (assinatura existente: `uploadToBucket(supabase, path: string, file: File): Promise<string>`).
- Produces: `storeSchema` valida `{ store_name, slug, whatsapp, monogram, description, instagram, accentColor, paymentMethods, deliveryMethods }`. `createStore` insere a loja com todos esses campos e, se um logo foi enviado, faz upload em uma segunda fase após o insert.

Sem teste dedicado para esta task — mantém o padrão já estabelecido no projeto de não testar diretamente Server Actions que dependem de sessão/Storage do Supabase. Verificação por leitura + `tsc` + checagem manual na Task 8.

- [ ] **Step 1: Atualizar os imports em `app/actions/auth.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from '@/lib/data'
import { uploadToBucket } from '@/lib/server/upload'
```

- [ ] **Step 2: Atualizar `storeSchema`**

Trocar:

```ts
const storeSchema = z.object({
  store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Link inválido'),
  instagram: z.string().nullable(),
})
```

por:

```ts
const storeSchema = z.object({
  store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Link inválido'),
  whatsapp: z.string().min(1, 'WhatsApp é obrigatório'),
  monogram: z.string().max(3, 'Monograma deve ter no máximo 3 letras').nullable(),
  description: z.string().nullable(),
  instagram: z.string().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
})
```

- [ ] **Step 3: Reescrever `createStore`**

Substituir a função inteira por:

```ts
export async function createStore(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = storeSchema.safeParse({
    store_name: formData.get('store_name'),
    slug: formData.get('slug'),
    whatsapp: (formData.get('whatsapp') as string) || '',
    monogram: (formData.get('monogram') as string) || null,
    description: (formData.get('description') as string) || null,
    instagram: (formData.get('instagram') as string)?.replace(/^@+/, '').trim() || null,
    accentColor: formData.get('accentColor'),
    paymentMethods: JSON.parse((formData.get('paymentMethods') as string) || '[]'),
    deliveryMethods: JSON.parse((formData.get('deliveryMethods') as string) || '[]'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado.' }

  // Upsert profile (Google pode ter criado no callback; email signup não cria antes da confirmação)
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
  })

  // MODO DEMO (a partir de jul/2026): toda loja nasce Starter, sem expiração.
  // Para voltar ao modelo com trial + escolha de plano, restaurar o bloco abaixo:
  //
  // const trialEndsAt = new Date()
  // trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  //
  // ... e trocar o redirect final para '/escolha-de-plano'

  const { data: store, error } = await supabase
    .from('stores')
    .insert({
      owner_id: user.id,
      name: result.data.store_name,
      slug: result.data.slug,
      plan: 'starter',
      trial_ends_at: null,
      whatsapp: result.data.whatsapp,
      monogram: result.data.monogram,
      description: result.data.description,
      instagram: result.data.instagram,
      accent_color: result.data.accentColor,
      payment_methods: result.data.paymentMethods,
      delivery_methods: result.data.deliveryMethods,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Esse link já está em uso. Tente outro.' }
    }
    return { error: 'Erro ao criar loja. Tente novamente.' }
  }

  // Logo é opcional e só pode ser enviado depois que a loja existe (o caminho
  // no Storage usa o id da loja). Falha no upload não desfaz a loja já criada
  // — o lojista pode enviar o logo depois em Configurações.
  const logo = formData.get('logo') as File | null
  if (logo && logo.size > 0) {
    const ext = logo.name.split('.').pop() || 'png'
    const path = `${store.id}/logo/${crypto.randomUUID()}.${ext}`
    try {
      const logoUrl = await uploadToBucket(supabase, path, logo)
      await supabase.from('stores').update({ logo_url: logoUrl }).eq('id', store.id)
    } catch {
      // Ignorado de propósito — loja já foi criada com sucesso.
    }
  }

  redirect('/painel')
}
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos. `app/(auth)/cadastro/use-cadastro-form.ts` (ainda não atualizado — Task 6) pode não enviar todos os campos novos que `storeSchema` agora exige — isso é esperado nesta task e resolvido na próxima; confirme que não há erro de **tipo** (TypeScript), só uma lacuna funcional temporária (o formulário de cadastro, sem a Task 6/7, ainda não manda `whatsapp`/`accentColor`/etc., então `createStore` retornaria erro de validação em runtime até a Task 7 — não é um erro de compilação).

- [ ] **Step 5: Commit**

```bash
git add app/actions/auth.ts
git commit -m "feat: createStore cria a loja com perfil completo (identidade, cor, pagamento/entrega)"
```

---

### Task 6: `useCadastroForm` passa a usar o hook compartilhado

**Files:**
- Modify: `app/(auth)/cadastro/use-cadastro-form.ts`

**Interfaces:**
- Consumes: `useLojaFields` (Task 1); `ACCENT_COLOR_OPTIONS` de `@/lib/data` (para o valor padrão de cor).
- Produces: `useCadastroForm(stepLoja)` continua retornando tudo que já retornava, mais os campos do `useLojaFields` espalhados (`whatsapp`, `setWhatsapp`, `monogram`, `setMonogram`, `storeDescription`, `setStoreDescription`, `accent`, `setAccent`, `paymentMethods`, `togglePaymentMethod`, `deliveryMethods`, `toggleDeliveryMethod`, `logo`, `logoPreview`, `setLogo`). `instagram`/`setInstagram` continuam existindo, só que agora vêm de `useLojaFields` em vez de um `useState` próprio — mesmo nome, mesmo comportamento.

- [ ] **Step 1: Reescrever `app/(auth)/cadastro/use-cadastro-form.ts`**

```ts
'use client'

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/auth/slugify'
import { signUp, createStore } from '@/app/actions/auth'
import { useLojaFields } from '@/components/loja/use-loja-fields'
import { ACCENT_COLOR_OPTIONS } from '@/lib/data'

type FormState = { error: string } | null

export function useCadastroForm(stepLoja: boolean) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [storeName, setStoreName] = useState('')
  const [slug, setSlug] = useState('')

  const loja = useLojaFields({
    whatsapp: null,
    monogram: null,
    storeDescription: null,
    instagram: null,
    accentColor: ACCENT_COLOR_OPTIONS[0],
    paymentMethods: [],
    deliveryMethods: [],
  })

  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      if (!stepLoja) return signUp(prev, formData)
      formData.set('accentColor', loja.accent)
      formData.set('instagram', loja.instagram)
      formData.set('paymentMethods', JSON.stringify(loja.paymentMethods))
      formData.set('deliveryMethods', JSON.stringify(loja.deliveryMethods))
      if (loja.logo) formData.set('logo', loja.logo)
      return createStore(prev, formData)
    },
    null
  )

  const handleStoreNameChange = (name: string) => {
    setStoreName(name)
    setSlug(slugify(name))
  }

  return {
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    storeName,
    handleStoreNameChange,
    slug,
    setSlug,
    ...loja,
    state,
    action,
    pending,
  }
}
```

- [ ] **Step 2: Rodar os testes existentes de `CadastroForm` e confirmar que ainda passam**

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: PASS — os testes existentes (etapas, Instagram, link de saída) não dependem de nenhum campo novo ainda, então devem continuar passando sem modificação nesta task (a UI que consome os novos campos só é adicionada na Task 7).

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/cadastro/use-cadastro-form.ts"
git commit -m "feat: useCadastroForm passa a usar o hook compartilhado useLojaFields"
```

---

### Task 7: `CadastroForm` exibe Identidade, Cor de destaque e Pagamento/entrega na etapa 2

**Files:**
- Modify: `app/(auth)/cadastro/CadastroForm.tsx`
- Modify: `__tests__/CadastroForm.test.tsx`

**Interfaces:**
- Consumes: `IdentidadeFields`, `CorDestaqueFields`, `PagamentoEntregaFields` (Task 2); campos novos de `useCadastroForm` (Task 6).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `__tests__/CadastroForm.test.tsx`:

```tsx
describe("CadastroForm — perfil completo na etapa 2 (novo)", () => {
  it("mostra as seções Identidade, Cor de destaque e Pagamento e entrega na etapa 2", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByText("Identidade")).toBeTruthy();
    expect(screen.getByText("Cor de destaque")).toBeTruthy();
    expect(screen.getByText("Pagamento e entrega")).toBeTruthy();
  });

  it("não mostra as seções novas na etapa 1", () => {
    render(<CadastroForm />);
    expect(screen.queryByText("Identidade")).toBeNull();
    expect(screen.queryByText("Cor de destaque")).toBeNull();
    expect(screen.queryByText("Pagamento e entrega")).toBeNull();
  });

  it("mostra o campo de WhatsApp na etapa 2", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByLabelText(/WhatsApp/i)).toBeTruthy();
  });

  it("mostra as formas de pagamento e entrega na etapa 2", () => {
    render(<CadastroForm stepLoja />);
    expect(screen.getByText("Pix")).toBeTruthy();
    expect(screen.getByText("Retirar no local")).toBeTruthy();
  });

  it("exibe a mensagem de erro do servidor quando o WhatsApp não é preenchido", async () => {
    const { createStore } = await import("@/app/actions/auth");
    (createStore as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      error: "WhatsApp é obrigatório",
    });
    render(<CadastroForm stepLoja />);
    fireEvent.click(screen.getByRole("button", { name: /Salvar e continuar/i }));
    expect(await screen.findByText("WhatsApp é obrigatório")).toBeTruthy();
  });
});
```

Isso exercita o mesmo mecanismo de exibição de erro que a etapa 1 já usa (`state?.error`) — não testa a regra do Zod em si (que não tem teste dedicado em `app/actions/auth.ts`, mantendo o padrão já estabelecido no projeto), mas confirma que quando o servidor rejeita por falta de WhatsApp, a tela mostra isso ao lojista.

Certifique-se de que o `import { render, screen, fireEvent } from "@testing-library/react";` no topo do arquivo já inclui `fireEvent` (deve incluir, usado pelos testes existentes de link/sign-out da task anterior).

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: FAIL — as seções ainda não existem em `CadastroForm.tsx`, e o botão "Salvar e continuar" existe mas nenhuma seção nova é renderizada ainda (o teste de erro pode inclusive já passar nesta fase, já que só depende do mock — não é um problema; o importante é que os 4 testes de presença falhem).

- [ ] **Step 3: Atualizar `app/(auth)/cadastro/CadastroForm.tsx`**

Atualizar os imports:

```tsx
import Link from 'next/link'
import { User, Mail, ArrowLeft, ArrowRight, Store, Instagram } from 'lucide-react'
import { useCadastroForm } from './use-cadastro-form'
import { signOut } from '@/app/actions/auth'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { SlugInput } from '@/components/ui/SlugInput'
import { VtrineLogo } from '@/components/ui/VtrineLogo'
import { IdentidadeFields } from '@/components/loja/IdentidadeFields'
import { CorDestaqueFields } from '@/components/loja/CorDestaqueFields'
import { PagamentoEntregaFields } from '@/components/loja/PagamentoEntregaFields'
```

Atualizar a desestruturação do hook:

```tsx
  const {
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    storeName, handleStoreNameChange,
    slug, setSlug,
    instagram, setInstagram,
    whatsapp, setWhatsapp,
    monogram, setMonogram,
    storeDescription, setStoreDescription,
    accent, setAccent,
    paymentMethods, togglePaymentMethod,
    deliveryMethods, toggleDeliveryMethod,
    logo, logoPreview, setLogo,
    state, action, pending,
  } = useCadastroForm(stepLoja)
```

Dentro do bloco `{stepLoja && (...)}` ("Seção B: Sua loja") existe hoje um campo solto de Instagram (o `<div>` com o label "Instagram (opcional)", logo depois do `SlugInput`) — `IdentidadeFields` (Task 2) já tem seu próprio input de Instagram com o mesmo `name="instagram"` e o mesmo estado `instagram`/`setInstagram`, então esse bloco fica duplicado (dois inputs com o mesmo `name` no mesmo formulário). **Substitua esse bloco solto de Instagram** (não apenas adicione depois dele) pelas três novas seções abaixo, mantendo a mesma posição — logo depois do `<div>` que fecha o `SlugInput` de "Link da loja", antes do `</div>` final que fecha a seção "Sua loja":

```tsx
                <div className="flex items-center gap-3 mt-2">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Identidade
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>
                <IdentidadeFields
                  nameForInitials={storeName}
                  logoPreview={logoPreview}
                  logoFileName={logo?.name}
                  onLogoChange={setLogo}
                  whatsapp={whatsapp}
                  onWhatsappChange={setWhatsapp}
                  monogram={monogram}
                  onMonogramChange={setMonogram}
                  instagram={instagram}
                  onInstagramChange={setInstagram}
                  storeDescription={storeDescription}
                  onStoreDescriptionChange={setStoreDescription}
                />

                <div className="flex items-center gap-3 mt-2">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Cor de destaque
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>
                <CorDestaqueFields accent={accent} onAccentChange={setAccent} />

                <div className="flex items-center gap-3 mt-2">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Pagamento e entrega
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>
                <PagamentoEntregaFields
                  paymentMethods={paymentMethods}
                  onTogglePaymentMethod={togglePaymentMethod}
                  deliveryMethods={deliveryMethods}
                  onToggleDeliveryMethod={toggleDeliveryMethod}
                />
```

Confirme ao final: só deve existir **um** campo de Instagram na etapa 2 — o de dentro de `IdentidadeFields` — e o bloco solto antigo (que ficava logo após o `SlugInput`) não deve mais aparecer no arquivo.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: PASS — todos os testes, incluindo os pré-existentes (etapas, link de saída) e os novos.

- [ ] **Step 5: Rodar a suíte completa e checar tipos**

Run: `npx vitest run`
Expected: PASS em todos os arquivos.

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)/cadastro/CadastroForm.tsx" __tests__/CadastroForm.test.tsx
git commit -m "feat: etapa 2 do cadastro exibe identidade, cor e pagamento/entrega"
```

---

### Task 8: Documentação e verificação manual end-to-end

**Files:**
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Atualizar `docs/ARCHITECTURE.md`**

No trecho que descreve a etapa 2 do cadastro (seção "Fluxo de cadastro"), adicionar uma nota sobre o que a etapa 2 coleta agora. Localizar a linha:

```
  → /cadastro?step=loja (etapa 2: nome e slug da loja)
```

E substituir por:

```
  → /cadastro?step=loja (etapa 2: nome/slug da loja, WhatsApp, logo, monograma, Instagram, descrição, cor de destaque e formas de pagamento/entrega)
```

Na tabela "Arquivos importantes", atualizar a linha de `app/actions/auth.ts` para mencionar que `createStore` cria a loja já com o perfil completo. Localizar a linha (se existir) que menciona `app/actions/auth.ts` e ajustar a descrição de `createStore`, ou adicionar uma nota equivalente próxima à seção de cadastro, indicando que WhatsApp passou a ser obrigatório em toda a aplicação (não só no cadastro).

- [ ] **Step 2: Verificação manual completa**

Run: `npm run dev`. Fluxo completo:

1. `http://localhost:3000/cadastro` — preencha nome/e-mail/senha, envie.
2. Confirme o e-mail via Mailpit (`http://localhost:54324`).
3. Você cai em `/cadastro?step=loja`. Confirme que aparecem, nesta ordem: Sua loja (nome + slug), Identidade (logo, WhatsApp, monograma, Instagram, descrição), Cor de destaque (paleta + preview), Pagamento e entrega (toggles).
4. Tente enviar sem preencher WhatsApp — confirme que aparece um erro pedindo o WhatsApp.
5. Preencha WhatsApp, escolha uma cor, marque Pix e Retirar no local, envie um logo pequeno (ex: um PNG de teste).
6. Envie o formulário. Confirme redirecionamento para `/painel`.
7. Abra `/painel/configuracoes` e confirme que todos os dados preenchidos na etapa 2 aparecem corretamente (nome, WhatsApp, logo, monograma, Instagram, descrição, cor, pagamento/entrega).
8. Abra o catálogo público da loja (`/{slug}`) e confirme que o header mostra a descrição e os links de WhatsApp/Instagram, e que a cor de destaque escolhida aparece no botão de comprar.

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: atualiza fluxo de cadastro com o perfil completo da etapa 2"
```

---

## Verificação final

- [ ] **Rodar a suíte completa**

Run: `npx vitest run`
Expected: todos os testes passam (novos e existentes).

- [ ] **Checar tipos do projeto inteiro**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Lint**

Run: `npm run lint`
Expected: sem erros novos introduzidos por este plano (erros pré-existentes em arquivos não tocados por este plano não são de responsabilidade desta mudança).
