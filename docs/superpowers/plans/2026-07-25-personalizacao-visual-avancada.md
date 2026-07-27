# Personalização Visual Avançada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a Starter/Pro três eixos independentes de personalização visual — pareamento de fonte, paleta de fundo e formato de cantos — além de produtos em destaque e densidade de grid, sem alterar nada do que o Free já tem hoje (cor de destaque, capa).

**Architecture:** Três "cardápios" de opções curadas e independentes entre si (`lib/theme-options.ts`: pareamento de fonte, paleta de fundo, formato de cantos), combináveis livremente pelo lojista — não um único preset combinado. `tailwind.config.ts` passa a referenciar os CSS custom properties que `app/globals.css` já declara (`--color-bg`, `--color-surface`, `--color-border`, `--radius-card`, `--radius-btn`) em vez de valores literais fixos — isso já é o padrão usado hoje só para fonte (`var(--font-sora)`) e cor de destaque (`var(--color-primary)`); esta task estende o mesmo mecanismo pra fundo e cantos, sem mudar a aparência de nenhuma tela hoje (os valores em `:root` continuam idênticos aos atuais). A resolução do que cada loja pode efetivamente usar acontece em funções puras (`resolveCatalog` em `lib/catalog.ts`, `resolveTheme` em `lib/theme-options.ts`) — o componente do catálogo público só aplica o que já foi resolvido, sem saber nada sobre planos.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), Zod, Vitest, Tailwind (tokens CSS em `app/globals.css` / `tailwind.config.ts`), `next/font/google`.

## Global Constraints

- Gating aditivo: nada que já existe hoje (cor de destaque, capa, limites atuais) pode regredir para lojas Free existentes.
- Os três eixos de tema (fonte, fundo, formato) são **independentes entre si** — o lojista escolhe cada um separadamente, não um preset combinado. Todos os três são liberados juntos pela mesma flag de plano (`themeOptions`); a cor secundária livre continua exclusiva do Pro (`advancedTheme`).
- Toda validação de plano é feita no servidor (server actions), nunca só na UI.
- Colunas novas lidas pelo catálogo público precisam de `grant select` explícito para `anon` (regra crítica do `AGENTS.md`) — sem isso a vitrine `/{slug}` quebra silenciosamente.
- **`plan`/`trial_ends_at` de `stores` NUNCA são expostos ao `anon`** — removidos deliberadamente do grant em `20260709000000_restringe_colunas_publicas_stores.sql` (achado de segurança MEDIA-03: qualquer um conseguia ler plano/expiração de qualquer loja via REST direto). O gating no catálogo público usa a função Postgres `get_effective_plan` (Task 1), nunca lê essas colunas cru.
- `fetchPublicCatalog` (`lib/server/catalog.ts`) roda inteiramente com `createAnonClient()` — não existe cliente com privilégio elevado nesta base.
- Referência de design/spec: `docs/superpowers/specs/2026-07-25-diferenciacao-planos-design.md` (§3, §4, §5.1, §5.2, §6, §8 desta spec).

---

## Mapa de arquivos

**Novos:**
- `supabase/migrations/20260725100000_theme_and_featured_columns.sql`
- `supabase/migrations/20260725100100_grant_anon_theme_columns.sql`
- `supabase/migrations/20260725100200_get_effective_plan_function.sql`
- `lib/theme-options.ts`
- `__tests__/theme-options.test.ts`
- `components/painel/ThemeOptionsFields.tsx`
- `components/catalogo/FeaturedRail.tsx`

**Modificados:**
- `lib/plan-limits.ts`, `__tests__/plan-limits.test.ts`
- `app/layout.tsx` (5 pareamentos de fonte via `next/font/google`)
- `tailwind.config.ts`, `app/globals.css` (cores/raio de borda passam a referenciar CSS vars)
- `lib/types.ts`
- `lib/catalog.ts`, `__tests__/catalog.test.ts` (criar se não existir)
- `lib/server/catalog.ts`
- `lib/server/store.ts`
- `lib/validation/painel.ts`
- `app/actions/store.ts`
- `app/actions/produtos.ts`
- `app/painel/personalizacao/PersonalizacaoClient.tsx`, `use-personalizacao.ts`
- `app/painel/produtos/ProdutosClient.tsx`, `use-produtos.ts`
- `app/[slug]/CatalogoClient.tsx`
- `app/landing/data.tsx`

---

### Task 1: Migração de banco — colunas novas, grants e função de plano efetivo

**Files:**
- Create: `supabase/migrations/20260725100000_theme_and_featured_columns.sql`
- Create: `supabase/migrations/20260725100100_grant_anon_theme_columns.sql`
- Create: `supabase/migrations/20260725100200_get_effective_plan_function.sql`

**Interfaces:**
- Produces: colunas `stores.font_pairing` (text, default `'padrao'`), `stores.background_palette` (text, default `'padrao'`), `stores.corner_style` (text, default `'padrao'`), `stores.secondary_color` (text, nullable), `stores.grid_density` (text, default `'padrao'`), `products.is_featured` (boolean, default `false`); grants de `select` para `anon` nessas colunas de `stores`/`products`; função `public.get_effective_plan(store_id uuid) returns text`, executável por `anon` — consumida pela Task 5.

- [ ] **Step 1: Escrever a migration de colunas**

```sql
-- supabase/migrations/20260725100000_theme_and_featured_columns.sql
alter table stores add column font_pairing text not null default 'padrao';
alter table stores add column background_palette text not null default 'padrao';
alter table stores add column corner_style text not null default 'padrao';
alter table stores add column secondary_color text;
alter table stores add column grid_density text not null default 'padrao';
alter table products add column is_featured boolean not null default false;
```

- [ ] **Step 2: Escrever a migration de grants (sem incluir `plan`/`trial_ends_at`)**

```sql
-- supabase/migrations/20260725100100_grant_anon_theme_columns.sql
-- font_pairing/background_palette/corner_style/secondary_color/grid_density:
-- lidos pelo catálogo público para decidir o tema efetivo. NÃO inclui
-- plan/trial_ends_at — essas colunas foram deliberadamente removidas do
-- grant do anon em 20260709000000_restringe_colunas_publicas_stores.sql
-- (achado de segurança MEDIA-03). O plano efetivo é obtido via a função
-- get_effective_plan (Step 3), não por leitura direta das colunas.
grant select (font_pairing, background_palette, corner_style, secondary_color, grid_density) on public.stores to anon;
grant select (is_featured) on public.products to anon;
```

- [ ] **Step 3: Escrever a migration da função `get_effective_plan`**

```sql
-- supabase/migrations/20260725100200_get_effective_plan_function.sql
-- Replica só a regra de expiração de lib/plan-limits.ts:getEffectivePlan() —
-- devolve o plano JÁ RESOLVIDO ('free'/'starter'/'pro'), nunca trial_ends_at
-- cru. security definer: roda com o dono da function (bypassa o grant restrito
-- do anon só para esta leitura pontual e específica), então o anon ganha
-- EXECUTE na função, não SELECT nas colunas plan/trial_ends_at.
create or replace function public.get_effective_plan(p_store_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select
    case
      when s.plan <> 'free' and s.trial_ends_at is not null and s.trial_ends_at <= now()
      then 'free'
      else s.plan
    end
  from public.stores s
  where s.id = p_store_id;
$$;

grant execute on function public.get_effective_plan(uuid) to anon;
```

- [ ] **Step 4: Aplicar as migrations localmente**

Run: `npx supabase db reset` (ou `npx supabase migration up`, conforme o fluxo já usado no projeto para aplicar migrations no ambiente local)
Expected: as três migrations aplicadas sem erro; `select font_pairing, background_palette, corner_style, secondary_color, grid_density from stores limit 1;` e `select is_featured from products limit 1;` rodam sem erro de permissão pro papel `anon`; `select plan from stores limit 1;` continua retornando `42501 permission denied` pro `anon` (a proteção do MEDIA-03 não regrediu); `select get_effective_plan('<algum-id-de-loja>'::uuid);` retorna `'free'`, `'starter'` ou `'pro'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260725100000_theme_and_featured_columns.sql supabase/migrations/20260725100100_grant_anon_theme_columns.sql supabase/migrations/20260725100200_get_effective_plan_function.sql
git commit -m "feat(db): adiciona colunas de tema (fonte/fundo/cantos) e função get_effective_plan"
```

---

### Task 2: Extensão de `lib/plan-limits.ts` com feature flags

