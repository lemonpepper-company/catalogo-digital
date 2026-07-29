# Ajustes de personalização, upsell e polimento de UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 7 ajustes de `docs/superpowers/specs/2026-07-29-ajustes-personalizacao-e-polimento-design.md` — unificar avisos de upsell, adicionar tooltips em campos bloqueados por plano, corrigir o preview de WhatsApp, mover a cor secundária de card, aplicar blur no modal de produto e adicionar link de suporte.

**Architecture:** Dois componentes novos e reutilizáveis (`UpsellHint`, `Tooltip`) nascem primeiro; as demais tarefas são edições pontuais e independentes em telas existentes do painel (`Personalização`, `Configurações`, `Categorias`, `Sidebar`) e do catálogo público (`CatalogoClient`), cada uma consumindo os componentes novos onde fizer sentido. Nenhuma migration de banco é necessária — todas as colunas usadas (`secondary_color`, `payment_methods`, `delivery_methods`, `message_template`) já existem.

**Tech Stack:** Next.js 16 (App Router) + React 19, Tailwind CSS (sem Radix/shadcn — componentes de UI são escritos à mão), Vitest + Testing Library para testes.

## Global Constraints

- Nenhuma dependência nova — `Tooltip` e `UpsellHint` são Tailwind puro, no padrão já usado em todo `components/ui/` e `components/painel/`.
- Não alterar `lib/plan-limits.ts` nem o comportamento de nenhum plano — só a comunicação visual de bloqueio.
- Nenhuma mudança de schema/coluna do Supabase neste plano — todas as colunas usadas já existem e já têm GRANT.
- Badges de produto (`components/ui/Badge.tsx`) e o `MobileTabBar` ficam fora de escopo — não tocar.
- Testes com Vitest (`npx vitest run <arquivo>`), seguindo as convenções já usadas em `__tests__/` (mocks de `@/app/actions/*`, `render`/`screen` do Testing Library, `toBeDisabled`/`toHaveTextContent` do jest-dom).
- Commits frequentes, um por tarefa.

---

### Task 1: Componente `UpsellHint`

**Files:**
- Create: `components/painel/UpsellHint.tsx`
- Test: `__tests__/UpsellHint.test.tsx`

