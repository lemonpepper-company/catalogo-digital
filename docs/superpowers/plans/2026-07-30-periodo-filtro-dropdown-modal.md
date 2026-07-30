# PeriodoFiltro: dropdown + modal de range personalizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `PeriodoFiltro`'s row of preset pills + inline date inputs with a single dropdown (reusing the existing `Select` component) whose footer action opens a modal (reusing the existing `Modal` component) for the custom date range.

**Architecture:** Pure internal rewrite of one client component. `PeriodoFiltro`'s external prop contract (`basePath`, `periodo?`, `de?`, `ate?`, `extraParams?`) and its dependency on `lib/period-filter.ts`'s `activePeriodToken` are unchanged, so nothing outside this component needs to change.

**Tech Stack:** Next.js App Router, React client component, `components/ui/Select.tsx` and `components/ui/Modal.tsx` (both pre-existing, unmodified), Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-07-30-periodo-filtro-dropdown-modal-design.md](../specs/2026-07-30-periodo-filtro-dropdown-modal-design.md)

## Global Constraints

- No new dependency — the custom range still uses native `<input type="date">`, just inside a modal instead of inline.
- `components/ui/Select.tsx` and `components/ui/Modal.tsx` are used as-is, with zero modifications to either file.
- `PeriodoFiltro`'s props stay exactly `{ basePath: string; periodo?: string; de?: string; ate?: string; extraParams?: Record<string, string> }` — no changes to `app/painel/DashboardClient.tsx`, `app/painel/pedidos/PedidosClient.tsx`, `lib/period-filter.ts`, `lib/timezone-sp.ts`, `lib/server/pedidos.ts`, or either `page.tsx`.
- Presets: exactly "Hoje" / "7 dias" / "Este mês" / "Todo período", in that order; "Este mês" is the default and is never written to the URL (same convention as today).
- The outer wrapper keeps `<div role="group" aria-label="Filtrar por período">` so `__tests__/DashboardClient.test.tsx` and `__tests__/PedidosClient.test.tsx` need no changes.
- Custom range display label: `"{day} {monthAbbr}"` for the start date when both dates share a year, else `"{day} {monthAbbr} {year}"`; the end date always includes the year: `"{day} {monthAbbr} {year}"`. Joined with `" – "` (en dash with spaces). Month abbreviations: `jan, fev, mar, abr, mai, jun, jul, ago, set, out, nov, dez` (index 0 = January).

---

### Task 1: Rewrite `PeriodoFiltro` as dropdown + modal

**Files:**
- Modify: `components/painel/PeriodoFiltro.tsx`
- Modify: `__tests__/PeriodoFiltro.test.tsx`

**Interfaces:**
- Consumes: `Select` from `@/components/ui/Select` (props: `value: string`, `placeholder?: string`, `options: string[]`, `onChange: (value: string) => void`, `footer?: { label: string; onClick: () => void }`); `Modal` from `@/components/ui/Modal` (props: `title: string`, `onClose: () => void`, `children`, `className?`); `Input` from `@/components/ui/Input` (native input props + `label?`, `type="date"` supported); `activePeriodToken`, `type PeriodPreset` from `@/lib/period-filter` (unchanged, already exists).
- Produces: `PeriodoFiltro(props: PeriodoFiltroProps)` — same public shape as before this task; internal-only helper `formatCustomRangeLabel` is not exported (implementation detail).

- [ ] **Step 1: Replace `__tests__/PeriodoFiltro.test.tsx` with the new test suite**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockReset();
});

/** Abre o dropdown clicando no botão-gatilho (mostra o valor atual, sempre único quando fechado). */
function openDropdown(currentValueLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: currentValueLabel }));
}

describe("PeriodoFiltro — dropdown de presets (ORD-48)", () => {
  it("mostra Este mês como valor selecionado por padrão, sem nenhum prop de período", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
  });

  it("mostra o rótulo do preset correspondente a periodo como valor selecionado", () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
  });

  it("ao abrir, lista os quatro presets e a ação de período personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    openDropdown("Este mês");

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo período" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Período personalizado" })).toBeTruthy();
    // "Este mês" aparece duas vezes quando aberto: o gatilho (valor atual) e a opção da lista.
    expect(screen.getAllByText("Este mês")).toHaveLength(2);
  });

  it("selecionar um preset navega para o basePath com ?periodo=<preset>", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });

  it("selecionar Todo período navega com ?periodo=tudo", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Todo período" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=tudo", {
      scroll: false,
    });
  });

  it("selecionar Este mês (o default) navega sem parâmetro de período", () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    openDropdown("Hoje");
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    expect(replace).toHaveBeenCalledWith("/painel", { scroll: false });
  });

  it("preserva extraParams (ex: busca) ao selecionar um preset", () => {
    render(
      <PeriodoFiltro basePath="/painel/pedidos" extraParams={{ q: "ana" }} />
    );

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });
});