**Files:**
- Modify: `lib/plan-limits.ts`
- Modify: `__tests__/plan-limits.test.ts`

**Interfaces:**
- Produces: `PlanLimits` ganha `maxFeaturedProducts: number`, `themeOptions: boolean`, `advancedTheme: boolean`, `gridDensity: boolean`. Consumido pelas Tasks 3, 5, 6, 7, 8.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Adicionar ao final de `__tests__/plan-limits.test.ts` (mantendo os testes existentes intactos):

```ts
describe("getPlanLimits — feature flags de personalização", () => {
  it("free não tem nenhuma flag de personalização", () => {
    const limits = getPlanLimits("free", null);
    expect(limits.maxFeaturedProducts).toBe(0);
    expect(limits.themeOptions).toBe(false);
    expect(limits.advancedTheme).toBe(false);
    expect(limits.gridDensity).toBe(false);
  });

  it("starter libera fonte/fundo/cantos, densidade e até 3 destaques, mas não cor secundária", () => {
    const limits = getPlanLimits("starter", null);
    expect(limits.maxFeaturedProducts).toBe(3);
    expect(limits.themeOptions).toBe(true);
    expect(limits.gridDensity).toBe(true);
    expect(limits.advancedTheme).toBe(false);
  });

  it("pro libera tudo, incluindo cor secundária e destaques ilimitados", () => {
    const limits = getPlanLimits("pro", null);
    expect(limits.maxFeaturedProducts).toBe(Infinity);
    expect(limits.themeOptions).toBe(true);
    expect(limits.advancedTheme).toBe(true);
    expect(limits.gridDensity).toBe(true);
  });

  it("starter/pro com trial_ends_at expirado perdem as flags (caem para Free)", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const limits = getPlanLimits("pro", past);
    expect(limits.themeOptions).toBe(false);
    expect(limits.maxFeaturedProducts).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: FAIL — `limits.maxFeaturedProducts` (e as demais flags) são `undefined`.

- [ ] **Step 3: Implementar as flags em `lib/plan-limits.ts`**

```ts
export type Plan = "free" | "starter" | "pro";

export interface PlanLimits {
  maxProducts: number;
  maxCategories: number;
  maxPhotos: number;
  maxFeaturedProducts: number;
  themeOptions: boolean;
  advancedTheme: boolean;
  gridDensity: boolean;
}

const FREE_LIMITS: PlanLimits = {
  maxProducts: 8,
  maxCategories: 1,
  maxPhotos: 1,
  maxFeaturedProducts: 0,
  themeOptions: false,
  advancedTheme: false,
  gridDensity: false,
};

const STARTER_LIMITS: PlanLimits = {
  maxProducts: 30,
  maxCategories: 5,
  maxPhotos: 3,
  maxFeaturedProducts: 3,
  themeOptions: true,
  advancedTheme: false,
  gridDensity: true,
};

const PRO_LIMITS: PlanLimits = {
  maxProducts: Infinity,
  maxCategories: Infinity,
  maxPhotos: 5,
  maxFeaturedProducts: Infinity,
  themeOptions: true,
  advancedTheme: true,
  gridDensity: true,
};
```

(As funções `isPaidAccessExpired`, `getEffectivePlan` e `getPlanLimits` não mudam nesta task.)

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/plan-limits.test.ts`
Expected: PASS — todos os testes, incluindo os 5 já existentes e os 4 novos.

- [ ] **Step 5: Commit**

```bash
git add lib/plan-limits.ts __tests__/plan-limits.test.ts
git commit -m "feat: adiciona feature flags de personalização ao PlanLimits"
```

---

### Task 3: Opções de tema — fonte, fundo e cantos (`lib/theme-options.ts`)

Três listas curadas e independentes. Fontes novas via `next/font/google`, seguindo o padrão já usado para Sora/DM Sans em `app/layout.tsx`.

**Files:**
- Modify: `app/layout.tsx`
- Create: `lib/theme-options.ts`
- Create: `__tests__/theme-options.test.ts`

**Interfaces:**
- Produces: `FONT_PAIRINGS`, `BACKGROUND_PALETTES`, `CORNER_STYLES` (arrays), `DEFAULT_FONT_PAIRING_KEY`/`DEFAULT_BACKGROUND_PALETTE_KEY`/`DEFAULT_CORNER_STYLE_KEY`, `getFontPairing(key)`, `getBackgroundPalette(key)`, `getCornerStyle(key)`, `resolveTheme(fontPairingKey, backgroundPaletteKey, cornerStyleKey, secondaryColor, limits): ResolvedTheme`. Consumido pela Task 5 (`resolveCatalog`), Task 6 (UI do painel) e Task 9 (`CatalogoClient.tsx`).

- [ ] **Step 1: Carregar as fontes novas no layout raiz**

Ler `app/layout.tsx` (linhas 1-25 aprox.) antes de editar, para preservar `sora`/`dmSans` exatamente como estão. Adicionar as fontes novas ao lado das existentes:

```ts
import { Sora, DM_Sans, Fraunces, Inter, Playfair_Display, Lora, Space_Grotesk } from "next/font/google";

// ... (sora e dmSans continuam exatamente como estão hoje)

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter" });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["600"], variable: "--font-playfair" });
const lora = Lora({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-lora" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-space-grotesk" });
```

E incluir `fraunces.variable`, `inter.variable`, `playfairDisplay.variable`, `lora.variable` e `spaceGrotesk.variable` junto das classes já aplicadas em `<html>` (ao lado de `sora.variable` e `dmSans.variable`, sem remover nenhuma). Nenhum componente passa a usar essas fontes por padrão — só ficam disponíveis como variáveis CSS carregadas, prontas para serem referenciadas pelo tema resolvido (Task 9).

- [ ] **Step 2: Escrever os testes que falham primeiro**

```ts
// __tests__/theme-options.test.ts
import { describe, it, expect } from "vitest";
import {
  FONT_PAIRINGS,
  BACKGROUND_PALETTES,
  CORNER_STYLES,
  DEFAULT_FONT_PAIRING_KEY,
  DEFAULT_BACKGROUND_PALETTE_KEY,
  DEFAULT_CORNER_STYLE_KEY,
  getFontPairing,
  getBackgroundPalette,
  getCornerStyle,
  resolveTheme,
} from "@/lib/theme-options";

describe("opções de tema", () => {
  it("o pareamento padrão usa exatamente a fonte atual do produto (Sora/DM Sans)", () => {
    const padrao = getFontPairing(DEFAULT_FONT_PAIRING_KEY);
    expect(padrao.fontDisplayVar).toBe("--font-sora");
    expect(padrao.fontBodyVar).toBe("--font-dm-sans");
  });

  it("a paleta de fundo padrão usa exatamente as cores atuais (Ivory/Linen/Sand)", () => {
    const padrao = getBackgroundPalette(DEFAULT_BACKGROUND_PALETTE_KEY);
    expect(padrao).toMatchObject({ background: "#F9F9F7", surface: "#F0EDE8", border: "#E2DFDA" });
  });

  it("o formato de cantos padrão usa exatamente o raio atual (16px/8px)", () => {
    const padrao = getCornerStyle(DEFAULT_CORNER_STYLE_KEY);
    expect(padrao).toMatchObject({ cardRadius: "16px", btnRadius: "8px" });
  });

  it("tem 5 pareamentos de fonte, 4 paletas de fundo e 3 formatos de cantos", () => {
    expect(FONT_PAIRINGS).toHaveLength(5);
    expect(BACKGROUND_PALETTES).toHaveLength(4);
    expect(CORNER_STYLES).toHaveLength(3);
  });

  it("getters caem para o padrão quando a chave é desconhecida", () => {
    expect(getFontPairing("chave-inexistente").key).toBe(DEFAULT_FONT_PAIRING_KEY);
    expect(getBackgroundPalette("chave-inexistente").key).toBe(DEFAULT_BACKGROUND_PALETTE_KEY);
    expect(getCornerStyle("chave-inexistente").key).toBe(DEFAULT_CORNER_STYLE_KEY);
  });
});

describe("resolveTheme", () => {
  const noFlags = { themeOptions: false, advancedTheme: false };
  const themeFlag = { themeOptions: true, advancedTheme: false };
  const allFlags = { themeOptions: true, advancedTheme: true };

  it("sem themeOptions, ignora as 3 escolhas e usa sempre o padrão de cada uma", () => {
    const resolved = resolveTheme("editorial", "areia", "arredondado", null, noFlags);
    expect(resolved.fontDisplayVar).toBe("--font-sora");
    expect(resolved.backgroundColor).toBe("#F9F9F7");
    expect(resolved.cardRadius).toBe("16px");
  });

  it("com themeOptions, aplica as 3 escolhas de forma independente", () => {
    const resolved = resolveTheme("editorial", "areia", "arredondado", null, themeFlag);
    expect(resolved.fontDisplayVar).toBe("--font-fraunces");
    expect(resolved.backgroundColor).toBe("#F5EFE6");
    expect(resolved.cardRadius).toBe("24px");
  });

  it("consegue misturar uma fonte com um fundo e cantos de 'presets' diferentes", () => {
    const resolved = resolveTheme("classico", "cinza", "reto", null, themeFlag);
    expect(resolved.fontDisplayVar).toBe("--font-playfair");
    expect(resolved.backgroundColor).toBe("#EEEEEC");
    expect(resolved.cardRadius).toBe("4px");
  });

  it("sem advancedTheme, ignora a cor secundária mesmo se estiver salva", () => {
    const resolved = resolveTheme("padrao", "padrao", "padrao", "#123456", themeFlag);
    expect(resolved.secondaryColor).toBeNull();
  });

  it("com advancedTheme, aplica a cor secundária salva", () => {
    const resolved = resolveTheme("padrao", "padrao", "padrao", "#123456", allFlags);
    expect(resolved.secondaryColor).toBe("#123456");
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/theme-options.test.ts`
Expected: FAIL com `Cannot find module '@/lib/theme-options'`.

