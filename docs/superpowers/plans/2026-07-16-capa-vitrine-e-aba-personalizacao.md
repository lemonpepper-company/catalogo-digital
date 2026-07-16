# Capa da vitrine + aba de Personalização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma imagem de capa na página de listagem do catálogo público e mover a personalização visual (cor de destaque + capa) para uma aba própria do painel, separada de Configurações.

**Architecture:** Nova coluna `stores.cover_url` propagada pelos mapeadores para os tipos `Store`/`StoreSettings`. Nova rota `/painel/personalizacao` com Server Action `updatePersonalizacao` independente (cor + capa), enquanto `updateStoreSettings` e o onboarding perdem a cor de destaque. Na vitrine, a capa é renderizada entre o cabeçalho e os filtros num layout de duas camadas fixas.

**Tech Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript strict, Tailwind v3, Supabase (Postgres + Storage), Zod v4, Vitest + Testing Library.

## Global Constraints

- **Mobile-first**; breakpoints `md:`/`lg:` para desktop.
- **Páginas sem lógica** (`page.tsx`): só composição; estado/efeitos em hooks `use-*.ts` co-locados.
- **Server Actions**: validar com Zod antes do banco; `getUser()` no início; retornar `{ error: string }` em falha; `{ ok: true }` em sucesso (padrão `StoreActionState`).
- **Zod v4**: usar `.error.issues[0].message`.
- **Ícones** Lucide outline (~2px), import nomeado.
- **Imagens de conteúdo** via `next/image` (nunca `<img>` para conteúdo novo); domínio do Supabase já liberado em `next.config`.
- **Sem `box-shadow`**; elevação por cor de superfície. Transições ≤ 200ms.
- **Cor default da loja:** `#C9A96E` (Gold Dust).
- **Identificadores de código em inglês** (`coverUrl`/`cover_url`); rótulo de UI em pt-BR ("Capa").
- **Bucket de storage:** `product-images`; path da capa `{store_id}/cover/{uuid}.{ext}`.
- Testes rodam com `npx vitest run <arquivo>`; typecheck com `npx tsc --noEmit`.

---

## File Structure

**Novos:**
- `supabase/migrations/20260716000000_store_cover.sql` — coluna `cover_url`.
- `app/painel/personalizacao/page.tsx` — Server Component da aba.
- `app/painel/personalizacao/PersonalizacaoClient.tsx` — UI (cor + capa).
- `app/painel/personalizacao/use-personalizacao.ts` — estado + submit.
- `app/painel/personalizacao/loading.tsx` — skeleton.
- `components/loja/CapaFields.tsx` — upload/preview/remoção da capa.
- `components/catalogo/StoreBanner.tsx` — render da capa na vitrine.

**Modificados:**
- `lib/types.ts`, `lib/catalog.ts`, `lib/server/store.ts`, `lib/server/catalog.ts` — threading de `coverUrl`.
- `lib/validation/painel.ts` — novo `personalizacaoSchema`; `accentColor` sai de `storeSettingsSchema`.
- `app/actions/store.ts` — nova `updatePersonalizacao`; `updateStoreSettings` perde `accentColor`.
- `app/painel/configuracoes/{ConfiguracoesClient.tsx,use-configuracoes.ts,loading.tsx}` — remove cor de destaque.
- `components/loja/use-loja-fields.ts` — remove `accent`.
- `components/painel/{Sidebar.tsx,MobileTabBar.tsx}` — item "Personalização".
- `app/[slug]/CatalogoClient.tsx` — capa + duas camadas fixas.
- `app/(auth)/cadastro/{CadastroForm.tsx,use-cadastro-form.ts}`, `app/actions/auth.ts` — remove cor do onboarding.
- Testes afetados: `__tests__/{catalog.test.ts,use-loja-fields.test.ts,ConfiguracoesClient.test.tsx,CadastroForm.test.tsx,CatalogoClient.test.tsx,painel-validation.test.ts}`.

---

## Task 1: Coluna `cover_url` + threading pelos tipos e mapeadores

**Files:**
- Create: `supabase/migrations/20260716000000_store_cover.sql`
- Modify: `lib/types.ts` (interfaces `Store`, `StoreSettings`)
- Modify: `lib/catalog.ts` (`PublicStoreRow`, `mapPublicStore`)
- Modify: `lib/server/store.ts` (`StoreRow`, `mapStore`, SELECT de `getCurrentStore`)
- Modify: `lib/server/catalog.ts` (`STORE_COLS`)
- Modify: `__tests__/catalog.test.ts` (fixture + novo teste)
- Modify: `__tests__/ConfiguracoesClient.test.tsx` (fixture — campo obrigatório novo)