describe("PeriodoFiltro — valor exibido para range customizado (ORD-48)", () => {
  it("mostra o range abreviado como valor selecionado quando de/ate válidos vêm por prop, mesmo ano", () => {
    render(<PeriodoFiltro basePath="/painel" de="2026-07-01" ate="2026-07-10" />);

    expect(
      screen.getByRole("button", { name: "1 jul – 10 jul 2026" })
    ).toBeTruthy();
  });

  it("inclui o ano nos dois lados quando de/ate estão em anos diferentes", () => {
    render(<PeriodoFiltro basePath="/painel" de="2025-12-20" ate="2026-01-05" />);

    expect(
      screen.getByRole("button", { name: "20 dez 2025 – 5 jan 2026" })
    ).toBeTruthy();
  });
});

describe("PeriodoFiltro — modal de período personalizado (ORD-48)", () => {
  function openCustomModal(currentValueLabel: string): HTMLElement {
    openDropdown(currentValueLabel);
    fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
    return screen.getByRole("dialog", { name: "Período personalizado" });
  }

  it("abre com os campos De/Até vazios quando não há range customizado ativo", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    const dialog = openCustomModal("Este mês");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe("");
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe("");
  });

  it("abre com os campos De/Até preenchidos quando já há um range customizado ativo", () => {
    render(<PeriodoFiltro basePath="/painel" de="2026-07-01" ate="2026-07-10" />);

    const dialog = openCustomModal("1 jul – 10 jul 2026");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe(
      "2026-07-01"
    );
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
  });

  it("desabilita Aplicar até as duas datas estarem preenchidas", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    const dialog = openCustomModal("Este mês");
    const aplicar = within(dialog).getByRole("button", { name: "Aplicar" });
    expect(aplicar).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("De"), {
      target: { value: "2026-07-01" },
    });
    expect(aplicar).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Até"), {
      target: { value: "2026-07-10" },
    });
    expect(aplicar).not.toBeDisabled();
  });

  it("aplicar navega com de/ate e fecha a modal", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    const dialog = openCustomModal("Este mês");
    fireEvent.change(within(dialog).getByLabelText("De"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Até"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(replace).toHaveBeenCalledWith(
      "/painel/pedidos?de=2026-07-01&ate=2026-07-10",
      { scroll: false }
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("preserva extraParams ao aplicar o range customizado", () => {
    render(
      <PeriodoFiltro basePath="/painel/pedidos" extraParams={{ q: "ana" }} />
    );

    const dialog = openCustomModal("Este mês");
    fireEvent.change(within(dialog).getByLabelText("De"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("Até"), {
      target: { value: "2026-07-10" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Aplicar" }));

    expect(replace).toHaveBeenCalledWith(
      "/painel/pedidos?q=ana&de=2026-07-01&ate=2026-07-10",
      { scroll: false }
    );
  });

  it("fechar sem aplicar não navega e fecha a modal", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    const dialog = openCustomModal("Este mês");
    fireEvent.click(within(dialog).getByLabelText("Fechar"));

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/PeriodoFiltro.test.tsx`
Expected: FAIL — the current component still renders pill buttons (`role="group"` with individual preset buttons directly, no `Select`/`Modal`), so none of the new assertions about a single dropdown trigger, footer action, or dialog match.

- [ ] **Step 3: Replace `components/painel/PeriodoFiltro.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { activePeriodToken, type PeriodPreset } from "@/lib/period-filter";

const PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  mes: "Este mês",
  tudo: "Todo período",
};

const PRESET_ORDER: PeriodPreset[] = ["hoje", "7d", "mes", "tudo"];
const PRESET_OPTIONS = PRESET_ORDER.map((preset) => PRESET_LABELS[preset]);
const LABEL_TO_PRESET: Record<string, PeriodPreset> = Object.fromEntries(
  PRESET_ORDER.map((preset) => [PRESET_LABELS[preset], preset])
) as Record<string, PeriodPreset>;

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatDateInputAbbrev(value: string): { day: number; month: string; year: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { day, month: MONTH_ABBR[month - 1], year };
}

function formatCustomRangeLabel(de: string, ate: string): string {
  const from = formatDateInputAbbrev(de);
  const to = formatDateInputAbbrev(ate);
  const fromLabel =
    from.year === to.year
      ? `${from.day} ${from.month}`
      : `${from.day} ${from.month} ${from.year}`;
  const toLabel = `${to.day} ${to.month} ${to.year}`;
  return `${fromLabel} – ${toLabel}`;
}

function periodDisplayLabel(
  active: PeriodPreset | "custom",
  de: string | undefined,
  ate: string | undefined
): string {
  if (active === "custom") {
    return de && ate ? formatCustomRangeLabel(de, ate) : PRESET_LABELS.mes;
  }
  return PRESET_LABELS[active];
}

interface PeriodoFiltroProps {
  basePath: string;
  periodo?: string;
  de?: string;
  ate?: string;
  extraParams?: Record<string, string>;
}

export function PeriodoFiltro({
  basePath,
  periodo,
  de,
  ate,
  extraParams = {},
}: PeriodoFiltroProps) {
  const router = useRouter();
  const active = activePeriodToken({ periodo, de, ate });
  const [modalOpen, setModalOpen] = useState(false);
  const [customDe, setCustomDe] = useState(de ?? "");
  const [customAte, setCustomAte] = useState(ate ?? "");

  const navigate = (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...extraParams, ...params }).toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  const selectPreset = (label: string) => {
    const preset = LABEL_TO_PRESET[label];
    if (!preset) return;
    navigate(preset === "mes" ? {} : { periodo: preset });
  };

  const openModal = () => {
    setCustomDe(de ?? "");
    setCustomAte(ate ?? "");
    setModalOpen(true);
  };

  const applyCustomRange = () => {
    if (!customDe || !customAte) return;
    navigate({ de: customDe, ate: customAte });
    setModalOpen(false);
  };

  return (
    <div role="group" aria-label="Filtrar por período">
      <Select
        value={periodDisplayLabel(active, de, ate)}
        options={PRESET_OPTIONS}
        onChange={selectPreset}
        footer={{ label: "Período personalizado", onClick: openModal }}
      />

      {modalOpen && (
        <Modal title="Período personalizado" onClose={() => setModalOpen(false)}>
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="w-40">
              <Input
                type="date"
                label="De"
                value={customDe}
                onChange={(e) => setCustomDe(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                type="date"
                label="Até"
                value={customAte}
                onChange={(e) => setCustomAte(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!customDe || !customAte}
            className="h-11 px-4 rounded-btn bg-obsidian text-white font-body font-medium text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Aplicar
          </button>
        </Modal>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/PeriodoFiltro.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 5: Confirm the two consuming components' tests still pass unchanged**

Run: `npx vitest run __tests__/DashboardClient.test.tsx __tests__/PedidosClient.test.tsx`
Expected: PASS, with zero modifications to either test file — both only assert `screen.getByRole("group", { name: "Filtrar por período" })` / `queryByRole(...)` for presence/absence of the filter, which the new markup still satisfies via the unchanged wrapper `<div role="group" aria-label="Filtrar por período">`.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors introduced by `components/painel/PeriodoFiltro.tsx` (pre-existing errors in unrelated files — `app/[slug]/use-catalogo.ts`, `app/painel/configuracoes/ConfiguracoesClient.tsx`, `components/ui/SlugInput.tsx` — are out of scope and expected to remain).

- [ ] **Step 7: Full suite sanity check**

Run: `npm test -- --run`
Expected: same pass count as before this change plus/minus only the `PeriodoFiltro.test.tsx` delta (test count in that file may differ from the old 13-pill-based tests to the new dropdown-based ones) — no new failures anywhere else. The pre-existing, unrelated `__tests__/tailwind-alpha-utilities.test.ts` failure (missing `tailwindcss` binary in this environment) is expected and out of scope.

- [ ] **Step 8: Commit**

```bash
git add components/painel/PeriodoFiltro.tsx __tests__/PeriodoFiltro.test.tsx
git commit -m "$(cat <<'EOF'
refactor(painel): PeriodoFiltro vira dropdown + modal de range personalizado

Troca os pills de preset + inputs de data inline por um Select (já
existente no design system) com uma ação de rodapé "Período
personalizado" que abre uma Modal (também já existente) com os mesmos
dois <input type="date">. Quando um range customizado está ativo, o
dropdown fechado mostra o range abreviado como valor selecionado.

Nenhuma mudança de props: DashboardClient/PedidosClient e o restante
do filtro de período (lib/period-filter.ts, lib/server/pedidos.ts,
as duas páginas) continuam intactos.
EOF
)"
```

---

## Self-Review

**Spec coverage:** dropdown with 4 preset options ✓ (Step 3), footer action opening a modal ✓, modal with the two date inputs + Aplicar ✓, custom range abbreviated label with same-year/different-year rules ✓ (`formatCustomRangeLabel`), no prop changes / no changes to consuming files ✓ (Step 5 proves this via unchanged tests), `role="group"` wrapper preserved ✓.

**Placeholder scan:** none — every step has complete, runnable code.

**Type consistency:** `PeriodoFiltroProps` unchanged from the pre-existing shape; `periodDisplayLabel`/`formatCustomRangeLabel`/`formatDateInputAbbrev` are internal, consistently named between the test file's expectations (output strings) and the implementation.