- [ ] **Step 4: Implementar `lib/theme-options.ts`**

```ts
export interface FontPairing {
  key: string;
  label: string;
  fontDisplayVar: string;
  fontBodyVar: string;
  titleTransform: "none" | "uppercase";
  titleLetterSpacing: string;
}

export interface BackgroundPalette {
  key: string;
  label: string;
  background: string;
  surface: string;
  border: string;
}

export interface CornerStyle {
  key: string;
  label: string;
  cardRadius: string;
  btnRadius: string;
}

export const DEFAULT_FONT_PAIRING_KEY = "padrao";
export const DEFAULT_BACKGROUND_PALETTE_KEY = "padrao";
export const DEFAULT_CORNER_STYLE_KEY = "padrao";

export const FONT_PAIRINGS: FontPairing[] = [
  { key: "padrao", label: "Padrão", fontDisplayVar: "--font-sora", fontBodyVar: "--font-dm-sans", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "editorial", label: "Editorial", fontDisplayVar: "--font-fraunces", fontBodyVar: "--font-inter", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "classico", label: "Clássico", fontDisplayVar: "--font-playfair", fontBodyVar: "--font-lora", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "moderno", label: "Moderno", fontDisplayVar: "--font-space-grotesk", fontBodyVar: "--font-inter", titleTransform: "none", titleLetterSpacing: "0" },
  { key: "minimal", label: "Minimal", fontDisplayVar: "--font-inter", fontBodyVar: "--font-inter", titleTransform: "uppercase", titleLetterSpacing: "0.06em" },
];

export const BACKGROUND_PALETTES: BackgroundPalette[] = [
  { key: "padrao", label: "Ivory (padrão)", background: "#F9F9F7", surface: "#F0EDE8", border: "#E2DFDA" },
  { key: "branco", label: "Branco puro", background: "#FFFFFF", surface: "#F7F7F5", border: "#ECECEA" },
  { key: "areia", label: "Areia quente", background: "#F5EFE6", surface: "#FFFDF9", border: "#E6DCC9" },
  { key: "cinza", label: "Cinza claro", background: "#EEEEEC", surface: "#F7F7F5", border: "#D8D8D4" },
];

export const CORNER_STYLES: CornerStyle[] = [
  { key: "padrao", label: "Atual", cardRadius: "16px", btnRadius: "8px" },
  { key: "reto", label: "Reto", cardRadius: "4px", btnRadius: "4px" },
  { key: "arredondado", label: "Arredondado", cardRadius: "24px", btnRadius: "999px" },
];

export function getFontPairing(key: string): FontPairing {
  return FONT_PAIRINGS.find((p) => p.key === key) ?? FONT_PAIRINGS[0];
}

export function getBackgroundPalette(key: string): BackgroundPalette {
  return BACKGROUND_PALETTES.find((p) => p.key === key) ?? BACKGROUND_PALETTES[0];
}

export function getCornerStyle(key: string): CornerStyle {
  return CORNER_STYLES.find((p) => p.key === key) ?? CORNER_STYLES[0];
}

export interface ThemeLimits {
  themeOptions: boolean;
  advancedTheme: boolean;
}

export interface ResolvedTheme {
  fontDisplayVar: string;
  fontBodyVar: string;
  titleTransform: "none" | "uppercase";
  titleLetterSpacing: string;
  backgroundColor: string;
  surfaceColor: string;
  borderColor: string;
  cardRadius: string;
  btnRadius: string;
  secondaryColor: string | null;
}

export function resolveTheme(
  fontPairingKey: string,
  backgroundPaletteKey: string,
  cornerStyleKey: string,
  secondaryColor: string | null,
  limits: ThemeLimits
): ResolvedTheme {
  const font = limits.themeOptions ? getFontPairing(fontPairingKey) : getFontPairing(DEFAULT_FONT_PAIRING_KEY);
  const background = limits.themeOptions
    ? getBackgroundPalette(backgroundPaletteKey)
    : getBackgroundPalette(DEFAULT_BACKGROUND_PALETTE_KEY);
  const corner = limits.themeOptions ? getCornerStyle(cornerStyleKey) : getCornerStyle(DEFAULT_CORNER_STYLE_KEY);

  return {
    fontDisplayVar: font.fontDisplayVar,
    fontBodyVar: font.fontBodyVar,
    titleTransform: font.titleTransform,
    titleLetterSpacing: font.titleLetterSpacing,
    backgroundColor: background.background,
    surfaceColor: background.surface,
    borderColor: background.border,
    cardRadius: corner.cardRadius,
    btnRadius: corner.btnRadius,
    secondaryColor: limits.advancedTheme ? secondaryColor : null,
  };
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/theme-options.test.ts`
Expected: PASS em todos os casos.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx lib/theme-options.ts __tests__/theme-options.test.ts
git commit -m "feat: adiciona opções independentes de fonte, fundo e cantos com gating por plano"
```

---

### Task 4: Ligar `tailwind.config.ts`/`app/globals.css` às variáveis CSS existentes

`app/globals.css` já declara `--color-bg`, `--color-surface`, `--color-border`, `--radius-card`, `--radius-btn` em `:root` — mas `tailwind.config.ts` hoje usa valores literais (`ivory: "#F9F9F7"`, `card: "16px"`) em vez de referenciar essas variáveis. Isso impede o mesmo truque já usado pra cor de destaque/fonte (sobrescrever a variável CSS na raiz do catálogo) de funcionar pra fundo e cantos. Esta task fecha essa lacuna, sem mudar a aparência de nenhuma tela hoje — os valores em `:root` continuam idênticos aos atuais.

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css` (verificação apenas — os tokens já existem)

**Interfaces:**
- Produces: classes Tailwind `bg-ivory`, `bg-linen`, `border-sand`, `rounded-card`, `rounded-btn` passam a resolver via `var(...)`, herdando qualquer override feito num container pai. Consumido pela Task 9 (`CatalogoClient.tsx`).

- [ ] **Step 1: Ler `tailwind.config.ts` e `app/globals.css` (linhas 1-45) antes de editar**

Já lidos nesta sessão — confirmar que `--color-bg: #F9F9F7`, `--color-surface: #F0EDE8`, `--color-border: #E2DFDA`, `--radius-card: 16px`, `--radius-btn: 8px` estão em `:root` antes de prosseguir (não deveria ser necessário criar nada em `globals.css`, só referenciar em `tailwind.config.ts`).

- [ ] **Step 2: Atualizar `tailwind.config.ts`**

