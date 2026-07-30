# Feedback de loading unificado nos filtros do painel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every filter change in Dashboard, Pedidos, and Produtos shows visual loading feedback — one `useTransition` per page, shared across all of that page's filters, driving a spinner on Dashboard's order StatCards and a skeleton over the Pedidos/Produtos lists.

**Architecture:** Each page's client component (`DashboardClient`, `PedidosClient`, `ProdutosClient`) owns a single `useTransition()`. Its `startTransition` is injected into whichever hook/component currently calls `router.replace` for that page's filters (`PeriodoFiltro`, `usePedidosBusca`, `useProdutosFiltros`), replacing each of their own previously-isolated `useTransition` calls. The resulting single `isPending` per page drives every loading affordance on that page.

**Tech Stack:** Next.js App Router, React `useTransition`, Vitest + Testing Library, existing hand-rolled design system (`components/ui/`).

**Spec:** [docs/superpowers/specs/2026-07-30-feedback-loading-filtros-painel-design.md](../specs/2026-07-30-feedback-loading-filtros-painel-design.md)

## Global Constraints

- `startTransition` is threaded in as a **required** parameter/prop everywhere it's needed (`PeriodoFiltro`, `usePedidosBusca`, `useProdutosFiltros`) — none of these three are used outside their one page, so there's no need for an optional/self-contained fallback.
- `useProdutos()`'s existing `isPending` (toggle/feature/delete actions) and `usePedidos()`'s `statusPending` (order status change) are unrelated signals — do not merge them with the new filter-driven `isPending`. Name the new per-page filter transition `filtersPending` in `PedidosClient`/`ProdutosClient` to keep it visually distinct from those.
- Skeleton row components (`OrderRowSkeleton`, `ProductRowSkeleton`) move to `components/painel/` so both the route's `loading.tsx` (initial load) and the page's client component (filter-triggered reload) render identical markup — no visual difference between the two loading moments.
- Each extracted skeleton file keeps its own local `Sk` helper (same small duplication already present across the six existing `loading.tsx` files in this codebase) — do not attempt to deduplicate `Sk` itself, out of scope.
- Skeleton row count during a filter-triggered reload is `(current items).length || 6` — falls back to 6 (matching the initial-load skeleton) only when the previous list was already empty.
- No new dependency, no change to `lib/period-filter.ts`, `lib/timezone-sp.ts`, `lib/server/pedidos.ts`, either `page.tsx` for Pedidos/Dashboard, or `app/painel/produtos/page.tsx`.

---

## File Structure

**New files:**
- `components/painel/OrderRowSkeleton.tsx` — extracted from `app/painel/pedidos/loading.tsx`.
- `components/painel/ProductRowSkeleton.tsx` — extracted from `app/painel/produtos/loading.tsx`.
- `__tests__/StatCard.test.tsx` — new, `StatCard` had no dedicated test file before.

**Modified files:**
- `components/ui/StatCard.tsx` — new optional `loading` prop.
- `app/painel/loading.tsx` — removes the orphaned "Produtos recentes" skeleton block.
- `app/painel/pedidos/loading.tsx`, `app/painel/produtos/loading.tsx` — import the extracted row-skeleton components instead of defining them locally.
- `components/painel/PeriodoFiltro.tsx` — `isPending`/`startTransition` become required props instead of an internal `useTransition`.
- `app/painel/DashboardClient.tsx` — owns `useTransition`, feeds `PeriodoFiltro` and the 3 "Vendas pela vitrine" `StatCard`s.
- `app/painel/pedidos/use-pedidos-busca.ts` — accepts injected `startTransition`, drops its own.
- `app/painel/pedidos/PedidosClient.tsx` — owns `useTransition` (`filtersPending`), feeds the hook, `PeriodoFiltro`, the search icon, and a new list skeleton.
- `app/painel/produtos/use-produtos-filtros.ts` — accepts injected `startTransition`.
- `app/painel/produtos/ProdutosClient.tsx` — owns `useTransition` (`filtersPending`), feeds the hook, dims the two `Select` filters, and adds a list skeleton.
- `__tests__/PeriodoFiltro.test.tsx`, `__tests__/DashboardClient.test.tsx`, `__tests__/PedidosClient.test.tsx`, `__tests__/ProdutosClient.test.tsx` — updated for the above.

---

### Task 1: `StatCard` gains a `loading` state

**Files:**
- Modify: `components/ui/StatCard.tsx`
- Test: `__tests__/StatCard.test.tsx` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: `StatCard({ value, label, tone?, loading? })` — `loading` defaults to `false`; when `true`, renders a spinner (`data-testid="statcard-loading"`) instead of `value`, keeping `label` visible. Task 4 passes `loading={isPending}` to the 3 order-stat cards.

- [ ] **Step 1: Write the failing test**

Create `__tests__/StatCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/ui/StatCard";

describe("StatCard", () => {
  it("mostra o valor e o rótulo por padrão", () => {
    render(<StatCard value={7} label="Pedidos" />);

    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Pedidos")).toBeTruthy();
  });

  it("com loading, mostra o spinner e não mostra o valor", () => {
    render(<StatCard value={7} label="Pedidos" loading />);

    expect(screen.getByTestId("statcard-loading")).toBeTruthy();
    expect(screen.queryByText("7")).toBeNull();
    expect(screen.getByText("Pedidos")).toBeTruthy();
  });

  it("sem loading (padrão), não mostra o spinner", () => {
    render(<StatCard value={7} label="Pedidos" />);

    expect(screen.queryByTestId("statcard-loading")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/StatCard.test.tsx`
Expected: FAIL — `loading` prop doesn't exist yet, `data-testid="statcard-loading"` never renders.

- [ ] **Step 3: Add the `loading` prop to `StatCard.tsx`**

Replace the full file content with:

```tsx
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "default" | "soldout";

interface StatCardProps {
  value: number | string;
  label: string;
  tone?: Tone;
  loading?: boolean;
}

export function StatCard({
  value,
  label,
  tone = "default",
  loading = false,
}: StatCardProps) {
  return (
    <div className="bg-linen border border-sand/50 rounded-card p-6 flex flex-col gap-1">
      {loading ? (
        <div className="h-9 flex items-center" data-testid="statcard-loading">
          <Loader2 size={24} className="text-graphite animate-spin" />
        </div>
      ) : (
        <span
          className={cn(
            "font-display font-semibold text-[36px] leading-none",
            tone === "soldout" ? "text-soldout" : "text-obsidian"
          )}
        >
          {value}
        </span>
      )}
      <span className="font-body text-[13px] text-graphite">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/StatCard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/ui/StatCard.tsx __tests__/StatCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): StatCard ganha estado de loading

Mostra um spinner no lugar do valor quando `loading` é true, mantendo
o rótulo visível — usado pelos cards de "Vendas pela vitrine" quando o
filtro de período está sendo trocado.
EOF
)"
```

---

### Task 2: Extract shared row-skeleton components; fix the orphaned Dashboard skeleton