**Interfaces:**
- Produces: `Store.coverUrl?: string | null` (opcional, como `logoUrl`); `StoreSettings.coverUrl: string | null` (obrigatório); `PublicStoreRow.cover_url: string | null`; `mapPublicStore` e `mapStore` passam a preencher `coverUrl`.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/20260716000000_store_cover.sql`:

```sql
-- Capa da vitrine pública: imagem promocional exibida na página de listagem.
-- Nullable, sem default. Upload usa o bucket product-images em {store_id}/cover/*.
alter table stores add column cover_url text;
```

- [ ] **Step 2: Adicionar `coverUrl` aos tipos**

In `lib/types.ts`, na interface `Store` adicionar após `logoUrl?`:

```ts
  coverUrl?: string | null;
```

Na interface `StoreSettings`, adicionar após `logoUrl: string | null;`:

```ts
  coverUrl: string | null;
```

- [ ] **Step 3: Atualizar o teste de mapeamento (falha primeiro)**

In `__tests__/catalog.test.ts`, adicionar `cover_url: null,` ao objeto `storeRow` (após `logo_url: null,`). Depois adicionar este teste dentro do bloco `describe("mapPublicStore", ...)`:

```ts
  it("propaga cover_url para coverUrl", () => {
    expect(
      mapPublicStore({ ...storeRow, cover_url: "https://img/capa.jpg" }, []).coverUrl
    ).toBe("https://img/capa.jpg");
  });
  it("mapeia cover_url nulo para null", () => {
    expect(mapPublicStore({ ...storeRow, cover_url: null }, []).coverUrl).toBeNull();
  });
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: FAIL — `cover_url` não existe em `PublicStoreRow` (erro de tipo) / `coverUrl` undefined.

- [ ] **Step 5: Adicionar `cover_url` ao `PublicStoreRow` e mapear em `mapPublicStore`**

In `lib/catalog.ts`, na interface `PublicStoreRow` adicionar após `logo_url: string | null;`:

```ts
  cover_url: string | null;
```

Em `mapPublicStore`, no objeto retornado, adicionar após `logoUrl: row.logo_url,`:

```ts
    coverUrl: row.cover_url,
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: PASS.

- [ ] **Step 7: Threading no lado do painel (`lib/server/store.ts`)**

In `lib/server/store.ts`:

Na type `StoreRow`, após `logo_url: string | null;` adicionar:

```ts
  cover_url: string | null;
```

Em `mapStore`, após `logoUrl: row.logo_url,` adicionar:

```ts
    coverUrl: row.cover_url,
```

No SELECT de `getCurrentStore`, incluir `cover_url` — a string passa a ser:

```ts
      "id, name, slug, plan, trial_ends_at, whatsapp, accent_color, cover_url, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods"
```

- [ ] **Step 8: Threading no catálogo público (`lib/server/catalog.ts`)**

In `lib/server/catalog.ts`, na constante `STORE_COLS`, incluir `cover_url` (após `logo_url`):

```ts
const STORE_COLS =
  "id, name, slug, is_active, whatsapp, accent_color, cover_url, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods";
```

- [ ] **Step 9: Corrigir a fixture de `StoreSettings` no teste de Configurações**

In `__tests__/ConfiguracoesClient.test.tsx`, no objeto `baseSettings`, adicionar após `logoUrl: null,`:

```ts
  coverUrl: null,
```

- [ ] **Step 10: Typecheck + suíte afetada**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx vitest run __tests__/catalog.test.ts __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add supabase/migrations/20260716000000_store_cover.sql lib/types.ts lib/catalog.ts lib/server/store.ts lib/server/catalog.ts __tests__/catalog.test.ts __tests__/ConfiguracoesClient.test.tsx
git commit -m "feat: adiciona coluna cover_url e propaga coverUrl pelos mapeadores"
```

---

## Task 2: `personalizacaoSchema` + remover `accentColor` de `storeSettingsSchema`

**Files:**
- Modify: `lib/validation/painel.ts`
- Modify: `__tests__/painel-validation.test.ts` (novos testes)

**Interfaces:**
- Consumes: nada.
- Produces: `personalizacaoSchema` (Zod) validando `{ accentColor: string }` com regex hex `^#[0-9A-Fa-f]{6}$`. `storeSettingsSchema` deixa de ter `accentColor`.

- [ ] **Step 1: Escrever os testes (falham primeiro)**

In `__tests__/painel-validation.test.ts`, adicionar ao import (linha ~6) `personalizacaoSchema` junto de `storeSettingsSchema`. Depois adicionar este bloco no fim do arquivo:

```ts
describe("personalizacaoSchema", () => {
  it("aceita cor hex de 6 dígitos", () => {
    const r = personalizacaoSchema.safeParse({ accentColor: "#C9A96E" });
    expect(r.success).toBe(true);
  });
  it("rejeita hex de 3 dígitos", () => {
    const r = personalizacaoSchema.safeParse({ accentColor: "#FFF" });
    expect(r.success).toBe(false);
  });
  it("rejeita valor sem #", () => {
    const r = personalizacaoSchema.safeParse({ accentColor: "C9A96E" });
    expect(r.success).toBe(false);
  });
  it("mensagem de erro é 'Cor inválida'", () => {
    const r = personalizacaoSchema.safeParse({ accentColor: "xyz" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Cor inválida");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: FAIL — `personalizacaoSchema` não existe.

- [ ] **Step 3: Adicionar o schema e remover `accentColor` do de settings**

In `lib/validation/painel.ts`, remover a linha `accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),` de dentro de `storeSettingsSchema`. Adicionar, logo após o bloco `storeSettingsSchema`:

```ts
export const personalizacaoSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
});
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run __tests__/painel-validation.test.ts`
Expected: PASS. (Os testes existentes de `storeSettingsSchema` continuam passando: o objeto `base` deles inclui uma chave `accentColor` extra, que o Zod não-estrito descarta.)

- [ ] **Step 5: Commit**

```bash
git add lib/validation/painel.ts __tests__/painel-validation.test.ts
git commit -m "feat: adiciona personalizacaoSchema e remove accentColor de storeSettingsSchema"
```

---

## Task 3: Server Action `updatePersonalizacao` + `updateStoreSettings` sem cor

**Files:**
- Modify: `app/actions/store.ts`

**Interfaces:**
- Consumes: `personalizacaoSchema` (Task 2); `coverUrl` em `StoreSettings` (Task 1); `uploadToBucket`, `getCurrentStore`, `StoreActionState`.
- Produces: `export async function updatePersonalizacao(prev: StoreActionState, formData: FormData): Promise<StoreActionState>`. Lê `accentColor` (string), `cover` (File), `removeCover` (`"1"` quando marcado). `updateStoreSettings` deixa de ler/gravar `accentColor`.

> **Nota de teste:** o projeto não tem testes automatizados para Server Actions de store (só para `uploadToBucket` e schemas). Seguindo essa convenção, esta task não adiciona teste unitário — a cobertura vem do `personalizacaoSchema` (Task 2) e da verificação manual (Task 8). O gate desta task é `npx tsc --noEmit` + `npm run build`.

- [ ] **Step 1: Importar o novo schema**

In `app/actions/store.ts`, no import de `@/lib/validation/painel`, adicionar `personalizacaoSchema`:

```ts
import { storeSettingsSchema, personalizacaoSchema } from "@/lib/validation/painel";
```

- [ ] **Step 2: Remover `accentColor` de `updateStoreSettings`**

Na chamada `storeSettingsSchema.safeParse({ ... })`, remover a linha `accentColor: formData.get("accentColor"),`. No `.update({ ... })` da tabela `stores`, remover a linha `accent_color: parsed.data.accentColor,`.

- [ ] **Step 3: Implementar `updatePersonalizacao`**

Adicionar ao final de `app/actions/store.ts`:

```ts
export async function updatePersonalizacao(
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

  const parsed = personalizacaoSchema.safeParse({
    accentColor: formData.get("accentColor"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let coverUrl = store.coverUrl;
  const removeCover = formData.get("removeCover") === "1";
  const cover = formData.get("cover") as File | null;
  if (removeCover) {
    coverUrl = null;
  } else if (cover && cover.size > 0) {
    const ext = cover.name.split(".").pop() || "jpg";
    const path = `${store.id}/cover/${crypto.randomUUID()}.${ext}`;
    try {
      coverUrl = await uploadToBucket(supabase, path, cover);
    } catch {
      return { error: "Falha no upload da capa." };
    }
  }

  const { error } = await supabase
    .from("stores")
    .update({
      accent_color: parsed.data.accentColor,
      cover_url: coverUrl,
    })
    .eq("id", store.id);

  if (error) return { error: "Erro ao salvar a personalização." };

  revalidatePath("/painel/personalizacao");
  revalidatePath("/painel");
  revalidateTag(`catalog-${store.slug}`, { expire: 0 });
  return { ok: true };
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add app/actions/store.ts
git commit -m "feat: adiciona updatePersonalizacao e remove accentColor de updateStoreSettings"
```

---

## Task 4: Refactor `useLojaFields` + remover cor de Configurações

**Files:**
- Modify: `components/loja/use-loja-fields.ts`
- Modify: `app/painel/configuracoes/use-configuracoes.ts`
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`
- Modify: `app/painel/configuracoes/loading.tsx`
- Modify: `__tests__/use-loja-fields.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `useLojaFields` sem `accent`/`setAccent`; `LojaFieldsInit` sem `accentColor`. `useConfiguracoes` não expõe mais `accent`.

- [ ] **Step 1: Atualizar o teste de `useLojaFields` (falha primeiro)**

In `__tests__/use-loja-fields.test.ts`:
- Remover `accentColor: "#C9A96E",` do objeto `baseInit`.
- Remover a asserção `expect(result.current.accent).toBe("#C9A96E");` (no teste "inicializa com valores vazios…").
- No segundo teste ("inicializa com os valores fornecidos…"), remover `accentColor: "#000000",` do argumento e a asserção `expect(result.current.accent).toBe("#000000");`.

- [ ] **Step 2: Rodar e confirmar que falha (tipos)**

Run: `npx vitest run __tests__/use-loja-fields.test.ts`
Expected: ainda PASS neste ponto (a remoção de asserções não quebra), mas `npx tsc --noEmit` do teste falharia se `accentColor` fosse obrigatório. Prossiga para tornar o código consistente.

- [ ] **Step 3: Remover `accent` de `useLojaFields`**

In `components/loja/use-loja-fields.ts`:
- Na interface `LojaFieldsInit`, remover `accentColor: string;`.
- Remover `const [accent, setAccent] = useState(init.accentColor);`.
- No objeto retornado, remover `accent,` e `setAccent,`.

- [ ] **Step 4: Remover cor de `use-configuracoes.ts`**

In `app/painel/configuracoes/use-configuracoes.ts`:
- No objeto passado a `useLojaFields({ ... })`, remover `accentColor: settings.accentColor,`.
- No corpo do `useActionState`, remover `formData.set("accentColor", loja.accent);`.

- [ ] **Step 5: Remover o Card de cor de `ConfiguracoesClient.tsx`**

In `app/painel/configuracoes/ConfiguracoesClient.tsx`:
- Remover o import `import { CorDestaqueFields } from "@/components/loja/CorDestaqueFields";`.
- Remover o `<Card>` inteiro de "Cor de destaque" (o bloco que contém `<CorDestaqueFields accent={f.accent} onAccentChange={f.setAccent} />`, incluindo seu `<h2>`).

- [ ] **Step 6: Remover o skeleton de cor de `loading.tsx`**

In `app/painel/configuracoes/loading.tsx`, remover o segundo `<div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">` — o bloco cujos filhos incluem os 8 círculos (`Array.from({ length: 8 })`) e o `<Sk w="w-44" ... />`. Esse é o placeholder da cor de destaque.

- [ ] **Step 7: Typecheck + testes**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx vitest run __tests__/use-loja-fields.test.ts __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/loja/use-loja-fields.ts app/painel/configuracoes/use-configuracoes.ts app/painel/configuracoes/ConfiguracoesClient.tsx app/painel/configuracoes/loading.tsx __tests__/use-loja-fields.test.ts
git commit -m "refactor: remove cor de destaque de useLojaFields e da tela de Configurações"
```

---

## Task 5: Aba Personalização (rota, hook, UI, upload da capa) + navegação

**Files:**
- Create: `components/loja/CapaFields.tsx`
- Create: `app/painel/personalizacao/use-personalizacao.ts`
- Create: `app/painel/personalizacao/PersonalizacaoClient.tsx`
- Create: `app/painel/personalizacao/page.tsx`
- Create: `app/painel/personalizacao/loading.tsx`
- Modify: `components/painel/Sidebar.tsx`
- Modify: `components/painel/MobileTabBar.tsx`
- Modify: `__tests__/Sidebar.test.tsx` (nova asserção)

**Interfaces:**
- Consumes: `updatePersonalizacao` (Task 3); `CorDestaqueFields` (existente); `compressImage`; `StoreSettings.coverUrl` (Task 1).
- Produces: `usePersonalizacao(settings)` retornando `{ accent, setAccent, coverPreview, coverFileName, setCover, removeCover, clearCover, state, formAction, pending, toast }`; `CapaFields` (componente de upload); rota `/painel/personalizacao`.

- [ ] **Step 1: Criar `CapaFields`**

Create `components/loja/CapaFields.tsx`:

```tsx
"use client";

import { Upload, Trash2 } from "lucide-react";

interface CapaFieldsProps {
  coverUrl?: string | null;
  coverPreview: string | null;
  coverFileName?: string | null;
  onCoverChange: (file: File | null) => void;
  onRemoveCover: () => void;
}

export function CapaFields({
  coverUrl,
  coverPreview,
  coverFileName,
  onCoverChange,
  onRemoveCover,
}: CapaFieldsProps) {
  const shown = coverPreview ?? coverUrl ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full aspect-[3/1] rounded-card overflow-hidden border border-sand bg-linen">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Prévia da capa" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-body text-[13px] text-graphite">
            Nenhuma capa enviada
          </div>
        )}
      </div>
      <div className="flex items-center flex-wrap gap-3">
        <label className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] cursor-pointer hover:bg-surface-hover transition-colors">
          <Upload size={18} />
          {coverFileName ?? "Enviar capa"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onCoverChange(e.target.files?.[0] ?? null)}
          />
        </label>
        {shown && (
          <button
            type="button"
            onClick={onRemoveCover}
            className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-btn font-display font-medium text-[15px] text-error hover:bg-surface-hover transition-colors"
          >
            <Trash2 size={18} />
            Remover
          </button>
        )}
      </div>
      <p className="font-body text-[13px] text-graphite">
        Proporção recomendada 3:1 (ex.: 1200×400px). Imagens fora dessa proporção são recortadas.
      </p>
    </div>
  );
}
```

> Se `text-error` não existir no Tailwind config, usar a cor de erro inline `style={{ color: "#C0392B" }}` no botão Remover. Verifique `tailwind.config.ts` antes; o design system define erro como `#C0392B`.

- [ ] **Step 2: Criar o hook `use-personalizacao`**

Create `app/painel/personalizacao/use-personalizacao.ts`:

```ts
"use client";

import { useActionState, useState } from "react";
import { updatePersonalizacao } from "@/app/actions/store";
import { compressImage } from "@/lib/image-compress";
import type { StoreSettings, ToastState } from "@/lib/types";

type State = { error: string } | { ok: true } | null;

export function usePersonalizacao(settings: StoreSettings) {
  const [accent, setAccent] = useState(settings.accentColor);
  const [cover, setCoverState] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const flash = (msg: string, tone: ToastState["tone"] = "success") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 3000);
  };

  const setCover = async (file: File | null) => {
    const compressed = file ? await compressImage(file) : null;
    setCoverState(compressed);
    setRemoveCover(false);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return compressed ? URL.createObjectURL(compressed) : null;
    });
  };

  const clearCover = () => {
    setCoverState(null);
    setRemoveCover(true);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("accentColor", accent);
      if (cover) formData.set("cover", cover);
      if (removeCover) formData.set("removeCover", "1");
      const res = await updatePersonalizacao(prev, formData);
      if (res && "ok" in res) flash("Personalização salva");
      if (res && "error" in res) flash(res.error, "error");
      return res;
    },
    null
  );

  return {
    accent,
    setAccent,
    coverPreview,
    coverFileName: cover?.name ?? null,
    coverUrl: removeCover ? null : settings.coverUrl,
    setCover,
    clearCover,
    state,
    formAction,
    pending,
    toast,
  };
}
```

- [ ] **Step 3: Criar `PersonalizacaoClient`**

Create `app/painel/personalizacao/PersonalizacaoClient.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { CorDestaqueFields } from "@/components/loja/CorDestaqueFields";
import { CapaFields } from "@/components/loja/CapaFields";
import type { StoreSettings } from "@/lib/types";
import { usePersonalizacao } from "./use-personalizacao";

export function PersonalizacaoClient({ settings }: { settings: StoreSettings }) {
  const f = usePersonalizacao(settings);

  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <form action={f.formAction} className="flex flex-col gap-5">
        <h1 className="font-display font-semibold text-[28px] text-obsidian">
          Personalização
        </h1>

        <Card>
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
            Cor de destaque{" "}
            <span className="text-graphite font-normal">
              · aplicada nos botões primários e pills ativos
            </span>
          </h2>
          <CorDestaqueFields accent={f.accent} onAccentChange={f.setAccent} />
        </Card>

        <Card>
          <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
            Capa da vitrine
          </h2>
          <p className="font-body text-[13px] text-graphite mb-4">
            Imagem de destaque exibida no topo do seu catálogo (promoções, avisos).
          </p>
          <CapaFields
            coverUrl={f.coverUrl}
            coverPreview={f.coverPreview}
            coverFileName={f.coverFileName}
            onCoverChange={f.setCover}
            onRemoveCover={f.clearCover}
          />
        </Card>

        <div className="flex justify-end gap-3 pb-6">
          <Button type="button" variant="ghost" onClick={() => history.back()}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={f.pending}>
            {f.pending ? "Salvando…" : "Salvar personalização"}
          </Button>
        </div>

        {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
      </form>
    </div>
  );
}
```

> Confirme a assinatura de `Toast` em `components/ui/Toast.tsx` — `ConfiguracoesClient` usa `<Toast msg=... tone=... />`. Mantenha idêntico.

- [ ] **Step 4: Criar `page.tsx` e `loading.tsx`**

Create `app/painel/personalizacao/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { PersonalizacaoClient } from "./PersonalizacaoClient";

export default async function PersonalizacaoPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  return <PersonalizacaoClient settings={store} />;
}
```

Create `app/painel/personalizacao/loading.tsx`:

```tsx
function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export default function PersonalizacaoLoading() {
  return (
    <div className="w-full lg:max-w-form flex flex-col gap-5">
      <Sk w="w-44" h="h-7" />

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-32" h="h-4" />
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-sand/70 animate-pulse" />
          ))}
        </div>
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6 flex flex-col gap-4">
        <Sk w="w-28" h="h-4" />
        <Sk w="w-full" h="h-40" rounded="rounded-card" />
        <Sk w="w-40" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="flex justify-end gap-3 pb-6">
        <Sk w="w-24" h="h-11" rounded="rounded-btn" />
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Adicionar o item de navegação no Sidebar (teste falha primeiro)**

In `__tests__/Sidebar.test.tsx`, adicionar ao `describe("Sidebar", ...)`:

```ts
  it("mostra o item de navegação Personalização", () => {
    render(
      <Sidebar name="Ateliê Mira" monogram="AM" logoUrl={null} slug="ateliemira" />
    );
    expect(screen.getByText("Personalização")).toBeTruthy();
  });
```

Run: `npx vitest run __tests__/Sidebar.test.tsx`
Expected: FAIL — texto "Personalização" ausente.

- [ ] **Step 6: Implementar o item no Sidebar**

In `components/painel/Sidebar.tsx`:
- No import de `lucide-react`, adicionar `Palette`.
- Entre o `NavItem` de "Categorias" e o de "Configurações", adicionar:

```tsx
        <NavItem
          href="/painel/personalizacao"
          icon={<Palette size={19} />}
          label="Personalização"
          active={isActive("/painel/personalizacao")}
        />
```

- [ ] **Step 7: Implementar o item no MobileTabBar**

In `components/painel/MobileTabBar.tsx`:
- No import de `lucide-react`, adicionar `Palette`.
- Entre o `TabItem` de "Categorias" e o de "Config.", adicionar:

```tsx
      <TabItem
        href="/painel/personalizacao"
        icon={<Palette size={20} />}
        label="Personalização"
        active={isActive("/painel/personalizacao")}
      />
```

- [ ] **Step 8: Typecheck + testes**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx vitest run __tests__/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/loja/CapaFields.tsx app/painel/personalizacao/ components/painel/Sidebar.tsx components/painel/MobileTabBar.tsx __tests__/Sidebar.test.tsx
git commit -m "feat: adiciona aba Personalização com cor de destaque e upload de capa"
```

---

## Task 6: Onboarding — remover cor de destaque da etapa 2 do cadastro

**Files:**
- Modify: `app/(auth)/cadastro/CadastroForm.tsx`
- Modify: `app/(auth)/cadastro/use-cadastro-form.ts`
- Modify: `app/actions/auth.ts`
- Modify: `__tests__/CadastroForm.test.tsx`

**Interfaces:**
- Consumes: `useLojaFields` sem `accent` (Task 4).
- Produces: etapa 2 sem seção de cor; `createStore` grava `accent_color: "#C9A96E"` fixo.

- [ ] **Step 1: Atualizar o teste do CadastroForm (falha primeiro)**

In `__tests__/CadastroForm.test.tsx`:
- No teste da linha ~48, trocar o título e remover a asserção da cor:
  - Renomear para `it("mostra as seções Identidade e Pagamento e entrega na etapa 2", () => {`.
  - Remover a linha `expect(screen.getByText("Cor de destaque")).toBeTruthy();`.
- Adicionar (no mesmo teste ou logo abaixo) a asserção de ausência:

```ts
    expect(screen.queryByText("Cor de destaque")).toBeNull();
```

(No teste da etapa 1 já existe `expect(screen.queryByText("Cor de destaque")).toBeNull();` — mantenha.)

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: FAIL — a etapa 2 ainda mostra "Cor de destaque".

- [ ] **Step 2: Remover a seção de cor de `CadastroForm.tsx`**

In `app/(auth)/cadastro/CadastroForm.tsx`:
- Remover o import `import { CorDestaqueFields } from '@/components/loja/CorDestaqueFields'`.
- Remover, de dentro do bloco `{stepLoja && (...)}`, o cabeçalho "Cor de destaque" (o `<div className="flex items-center gap-3 mt-2">…Cor de destaque…</div>`) **e** o `<CorDestaqueFields accent={accent} onAccentChange={setAccent} />` logo abaixo.
- No destructuring de `useCadastroForm(...)` (linha ~35), remover `accent, setAccent,`.

- [ ] **Step 3: Remover `accent` de `use-cadastro-form.ts`**

In `app/(auth)/cadastro/use-cadastro-form.ts`:
- Remover o import `import { ACCENT_COLOR_OPTIONS } from '@/lib/data'`.
- No objeto passado a `useLojaFields({ ... })`, remover `accentColor: ACCENT_COLOR_OPTIONS[0],`.
- No corpo do `useActionState`, remover `formData.set('accentColor', loja.accent)`.

- [ ] **Step 4: Ajustar `createStore` em `app/actions/auth.ts`**

In `app/actions/auth.ts`:
- Na definição `const storeSchema = z.object({ ... })`, remover a linha `accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),`.
- Na chamada `storeSchema.safeParse({ ... })` dentro de `createStore`, remover a linha `accentColor: formData.get('accentColor'),`.
- No `.insert({ ... })` da tabela `stores`, trocar `accent_color: result.data.accentColor,` por:

```ts
      accent_color: '#C9A96E', // padrão Gold Dust; o lojista ajusta na aba Personalização
```

- [ ] **Step 5: Typecheck + teste**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx vitest run __tests__/CadastroForm.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/\(auth\)/cadastro/CadastroForm.tsx app/\(auth\)/cadastro/use-cadastro-form.ts app/actions/auth.ts __tests__/CadastroForm.test.tsx
git commit -m "feat: remove cor de destaque do onboarding; loja nasce com padrão Gold Dust"
```

---

## Task 7: Render da capa na vitrine + layout de duas camadas fixas

**Files:**
- Create: `components/catalogo/StoreBanner.tsx`
- Modify: `app/[slug]/CatalogoClient.tsx`
- Modify: `__tests__/CatalogoClient.test.tsx` (stub de `ResizeObserver` + teste da capa)

**Interfaces:**
- Consumes: `Store.coverUrl` (Task 1).
- Produces: `StoreBanner` (renderiza a capa só quando `coverUrl` existe).

- [ ] **Step 1: Criar `StoreBanner`**

Create `components/catalogo/StoreBanner.tsx`:

```tsx
import Image from "next/image";
import type { Store } from "@/lib/types";

export function StoreBanner({ store }: { store: Store }) {
  if (!store.coverUrl) return null;
  return (
    <div className="relative w-full aspect-[3/1] overflow-hidden">
      <Image
        src={store.coverUrl}
        alt={`Capa da loja ${store.name}`}
        fill
        sizes="100vw"
        className="object-cover"
      />
    </div>
  );
}
```

- [ ] **Step 2: Escrever o teste da capa (falha primeiro)**

In `__tests__/CatalogoClient.test.tsx`:
- No `beforeEach`, adicionar um stub de `ResizeObserver` (jsdom não implementa):

```ts
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
```

- Adicionar um teste que a capa aparece quando `coverUrl` está setada. Como `next/image` renderiza um `<img>` com `alt`, buscar por alt:

```ts
  it("renderiza a capa quando a loja tem coverUrl", () => {
    render(
      <CatalogoClient
        store={{ ...store, coverUrl: "https://example.com/capa.jpg" }}
        products={makeProducts(2, "Vestidos")}
      />
    );
    expect(screen.getByAltText("Capa da loja Ateliê Mira")).toBeTruthy();
  });

  it("não renderiza a capa quando não há coverUrl", () => {
    render(<CatalogoClient store={store} products={makeProducts(2, "Vestidos")} />);
    expect(screen.queryByAltText(/Capa da loja/)).toBeNull();
  });
```

> `next/image` pode exigir mock em jsdom. Se o render falhar por causa do otimizador, adicionar no topo do arquivo:
> ```ts
> vi.mock("next/image", () => ({
>   default: (props: Record<string, unknown>) => {
>     // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
>     return <img {...(props as any)} />;
>   },
> }));
> ```
> Verifique se outros testes (ex.: `ProductCard`) já mockam `next/image` para seguir o mesmo padrão.

Run: `npx vitest run __tests__/CatalogoClient.test.tsx`
Expected: FAIL — capa não é renderizada (StoreBanner ainda não integrado).

- [ ] **Step 3: Integrar StoreBanner + duas camadas fixas em `CatalogoClient`**

In `app/[slug]/CatalogoClient.tsx`:
- Adicionar imports: `import { useEffect, useRef, useState } from "react";` (ajustar o import de react existente para incluir `useState`) e `import { StoreBanner } from "@/components/catalogo/StoreBanner";`.
- Dentro do componente, adicionar a medição da altura do header:

```tsx
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => setHeaderH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
```

- Substituir o bloco sticky atual:

```tsx
      <div className="sticky top-0 z-10 bg-ivory">
        <StoreHeader ... />

        <div className="bg-ivory flex gap-2 px-4 py-3.5 overflow-x-auto no-scrollbar">
          {store.categories.map((cat) => ( ... ))}
        </div>
      </div>
```

por (cabeçalho sticky, capa em fluxo normal, pills sticky abaixo do header):

```tsx
      <div ref={headerRef} className="sticky top-0 z-20 bg-ivory">
        <StoreHeader
          store={store}
          activeProductCount={activeProducts.length}
          bagCount={bagCount}
          onOpenBag={() => setBagOpen(true)}
          searchOpen={searchOpen}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleSearch={toggleSearch}
        />
      </div>

      <StoreBanner store={store} />

      <div
        className="sticky z-10 bg-ivory flex gap-2 px-4 py-3.5 overflow-x-auto no-scrollbar"
        style={{ top: headerH }}
      >
        {store.categories.map((cat) => (
          <Pill
            key={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </Pill>
        ))}
      </div>
```

(Mantém tudo o mais igual: o grid, o sentinel, o `BagDrawer` e o `Toast` seguem depois.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run __tests__/CatalogoClient.test.tsx`
Expected: PASS (novos testes da capa + os existentes de grid/busca/pills).

- [ ] **Step 5: Typecheck + suíte completa**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx vitest run`
Expected: toda a suíte PASS.

- [ ] **Step 6: Commit**

```bash
git add components/catalogo/StoreBanner.tsx app/\[slug\]/CatalogoClient.tsx __tests__/CatalogoClient.test.tsx
git commit -m "feat: renderiza a capa na vitrine com layout de duas camadas fixas"
```

---

## Task 8: Verificação manual end-to-end

**Files:** nenhum (verificação).

- [ ] **Step 1: Subir o ambiente**

Garantir Supabase local no ar e aplicar a migration:

```bash
supabase start
supabase migration up
```

(Ou `supabase db reset` se preferir recriar do zero — cuidado: apaga dados locais.)

- [ ] **Step 2: Rodar o dev server e conferir o checklist**

Iniciar o dev server (via ferramenta de preview do harness) e validar, na ordem:

1. Sidebar (desktop) e tab bar (mobile) mostram "Personalização" entre Categorias e Configurações.
2. Configurações **não** mostra mais o Card "Cor de destaque".
3. Na aba Personalização: escolher uma cor e salvar → toast de sucesso.
4. Enviar uma capa (imagem larga) e salvar → prévia aparece; abrir a vitrine pública `/{slug}` → capa aparece entre o nome da loja e os filtros, proporção 3:1, recortada.
5. Ao rolar a vitrine: a capa some; cabeçalho e barra de filtros permanecem fixos no topo.
6. Voltar à Personalização, clicar "Remover" e salvar → capa some da vitrine (sem espaço vazio).
7. Alterar a cor de destaque → CTAs da vitrine (adicionar à sacola, comprar) refletem a nova cor.
8. Fazer um cadastro novo (`/cadastro`): a etapa 2 **não** pede cor de destaque; após criar, a loja nasce com Gold Dust e é editável na aba Personalização.

- [ ] **Step 3: Confirmar suíte verde**

Run: `npx vitest run`
Expected: toda a suíte PASS.

---

## Self-Review

**Spec coverage:**
- §4 modelo de dados (coluna + threading) → Task 1. ✓
- §5 aba Personalização (rota, hook, client, CapaFields, loading) → Task 5. ✓
- §5 navegação (Sidebar/MobileTabBar) → Task 5. ✓
- §5 "o que sai da Configurações" → Task 4. ✓
- §5.1 onboarding → Task 6. ✓
- §6 Server Action + validação + upload → Tasks 2 e 3. ✓
- §7 render na vitrine + duas camadas fixas → Task 7. ✓
- §8 testes (schema, mapeadores) → Tasks 1, 2; checklist manual → Task 8. ✓
- Refactor do `useLojaFields` (accent sai) → Task 4. ✓

**Placeholder scan:** sem TBD/TODO; todo passo com código real ou comando concreto. As duas notas condicionais (`text-error`, mock de `next/image`) instruem verificação explícita, não deixam trabalho em aberto.

**Type consistency:** `coverUrl` (`Store` opcional / `StoreSettings` obrigatório) e `cover_url` (rows) usados de forma consistente entre Tasks 1, 3, 5, 7. `updatePersonalizacao(prev, formData): Promise<StoreActionState>` e os campos `accentColor`/`cover`/`removeCover` batem entre a action (Task 3) e o hook (Task 5). `personalizacaoSchema` definido na Task 2 e consumido na Task 3.