```ts
colors: {
  obsidian: "#0D0D0D",
  gold: "#C9A96E",
  "gold-hover": "#BD9A5C",
  ivory: "var(--color-bg)",
  linen: "var(--color-surface)",
  graphite: "#3D3D3D",
  sand: "var(--color-border)",
  "surface-hover": "#E7E2DB",
  success: "#1A9C6E",
  soldout: "#C47E00",
  error: "#C0392B",
  "error-surface": "#FDECEA",
  inactive: "#B0ADA8",
},
fontFamily: {
  display: ["var(--font-sora)", "sans-serif"],
  body: ["var(--font-dm-sans)", "sans-serif"],
},
borderRadius: {
  card: "var(--radius-card)",
  btn: "var(--radius-btn)",
  pill: "999px",
  input: "8px",
  modal: "20px",
},
```

(Só `ivory`/`linen`/`sand` e `card`/`btn` mudam de literal para `var(...)` — os demais tokens ficam exatamente como estão hoje.)

- [ ] **Step 3: Verificação manual de não-regressão**

Run: `npm run dev`, abrir `/painel` (qualquer tela) e `/{slug}` de uma loja de teste.
Expected: nenhuma mudança visual em nenhuma tela — `bg-ivory`/`bg-linen`/`border-sand`/`rounded-card`/`rounded-btn` renderizam exatamente como antes, porque `:root` já define essas variáveis com os mesmos valores literais que estavam hardcoded no Tailwind.

- [ ] **Step 4: Rodar a suíte completa**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — nenhuma regressão (mudança é só de onde o valor vem, não do valor em si).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts
git commit -m "refactor: liga cores/raio de borda do Tailwind às variáveis CSS já existentes"
```

---

### Task 5: Threading dos campos novos pelos tipos e gating no `resolveCatalog`

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/catalog.ts`
- Modify: `lib/server/catalog.ts`
- Modify: `lib/server/store.ts`
- Create: `__tests__/catalog.test.ts` (se não existir; se existir, adicionar os testes abaixo ao arquivo)

**Interfaces:**
- Consumes: `getPlanLimits(plan, trialEndsAt)` (Task 2), `resolveTheme(...)` (Task 3).
- Produces: `Store.theme: ResolvedTheme`, `Store.gridDensity: "padrao" | "compacto"`, `Product.isFeatured: boolean`, `StoreSettings.fontPairing/backgroundPalette/cornerStyle/secondaryColor/gridDensity`, `StoreProduct.isFeatured`. Consumido pelas Tasks 6, 7, 8, 9.

- [ ] **Step 1: Escrever os testes que falham primeiro**

Se `__tests__/catalog.test.ts` já existir, abrir e adicionar ao final; senão criar o arquivo com este conteúdo mínimo (mais os describes abaixo):

```ts
import { describe, it, expect } from "vitest";
import { resolveCatalog, type PublicStoreRow, type PublicProductRow } from "@/lib/catalog";

function baseStoreRow(overrides: Partial<PublicStoreRow> = {}): PublicStoreRow {
  return {
    id: "store-1",
    name: "Loja Teste",
    slug: "loja-teste",
    is_active: true,
    whatsapp: "5511999990000",
    accent_color: "#C9A96E",
    logo_url: null,
    cover_url: null,
    description: null,
    monogram: null,
    analytics_id: null,
    pixel_id: null,
    message_template: null,
    instagram: null,
    payment_methods: [],
    delivery_methods: [],
    font_pairing: "padrao",
    background_palette: "padrao",
    corner_style: "padrao",
    secondary_color: null,
    grid_density: "padrao",
    ...overrides,
  };
}

describe("resolveCatalog — gating de tema/densidade/destaques por plano", () => {
  // effectivePlan chega separado do storeRow — resolvido antes, via RPC
  // get_effective_plan (Task 1), nunca lido de plan/trial_ends_at cru.
  it("loja free: ignora fonte/fundo/cantos e densidade não-padrão mesmo se salvos no banco", () => {
    const store = baseStoreRow({
      font_pairing: "editorial",
      background_palette: "areia",
      corner_style: "arredondado",
      grid_density: "compacto",
    });
    const result = resolveCatalog(store, [], [], "free");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.fontDisplayVar).toBe("--font-sora");
    expect(result.store.theme.backgroundColor).toBe("#F9F9F7");
    expect(result.store.theme.cardRadius).toBe("16px");
    expect(result.store.gridDensity).toBe("padrao");
  });

  it("loja starter: aplica fonte/fundo/cantos e densidade salvos, de forma independente", () => {
    const store = baseStoreRow({
      font_pairing: "classico",
      background_palette: "cinza",
      corner_style: "reto",
      grid_density: "compacto",
    });
    const result = resolveCatalog(store, [], [], "starter");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.fontDisplayVar).toBe("--font-playfair");
    expect(result.store.theme.backgroundColor).toBe("#EEEEEC");
    expect(result.store.theme.cardRadius).toBe("4px");
    expect(result.store.gridDensity).toBe("compacto");
  });

  it("loja starter: cor secundária é ignorada (só Pro)", () => {
    const store = baseStoreRow({ secondary_color: "#112233" });
    const result = resolveCatalog(store, [], [], "starter");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.secondaryColor).toBeNull();
  });

  it("loja pro: aplica cor secundária salva", () => {
    const store = baseStoreRow({ secondary_color: "#112233" });
    const result = resolveCatalog(store, [], [], "pro");
    if (result.status !== "ok" && result.status !== "hidden") throw new Error("esperado ok/hidden");
    expect(result.store.theme.secondaryColor).toBe("#112233");
  });

  it("produtos em destaque só aparecem marcados quando o plano permite", () => {
    const productRow: PublicProductRow = {
      id: "p1",
      name: "Produto 1",
      price_cents: 1000,
      description: null,
      category_id: null,
      sizes: [],
      sold_sizes: [],
      colors: [],
      images: [],
      stock: 5,
      is_active: true,
      is_new: false,
      is_featured: true,
    };

    const freeResult = resolveCatalog(baseStoreRow(), [productRow], [], "free");
    const proResult = resolveCatalog(baseStoreRow(), [productRow], [], "pro");

    if (freeResult.status !== "ok") throw new Error("esperado ok");
    if (proResult.status !== "ok") throw new Error("esperado ok");
    expect(freeResult.products[0].isFeatured).toBe(false);
    expect(proResult.products[0].isFeatured).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run __tests__/catalog.test.ts`
Expected: FAIL — erro de tipo/propriedade (`font_pairing`/`background_palette`/`corner_style`/`is_featured` não existem em `PublicStoreRow`/`PublicProductRow`; `resolveCatalog` ainda não aceita um 4º argumento `effectivePlan`; `result.store.theme` é `undefined`).

- [ ] **Step 3: Estender os tipos em `lib/types.ts`**

No `interface StoreSettings` (após `deliveryMethods: string[];`):

```ts
  fontPairing: string;
  backgroundPalette: string;
  cornerStyle: string;
  secondaryColor: string | null;
  gridDensity: "padrao" | "compacto";
```

No `interface StoreProduct` (após `isNew: boolean;`):

```ts
  isFeatured: boolean;
```

No `interface Store` e no `interface Product` (verificar campos existentes), adicionar:

```ts
// Store:
  theme: ResolvedTheme;
  gridDensity: "padrao" | "compacto";
// Product:
  isFeatured: boolean;
```

Importar `type { ResolvedTheme } from "@/lib/theme-options"` em `lib/types.ts`.

- [ ] **Step 4: Estender `PublicStoreRow`/`PublicProductRow` em `lib/catalog.ts`**

Em `PublicStoreRow`, após `delivery_methods: string[] | null;` — **sem `plan`/`trial_ends_at`**, que continuam fora do alcance do `anon` (o plano efetivo chega separado, como parâmetro):

```ts
  font_pairing: string;
  background_palette: string;
  corner_style: string;
  secondary_color: string | null;
  grid_density: string;
```

Em `PublicProductRow`, após `is_new: boolean;`:

```ts
  is_featured: boolean;
```

- [ ] **Step 5: Aplicar o gating em `mapPublicStore`/`mapPublicProduct`/`resolveCatalog` (`lib/catalog.ts`)**

`effectivePlan` chega como parâmetro (resolvido antes, via RPC `get_effective_plan` — Step 6) e é repassado para `getPlanLimits(effectivePlan, null)`. Passar `null` de `trialEndsAt` é seguro aqui: o RPC já aplicou a regra de expiração, e um plano pago com `trialEndsAt = null` sempre significa "sem expiração" em `getEffectivePlan`, então `getPlanLimits` não reaplica nenhum corte adicional.