**Interfaces:**
- Consumes: `VTRINE_WHATSAPP_NUMBER` de `@/lib/contact`.
- Produces: `UpsellHint({ label: string; whatsappMessage: string }): JSX.Element`, exportado de `@/components/painel/UpsellHint`. Renderiza um único `<a>` com `role="link"`, texto = `label`, `href` = `https://wa.me/{VTRINE_WHATSAPP_NUMBER}?text={encodeURIComponent(whatsappMessage)}`, `target="_blank"`, `rel="noopener noreferrer"`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `__tests__/UpsellHint.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpsellHint } from "@/components/painel/UpsellHint";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

describe("UpsellHint", () => {
  it("renderiza o texto informado como link", () => {
    render(
      <UpsellHint
        label="Disponível no Starter — fale conosco"
        whatsappMessage="Olá! Quero saber mais."
      />
    );
    expect(
      screen.getByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeTruthy();
  });

  it("aponta para o WhatsApp da Vtrine com a mensagem informada", () => {
    render(
      <UpsellHint
        label="Disponível no Pro — fale conosco"
        whatsappMessage="Olá! Quero saber mais sobre a cor secundária."
      />
    );
    const link = screen.getByRole("link", { name: "Disponível no Pro — fale conosco" });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Quero saber mais sobre a cor secundária."
      )}`
    );
  });

  it("abre em nova aba com segurança", () => {
    render(<UpsellHint label="Disponível no Starter — fale conosco" whatsappMessage="Oi" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/UpsellHint.test.tsx`
Expected: FAIL — `Cannot find module '@/components/painel/UpsellHint'`

- [ ] **Step 3: Implementar**

Criar `components/painel/UpsellHint.tsx`:

```tsx
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

interface UpsellHintProps {
  label: string;
  whatsappMessage: string;
}

export function UpsellHint({ label, whatsappMessage }: UpsellHintProps) {
  const href = `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    whatsappMessage
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-body text-[13px] text-graphite underline"
    >
      {label}
    </a>
  );
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/UpsellHint.test.tsx`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add components/painel/UpsellHint.tsx __tests__/UpsellHint.test.tsx
git commit -m "feat: adiciona componente UpsellHint reutilizável"
```

---

### Task 2: Componente `Tooltip`

**Files:**
- Create: `components/ui/Tooltip.tsx`
- Test: `__tests__/Tooltip.test.tsx`

**Interfaces:**
- Consumes: nada (componente puro).
- Produces: `Tooltip({ label: string; children: React.ReactNode }): JSX.Element`, exportado de `@/components/ui/Tooltip`. Envolve `children` num wrapper `group relative`; renderiza um balão com `role="tooltip"` e texto `label`, sempre presente no DOM, revelado por CSS (`opacity-0 group-hover:opacity-100`) no hover do wrapper.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `__tests__/Tooltip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tooltip } from "@/components/ui/Tooltip";

describe("Tooltip", () => {
  it("renderiza o conteúdo filho normalmente", () => {
    render(
      <Tooltip label="Disponível no Starter">
        <button>Fonte editorial</button>
      </Tooltip>
    );
    expect(screen.getByRole("button", { name: "Fonte editorial" })).toBeTruthy();
  });

  it("inclui o texto do tooltip no DOM, com role='tooltip'", () => {
    render(
      <Tooltip label="Disponível no Pro">
        <button>Cor secundária</button>
      </Tooltip>
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Disponível no Pro");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/Tooltip.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ui/Tooltip'`

- [ ] **Step 3: Implementar**

Criar `components/ui/Tooltip.tsx`:

```tsx
interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="inline-flex group relative">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-[6px] bg-obsidian px-2.5 py-1.5 font-body text-[12px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-10"
      >
        {label}
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/Tooltip.test.tsx`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add components/ui/Tooltip.tsx __tests__/Tooltip.test.tsx
git commit -m "feat: adiciona componente Tooltip reutilizável"
```

---

### Task 3: `ThemeOptionsFields` — usar `UpsellHint` e `Tooltip`

**Files:**
- Modify: `components/painel/ThemeOptionsFields.tsx`
- Test: `__tests__/ThemeOptionsFields.test.tsx` (novo)

**Interfaces:**
- Consumes: `UpsellHint` de `@/components/painel/UpsellHint` (Task 1); `Tooltip` de `@/components/ui/Tooltip` (Task 2).
- Produces: nenhuma mudança na prop pública de `ThemeOptionsFields` (mesmas props de hoje: `fontPairing`, `onFontPairingChange`, `backgroundPalette`, `onBackgroundPaletteChange`, `cornerStyle`, `onCornerStyleChange`, `unlocked`).

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `__tests__/ThemeOptionsFields.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeOptionsFields } from "@/components/painel/ThemeOptionsFields";

function setup(unlocked: boolean) {
  return render(
    <ThemeOptionsFields
      fontPairing="padrao"
      onFontPairingChange={vi.fn()}
      backgroundPalette="padrao"
      onBackgroundPaletteChange={vi.fn()}
      cornerStyle="padrao"
      onCornerStyleChange={vi.fn()}
      unlocked={unlocked}
    />
  );
}

describe("ThemeOptionsFields — bloqueio por plano", () => {
  it("mostra tooltip 'Disponível no Starter' nas opções bloqueadas", () => {
    setup(false);
    const tooltips = screen.getAllByRole("tooltip");
    expect(tooltips.length).toBeGreaterThan(0);
    tooltips.forEach((t) => expect(t).toHaveTextContent("Disponível no Starter"));
  });

  it("mostra o aviso de upsell quando bloqueado", () => {
    setup(false);
    expect(
      screen.getByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeTruthy();
  });

  it("não mostra tooltip nem aviso de upsell quando desbloqueado", () => {
    setup(true);
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Disponível no Starter — fale conosco" })
    ).toBeNull();
  });

  it("mantém a opção padrão do pareamento de fonte sempre clicável, mesmo bloqueado", () => {
    setup(false);
    expect(screen.getByRole("button", { name: "Padrão" })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/ThemeOptionsFields.test.tsx`
Expected: FAIL — nenhum elemento com `role="tooltip"` existe ainda

- [ ] **Step 3: Implementar**

Substituir todo o conteúdo de `components/painel/ThemeOptionsFields.tsx`:

```tsx
"use client";

import { Fragment } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_PAIRINGS, BACKGROUND_PALETTES, CORNER_STYLES } from "@/lib/theme-options";
import { Tooltip } from "@/components/ui/Tooltip";
import { UpsellHint } from "@/components/painel/UpsellHint";

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
          const button = (
            <button
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
          return locked ? (
            <Tooltip key={opt.key} label="Disponível no Starter">
              {button}
            </Tooltip>
          ) : (
            <Fragment key={opt.key}>{button}</Fragment>
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
        <UpsellHint
          label="Disponível no Starter — fale conosco"
          whatsappMessage="Olá! Quero saber mais sobre desbloquear as opções de tema."
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/ThemeOptionsFields.test.tsx`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add components/painel/ThemeOptionsFields.tsx __tests__/ThemeOptionsFields.test.tsx
git commit -m "refactor: ThemeOptionsFields usa UpsellHint e Tooltip"
```

---

### Task 4: `PersonalizacaoClient` — mover cor secundária e corrigir bloqueio

**Files:**
- Modify: `app/painel/personalizacao/PersonalizacaoClient.tsx`
- Test: `__tests__/PersonalizacaoClient.test.tsx` (novo)

**Interfaces:**
- Consumes: `UpsellHint` (Task 1), `Tooltip` (Task 2), `SECONDARY_COLOR_OPTIONS` de `@/lib/data` (já existente), `f.limits.advancedTheme` / `f.limits.gridDensity` de `usePersonalizacao` (já existente, sem mudança de assinatura).
- Produces: nenhuma mudança na prop pública de `PersonalizacaoClient`.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `__tests__/PersonalizacaoClient.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PersonalizacaoClient } from "@/app/painel/personalizacao/PersonalizacaoClient";
import { getPlanLimits } from "@/lib/plan-limits";
import type { StoreSettings } from "@/lib/types";

vi.mock("@/app/actions/store", () => ({
  updatePersonalizacao: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/image-compress", () => ({
  compressImage: vi.fn(async (f: File) => f),
}));

function makeSettings(): StoreSettings {
  return {
    id: "store1",
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan: "free",
    trialEndsAt: null,
    whatsapp: "5511999990000",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: null,
    analyticsId: null,
    pixelId: null,
    messageTemplate: null,
    instagram: null,
    paymentMethods: [],
    deliveryMethods: [],
    fontPairing: "padrao",
    backgroundPalette: "padrao",
    cornerStyle: "padrao",
    secondaryColor: null,
    gridDensity: "padrao",
    customDomain: null,
    customDomainVerified: false,
  };
}

describe("PersonalizacaoClient — localização do card de cor secundária", () => {
  it("aparece dentro do card 'Cor de destaque'", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("pro", null)} />
    );
    const card = screen.getByText("Cor de destaque").closest(".rounded-card") as HTMLElement;
    expect(within(card).getByText(/Cor secundária/)).toBeTruthy();
  });

  it("não aparece mais dentro do card 'Tema'", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("pro", null)} />
    );
    const card = screen.getByText("Tema").closest(".rounded-card") as HTMLElement;
    expect(within(card).queryByText(/Cor secundária/)).toBeNull();
  });
});

describe("PersonalizacaoClient — cor secundária bloqueada (Free/Starter)", () => {
  it("swatches ficam desabilitados com tooltip 'Disponível no Pro'", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("starter", null)} />
    );
    const swatch = screen.getByRole("button", { name: "#1F2D5A" });
    expect(swatch).toBeDisabled();
    const tooltips = screen.getAllByRole("tooltip");
    expect(tooltips.some((t) => t.textContent === "Disponível no Pro")).toBe(true);
  });

  it("mostra o aviso 'Disponível no Pro' mesmo no plano Starter (antes não mostrava nada)", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("starter", null)} />
    );
    expect(
      screen.getByRole("link", { name: "Disponível no Pro — fale conosco" })
    ).toBeTruthy();
  });

  it("mostra o mesmo aviso no plano Free", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("free", null)} />
    );
    expect(
      screen.getByRole("link", { name: "Disponível no Pro — fale conosco" })
    ).toBeTruthy();
  });
});

describe("PersonalizacaoClient — cor secundária liberada (Pro)", () => {
  it("swatches ficam interativos, sem tooltip nem aviso de upsell", () => {
    render(
      <PersonalizacaoClient settings={makeSettings()} limits={getPlanLimits("pro", null)} />
    );
    const swatch = screen.getByRole("button", { name: "#1F2D5A" });
    expect(swatch).not.toBeDisabled();
    expect(
      screen.queryByRole("link", { name: "Disponível no Pro — fale conosco" })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/PersonalizacaoClient.test.tsx`
Expected: FAIL — cor secundária ainda dentro do card "Tema", sem tooltip/upsell no Starter

- [ ] **Step 3: Implementar**

Editar `app/painel/personalizacao/PersonalizacaoClient.tsx`. Adicionar imports:

```tsx
import { Fragment } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { UpsellHint } from "@/components/painel/UpsellHint";
```

Substituir o card "Cor de destaque" (linhas 31-39 do arquivo atual) por:

```tsx
<Card>
  <h2 className="font-display font-medium text-[16px] text-obsidian mb-4">
    Cor de destaque{" "}
    <span className="text-graphite font-normal">
      · aplicada nos botões primários e pills ativos
    </span>
  </h2>
  <CorDestaqueFields accent={f.accent} onAccentChange={f.setAccent} />

  <div className="mt-5 pt-5 border-t border-sand/50">
    <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
      Cor secundária (opcional){" "}
      <span className="text-graphite font-normal">
        · aplicada na categoria selecionada
      </span>
    </label>
    <div className="flex items-center gap-3 flex-wrap">
      {SECONDARY_COLOR_OPTIONS.map((c) => {
        const locked = !f.limits.advancedTheme;
        const button = (
          <button
            type="button"
            disabled={locked}
            onClick={() => !locked && f.setSecondaryColor(c)}
            aria-label={c}
            className={cn(
              "w-10 h-10 rounded-full transition-all duration-200",
              locked && "opacity-50 cursor-not-allowed"
            )}
            style={{
              background: c,
              border:
                f.secondaryColor === c
                  ? "2px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
              outline: f.secondaryColor === c ? "2px solid var(--color-bg)" : "none",
              outlineOffset: f.secondaryColor === c ? "-4px" : "0",
              boxSizing: "border-box",
            }}
          />
        );
        return locked ? (
          <Tooltip key={c} label="Disponível no Pro">
            {button}
          </Tooltip>
        ) : (
          <Fragment key={c}>{button}</Fragment>
        );
      })}
    </div>
    {!f.limits.advancedTheme && (
      <div className="mt-2">
        <UpsellHint
          label="Disponível no Pro — fale conosco"
          whatsappMessage="Olá! Quero saber mais sobre desbloquear a cor secundária."
        />
      </div>
    )}
  </div>
</Card>
```

Remover inteiramente o bloco de cor secundária que hoje fica dentro do card "Tema" (linhas 58-88 do arquivo atual — o `{f.limits.advancedTheme && (...)}`). O card "Tema" fica só com `ThemeOptionsFields` e a densidade do grid.

Na densidade do grid (dentro do card "Tema"), trocar o `.map` para envolver o botão bloqueado em `Tooltip`:

```tsx
<div className="mt-5">
  <label className="font-body font-medium text-[13px] text-obsidian block mb-2">
    Densidade do grid
  </label>
  <div className="flex gap-3">
    {(["padrao", "compacto"] as const).map((d) => {
      const locked = !f.limits.gridDensity && d !== "padrao";
      const button = (
        <button
          type="button"
          disabled={locked}
          onClick={() => f.setGridDensity(d)}
          className={cn(
            "h-11 px-4 rounded-btn border text-[13px]",
            f.gridDensity === d
              ? "border-obsidian bg-obsidian text-white"
              : "border-sand bg-white text-obsidian hover:bg-surface-hover",
            locked && "opacity-50 cursor-not-allowed"
          )}
        >
          {d === "padrao" ? "Padrão" : "Compacto"}
        </button>
      );
      return locked ? (
        <Tooltip key={d} label="Disponível no Starter">
          {button}
        </Tooltip>
      ) : (
        <Fragment key={d}>{button}</Fragment>
      );
    })}
  </div>
</div>
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/PersonalizacaoClient.test.tsx`
Expected: PASS (6 testes)

Run também: `npx vitest run __tests__/ThemeOptionsFields.test.tsx __tests__/UpsellHint.test.tsx __tests__/Tooltip.test.tsx`
Expected: PASS (sem regressão)

- [ ] **Step 5: Commit**

```bash
git add app/painel/personalizacao/PersonalizacaoClient.tsx __tests__/PersonalizacaoClient.test.tsx
git commit -m "fix: move cor secundária para o card de cor de destaque e corrige aviso de bloqueio"
```

---

### Task 5: Corrigir preview do template de WhatsApp

**Files:**
- Modify: `lib/utils.ts:58-60` (exportar `collapseBlankLines`)
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`
- Test: `__tests__/ConfiguracoesMensagem.test.tsx` (estender)

**Interfaces:**
- Consumes: `formatPaymentLine`, `formatDeliveryLine` (já existentes e exportadas em `lib/utils.ts`); `f.paymentMethods: string[]` e `f.deliveryMethods: string[]` (já expostos por `useConfiguracoes`, vêm de `useLojaFields`).
- Produces: `collapseBlankLines(message: string): string`, agora exportada de `@/lib/utils`.

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar ao final de `__tests__/ConfiguracoesMensagem.test.tsx` (antes do `});` final do `describe` existente, como um novo `describe`):

```tsx
describe("Configurações — preview do WhatsApp reflete pagamento/entrega reais", () => {
  it("não deixa linha vazia no preview quando pagamento e entrega não estão configurados", () => {
    render(<ConfiguracoesClient settings={makeSettings(null)} limits={proLimits} />);

    const preview = document.querySelector(
      ".bg-linen.border.border-sand\\/50.rounded-card.p-4"
    ) as HTMLElement;
    expect(preview.textContent).not.toMatch(/\n{3,}/);
  });

  it("mostra a forma de pagamento real quando configurada", () => {
    const settings = { ...makeSettings(null), paymentMethods: ["pix"] };
    render(<ConfiguracoesClient settings={settings} limits={proLimits} />);

    expect(screen.getByText(/Forma de pagamento: Pix/)).toBeTruthy();
  });

  it("mostra a forma de entrega real quando configurada", () => {
    const settings = { ...makeSettings(null), deliveryMethods: ["retirada"] };
    render(<ConfiguracoesClient settings={settings} limits={proLimits} />);

    expect(screen.getByText(/Entrega: Retirar no local/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/ConfiguracoesMensagem.test.tsx`
Expected: FAIL na 1ª asserção nova — `MSG_MOCK` sempre injeta "Forma de pagamento: Pix"/"Entrega: Retirar no local" fixos, sem colapsar linhas em branco reais

- [ ] **Step 3: Implementar**

Em `lib/utils.ts`, exportar a função (linha 58):

```ts
export function collapseBlankLines(message: string): string {
  return message.replace(/\n{3,}/g, "\n\n").trim();
}
```

Em `app/painel/configuracoes/ConfiguracoesClient.tsx`, trocar o import e a lógica de preview:

```tsx
import { formatPaymentLine, formatDeliveryLine, collapseBlankLines } from "@/lib/utils";
```

Substituir `MSG_MOCK` e `renderTemplate` por:

```tsx
const MSG_MOCK = {
  saudacao: "Olá! Gostaria de fazer um pedido:",
  nome: "Cliente: Ana",
  pedido: "Pedido: A1B2C3",
  itens:
    "01. Produto Exemplo\n    Quantidade: 2x | Valor unitário: R$ 50,00\n    Tamanho: M\n    Cor: Preto\n    Subtotal: R$ 100,00",
  total: "R$ 100,00",
};

function renderTemplate(
  tpl: string,
  paymentMethods: string[],
  deliveryMethods: string[]
) {
  const pagamento = formatPaymentLine(paymentMethods[0] ?? null);
  const entrega = formatDeliveryLine(deliveryMethods[0] ?? null, null);
  const rendered = tpl
    .replace(/\{saudacao\}/g, MSG_MOCK.saudacao)
    .replace(/\{nome\}/g, MSG_MOCK.nome)
    .replace(/\{pedido\}/g, MSG_MOCK.pedido)
    .replace(/\{itens\}/g, MSG_MOCK.itens)
    .replace(/\{total\}/g, MSG_MOCK.total)
    .replace(/\{pagamento\}/g, pagamento)
    .replace(/\{entrega\}/g, entrega);
  return collapseBlankLines(rendered);
}
```

Atualizar a chamada no JSX (dentro do card "Mensagem do pedido"):

```tsx
<WhatsPreviewText text={renderTemplate(f.msgTpl, f.paymentMethods, f.deliveryMethods)} />
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/ConfiguracoesMensagem.test.tsx __tests__/ConfiguracoesClient.test.tsx __tests__/utils.test.ts`
Expected: PASS em todos (sem regressão nos testes existentes de `{nome}`/`{pedido}` e de `lib/utils.ts`)

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts app/painel/configuracoes/ConfiguracoesClient.tsx __tests__/ConfiguracoesMensagem.test.tsx
git commit -m "fix: preview da mensagem de WhatsApp reflete pagamento/entrega reais da loja"
```

---

### Task 6: Link de suporte no final da página de Configurações (mobile)

**Files:**
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`
- Test: `__tests__/ConfiguracoesClient.test.tsx` (estender)

**Interfaces:**
- Consumes: `VTRINE_WHATSAPP_NUMBER` de `@/lib/contact`.
- Produces: nenhuma mudança de props.

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `__tests__/ConfiguracoesClient.test.tsx`:

```tsx
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

describe("ConfiguracoesClient — link de suporte", () => {
  it("mostra um link de suporte no final da página", () => {
    render(<ConfiguracoesClient settings={baseSettings} limits={proLimits} />);
    const link = screen.getByRole("link", { name: /suporte/i });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Preciso de suporte com minha loja na Vtrine Digital."
      )}`
    );
  });
});
```

(Adicionar o `import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";` no topo do arquivo, junto aos demais imports.)

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: FAIL — nenhum link com nome "suporte" existe ainda

- [ ] **Step 3: Implementar**

Em `app/painel/configuracoes/ConfiguracoesClient.tsx`, adicionar ao final do JSX retornado, depois do `<form action={dominio.formAction}>...</form>` e antes do `</div>` que fecha o container raiz:

```tsx
<div className="pb-6 flex justify-center">
  <a
    href={`https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
      "Olá! Preciso de suporte com minha loja na Vtrine Digital."
    )}`}
    target="_blank"
    rel="noopener noreferrer"
    className="font-body text-[13px] text-graphite underline"
  >
    Precisa de ajuda? Fale com o suporte
  </a>
</div>
```

Adicionar o import `VTRINE_WHATSAPP_NUMBER` de `@/lib/contact` no topo do componente.

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS em todos

- [ ] **Step 5: Commit**

```bash
git add app/painel/configuracoes/ConfiguracoesClient.tsx __tests__/ConfiguracoesClient.test.tsx
git commit -m "feat: adiciona link de suporte ao final da página de Configurações"
```

---

### Task 7: Blur no overlay do modal de produto (desktop)

**Files:**
- Modify: `app/[slug]/CatalogoClient.tsx:140`
- Test: `__tests__/CatalogoClient.test.tsx` (estender)

**Interfaces:**
- Consumes: nada novo.
- Produces: nenhuma mudança de props.

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `__tests__/CatalogoClient.test.tsx`:

```tsx
describe("CatalogoClient — modal de produto com blur no desktop", () => {
  it("o overlay usa fundo translúcido com blur, não cinza sólido", () => {
    const products = makeProducts(1, "Vestidos");
    const { container } = render(<CatalogoClient store={store} products={products} />);

    fireEvent.click(screen.getByText(products[0].name));

    const overlay = container.querySelector(".fixed.inset-0.z-20") as HTMLElement;
    expect(overlay.className).toContain("md:backdrop-blur-md");
    expect(overlay.className).not.toContain("md:bg-black/50");
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/CatalogoClient.test.tsx`
Expected: FAIL — overlay ainda usa `md:bg-black/50`, sem `md:backdrop-blur-md`

- [ ] **Step 3: Implementar**

Em `app/[slug]/CatalogoClient.tsx`, trocar a classe do overlay do modal (linha 140):

```tsx
className="fixed inset-0 z-20 bg-ivory md:flex md:items-center md:justify-center md:bg-black/20 md:backdrop-blur-md md:p-6"
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/CatalogoClient.test.tsx`
Expected: PASS em todos

- [ ] **Step 5: Commit**

```bash
git add "app/[slug]/CatalogoClient.tsx" __tests__/CatalogoClient.test.tsx
git commit -m "fix: overlay do modal de produto usa blur em vez de fundo cinza sólido"
```

---

### Task 8: Link de suporte na Sidebar (desktop)

**Files:**
- Modify: `components/painel/Sidebar.tsx`
- Test: `__tests__/Sidebar.test.tsx` (estender)

**Interfaces:**
- Consumes: `VTRINE_WHATSAPP_NUMBER` de `@/lib/contact`.
- Produces: nenhuma mudança de props.

- [ ] **Step 1: Escrever o teste (falhando)**

Adicionar a `__tests__/Sidebar.test.tsx`:

```tsx
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

describe("Sidebar — link de suporte", () => {
  it("mostra um link de Suporte apontando para o WhatsApp da Vtrine", () => {
    render(
      <Sidebar name="Ateliê Mira" monogram="AM" logoUrl={null} slug="ateliemira" />
    );
    const link = screen.getByRole("link", { name: /suporte/i });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Preciso de suporte com minha loja na Vtrine Digital."
      )}`
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/Sidebar.test.tsx`
Expected: FAIL — nenhum link "Suporte" existe ainda

- [ ] **Step 3: Implementar**

Em `components/painel/Sidebar.tsx`, adicionar aos imports:

```tsx
import {
  LayoutDashboard,
  Tag,
  Receipt,
  Layers,
  Palette,
  Settings,
  ExternalLink,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";
```

No bloco `mt-auto` (antes do `<form action={signOut}>`), adicionar:

```tsx
<a
  href={`https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Olá! Preciso de suporte com minha loja na Vtrine Digital."
  )}`}
  target="_blank"
  rel="noopener noreferrer"
  className="flex items-center gap-3 w-full px-3.5 py-[11px] rounded-btn font-body text-[15px] text-graphite hover:bg-surface-hover transition-all duration-200"
>
  <HelpCircle size={19} />
  Suporte
</a>
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/Sidebar.test.tsx`
Expected: PASS em todos

- [ ] **Step 5: Commit**

```bash
git add components/painel/Sidebar.tsx __tests__/Sidebar.test.tsx
git commit -m "feat: adiciona link de suporte na Sidebar do painel"
```

---

### Task 9: Unificar mensagem de limite de categorias com `UpsellHint`

**Files:**
- Modify: `app/painel/categorias/CategoriasClient.tsx`
- Test: `__tests__/CategoriasClient.test.tsx` (novo)

**Interfaces:**
- Consumes: `UpsellHint` (Task 1).
- Produces: nenhuma mudança de props.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `__tests__/CategoriasClient.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoriasClient } from "@/app/painel/categorias/CategoriasClient";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";
import type { StoreCategory } from "@/lib/types";

vi.mock("@/app/actions/categorias", () => ({
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

const categories: StoreCategory[] = [
  { id: "c1", name: "Vestidos", position: 0, productCount: 3 },
];

describe("CategoriasClient — limite de categorias", () => {
  it("mostra o botão 'Nova categoria' quando o limite não foi atingido", () => {
    render(<CategoriasClient categories={categories} maxCategories={5} />);
    expect(screen.getByRole("button", { name: "Nova categoria" })).toBeTruthy();
  });

  it("mostra um link de upsell clicável quando o limite foi atingido", () => {
    render(<CategoriasClient categories={categories} maxCategories={1} />);
    const link = screen.getByRole("link", {
      name: "Limite de categorias do plano atingido — fale conosco para aumentar",
    });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Quero aumentar o limite de categorias da minha loja."
      )}`
    );
  });

  it("não mostra o botão 'Nova categoria' quando o limite foi atingido", () => {
    render(<CategoriasClient categories={categories} maxCategories={1} />);
    expect(screen.queryByRole("button", { name: "Nova categoria" })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run __tests__/CategoriasClient.test.tsx`
Expected: FAIL — texto atual é "Limite de 1 atingido — faça upgrade", sem link

- [ ] **Step 3: Implementar**

Em `app/painel/categorias/CategoriasClient.tsx`, adicionar o import:

```tsx
import { UpsellHint } from "@/components/painel/UpsellHint";
```

Trocar o bloco (linhas 50-63 do arquivo atual):

```tsx
{!creating &&
  (limitReached ? (
    <UpsellHint
      label="Limite de categorias do plano atingido — fale conosco para aumentar"
      whatsappMessage="Olá! Quero aumentar o limite de categorias da minha loja."
    />
  ) : (
    <Button
      variant="primary"
      iconLeft={<Plus size={18} />}
      onClick={() => setCreating(true)}
    >
      Nova categoria
    </Button>
  ))}
```

- [ ] **Step 4: Rodar e confirmar sucesso**

Run: `npx vitest run __tests__/CategoriasClient.test.tsx`
Expected: PASS em todos

- [ ] **Step 5: Commit**

```bash
git add app/painel/categorias/CategoriasClient.tsx __tests__/CategoriasClient.test.tsx
git commit -m "fix: unifica mensagem de limite de categorias com link de upsell"
```

---

### Task 10: Verificação final

**Files:** nenhum (só execução)

**Interfaces:** N/A

- [ ] **Step 1: Rodar toda a suíte de testes**

Run: `npx vitest run`
Expected: PASS em todos os arquivos, nenhuma regressão nos testes já existentes antes deste plano

- [ ] **Step 2: Rodar lint**

Run: `npm run lint`
Expected: sem erros novos introduzidos pelos arquivos tocados neste plano

- [ ] **Step 3: Commit final (se houver ajustes de lint)**

```bash
git add -A
git commit -m "chore: ajustes finais de lint do pacote de UI"
```

(Pular este passo se não houver nenhuma mudança pendente.)

---

## Self-Review

**Cobertura do spec:** itens 1/2 (mover + corrigir aviso da cor secundária) → Task 4; item 3 (tooltip) → Tasks 2, 3, 4; item 4 (bug WhatsApp) → Task 5; item 5 (badges) → fora de escopo, não implementado (correto, por decisão do usuário); item 6 (blur) → Task 7; item 7 (suporte desktop + mobile) → Tasks 6 e 8; item 8 (limite de categorias) → Task 9. Todos os 7 itens do spec têm tarefa correspondente.

**Placeholders:** nenhum "TBD"/"depois" — todos os steps têm código completo.

**Consistência de tipos/nomes:** `UpsellHint({ label, whatsappMessage })` usado de forma idêntica em Tasks 3, 4 e 9. `Tooltip({ label, children })` usado de forma idêntica em Tasks 3 e 4. `collapseBlankLines` exportado na Task 5 antes de ser importado em `ConfiguracoesClient.tsx` na mesma tarefa — sem dependência cruzada quebrada. Task 6 modifica o mesmo arquivo da Task 5 (`ConfiguracoesClient.tsx`) em sequência — sem conflito, já que as duas tarefas rodam em ordem, não em paralelo.