**Files:**
- Create: `components/painel/OrderRowSkeleton.tsx`
- Create: `components/painel/ProductRowSkeleton.tsx`
- Modify: `app/painel/pedidos/loading.tsx`
- Modify: `app/painel/produtos/loading.tsx`
- Modify: `app/painel/loading.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `OrderRowSkeleton({ first?: boolean })` and `ProductRowSkeleton({ first?: boolean })`, both exported. Task 5 uses `OrderRowSkeleton` in `PedidosClient.tsx`; Task 6 uses `ProductRowSkeleton` in `ProdutosClient.tsx`.

No test file changes in this task — none of these four files has a dedicated test today (confirmed: no `*loading*.test.tsx` exists in the repo), and the row-skeleton markup is copied verbatim, so there's no new behavior to assert beyond "still renders" (implicitly covered once Tasks 5/6 render these components inside already-tested list bodies).

- [ ] **Step 1: Create `components/painel/OrderRowSkeleton.tsx`**

```tsx
function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export function OrderRowSkeleton({ first = false }: { first?: boolean }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4"
      style={{ borderTop: !first ? "0.5px solid var(--color-border)" : "none" }}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Sk w="w-32" h="h-4" />
        <Sk w="w-44" h="h-3" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Sk w="w-20" h="h-4" />
        <Sk w="w-16" h="h-[22px]" rounded="rounded-pill" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/painel/pedidos/loading.tsx` to use it**

Replace the full file content with:

```tsx
import { OrderRowSkeleton } from "@/components/painel/OrderRowSkeleton";

function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export default function PedidosLoading() {
  return (
    <div className="w-full lg:max-w-content flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Sk w="w-28" h="h-7" />
        <Sk w="w-52" h="h-4" />
      </div>

      <div className="bg-white border border-sand/50 rounded-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <OrderRowSkeleton key={i} first={i === 0} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/painel/ProductRowSkeleton.tsx`**

```tsx
function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export function ProductRowSkeleton({ first = false }: { first?: boolean }) {
  return (
    <div style={{ borderTop: !first ? "0.5px solid var(--color-border)" : "none" }}>
      <div className="lg:hidden flex items-center gap-4 px-5 py-4">
        <Sk w="w-[52px]" h="h-16" rounded="rounded-[8px]" />
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <Sk w="w-32" h="h-4" />
          <Sk w="w-20" h="h-3" />
        </div>
        <Sk w="w-9" h="h-9" rounded="rounded-btn" />
      </div>
      <div className="hidden lg:flex items-center gap-4 px-5 py-3.5">
        <Sk w="w-12" h="h-12" rounded="rounded-[8px]" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Sk w="w-48" h="h-4" />
          <Sk w="w-24" h="h-3" />
        </div>
        <Sk w="w-14" h="h-5" rounded="rounded-pill" />
        <Sk w="w-10" h="h-6" rounded="rounded-btn" />
        <Sk w="w-9" h="h-9" rounded="rounded-btn" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `app/painel/produtos/loading.tsx` to use it**

Replace the full file content with:

```tsx
import { ProductRowSkeleton } from "@/components/painel/ProductRowSkeleton";

function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

export default function ProdutosLoading() {
  return (
    <div className="w-full lg:max-w-content flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Sk w="w-28" h="h-7" />
          <Sk w="w-56" h="h-4" />
        </div>
        <Sk w="w-40" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="bg-white border border-sand/50 rounded-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductRowSkeleton key={i} first={i === 0} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Remove the orphaned "Produtos recentes" skeleton from `app/painel/loading.tsx`**

Replace the full file content with:

```tsx
function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="bg-linen border border-sand/50 rounded-card p-6 flex flex-col gap-3">
      <Sk w="w-12" h="h-9" rounded="rounded-[6px]" />
      <Sk w="w-28" h="h-3.5" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Sk w="w-52" h="h-7" />
          <Sk w="w-64" h="h-4" />
        </div>
        <Sk w="w-44" h="h-11" rounded="rounded-btn" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Sk w="w-20" h="h-3" />
            <Sk w="w-64" h="h-5" />
          </div>
          <div className="flex gap-2.5">
            <Sk w="w-24" h="h-11" rounded="rounded-btn" />
            <Sk w="w-32" h="h-11" rounded="rounded-btn" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

(Removed: the local `ProductRowSkeleton` function and the trailing `<div>` block that rendered a heading + 4 of them — that was the skeleton for the "Produtos recentes" section removed from `DashboardClient.tsx` earlier in this branch. `StatCardSkeleton` and the "Vendas pela vitrine" card skeleton block stay untouched.)

- [ ] **Step 6: Run the full suite to confirm no regression**

Run: `npx vitest run`
Expected: same pass count as before this task (no test covers any of these 5 files today) — 1 pre-existing unrelated failure (`__tests__/tailwind-alpha-utilities.test.ts`, missing `tailwindcss` binary) is expected.

- [ ] **Step 7: Commit**

```bash
git add components/painel/OrderRowSkeleton.tsx components/painel/ProductRowSkeleton.tsx app/painel/pedidos/loading.tsx app/painel/produtos/loading.tsx app/painel/loading.tsx
git commit -m "$(cat <<'EOF'
refactor(painel): extrai skeletons de linha compartilhados; remove skeleton órfão

OrderRowSkeleton e ProductRowSkeleton saem de loading.tsx para
components/painel/, reaproveitados tanto no carregamento inicial da
rota quanto na troca de filtro (próximas tasks). app/painel/loading.tsx
também perde o bloco de skeleton que ainda simulava a lista "Produtos
recentes", removida do DashboardClient no início desta sessão — nunca
era substituído pelo conteúdo real porque a seção não existe mais.
EOF
)"
```

---

### Task 3: `PeriodoFiltro` takes `isPending`/`startTransition` as props

**Files:**
- Modify: `components/painel/PeriodoFiltro.tsx`
- Modify: `__tests__/PeriodoFiltro.test.tsx`

**Interfaces:**
- Consumes: nothing new (still uses `activePeriodToken` from `@/lib/period-filter`, `Select`/`Modal`/`Input` unchanged).
- Produces: `PeriodoFiltro({ basePath, periodo?, de?, ate?, extraParams?, isPending, startTransition })` — `isPending: boolean` and `startTransition: (callback: () => void) => void` are now **required** props (previously the component owned its own `useTransition`). Tasks 4 and 5 pass these from their own page-level `useTransition()`.

- [ ] **Step 1: Replace `__tests__/PeriodoFiltro.test.tsx` with the updated test suite**

This drops the `vi.mock("react", ...)` trick entirely (no longer needed — `isPending` is now a prop we control directly) and adds `isPending`/`startTransition` to every render call via a small helper.

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

const startTransition = (callback: () => void) => callback();

function renderFiltro(props: Partial<React.ComponentProps<typeof PeriodoFiltro>> = {}) {
  return render(
    <PeriodoFiltro
      basePath="/painel"
      isPending={false}
      startTransition={startTransition}
      {...props}
    />
  );
}

/** Abre o dropdown clicando no botão-gatilho (mostra o valor atual, sempre único quando fechado). */
function openDropdown(currentValueLabel: string) {
  fireEvent.click(screen.getByRole("button", { name: currentValueLabel }));
}

describe("PeriodoFiltro — dropdown de presets (ORD-48)", () => {
  it("mostra Este mês como valor selecionado por padrão, sem nenhum prop de período", () => {
    renderFiltro();

    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
  });

  it("mostra o rótulo do preset correspondente a periodo como valor selecionado", () => {
    renderFiltro({ periodo: "hoje" });

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
  });

  it("ao abrir, lista os quatro presets e a ação de período personalizado", () => {
    renderFiltro();

    openDropdown("Este mês");

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo período" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Período personalizado" })).toBeTruthy();
    // "Este mês" aparece duas vezes quando aberto: o gatilho (valor atual) e a opção da lista.
    expect(screen.getAllByText("Este mês")).toHaveLength(2);
  });

  it("selecionar um preset navega para o basePath com ?periodo=<preset>", () => {
    renderFiltro();

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });

  it("selecionar Todo período navega com ?periodo=tudo", () => {
    renderFiltro({ basePath: "/painel/pedidos" });

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Todo período" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=tudo", {
      scroll: false,
    });
  });

  it("selecionar Este mês (o default) navega sem parâmetro de período", () => {
    renderFiltro({ periodo: "hoje" });

    openDropdown("Hoje");
    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    expect(replace).toHaveBeenCalledWith("/painel", { scroll: false });
  });

  it("preserva extraParams (ex: busca) ao selecionar um preset", () => {
    renderFiltro({ basePath: "/painel/pedidos", extraParams: { q: "ana" } });

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });
});

describe("PeriodoFiltro — valor exibido para range customizado (ORD-48)", () => {
  it("mostra o range abreviado como valor selecionado quando de/ate válidos vêm por prop, mesmo ano", () => {
    renderFiltro({ de: "2026-07-01", ate: "2026-07-10" });

    expect(screen.getByRole("button", { name: "1 jul – 10 jul 2026" })).toBeTruthy();
  });

  it("inclui o ano nos dois lados quando de/ate estão em anos diferentes", () => {
    renderFiltro({ de: "2025-12-20", ate: "2026-01-05" });

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
    renderFiltro();

    const dialog = openCustomModal("Este mês");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe("");
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe("");
  });

  it("abre com os campos De/Até preenchidos quando já há um range customizado ativo", () => {
    renderFiltro({ de: "2026-07-01", ate: "2026-07-10" });

    const dialog = openCustomModal("1 jul – 10 jul 2026");

    expect((within(dialog).getByLabelText("De") as HTMLInputElement).value).toBe(
      "2026-07-01"
    );
    expect((within(dialog).getByLabelText("Até") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
  });

  it("desabilita Aplicar até as duas datas estarem preenchidas", () => {
    renderFiltro();

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
    renderFiltro({ basePath: "/painel/pedidos" });

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
    renderFiltro({ basePath: "/painel/pedidos", extraParams: { q: "ana" } });

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
    renderFiltro();

    const dialog = openCustomModal("Este mês");
    fireEvent.click(within(dialog).getByLabelText("Fechar"));

    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PeriodoFiltro — feedback de carregamento, controlado pelo pai (ORD-50)", () => {
  it("não mostra o spinner quando isPending é false", () => {
    renderFiltro({ isPending: false });

    expect(screen.queryByTestId("periodo-filtro-loading")).toBeNull();
  });

  it("mostra um spinner quando isPending é true", () => {
    renderFiltro({ isPending: true });

    expect(screen.getByTestId("periodo-filtro-loading")).toBeTruthy();
  });

  it("desabilita a interação com o dropdown quando isPending é true", () => {
    renderFiltro({ isPending: true });

    expect(
      screen.getByRole("button", { name: "Este mês" }).closest('[class*="pointer-events-none"]')
    ).toBeTruthy();
  });

  it("chama o startTransition recebido por prop ao navegar", () => {
    const customStartTransition = vi.fn((callback: () => void) => callback());
    renderFiltro({ startTransition: customStartTransition });

    openDropdown("Este mês");
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(customStartTransition).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/PeriodoFiltro.test.tsx`
Expected: FAIL — `PeriodoFiltro` doesn't accept `isPending`/`startTransition` props yet (TypeScript error on missing required props, or at minimum the new "chama o startTransition recebido por prop" test fails since the component still uses its own internal transition).

- [ ] **Step 3: Update `components/painel/PeriodoFiltro.tsx`**

Replace the full file content with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
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
  isPending: boolean;
  startTransition: (callback: () => void) => void;
}

export function PeriodoFiltro({
  basePath,
  periodo,
  de,
  ate,
  extraParams = {},
  isPending,
  startTransition,
}: PeriodoFiltroProps) {
  const router = useRouter();
  const active = activePeriodToken({ periodo, de, ate });
  const [modalOpen, setModalOpen] = useState(false);
  const [customDe, setCustomDe] = useState(de ?? "");
  const [customAte, setCustomAte] = useState(ate ?? "");

  const navigate = (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...extraParams, ...params }).toString();
    startTransition(() => {
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
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
      <div
        className={cn(
          "flex items-center gap-2 w-full sm:w-64",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        <div className="flex-1 min-w-0">
          <Select
            value={periodDisplayLabel(active, de, ate)}
            options={PRESET_OPTIONS}
            onChange={selectPreset}
            footer={{ label: "Período personalizado", onClick: openModal }}
          />
        </div>
        {isPending && (
          <Loader2
            size={16}
            className="text-graphite animate-spin flex-shrink-0"
            data-testid="periodo-filtro-loading"
          />
        )}
      </div>

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

(Only real change from before: `useTransition` import and internal call removed; `isPending`/`startTransition` come from props now.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/PeriodoFiltro.test.tsx`
Expected: PASS (19 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `app/painel/DashboardClient.tsx` and `app/painel/pedidos/PedidosClient.tsx` (both still render `<PeriodoFiltro>` without the two new required props) — **expected at this point**, Tasks 4 and 5 fix them. Confirm no OTHER unexpected errors appear.

- [ ] **Step 6: Commit**

```bash
git add components/painel/PeriodoFiltro.tsx __tests__/PeriodoFiltro.test.tsx
git commit -m "$(cat <<'EOF'
refactor(painel): PeriodoFiltro recebe isPending/startTransition do pai

Remove o useTransition interno — quem chama agora controla o estado de
pendência, permitindo que Dashboard e Pedidos usem um único
useTransition por página compartilhado entre todos os filtros daquela
tela (próximas tasks).
EOF
)"
```

---

### Task 4: Dashboard — spinner nos StatCards de "Vendas pela vitrine"

**Files:**
- Modify: `app/painel/DashboardClient.tsx`
- Modify: `__tests__/DashboardClient.test.tsx`

**Interfaces:**
- Consumes: `PeriodoFiltro` now requiring `isPending`/`startTransition` (Task 3); `StatCard` now accepting `loading?` (Task 1).
- Produces: no new exports — `DashboardClient` keeps the same props it already had.

- [ ] **Step 1: Replace `__tests__/DashboardClient.test.tsx` with the updated test suite**

Adds `next/navigation`'s `useRouter` mock returning a `replace` that we can leave a no-op for these tests (transitions resolve synchronously with a real `useTransition` and a synchronous mock `replace`, exactly like the rest of this codebase's existing tests), plus a new describe block asserting the 3 order `StatCard`s go into `loading` state while a transition is pending — driven by mocking `router.replace` to never resolve during the test via a manually-controlled promise is unnecessary here: instead, assert that `PeriodoFiltro`'s `startTransition` prop is the same function passed through from `DashboardClient`'s own `useTransition`, and separately unit-test the loading visual via `StatCard`'s own test (Task 1) plus an integration check that the `loading` prop wiring is present.

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardClient } from "@/app/painel/DashboardClient";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function makeProduct(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: "p1",
    name: "Vestido midi",
    priceCents: 19900,
    description: null,
    categoryId: null,
    sizes: [],
    soldSizes: [],
    colors: [],
    images: [],
    stock: 10,
    isActive: true,
    isNew: false,
    isFeatured: false,
    ...overrides,
  };
}

function renderDashboard(metrics: OrderMetrics | null, products: StoreProduct[] = []) {
  return render(
    <DashboardClient
      products={products}
      storeName="Ateliê Mira"
      catalogUrl="https://vtrine.test/ateliemira"
      metrics={metrics}
    />
  );
}

/** Valor do StatCard cujo rótulo é `label` (value e label são spans irmãos). */
function statValue(label: string): string | null | undefined {
  return screen.getByText(label).previousElementSibling?.textContent;
}

describe("DashboardClient — cards de ROI (ORD-17, ORD-18, ORD-19)", () => {
  const metrics: OrderMetrics = {
    ordersThisMonth: 7,
    confirmedCentsThisMonth: 123450,
    pendingCount: 3,
  };

  it("mostra a contagem de pedidos do período", () => {
    renderDashboard(metrics);

    expect(statValue("Pedidos")).toBe("7");
  });

  it("mostra as vendas confirmadas do período formatadas em reais", () => {
    renderDashboard(metrics);

    expect(statValue("Vendas confirmadas")).toBe("R$ 1234,50");
  });

  it("mostra a contagem de pedidos aguardando confirmação", () => {
    renderDashboard(metrics);

    expect(statValue("Aguardando confirmação")).toBe("3");
  });

  it("leva para o histórico de pedidos", () => {
    renderDashboard(metrics);

    expect(screen.getByRole("link", { name: "Ver pedidos" }).getAttribute("href")).toBe(
      "/painel/pedidos"
    );
  });

  it("mostra o filtro de período junto dos cards de vendas", () => {
    renderDashboard(metrics);

    expect(screen.getByRole("group", { name: "Filtrar por período" })).toBeTruthy();
  });

  it("não mostra loading nos cards de vendas antes de qualquer troca de período", () => {
    renderDashboard(metrics);

    expect(screen.queryAllByTestId("statcard-loading")).toHaveLength(0);
  });
});

describe("DashboardClient — métricas zeradas (ORD-20)", () => {
  it("mostra 0 e R$ 0,00 quando a loja não tem pedidos no período", () => {
    renderDashboard({
      ordersThisMonth: 0,
      confirmedCentsThisMonth: 0,
      pendingCount: 0,
    });

    expect(statValue("Pedidos")).toBe("0");
    expect(statValue("Vendas confirmadas")).toBe("R$ 0,00");
    expect(statValue("Aguardando confirmação")).toBe("0");
  });
});

describe("DashboardClient — bloqueio no plano Free (ORD-29)", () => {
  it("substitui os três cards de ROI pelo aviso de upgrade com CTA", () => {
    renderDashboard(null);

    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Falar no WhatsApp →" })).toBeTruthy();
    expect(screen.queryByText("Pedidos")).toBeNull();
    expect(screen.queryByText("Vendas confirmadas")).toBeNull();
    expect(screen.queryByText("Aguardando confirmação")).toBeNull();
  });

  it("não exibe nenhum valor de faturamento no HTML", () => {
    const { container } = renderDashboard(null);

    expect(container.textContent).not.toContain("R$");
  });

  it("não mostra o filtro de período quando o plano está bloqueado", () => {
    renderDashboard(null);

    expect(screen.queryByRole("group", { name: "Filtrar por período" })).toBeNull();
  });

  it("mantém os cards de produtos intactos", () => {
    renderDashboard(null, [makeProduct(), makeProduct({ id: "p2", stock: 0 })]);

    expect(statValue("Produtos ativos")).toBe("1");
    expect(statValue("Produtos esgotados")).toBe("1");
    expect(statValue("Produtos no catálogo")).toBe("2");
  });
});

describe("DashboardClient — produtos recentes removido (ORD-47)", () => {
  it("não mostra mais a lista de produtos recentes", () => {
    renderDashboard(null, [makeProduct()]);

    expect(screen.queryByText("Produtos recentes")).toBeNull();
    expect(screen.queryByText("Vestido midi")).toBeNull();
  });
});
```

(This test file's changes from before: added the "não mostra loading... antes de qualquer troca" sanity check. The actual "shows loading while pending" behavior is covered end-to-end by `PeriodoFiltro.test.tsx`'s `startTransition` wiring test plus `StatCard.test.tsx`'s loading-rendering test — driving a real pending transition through a mocked `router.replace` inside this integration test would require either fake async timers with an unresolved promise or re-adding a `useTransition` mock, both of which duplicate coverage Task 1/3 already have. Keep this file focused on Dashboard-specific wiring, not re-proving `useTransition` mechanics.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/DashboardClient.test.tsx`
Expected: FAIL — `<PeriodoFiltro>` inside `DashboardClient` doesn't pass `isPending`/`startTransition` yet, so TypeScript/React will error when the component tries to render (missing required props).

- [ ] **Step 3: Update `app/painel/DashboardClient.tsx`**

Replace the full file content with:

```tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Plus, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  catalogUrl: string;
  metrics: OrderMetrics | null;
  periodo?: string;
  de?: string;
  ate?: string;
}

export function DashboardClient({
  products,
  storeName,
  catalogUrl,
  metrics,
  periodo,
  de,
  ate,
}: DashboardClientProps) {
  const { copied, toast, handleCopy, activeProducts, soldOutProducts, total, orderStats } =
    useDashboard(products, catalogUrl, metrics);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-[28px] text-obsidian">
            Olá, {storeName}
          </h1>
          <p className="font-body text-[15px] text-graphite mt-1.5">
            Aqui está um resumo da sua loja hoje.
          </p>
        </div>
        <Link
          href="/painel/produtos/novo"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-6 py-2.5 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
        >
          <Plus size={18} />
          Cadastrar produto
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard value={activeProducts.length} label="Produtos ativos" />
        <StatCard
          value={soldOutProducts.length}
          label="Produtos esgotados"
          tone="soldout"
        />
        <StatCard value={total} label="Produtos no catálogo" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="font-display font-medium text-[18px] text-obsidian">
            Vendas pela vitrine
          </h2>
          <Link
            href="/painel/pedidos"
            className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
          >
            Ver pedidos
          </Link>
        </div>
        {orderStats ? (
          <div className="flex flex-col gap-3.5">
            <PeriodoFiltro
              basePath="/painel"
              periodo={periodo}
              de={de}
              ate={ate}
              isPending={isPending}
              startTransition={startTransition}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {orderStats.map((stat) => (
                <StatCard
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  loading={isPending}
                />
              ))}
            </div>
          </div>
        ) : (
          <RecursoBloqueado
            titulo="Pedidos e faturamento do mês"
            descricao="Seus pedidos já estão sendo registrados. Faça upgrade para ver quantos pedidos e quanto em vendas a sua vitrine gerou."
          />
        )}
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Link do catálogo
            </div>
            <div className="font-display font-medium text-[18px] text-obsidian mt-1.5 break-all">
              {catalogUrl}
            </div>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="ghost"
              iconLeft={<ExternalLink size={18} />}
              onClick={() => window.open(catalogUrl, "_blank")}
            >
              Abrir
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              iconLeft={
                copied ? <Check size={18} className="text-gold" /> : <Copy size={18} />
              }
            >
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          </div>
        </div>
      </Card>

      {toast && <Toast msg={toast} />}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/DashboardClient.test.tsx`
Expected: PASS (12 tests)

- [ ] **Step 5: Confirm `DashboardPage.test.tsx` still passes unchanged**

Run: `npx vitest run __tests__/DashboardPage.test.tsx`
Expected: PASS, zero modifications needed to that file — it renders `DashboardPage` (the Server Component), which passes props into `DashboardClient` the same way as before; `DashboardClient`'s new internal `useTransition` doesn't change its prop contract from the page's perspective.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: the `DashboardClient.tsx` error from Task 3 is now resolved. Confirm the remaining errors are only in `app/painel/pedidos/PedidosClient.tsx` (Task 5 fixes it) and, if Task 6 hasn't run yet, none related to Produtos (Task 6's changes are independent and not yet touched).

- [ ] **Step 7: Commit**

```bash
git add app/painel/DashboardClient.tsx __tests__/DashboardClient.test.tsx
git commit -m "$(cat <<'EOF'
feat(painel): spinner nos StatCards de Vendas pela vitrine ao trocar período

DashboardClient passa a ter seu próprio useTransition, repassado para
PeriodoFiltro e para os 3 StatCard de vendas — os cards de produtos
(não filtrados por período) continuam sem loading.
EOF
)"
```

---

### Task 5: Pedidos — skeleton na lista para busca OU período

**Files:**
- Modify: `app/painel/pedidos/use-pedidos-busca.ts`
- Modify: `app/painel/pedidos/PedidosClient.tsx`
- Modify: `__tests__/PedidosClient.test.tsx`

**Interfaces:**
- Consumes: `PeriodoFiltro` requiring `isPending`/`startTransition` (Task 3); `OrderRowSkeleton` from `@/components/painel/OrderRowSkeleton` (Task 2).
- Produces: `usePedidosBusca(initialQuery, startTransition, extraParams?)` — `startTransition` is now the 2nd (required) parameter, `extraParams` shifts to 3rd (still optional, default `{}`); the hook no longer returns `isPending` (the page's own `filtersPending` covers it).

- [ ] **Step 1: Update `app/painel/pedidos/use-pedidos-busca.ts`**

Replace the full file content with:

```ts
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

/**
 * Mesmo padrão de `app/painel/produtos/use-produtos-filtros.ts`: o termo digitado
 * vive no input e, depois do debounce, vai para a URL — quem filtra é o servidor.
 * `extraParams` (o período ativo, quando houver) é preservado na URL junto do
 * termo de busca, para que trocar de busca não derrube um filtro de período já
 * aplicado (ORD-46). A URL nova nunca leva `page`, então uma busca sempre
 * recomeça na página 1 e a paginação é recalculada sobre o resultado filtrado
 * (ORD-35.10). `startTransition` vem de `PedidosClient` — um único useTransition
 * por página, compartilhado com o filtro de período (ORD-50).
 */
export function usePedidosBusca(
  initialQuery: string,
  startTransition: (callback: () => void) => void,
  extraParams: Record<string, string> = {}
) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const trimmed = value.trim();
      const params = new URLSearchParams(extraParams);
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/painel/pedidos?${qs}` : "/painel/pedidos", { scroll: false });
      });
    }, DEBOUNCE_MS);
  };

  return { query, onQueryChange };
}
```

- [ ] **Step 2: Update `app/painel/pedidos/PedidosClient.tsx`**

Replace the full file content with:

```tsx
"use client";

import { useTransition } from "react";
import { Receipt, Search, CalendarSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Toast } from "@/components/ui/Toast";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import { OrderRowSkeleton } from "@/components/painel/OrderRowSkeleton";
import { cn, formatCents, formatDeliveryLine, formatPaymentLine } from "@/lib/utils";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";
import { activePeriodToken } from "@/lib/period-filter";
import type { StoreOrder, StoreOrderItem } from "@/lib/types";
import { usePedidos } from "./use-pedidos";
import { usePedidosBusca } from "./use-pedidos-busca";

interface PedidosClientProps {
  orders: StoreOrder[];
  total: number;
  page: number;
  totalPages: number;
  query?: string;
  periodo?: string;
  de?: string;
  ate?: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

const STATUS_TONES: Record<OrderStatus, "soldout" | "success" | "error"> = {
  pendente: "soldout",
  confirmado: "success",
  cancelado: "error",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatOrderDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

function variationLabel(item: StoreOrderItem): string {
  const parts: string[] = [];
  if (item.size) parts.push(`Tamanho ${item.size}`);
  if (item.color) parts.push(`Cor ${item.color}`);
  return parts.join(" · ");
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}

function OrderCodeTag({ code }: { code: string }) {
  return (
    <span className="flex-shrink-0 font-mono text-[11px] tracking-[0.04em] text-graphite bg-linen border border-sand/60 rounded-pill px-2 py-0.5">
      {code}
    </span>
  );
}

export function PedidosClient({
  orders,
  total,
  page,
  totalPages,
  query = "",
  periodo,
  de,
  ate,
}: PedidosClientProps) {
  const { selected, openOrder, closeOrder, toast, statusAction, statusPending } =
    usePedidos(orders);
  const [filtersPending, startTransition] = useTransition();

  const periodParams: Record<string, string> = {};
  if (periodo) periodParams.periodo = periodo;
  if (de) periodParams.de = de;
  if (ate) periodParams.ate = ate;

  const { query: searchTerm, onQueryChange } = usePedidosBusca(
    query,
    startTransition,
    periodParams
  );

  const searchExtraParams: Record<string, string> = query ? { q: query } : {};
  const paginationExtraParams = { ...searchExtraParams, ...periodParams };

  const activeToken = activePeriodToken({ periodo, de, ate });
  const isSearching = query !== "";
  const isPeriodFiltered = activeToken !== "mes";
  const isFiltering = isSearching || isPeriodFiltered;
  const showSearch = isFiltering || orders.length > 0;

  const subtitle = isSearching
    ? total === 0
      ? `Nenhum pedido combina com "${query}".`
      : `${total} ${total === 1 ? "pedido encontrado" : "pedidos encontrados"}`
    : isPeriodFiltered
      ? total === 0
        ? "Nenhum pedido no período selecionado."
        : `${total} ${total === 1 ? "pedido no período" : "pedidos no período"}`
      : total === 0
        ? "Os pedidos enviados pela sacola aparecem aqui."
        : `${total} ${total === 1 ? "pedido recebido" : "pedidos recebidos"}`;

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div>
        <h1 className="font-display font-semibold text-[28px] text-obsidian">Pedidos</h1>
        <p className="font-body text-[15px] text-graphite mt-1.5">{subtitle}</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        {showSearch && (
          <div className="relative flex-1">
            {filtersPending ? (
              <Loader2
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite animate-spin pointer-events-none z-10"
                data-testid="busca-pedidos-loading"
              />
            ) : (
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite pointer-events-none z-10"
              />
            )}
            <Input
              value={searchTerm}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Buscar por código ou nome do cliente..."
              aria-label="Buscar por código ou nome do cliente"
              className="pl-9"
            />
          </div>
        )}
        <PeriodoFiltro
          basePath="/painel/pedidos"
          periodo={periodo}
          de={de}
          ate={ate}
          extraParams={searchExtraParams}
          isPending={filtersPending}
          startTransition={startTransition}
        />
      </div>

      {filtersPending ? (
        <Card pad={0} className="overflow-hidden">
          {Array.from({ length: orders.length || 6 }).map((_, i) => (
            <OrderRowSkeleton key={i} first={i === 0} />
          ))}
        </Card>
      ) : orders.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
              {isSearching ? (
                <Search size={42} />
              ) : isPeriodFiltered ? (
                <CalendarSearch size={42} />
              ) : (
                <Receipt size={42} />
              )}
            </div>
            {isSearching ? (
              <div>
                <div className="font-display font-semibold text-[20px] text-obsidian">
                  Nenhum pedido encontrado
                </div>
                <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                  Nenhum pedido desta loja combina com “{query}”. Tente o código que
                  chegou no WhatsApp ou parte do nome do cliente.
                </p>
              </div>
            ) : isPeriodFiltered ? (
              <div>
                <div className="font-display font-semibold text-[20px] text-obsidian">
                  Nenhum pedido no período
                </div>
                <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                  Nenhum pedido desta loja caiu no período selecionado. Tente escolher
                  outro período acima.
                </p>
              </div>
            ) : (
              <div>
                <div className="font-display font-semibold text-[20px] text-obsidian">
                  Nenhum pedido ainda
                </div>
                <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                  Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui
                  com os itens e o total.
                </p>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <>
          <Card pad={0} className="overflow-hidden">
            {orders.map((order, i) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openOrder(order.id)}
                aria-label={`Ver detalhe do pedido de ${order.customerName ?? "Sem nome"}`}
                className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-linen/50 transition-colors"
                style={{ borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display font-medium text-[15px] text-obsidian truncate">
                      {order.customerName ?? "Sem nome"}
                    </span>
                    <OrderCodeTag code={order.code} />
                  </div>
                  <div className="font-body text-[13px] text-graphite mt-0.5">
                    {formatOrderDate(order.createdAt)} · {itemsLabel(order.itemsCount)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className="font-display font-medium text-[15px] text-obsidian">
                    {formatCents(order.totalCents)}
                  </span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </button>
            ))}
          </Card>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            basePath="/painel/pedidos"
            extraParams={paginationExtraParams}
          />
        </>
      )}

      {selected && (
        <Modal title="Detalhe do pedido" onClose={closeOrder} className="max-w-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display font-medium text-[16px] text-obsidian truncate">
                  {selected.customerName ?? "Sem nome"}
                </span>
                <OrderCodeTag code={selected.code} />
              </div>
              <div className="font-body text-[13px] text-graphite mt-0.5">
                {formatOrderDate(selected.createdAt)}
              </div>
            </div>
            <OrderStatusBadge status={selected.status} />
          </div>

          <div className="flex flex-col">
            {selected.items.map((item, i) => {
              const variation = variationLabel(item);
              return (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 py-3"
                  style={{
                    borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-body text-[14px] text-obsidian">
                      {item.productName}
                    </div>
                    {variation && (
                      <div className="font-body text-[13px] text-graphite mt-0.5">
                        {variation}
                      </div>
                    )}
                    <div className="font-body text-[13px] text-graphite mt-0.5">
                      {item.qty}x {formatCents(item.unitPriceCents)}
                    </div>
                  </div>
                  <span className="font-body font-medium text-[14px] text-obsidian flex-shrink-0">
                    {formatCents(item.unitPriceCents * item.qty)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1">
            {formatPaymentLine(selected.paymentMethod) && (
              <p className="font-body text-[14px] text-graphite">
                {formatPaymentLine(selected.paymentMethod)}
              </p>
            )}
            {formatDeliveryLine(selected.deliveryMethod, selected.deliveryAddress) && (
              <p className="font-body text-[14px] text-graphite">
                {formatDeliveryLine(selected.deliveryMethod, selected.deliveryAddress)}
              </p>
            )}
          </div>

          <div
            className="flex items-center justify-between pt-4"
            style={{ borderTop: "0.5px solid var(--color-border)" }}
          >
            <span className="font-body text-[14px] text-graphite">Total</span>
            <span className="font-display font-semibold text-[20px] text-obsidian">
              {formatCents(selected.totalCents)}
            </span>
          </div>

          <form action={statusAction} className="flex flex-col gap-2.5">
            <input type="hidden" name="id" value={selected.id} />
            <span className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Status da venda
            </span>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  type="submit"
                  name="status"
                  value={status}
                  disabled={statusPending}
                  className={cn(
                    "min-h-9 px-4 rounded-pill border font-body text-[13px] transition-colors",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    status === selected.status
                      ? "bg-obsidian border-obsidian text-white"
                      : "bg-transparent border-sand text-obsidian hover:bg-surface-hover"
                  )}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} tone={toast.tone} />}
    </div>
  );
}
```

- [ ] **Step 3: Replace `__tests__/PedidosClient.test.tsx` with the updated test suite**

The full file is large (existing search/period/status/empty-state coverage is unchanged in *intent*) — this step lists exactly what changes relative to the file as it exists right now on disk (after the Task 9/loading-feedback work earlier this session):

1. Remove the `let mockSearchPending = false; vi.mock("react", ...)` block entirely (no longer needed — `PeriodoFiltro` takes `isPending` as a prop, and `PedidosClient` now owns a real `useTransition` that resolves synchronously with the mocked, synchronous `router.replace`, exactly like `DashboardClient.test.tsx`). Remove `mockSearchPending = false;` from `beforeEach`.
2. Delete the two tests in the `"PedidosClient — feedback de carregamento da busca (ORD-49)"` describe block (`mockSearchPending` no longer exists to control) and replace that whole describe block with the one below, which drives the **shared** `filtersPending` through `PeriodoFiltro`'s now-required `startTransition` prop instead — mirroring how `DashboardClient.test.tsx` (Task 4) validates prop wiring rather than re-testing `useTransition` mechanics: assert that changing a preset in `PeriodoFiltro` and the search box both funnel through the same injected `startTransition`, and that when a transition is genuinely pending (simulated the same way `PeriodoFiltro.test.tsx` does — by rendering with a controlled `isPending`), both the search icon and the list turn into their loading state.

Since `PedidosClient` computes `filtersPending` internally via its own `useTransition` (not a prop), the cleanest way to test "the list/icon show loading while pending" without re-deriving async transition timing is to keep a **local, file-scoped mock of `react`'s `useTransition`** for *this* file only (unlike `PeriodoFiltro.test.tsx`, which no longer needs it because it receives `isPending` as a prop — `PedidosClient` still owns the hook itself, so it still needs this technique). Keep the existing mock, but rename `mockSearchPending` to `mockFiltersPending` for clarity, and use it to cover both the icon swap and the new skeleton:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { PedidosClient } from "@/app/painel/pedidos/PedidosClient";
import type { StoreOrder } from "@/lib/types";

const updateOrderStatus = vi.fn();
const replace = vi.fn();

vi.mock("@/app/actions/pedidos", () => ({
  updateOrderStatus: (...args: unknown[]) => updateOrderStatus(...args),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

/**
 * `PedidosClient` owns its own `useTransition` (shared by search + período —
 * ORD-50). Com `router.replace` mockado (síncrono), a transição real nunca
 * fica "pending" de forma observável — controlamos aqui, igual
 * `PeriodoFiltro.test.tsx` fazia antes de isPending virar prop. O default
 * (`false`, `startTransition` chamando o callback na hora) reproduz o
 * comportamento real para todos os outros testes deste arquivo.
 */
let mockFiltersPending = false;
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useTransition: () => [mockFiltersPending, (callback: () => void) => callback()],
  };
});

beforeEach(() => {
  updateOrderStatus.mockReset();
  updateOrderStatus.mockResolvedValue({ ok: true });
  replace.mockReset();
  mockFiltersPending = false;
});
```

Keep every existing `makeOrder`, `openDetail`, and the full body of every describe block **exactly as they are today** (`"PedidosClient — lista do histórico"`, `"código do pedido"`, `"busca por código ou nome"`, `"paginação"`, `"detalhe do pedido"`, `"mudança de status"`, `"estado vazio"`, `"estado vazio de busca"`, `"filtro de período"`) — none of their assertions change, since `filtersPending` defaults to `false` and the component's non-loading rendering path is byte-for-byte the same as before. Only replace the final describe block:

```tsx
describe("PedidosClient — feedback de carregamento (ORD-50)", () => {
  it("mostra um spinner no lugar do ícone de busca enquanto qualquer filtro está pendente", () => {
    mockFiltersPending = true;
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.getByTestId("busca-pedidos-loading")).toBeTruthy();
  });

  it("mostra o ícone de busca normal quando não há filtro pendente", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.queryByTestId("busca-pedidos-loading")).toBeNull();
  });

  it("mostra o dropdown de período em estado pendente enquanto qualquer filtro está pendente", () => {
    mockFiltersPending = true;
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.getByTestId("periodo-filtro-loading")).toBeTruthy();
  });

  it("mostra o skeleton da lista no lugar dos pedidos reais enquanto qualquer filtro está pendente", () => {
    mockFiltersPending = true;
    render(
      <PedidosClient
        orders={[makeOrder(), makeOrder({ id: "o2" })]}
        total={2}
        page={1}
        totalPages={1}
      />
    );

    expect(screen.queryByText("Ana")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Ver detalhe do pedido/ })
    ).toBeNull();
  });

  it("volta a mostrar a lista real quando o filtro deixa de estar pendente", () => {
    const { rerender } = render(
      <PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />
    );

    expect(screen.getByText("Ana")).toBeTruthy();

    mockFiltersPending = true;
    rerender(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);
    expect(screen.queryByText("Ana")).toBeNull();

    mockFiltersPending = false;
    rerender(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);
    expect(screen.getByText("Ana")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/PedidosClient.test.tsx`
Expected: PASS (all tests — the file had 38 before this task; this step removes 2 and adds 5, net 41)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors from Pedidos-related files. If Task 6 hasn't run yet, Produtos-related errors (if any newly introduced by an out-of-order execution) are not expected here since this task doesn't touch Produtos files.

- [ ] **Step 6: Commit**

```bash
git add app/painel/pedidos/use-pedidos-busca.ts app/painel/pedidos/PedidosClient.tsx __tests__/PedidosClient.test.tsx
git commit -m "$(cat <<'EOF'
feat(painel): skeleton na lista de Pedidos ao trocar busca ou período

PedidosClient passa a ter um único useTransition compartilhado entre
usePedidosBusca e PeriodoFiltro — qualquer um dos dois filtros aciona
o mesmo estado de carregamento, que troca a lista inteira (e o ícone
de busca) pelo skeleton enquanto a navegação está pendente.
EOF
)"
```

---

### Task 6: Produtos — skeleton na listagem para nome, categoria ou status

**Files:**
- Modify: `app/painel/produtos/use-produtos-filtros.ts`
- Modify: `app/painel/produtos/ProdutosClient.tsx`
- Modify: `__tests__/ProdutosClient.test.tsx`

**Interfaces:**
- Consumes: `ProductRowSkeleton` from `@/components/painel/ProductRowSkeleton` (Task 2).
- Produces: `useProdutosFiltros(initialQ, initialCategoria, initialStatus, startTransition)` — `startTransition` is now the 4th (required) parameter.

- [ ] **Step 1: Add the failing loading tests to `__tests__/ProdutosClient.test.tsx`**

Add this near the top of the file, right after the existing `vi.mock("@/app/actions/produtos", ...)` block:

```tsx
/**
 * ProdutosClient possui seu próprio useTransition (compartilhado entre busca,
 * categoria e status — ORD-50). Com router.replace mockado (síncrono),
 * controlamos isPending diretamente, mesma técnica de
 * `__tests__/PedidosClient.test.tsx`.
 */
let mockFiltersPending = false;
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useTransition: () => [mockFiltersPending, (callback: () => void) => callback()],
  };
});
```

Add a `beforeEach` right after the `noFilters` constant and before the first `describe` (the file has none today):

```tsx
beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  mockFiltersPending = false;
});
```

Append this new describe block at the end of the file:

```tsx
describe("ProdutosClient — feedback de carregamento (ORD-50)", () => {
  it("mostra o skeleton da listagem no lugar dos produtos reais enquanto o filtro está pendente", () => {
    mockFiltersPending = true;
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        limits={baseLimits}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[]}
        {...noFilters}
      />
    );

    expect(screen.queryByText("Vestido midi")).toBeNull();
  });

  it("não mostra o skeleton quando o filtro não está pendente", () => {
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        limits={baseLimits}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[]}
        {...noFilters}
      />
    );

    expect(screen.getByText("Vestido midi")).toBeTruthy();
  });

  it("desabilita os filtros de categoria e status enquanto o filtro está pendente", () => {
    mockFiltersPending = true;
    render(
      <ProdutosClient
        products={[makeProduct()]}
        maxProducts={Infinity}
        limits={baseLimits}
        counts={baseCounts}
        page={1}
        totalPages={1}
        categories={[{ id: "cat-1", name: "Vestidos" }]}
        {...noFilters}
      />
    );

    expect(
      screen
        .getByText("Todas as categorias")
        .closest('[class*="pointer-events-none"]')
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify the new tests fail**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: the pre-existing tests still PASS (mocking `react` with `...actual` spread + `mockFiltersPending` defaulting to `false` reproduces today's behavior exactly), but the 3 new "ORD-50" tests FAIL — `filtersPending` isn't wired into the component yet, so the skeleton never renders and the `Select` wrappers never dim.

- [ ] **Step 3: Update `app/painel/produtos/use-produtos-filtros.ts`**

Replace the full file content with:

```ts
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

export function useProdutosFiltros(
  initialQ: string,
  initialCategoria: string,
  initialStatus: string,
  startTransition: (callback: () => void) => void
) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const qRef = useRef(initialQ);
  const categoriaRef = useRef(initialCategoria);
  const statusRef = useRef(initialStatus);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replace = (nextQ: string, nextCategoria: string, nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextCategoria) params.set("categoria", nextCategoria);
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    startTransition(() => {
      router.replace(`/painel/produtos${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  };

  const onQChange = (value: string) => {
    setQ(value);
    qRef.current = value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      replace(value, categoriaRef.current, statusRef.current);
    }, DEBOUNCE_MS);
  };

  const onCategoriaChange = (value: string) => {
    categoriaRef.current = value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    replace(qRef.current, value, statusRef.current);
  };

  const onStatusChange = (value: string) => {
    statusRef.current = value;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    replace(qRef.current, categoriaRef.current, value);
  };

  const clearFilters = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setQ("");
    qRef.current = "";
    categoriaRef.current = "";
    statusRef.current = "";
    replace("", "", "");
  };

  return { q, onQChange, onCategoriaChange, onStatusChange, clearFilters };
}
```

(Only change: `startTransition` param added, and the single `router.replace` call site wrapped in it.)

- [ ] **Step 4: Update `app/painel/produtos/ProdutosClient.tsx`**

Apply these exact edits to the current file:

**4a. Add the `useTransition` import and the shared row-skeleton import:**

```tsx
import { useState } from "react";
```
becomes:
```tsx
import { useState, useTransition } from "react";
```

Add, alongside the other `@/components/painel/...` import:
```tsx
import { ImportarProdutosModal } from "@/components/painel/ImportarProdutosModal";
```
becomes:
```tsx
import { ImportarProdutosModal } from "@/components/painel/ImportarProdutosModal";
import { ProductRowSkeleton } from "@/components/painel/ProductRowSkeleton";
```

**4b. Create the page-level transition and pass it to the filters hook:**

```tsx
  const { q, onQChange, onCategoriaChange, onStatusChange, clearFilters } =
    useProdutosFiltros(initialQ, initialCategoria, initialStatus);
```
becomes:
```tsx
  const [filtersPending, startTransition] = useTransition();

  const { q, onQChange, onCategoriaChange, onStatusChange, clearFilters } =
    useProdutosFiltros(initialQ, initialCategoria, initialStatus, startTransition);
```

**4c. Dim the two `Select` filters while pending** (the search `Input` stays interactive, same decision already made for Pedidos — don't block typing):

```tsx
            <div className="w-full sm:w-[200px]">
              <Select
                value={categoriaLabel || "Todas as categorias"}
```
becomes:
```tsx
            <div
              className={cn(
                "w-full sm:w-[200px]",
                filtersPending && "opacity-60 pointer-events-none"
              )}
            >
              <Select
                value={categoriaLabel || "Todas as categorias"}
```

```tsx
            <div className="w-full sm:w-[180px]">
              <Select
                value={statusLabel || "Todos os status"}
```
becomes:
```tsx
            <div
              className={cn(
                "w-full sm:w-[180px]",
                filtersPending && "opacity-60 pointer-events-none"
              )}
            >
              <Select
                value={statusLabel || "Todos os status"}
```

**4d. Show the skeleton in place of the real list while pending:**

```tsx
          {products.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
                  <Search size={42} />
                </div>
                <div>
                  <div className="font-display font-semibold text-[20px] text-obsidian">
                    Nenhum produto encontrado
                  </div>
                  <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                    Tente ajustar sua busca ou filtro.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
```
becomes:
```tsx
          {filtersPending ? (
            <Card pad={0} className="overflow-hidden">
              {Array.from({ length: products.length || 6 }).map((_, i) => (
                <ProductRowSkeleton key={i} first={i === 0} />
              ))}
            </Card>
          ) : products.length === 0 ? (
            <Card className="py-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-full bg-linen flex items-center justify-center text-inactive">
                  <Search size={42} />
                </div>
                <div>
                  <div className="font-display font-semibold text-[20px] text-obsidian">
                    Nenhum produto encontrado
                  </div>
                  <p className="font-body text-[15px] text-graphite mt-2 max-w-sm mx-auto">
                    Tente ajustar sua busca ou filtro.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
```

No other part of the file changes — the closing `)}` structure for this ternary, the real-list rendering, the pagination, the delete-confirm modal, and every helper component (`ProductThumbnail`, `StockLabel`, `VisibilityToggle`, `FeaturedToggle`, `ProductActions`) stay exactly as they are today.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run __tests__/ProdutosClient.test.tsx`
Expected: PASS (all tests — 10 pre-existing + 3 new = 13)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors anywhere in the project — this is the last task touching source files, so all three pages (Dashboard, Pedidos, Produtos) should now be fully wired.

- [ ] **Step 7: Commit**

```bash
git add app/painel/produtos/use-produtos-filtros.ts app/painel/produtos/ProdutosClient.tsx __tests__/ProdutosClient.test.tsx
git commit -m "$(cat <<'EOF'
feat(painel): skeleton na listagem de Produtos ao trocar nome/categoria/status

ProdutosClient passa a ter um useTransition próprio, repassado para
useProdutosFiltros — qualquer um dos três filtros troca a listagem
inteira pelo skeleton e desabilita visualmente os dois dropdowns
enquanto a navegação está pendente. O campo de busca continua digitável.
EOF
)"
```

---

### Task 7: Final verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: every test file green except the pre-existing, unrelated `__tests__/tailwind-alpha-utilities.test.ts` failure (missing `tailwindcss` binary in this environment's `node_modules/.bin`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors from any file touched in this plan. The 19 pre-existing errors in `app/[slug]/use-catalogo.ts`, `app/painel/configuracoes/ConfiguracoesClient.tsx`, and `components/ui/SlugInput.tsx` are expected and out of scope (confirmed in the prior loading-feedback round of work on this branch — none of those three files are touched by this plan).

- [ ] **Step 4: Manual browser verification (if a working `.env.local`/local Supabase session is available)**

- `/painel`: trigger a period change and confirm the 3 "Vendas pela vitrine" `StatCard`s show a spinner briefly, and the product-count cards above do not.
- `/painel/pedidos`: type in the search box and confirm the list turns into skeleton rows and the search icon becomes a spinner; separately, change the period dropdown and confirm the same skeleton appears; confirm the list returns to real rows (or the correct empty state) once the navigation resolves.
- `/painel/produtos`: change the name search, the category dropdown, and the status dropdown (each independently) and confirm the listing turns into skeleton rows each time, and the two `Select` dropdowns visually dim while pending.
- Reload `/painel` directly (hard navigation) and confirm the initial-load skeleton no longer shows any trace of a "Produtos recentes" table.

If no working local environment is available in this session, say so explicitly rather than claiming this step was completed — this is consistent with how the previous rounds of work on this branch handled the same environment limitation (no `.env.local`, `protect-env.sh` blocks creating one in this worktree).

- [ ] **Step 5: Report results**

No commit for this task — verification only. If any step surfaces a regression, fix it within the task where it belongs (re-open that task's files/tests) rather than patching ad hoc here.

---

## Self-Review

**Spec coverage:** Dashboard StatCard spinner ✅ (Task 4), Pedidos list skeleton for search-or-period ✅ (Task 5), Produtos list skeleton for name/categoria/status ✅ (Task 6), unified `useTransition` per page injected into `PeriodoFiltro`/`usePedidosBusca`/`useProdutosFiltros` ✅ (Tasks 3, 5, 6), shared skeleton row components reused by both `loading.tsx` and the client components ✅ (Task 2), orphaned "Produtos recentes" skeleton removed from `app/painel/loading.tsx` ✅ (Task 2).

**Placeholder scan:** none — every step has complete, runnable code; Task 6 Step 2 uses precise before/after snippets (not full-file dumps, since `ProdutosClient.tsx` is 513 lines and only ~20 lines actually change) but each snippet is complete and exact, not elided.

**Type consistency:** `startTransition: (callback: () => void) => void` is the exact same signature used consistently across `PeriodoFiltro`, `usePedidosBusca`, and `useProdutosFiltros`; `isPending`/`filtersPending` naming is consistent within each file (`isPending` inside `PeriodoFiltro` and `DashboardClient`, `filtersPending` inside `PedidosClient`/`ProdutosClient` to avoid colliding with their pre-existing, unrelated `isPending`/`statusPending`).