```ts
import { getPlanLimits, type Plan } from "@/lib/plan-limits";
import { resolveTheme } from "@/lib/theme-options";

export function mapPublicStore(
  row: PublicStoreRow,
  categories: string[],
  effectivePlan: Plan
): Store {
  const limits = getPlanLimits(effectivePlan, null);
  return {
    name: row.name,
    monogram: row.monogram?.trim() || initialsFromName(row.name),
    logoUrl: row.logo_url,
    coverUrl: row.cover_url,
    whatsapp: row.whatsapp ?? "",
    categories,
    description: row.description ?? "",
    accentColor: row.accent_color ?? DEFAULT_ACCENT_COLOR,
    catalogUrl: row.slug,
    analyticsId: row.analytics_id ?? undefined,
    pixelId: row.pixel_id ?? undefined,
    messageTemplate: row.message_template,
    instagram: row.instagram ?? undefined,
    paymentMethods: row.payment_methods ?? [],
    deliveryMethods: row.delivery_methods ?? [],
    theme: resolveTheme(
      row.font_pairing,
      row.background_palette,
      row.corner_style,
      row.secondary_color,
      limits
    ),
    gridDensity: limits.gridDensity && row.grid_density === "compacto" ? "compacto" : "padrao",
  };
}

export function mapPublicProduct(
  row: PublicProductRow,
  categoryName: string | null,
  allowFeatured: boolean
): Product {
  return {
    id: row.id,
    name: row.name,
    price: formatCents(row.price_cents),
    category: categoryName ?? "Todos",
    image: row.images?.[0] ?? PLACEHOLDER_IMAGE,
    images: row.images ?? [],
    desc: row.description ?? "",
    sizes: row.sizes ?? [],
    soldSizes: row.sold_sizes ?? [],
    colors: row.colors ?? [],
    isNew: row.is_new,
    isFeatured: allowFeatured && row.is_featured,
    stock: row.stock,
    active: row.is_active,
  };
}
```

`resolveCatalog` ganha um 4º parâmetro `effectivePlan: Plan`, propagado para `mapPublicStore` e usado para derivar `allowFeatured`:

```ts
export function resolveCatalog(
  storeRow: PublicStoreRow | null,
  productRows: PublicProductRow[],
  categoryRows: PublicCategoryRow[],
  effectivePlan: Plan
): PublicCatalog {
  if (!storeRow) return { status: "not_found" };
  if (!storeRow.is_active) {
    return { status: "hidden", store: mapPublicStore(storeRow, [], effectivePlan) };
  }
  const limits = getPlanLimits(effectivePlan, null);
  const allowFeatured = limits.maxFeaturedProducts > 0;
  const nameById = new Map(categoryRows.map((c) => [c.id, c.name]));
  const products = productRows.map((p) =>
    mapPublicProduct(p, p.category_id ? nameById.get(p.category_id) ?? null : null, allowFeatured)
  );
  const pills = computePills(categoryRows, productRows);
  return { status: "ok", store: mapPublicStore(storeRow, pills, effectivePlan), products };
}
```

- [ ] **Step 6: Estender `STORE_COLS`/`PRODUCT_COLS` e chamar `get_effective_plan` via RPC em `lib/server/catalog.ts`**

`STORE_COLS` ganha as cinco colunas de tema, **sem** `plan`/`trial_ends_at`:

```ts
const STORE_COLS =
  "id, name, slug, is_active, whatsapp, accent_color, cover_url, logo_url, description, monogram, analytics_id, pixel_id, message_template, instagram, payment_methods, delivery_methods, font_pairing, background_palette, corner_style, secondary_color, grid_density";
const PRODUCT_COLS =
  "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new, is_featured";
```

Em `fetchPublicCatalog`, logo após confirmar que `storeRow` existe e está ativo (antes de buscar produtos/categorias), chamar a function via RPC:

```ts
const { data: effectivePlan, error: planError } = await supabase.rpc("get_effective_plan", {
  p_store_id: (storeRow as PublicStoreRow).id,
});
if (planError) {
  console.error(`fetchPublicCatalog(${slug}) — erro ao resolver plano efetivo:`, planError);
  throw new Error(`Falha ao buscar catálogo público: ${planError.message}`);
}
```

E repassar `(effectivePlan ?? "free") as Plan` como 4º argumento em todas as chamadas de `resolveCatalog` dentro desta função (incluindo o `return resolveCatalog(null, [], [])` do caso "loja não encontrada" — nesse caso não há RPC pra chamar; usar `"free"` diretamente). Import `type { Plan } from "@/lib/plan-limits"` no topo do arquivo.

- [ ] **Step 7: Estender `StoreRow`/`mapStore`/`ProductRow`/`mapProduct`/`getCurrentStore` em `lib/server/store.ts`**

No `type StoreRow`, após `delivery_methods: string[] | null;`:

```ts
  font_pairing: string;
  background_palette: string;
  corner_style: string;
  secondary_color: string | null;
  grid_density: string;
```

Em `mapStore`, após `deliveryMethods: row.delivery_methods ?? [],`:

```ts
    fontPairing: row.font_pairing,
    backgroundPalette: row.background_palette,
    cornerStyle: row.corner_style,
    secondaryColor: row.secondary_color,
    gridDensity: row.grid_density === "compacto" ? "compacto" : "padrao",
```

No `type ProductRow`, após `is_new: boolean;`:

```ts
  is_featured: boolean;
```

Em `mapProduct`, após `isNew: row.is_new,`:

```ts
    isFeatured: row.is_featured,
```

No SELECT de `getCurrentStore` (query autenticada do painel, via RLS de `authenticated` — não passa pelo grant restrito do `anon`), adicionar `font_pairing, background_palette, corner_style, secondary_color, grid_density`.

(A listagem de produtos do painel — `app/painel/produtos/page.tsx` — provavelmente tem sua própria query de `products`; localizar e adicionar `is_featured` ao SELECT ali também, seguindo o mesmo padrão de `mapProduct`.)

- [ ] **Step 8: Rodar os testes e confirmar que passam**

Run: `npx vitest run __tests__/catalog.test.ts __tests__/plan-limits.test.ts __tests__/theme-options.test.ts`
Expected: PASS em todos.

- [ ] **Step 9: Rodar a suíte completa e o typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: sem falhas.

- [ ] **Step 10: Commit**

```bash
git add lib/types.ts lib/catalog.ts lib/server/catalog.ts lib/server/store.ts __tests__/catalog.test.ts
git commit -m "feat: aplica gating de fonte/fundo/cantos/densidade/destaque no resolveCatalog"
```

---

### Task 6: UI do painel — seletores independentes de tema

**Files:**
- Modify: `lib/validation/painel.ts`
- Create: `components/painel/ThemeOptionsFields.tsx`
- Modify: `app/painel/personalizacao/PersonalizacaoClient.tsx`
- Modify: `app/painel/personalizacao/use-personalizacao.ts`
- Modify: `app/painel/personalizacao/page.tsx`

**Interfaces:**
- Consumes: `FONT_PAIRINGS`/`BACKGROUND_PALETTES`/`CORNER_STYLES` (Task 3); `StoreSettings.fontPairing/backgroundPalette/cornerStyle/secondaryColor/gridDensity` (Task 5); `getPlanLimits` (Task 2).
- Produces: campos de formulário `fontPairing`, `backgroundPalette`, `cornerStyle`, `secondaryColor`, `gridDensity` submetidos por `updatePersonalizacao` (consumido pela Task 7).

- [ ] **Step 1: Estender `personalizacaoSchema` em `lib/validation/painel.ts`**

```ts
export const personalizacaoSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida"),
  fontPairing: z.string().min(1),
  backgroundPalette: z.string().min(1),
  cornerStyle: z.string().min(1),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida")
    .nullable(),
  gridDensity: z.enum(["padrao", "compacto"]),
});
```

- [ ] **Step 2: Passar `getPlanLimits` para a página de Personalização**

Ler `app/painel/personalizacao/page.tsx` antes de editar. Calcular `const limits = getPlanLimits(store.plan, store.trialEndsAt);` (import de `@/lib/plan-limits`), passando `limits` como prop nova para `<PersonalizacaoClient settings={store} limits={limits} />`.

- [ ] **Step 3: Criar `components/painel/ThemeOptionsFields.tsx`**

Um seletor genérico reaproveitado 3 vezes (fonte/fundo/cantos), cada linha bloqueada independentemente pela mesma flag `themeOptions`:

```tsx
"use client";

import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_PAIRINGS, BACKGROUND_PALETTES, CORNER_STYLES } from "@/lib/theme-options";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

interface Option {
  key: string;
  label: string;
}

function OptionRow({
  label,
  options,
  value,
  onChange,
  unlocked,
  renderPreview,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  unlocked: boolean;
  renderPreview?: (key: string) => React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="font-body font-medium text-[13px] text-obsidian mb-2">{label}</div>
      <div className="flex flex-wrap gap-3">
        {options.map((opt) => {
          const isDefault = opt.key === "padrao";
          const locked = !unlocked && !isDefault;
          const selected = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={locked}
              onClick={() => !locked && onChange(opt.key)}
              className={cn(
                "flex items-center gap-2 h-11 px-4 rounded-btn border text-[13px]",
                selected
                  ? "border-obsidian bg-obsidian text-white"
                  : "border-sand bg-white text-obsidian hover:bg-surface-hover",
                locked && "opacity-50 cursor-not-allowed hover:bg-white"
              )}
            >
              {locked && <Lock size={14} />}
              {renderPreview?.(opt.key)}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ThemeOptionsFieldsProps {
  fontPairing: string;
  onFontPairingChange: (key: string) => void;
  backgroundPalette: string;
  onBackgroundPaletteChange: (key: string) => void;
  cornerStyle: string;
  onCornerStyleChange: (key: string) => void;
  unlocked: boolean;
}

export function ThemeOptionsFields({
  fontPairing,
  onFontPairingChange,
  backgroundPalette,
  onBackgroundPaletteChange,
  cornerStyle,
  onCornerStyleChange,
  unlocked,
}: ThemeOptionsFieldsProps) {
  const upgradeHref = `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá! Quero saber mais sobre desbloquear as opções de tema."
  )}`;

  return (
    <>
      <OptionRow
        label="Pareamento de fonte"
        options={FONT_PAIRINGS}
        value={fontPairing}
        onChange={onFontPairingChange}
        unlocked={unlocked}
        renderPreview={(key) => {
          const p = FONT_PAIRINGS.find((f) => f.key === key);
          return p ? (
            <span style={{ fontFamily: `var(${p.fontDisplayVar})` }}>Aa</span>
          ) : null;
        }}
      />
      <OptionRow
        label="Paleta de fundo"
        options={BACKGROUND_PALETTES}
        value={backgroundPalette}
        onChange={onBackgroundPaletteChange}
        unlocked={unlocked}
        renderPreview={(key) => {
          const p = BACKGROUND_PALETTES.find((b) => b.key === key);
          return p ? (
            <span
              className="w-4 h-4 rounded-full border border-sand inline-block"
              style={{ background: p.background }}
            />
          ) : null;
        }}
      />
      <OptionRow
        label="Formato dos cantos"
        options={CORNER_STYLES}
        value={cornerStyle}
        onChange={onCornerStyleChange}
        unlocked={unlocked}
      />
      {!unlocked && (
        <a
          href={upgradeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[13px] text-graphite underline"
        >
          Disponível no Starter — fale conosco
        </a>
      )}
    </>
  );
}
```

- [ ] **Step 4: Adicionar o card "Tema" em `PersonalizacaoClient.tsx`**

Ler o arquivo inteiro antes de editar (2 Cards existentes: Cor de destaque e Capa). Adicionar um novo `<Card>` entre eles:

```tsx
<Card>
  <h2 className="font-display font-medium text-[16px] text-obsidian mb-1">
    Tema
  </h2>
  <p className="font-body text-[13px] text-graphite mb-4">
    Fonte, fundo e formato dos cantos da vitrine — cada escolha é independente.
  </p>
  <ThemeOptionsFields
    fontPairing={f.fontPairing}
    onFontPairingChange={f.setFontPairing}
    backgroundPalette={f.backgroundPalette}
    onBackgroundPaletteChange={f.setBackgroundPalette}
    cornerStyle={f.cornerStyle}
    onCornerStyleChange={f.setCornerStyle}
    unlocked={f.limits.themeOptions}
  />

  {f.limits.advancedTheme && (
    <div className="mt-5">
      <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
        Cor secundária (opcional)
      </label>
      <input
        type="color"
        value={f.secondaryColor ?? "#000000"}
        onChange={(e) => f.setSecondaryColor(e.target.value)}
        className="h-11 w-20 rounded-btn border border-sand cursor-pointer"
      />
    </div>
  )}

  <div className="mt-5">
    <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
      Densidade do grid
    </label>
    <div className="flex gap-3">
      {(["padrao", "compacto"] as const).map((d) => (
        <button
          key={d}
          type="button"
          disabled={!f.limits.gridDensity && d !== "padrao"}
          onClick={() => f.setGridDensity(d)}
          className={cn(
            "h-11 px-4 rounded-btn border text-[13px]",
            f.gridDensity === d
              ? "border-obsidian bg-obsidian text-white"
              : "border-sand bg-white text-obsidian hover:bg-surface-hover",
            !f.limits.gridDensity && d !== "padrao" && "opacity-50 cursor-not-allowed"
          )}
        >
          {d === "padrao" ? "Padrão" : "Compacto"}
        </button>
      ))}
    </div>
  </div>
</Card>
```

Importar `ThemeOptionsFields` e `cn` no topo do arquivo, e adicionar `limits: PlanLimits` à interface de props do componente (`import type { PlanLimits } from "@/lib/plan-limits";`).

- [ ] **Step 5: Estender `use-personalizacao.ts`**

```ts
import {
  DEFAULT_FONT_PAIRING_KEY,
  DEFAULT_BACKGROUND_PALETTE_KEY,
  DEFAULT_CORNER_STYLE_KEY,
} from "@/lib/theme-options";
import type { PlanLimits } from "@/lib/plan-limits";

export function usePersonalizacao(settings: StoreSettings, limits: PlanLimits) {
  const [accent, setAccent] = useState(settings.accentColor);
  const [fontPairing, setFontPairing] = useState(
    limits.themeOptions ? settings.fontPairing : DEFAULT_FONT_PAIRING_KEY
  );
  const [backgroundPalette, setBackgroundPalette] = useState(
    limits.themeOptions ? settings.backgroundPalette : DEFAULT_BACKGROUND_PALETTE_KEY
  );
  const [cornerStyle, setCornerStyle] = useState(
    limits.themeOptions ? settings.cornerStyle : DEFAULT_CORNER_STYLE_KEY
  );
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [gridDensity, setGridDensity] = useState(
    limits.gridDensity ? settings.gridDensity : "padrao"
  );
  // ... (cover/toast/state existentes continuam iguais)

  const [state, formAction, pending] = useActionState<State, FormData>(
    async (prev, formData) => {
      formData.set("accentColor", accent);
      formData.set("fontPairing", fontPairing);
      formData.set("backgroundPalette", backgroundPalette);
      formData.set("cornerStyle", cornerStyle);
      formData.set("gridDensity", gridDensity);
      if (secondaryColor) formData.set("secondaryColor", secondaryColor);
      if (cover) formData.set("cover", cover);
      if (removeCover) formData.set("removeCover", "1");
      const res = await updatePersonalizacao(prev, formData);
      // ... (resto igual)
    },
    null
  );

  return {
    accent,
    setAccent,
    fontPairing,
    setFontPairing,
    backgroundPalette,
    setBackgroundPalette,
    cornerStyle,
    setCornerStyle,
    secondaryColor,
    setSecondaryColor,
    gridDensity,
    setGridDensity,
    limits,
    // ... (resto igual: coverPreview, coverFileName, coverUrl, setCover, clearCover, state, formAction, pending, toast)
  };
}
```

(Aplicar este diff sobre o hook completo já existente — não remover nenhum dos campos de capa/toast atuais.)

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`, abrir `/painel/personalizacao` logado com uma loja `plan = 'free'`.
Expected: as 3 linhas (fonte/fundo/cantos) mostram só a opção "padrão" habilitada, as demais com cadeado; densidade "Compacto" desabilitada; campo de cor secundária não aparece. Mudar a loja para `plan = 'pro'` no Supabase e recarregar: todas as opções desbloqueadas, e é possível escolher, por exemplo, fonte "Clássico" + fundo "Cinza claro" + cantos "Reto" ao mesmo tempo — uma combinação que não existe como preset fixo em nenhum lugar do código.

- [ ] **Step 7: Commit**

```bash
git add lib/validation/painel.ts components/painel/ThemeOptionsFields.tsx app/painel/personalizacao/
git commit -m "feat: UI de fonte, fundo, cantos, cor secundária e densidade em Personalização"
```

---

### Task 7: Server action — gravar tema/densidade com validação de plano

**Files:**
- Modify: `app/actions/store.ts`

**Interfaces:**
- Consumes: `personalizacaoSchema` (Task 6), `getPlanLimits` (Task 2), `getFontPairing`/`getBackgroundPalette`/`getCornerStyle` (Task 3).
- Produces: `updatePersonalizacao` passa a gravar `font_pairing`, `background_palette`, `corner_style`, `secondary_color`, `grid_density`, rejeitando valores fora do plano efetivo mesmo se a request for forjada.

- [ ] **Step 1: Estender `updatePersonalizacao`**

Ler `app/actions/store.ts` inteiro antes de editar. Adicionar a validação de plano logo após buscar `store` e antes do `personalizacaoSchema.safeParse`:

```ts
import { getPlanLimits } from "@/lib/plan-limits";
import {
  getFontPairing,
  getBackgroundPalette,
  getCornerStyle,
  DEFAULT_FONT_PAIRING_KEY,
  DEFAULT_BACKGROUND_PALETTE_KEY,
  DEFAULT_CORNER_STYLE_KEY,
} from "@/lib/theme-options";

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

  const limits = getPlanLimits(store.plan, store.trialEndsAt);

  const parsed = personalizacaoSchema.safeParse({
    accentColor: formData.get("accentColor"),
    fontPairing: (formData.get("fontPairing") as string) || DEFAULT_FONT_PAIRING_KEY,
    backgroundPalette: (formData.get("backgroundPalette") as string) || DEFAULT_BACKGROUND_PALETTE_KEY,
    cornerStyle: (formData.get("cornerStyle") as string) || DEFAULT_CORNER_STYLE_KEY,
    secondaryColor: (formData.get("secondaryColor") as string) || null,
    gridDensity: (formData.get("gridDensity") as string) || "padrao",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Revalida no servidor — a UI já bloqueia isso, mas a fonte de verdade é aqui.
  // Cada eixo é validado de forma independente.
  const fontPairing = limits.themeOptions
    ? getFontPairing(parsed.data.fontPairing).key
    : DEFAULT_FONT_PAIRING_KEY;
  const backgroundPalette = limits.themeOptions
    ? getBackgroundPalette(parsed.data.backgroundPalette).key
    : DEFAULT_BACKGROUND_PALETTE_KEY;
  const cornerStyle = limits.themeOptions
    ? getCornerStyle(parsed.data.cornerStyle).key
    : DEFAULT_CORNER_STYLE_KEY;
  const secondaryColor = limits.advancedTheme ? parsed.data.secondaryColor : null;
  const gridDensity = limits.gridDensity ? parsed.data.gridDensity : "padrao";

  // ... (lógica de coverUrl existente continua igual)

  const { error } = await supabase
    .from("stores")
    .update({
      accent_color: parsed.data.accentColor,
      cover_url: coverUrl,
      font_pairing: fontPairing,
      background_palette: backgroundPalette,
      corner_style: cornerStyle,
      secondary_color: secondaryColor,
      grid_density: gridDensity,
    })
    .eq("id", store.id);

  // ... (resto da função continua igual: remoção de capa antiga, revalidate, return)
}
```

- [ ] **Step 2: Verificação manual do bloqueio no servidor**

Com uma loja `plan = 'free'`, forçar `fontPairing=editorial` na request (fora da UI). Recarregar `/painel/personalizacao` depois de salvar.
Expected: o valor gravado em `font_pairing` no Supabase continua `'padrao'`.

- [ ] **Step 3: Commit**

```bash
git add app/actions/store.ts
git commit -m "feat: valida plano no servidor ao salvar fonte/fundo/cantos/densidade"
```

---

### Task 8: Toggle "Destacar na vitrine" nos produtos

**Files:**
- Modify: `app/actions/produtos.ts`
- Modify: `app/painel/produtos/use-produtos.ts`
- Modify: `app/painel/produtos/ProdutosClient.tsx`

**Interfaces:**
- Consumes: `getPlanLimits` (Task 2), `StoreProduct.isFeatured` (Task 5).
- Produces: `toggleProductFeatured(prevState, formData): Promise<ToggleActionState>`, consumido pela UI desta mesma task.

- [ ] **Step 1: Adicionar `toggleProductFeatured` em `app/actions/produtos.ts`**

Ler o arquivo inteiro antes de editar (`toggleProductActive` é o modelo direto). Adicionar logo após `toggleProductActive`:

```ts
export async function toggleProductFeatured(
  prevState: ToggleActionState,
  formData: FormData
): Promise<ToggleActionState> {
  const id = formData.get("id");
  const next = formData.get("isFeatured") === "true";
  if (typeof id !== "string") return { error: "Produto inválido." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const store = await getCurrentStore();
  if (!store) return { error: "Loja não encontrada." };

  const limits = getPlanLimits(store.plan, store.trialEndsAt);

  if (next) {
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("is_featured", true);
    if ((count ?? 0) >= limits.maxFeaturedProducts) {
      return {
        error: "Limite de produtos em destaque do seu plano atingido. Fale conosco para aumentar o limite.",
      };
    }
  }

  const { error } = await supabase
    .from("products")
    .update({ is_featured: next })
    .eq("id", id)
    .eq("store_id", store.id);

  if (error) return { error: "Erro ao atualizar destaque." };

  revalidatePath("/painel/produtos");
  revalidateTag(`catalog-${store.slug}`, { expire: 0 });
  return { ok: true };
}
```

- [ ] **Step 2: Estender `use-produtos.ts` com `toggleFeatured`**

Ler o hook inteiro antes de editar (`toggleActive` é o modelo direto). Adicionar:

```ts
import {
  toggleProductActive,
  toggleProductFeatured,
  deleteProduct,
} from "@/app/actions/produtos";

// dentro de useProdutos, ao lado de toggleActive:
const toggleFeatured = (product: StoreProduct) => {
  startTransition(async () => {
    const fd = new FormData();
    fd.set("id", product.id);
    fd.set("isFeatured", String(!product.isFeatured));
    const res = await toggleProductFeatured(null, fd);
    if (res && "error" in res) flash(res.error, "error");
  });
};

// incluir toggleFeatured no objeto retornado pelo hook
```

- [ ] **Step 3: Adicionar o toggle de estrela em `ProdutosClient.tsx`**

Ler o arquivo inteiro antes de editar (`VisibilityToggle` ao lado de `StockLabel` é o padrão a seguir). Importar `Star` de `lucide-react` e `toggleFeatured` do hook. Adicionar, ao lado de cada `VisibilityToggle` (tanto no card mobile quanto na linha desktop):

```tsx
<button
  type="button"
  onClick={() => toggleFeatured(p)}
  aria-label={p.isFeatured ? "Remover destaque" : "Destacar na vitrine"}
  className={cn(
    "h-8 w-8 flex items-center justify-center rounded-btn border",
    p.isFeatured
      ? "border-gold bg-gold/10 text-gold"
      : "border-sand text-graphite hover:bg-surface-hover"
  )}
>
  <Star size={16} fill={p.isFeatured ? "currentColor" : "none"} />
</button>
```

Desestruturar `toggleFeatured` do retorno de `useProdutos(...)` junto com `toggleActive`.

- [ ] **Step 4: Verificação manual**

Run: `npm run dev`, abrir `/painel/produtos` com uma loja `plan = 'starter'`.
Expected: marcar estrela em 3 produtos funciona; no 4º produto, a action retorna erro "Limite de produtos em destaque do seu plano atingido..." exibido via Toast.

- [ ] **Step 5: Commit**

```bash
git add app/actions/produtos.ts app/painel/produtos/use-produtos.ts app/painel/produtos/ProdutosClient.tsx
git commit -m "feat: toggle de produto em destaque com limite por plano"
```

---

### Task 9: Renderização no catálogo público — tema, densidade e seção Destaques

**Files:**
- Create: `components/catalogo/FeaturedRail.tsx`
- Modify: `app/[slug]/CatalogoClient.tsx`

**Interfaces:**
- Consumes: `Store.theme`/`Store.gridDensity` (Task 5), `Product.isFeatured` (Task 5). Depende da Task 4 (Tailwind ligado às CSS vars) para que `bg-ivory`/`bg-linen`/`border-sand`/`rounded-card`/`rounded-btn` respondam ao override.

- [ ] **Step 1: Criar `components/catalogo/FeaturedRail.tsx`**

```tsx
"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/catalogo/ProductCard";

interface FeaturedRailProps {
  products: Product[];
  onOpen: (product: Product) => void;
}

export function FeaturedRail({ products, onOpen }: FeaturedRailProps) {
  const featured = products.filter((p) => p.isFeatured && p.active);
  if (featured.length === 0) return null;

  return (
    <div className="pt-4 pb-2">
      <h2 className="font-display font-medium text-[16px] text-obsidian px-4 mb-3">
        Destaques
      </h2>
      <div className="flex gap-4 px-4 pb-2 overflow-x-auto no-scrollbar">
        {featured.map((product) => (
          <div key={product.id} className="w-[160px] flex-shrink-0">
            <ProductCard product={product} onOpen={onOpen} priority={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Aplicar tema/densidade e inserir `FeaturedRail` em `CatalogoClient.tsx`**

Ler o arquivo inteiro antes de editar. Substituir a definição de `accentStyle` (linha ~55) por um `themeStyle` que remapeia fundo, superfície, borda, raio de cantos, fontes e cor secundária:

```tsx
const themeStyle = {
  "--color-primary": store.accentColor,
  "--color-bg": store.theme.backgroundColor,
  "--color-surface": store.theme.surfaceColor,
  "--color-border": store.theme.borderColor,
  "--radius-card": store.theme.cardRadius,
  "--radius-btn": store.theme.btnRadius,
  "--font-sora": `var(${store.theme.fontDisplayVar})`,
  "--font-dm-sans": `var(${store.theme.fontBodyVar})`,
  ...(store.theme.secondaryColor ? { "--color-secondary": store.theme.secondaryColor } : {}),
} as React.CSSProperties;
```

Substituir as duas ocorrências de `style={accentStyle}` (linha ~89 e ~107) por `style={themeStyle}`. Onde o nome da loja é renderizado (dentro de `StoreHeader`, ou no próprio topo se for renderizado aqui), aplicar `textTransform: store.theme.titleTransform, letterSpacing: store.theme.titleLetterSpacing` via `style` — checar se `StoreHeader.tsx` já aceita algum jeito de passar isso ou se precisa de uma prop nova `titleStyle`.

Inserir `<FeaturedRail products={products} onOpen={setOpenProduct} />` logo depois do bloco de pills de categoria e antes do bloco `{visibleProducts.length === 0 ? ...}`.

Trocar a classe fixa do grid (linha ~153):

```tsx
<div
  className={cn(
    "grid gap-4 px-4 pb-8 pt-1",
    store.gridDensity === "compacto"
      ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
  )}
>
```

Importar `cn` de `@/lib/utils` e `FeaturedRail` de `@/components/catalogo/FeaturedRail` no topo do arquivo.

- [ ] **Step 3: Verificação manual (checklist)**

Run: `npm run dev`, abrir `/{slug}` de uma loja de teste.
Expected:
1. Loja `plan = 'free'` com `font_pairing = 'editorial'`, `background_palette = 'areia'`, `corner_style = 'arredondado'` salvos no banco (via SQL direto) renderiza exatamente como hoje — os três eixos são ignorados.
2. Mesma loja mudada para `plan = 'pro'`: título em Playfair/Fraunces (conforme escolhido), fundo areia, cantos arredondados nos cards e botões — tudo ao mesmo tempo.
3. Testar uma segunda loja Pro com fonte "Clássico" + fundo "Cinza claro" + cantos "Reto": o resultado não deve se parecer com a loja do passo 2, mesmo as duas sendo Pro.
4. Loja Pro com 2 produtos marcados como destaque: seção "Destaques" aparece entre os filtros de categoria e o grid, com scroll horizontal.
5. Loja sem nenhum produto em destaque: seção "Destaques" não aparece.
6. Alternar `grid_density` entre `padrao`/`compacto` muda visivelmente o número de colunas.

- [ ] **Step 4: Rodar a suíte completa**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS — nenhuma regressão nos testes existentes de catálogo/produtos.

- [ ] **Step 5: Commit**

```bash
git add components/catalogo/FeaturedRail.tsx "app/[slug]/CatalogoClient.tsx"
git commit -m "feat: aplica fonte/fundo/cantos/densidade e seção de destaques no catálogo público"
```

---

### Task 10: Atualizar a landing page com os novos diferenciais

**Files:**
- Modify: `app/landing/data.tsx`

**Interfaces:**
- Nenhuma — só texto estático consumido por `app/page.tsx` (já existente, não muda).

- [ ] **Step 1: Adicionar as linhas em `starterFeatures` e `proFeatures`**

Ler `app/landing/data.tsx` linhas 106-122 antes de editar. Fonte/fundo/cantos/destaques/densidade são liberados igual em Starter e Pro; cor secundária é só Pro:

```ts
export const starterFeatures = [
  "Até 30 produtos",
  "5 categorias",
  "3 fotos por produto",
  "Temas, fundos e formatos personalizáveis",
];

export const proFeatures = [
  "Produtos ilimitados",
  "Categorias ilimitadas",
  "5 fotos por produto",
  "Temas, fundos e formatos personalizáveis",
  "Cor secundária exclusiva",
];
```

Se outro plano deste pacote (domínio ou CSV) já tiver adicionado uma linha a `proFeatures` antes deste, **adicionar a linha nova junto às existentes**, não sobrescrever o array.

- [ ] **Step 2: Verificação manual**

Run: `npm run dev`, abrir `/` e rolar até a seção "Planos".
Expected: os cards Starter e Pro listam "Temas, fundos e formatos personalizáveis"; o card Pro lista também "Cor secundária exclusiva".

- [ ] **Step 3: Commit**

```bash
git add app/landing/data.tsx
git commit -m "feat: adiciona personalização visual às features de Starter/Pro na landing"
```

---

## Self-Review

**Cobertura da spec (§3, §4, §5.1, §5.2, §6, §8 de `2026-07-25-diferenciacao-planos-design.md`, revisado para 3 eixos independentes conforme conversa de brainstorming):**
- §3.1/§3.2 (colunas + grants) → Task 1.
- §3.3 (plano efetivo no catálogo público sem reabrir o achado MEDIA-03) → Task 1 (função `get_effective_plan`) e Task 5 (consumo via RPC).
- §4 (extensão de `PlanLimits`) → Task 2.
- Reestruturação em 3 eixos independentes (fonte/fundo/cantos, decidida durante a revisão visual com o usuário) → Tasks 3 e 4.
- §5.1 (seletores de tema + densidade no painel) → Task 6.
- §5.2 (toggle de destaque) → Task 8.
- §6 (tema/densidade/Destaques no catálogo público + roteamento de domínio) → Tasks 5 e 9 cobrem tema/densidade/destaques; roteamento de domínio fica no plano `2026-07-25-dominio-proprio.md`.
- §8 (validação no servidor) → Tasks 7 e 8 revalidam plano no server action, não só na UI.
- Landing page (gap identificado depois da spec original) → Task 10.
- Carência de 3 dias (§8 da spec) e curadoria visual definitiva das opções — fora deste plano; a Task 3 já entrega uma curadoria concreta e testada, suficiente para não bloquear a implementação.

**Checagem de tipos:** `ResolvedTheme` (Task 3) é o mesmo tipo em `lib/theme-options.ts`, `lib/types.ts` (`Store.theme`) e `lib/catalog.ts` (`mapPublicStore`). `PlanLimits` (Task 2) é consumido com os mesmos nomes de campo (`maxFeaturedProducts`, `themeOptions`, `advancedTheme`, `gridDensity`) em todas as tasks seguintes. A assinatura de `resolveCatalog`/`mapPublicStore` (Task 5) ganha `effectivePlan: Plan` de forma consistente em todos os call sites.

**Segurança:** verificado contra `docs/superpowers/specs/2026-07-06-remediacao-seguranca-design.md` (achado MEDIA-03) — nenhuma task reabre o grant de `plan`/`trial_ends_at` para `anon`; o gating usa exclusivamente a função `security definer` da Task 1.

**Placeholders:** nenhum "TBD" — os 5 pareamentos de fonte, 4 paletas de fundo e 3 formatos de cantos da Task 3 são uma curadoria concreta e testada; refinar os valores exatos depois é mudança de conteúdo em `lib/theme-options.ts`, não uma lacuna de arquitetura.

---

Plano completo e salvo em `docs/superpowers/plans/2026-07-25-personalizacao-visual-avancada.md`.
