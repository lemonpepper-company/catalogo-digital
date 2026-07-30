# Filtro de período (Dashboard/Pedidos) e remoção de Produtos recentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Produtos recentes" list from the Dashboard, and add a shared period filter (presets + custom range) used both by "Vendas pela vitrine" on the Dashboard and by the order history at `/painel/pedidos`.

**Architecture:** A new pure module (`lib/period-filter.ts`) resolves URL search params into a `{ from, to } | null` date range in the `America/Sao_Paulo` timezone, built on top of a new shared timezone-helpers module (`lib/timezone-sp.ts`) extracted from the existing month-boundary logic. `lib/server/pedidos.ts` accepts that range and applies it to the Supabase queries. A new client component (`components/painel/PeriodoFiltro.tsx`) renders the preset pills + custom range inputs and keeps the period in the URL, following the same URL-as-source-of-truth pattern already used by search/pagination in this codebase.

**Tech Stack:** Next.js App Router (Server Components + Server Actions), Supabase (`@supabase/ssr`), Vitest + Testing Library, Tailwind (hand-rolled design system in `components/ui/`), no date library (native `<input type="date">`).

**Spec:** [docs/superpowers/specs/2026-07-29-filtro-de-periodo-dashboard-e-pedidos-design.md](../specs/2026-07-29-filtro-de-periodo-dashboard-e-pedidos-design.md)

## Global Constraints

- Timezone for all period math is always `America/Sao_Paulo` (fixed UTC-3, no DST in Brazil since 2019) — reuse the existing zoned-parts algorithm from `lib/order-metrics.ts`, don't reinvent it.
- No new dependency: custom date range uses native `<input type="date">`, no date-picker library.
- Presets: "Hoje", "7 dias", "Este mês" (default), "Todo período" — exactly these four, in this order.
- URL is the source of truth for the period (`periodo=hoje|7d|mes|tudo`, or `de=YYYY-MM-DD&ate=YYYY-MM-DD` for custom — `de`/`ate` take priority over `periodo` when both present). The default preset ("mes") is never written to the URL, same convention as `page=1` today.
- Invalid/malformed period params (unknown preset, malformed date, `ate` before `de`) silently fall back to the default ("mes") — never throw.
- In Pedidos, the period filter combines with the existing code/name search with logical AND, and resets pagination to page 1 (same as search already does).
- The plan gate (`getPlanLimits(...).hasOrderHistory`) is checked **before** any I/O or period resolution, exactly as today — Free-plan users never trigger a period computation or a Supabase query.
- No database schema changes in this feature — no new columns/tables, so no Supabase grant migration is needed (nothing in `docs/CONVENTIONS.md`'s Supabase section applies here).
- Test commands: `npx vitest run <path>` for a single file, `npm test -- --run` for the full suite, `npm run lint` for ESLint, `npx tsc --noEmit` for type-checking.

---

## File Structure

**New files:**
- `lib/timezone-sp.ts` — low-level São Paulo timezone helpers (day/month boundaries).
- `lib/period-filter.ts` — pure period-resolution logic (`resolvePeriodRange`, `activePeriodToken`), used by both surfaces.
- `components/painel/PeriodoFiltro.tsx` — shared client component (presets + custom range UI, writes to the URL).
- `__tests__/timezone-sp.test.ts`, `__tests__/period-filter.test.ts`, `__tests__/PeriodoFiltro.test.tsx` — tests for the above.

**Modified files:**
- `lib/order-metrics.ts` — re-exports `monthStartInSaoPaulo` from `lib/timezone-sp.ts` instead of defining it locally (no behavior change).
- `lib/server/pedidos.ts` — `getOrderMetrics`/`getStoreOrders` accept a `PeriodRange | null` and apply it to the Supabase queries.
- `app/painel/page.tsx`, `app/painel/DashboardClient.tsx`, `app/painel/use-dashboard.ts` — remove "Produtos recentes"; wire the period filter into "Vendas pela vitrine".
- `app/painel/pedidos/page.tsx`, `app/painel/pedidos/PedidosClient.tsx`, `app/painel/pedidos/use-pedidos-busca.ts` — wire the period filter into the order list, combined with search.
- `__tests__/server-pedidos.test.ts`, `__tests__/DashboardClient.test.tsx`, `__tests__/DashboardPage.test.tsx`, `__tests__/PedidosClient.test.tsx`, `__tests__/PedidosPage.test.tsx` — updated/extended for the above.

`__tests__/order-metrics.test.ts` needs **no changes** (it only imports `monthStartInSaoPaulo`/`computeOrderMetrics` from `lib/order-metrics.ts`, both of which keep their exact current behavior).

---

### Task 1: Remove "Produtos recentes" from the Dashboard

**Files:**
- Modify: `app/painel/DashboardClient.tsx`
- Modify: `app/painel/use-dashboard.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `useDashboard(products, catalogUrl, metrics)` no longer returns `recent`. `DashboardClient` no longer renders a "Produtos recentes" section. Later tasks (6) will further modify these same two files (period filter wiring) — do this removal first so that work starts from a clean baseline.

- [ ] **Step 1: Confirm the test baseline is green before touching anything**

Run: `npx vitest run __tests__/DashboardClient.test.tsx __tests__/DashboardPage.test.tsx`
Expected: PASS (both files, all tests) — this file has no test that references "Produtos recentes" today, so removal itself won't fail anything; this step is a safety net.

- [ ] **Step 2: Remove the "recent" products list from `DashboardClient.tsx`**

Replace the full file content with:

```tsx
"use client";

import Link from "next/link";
import { Plus, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { formatCents } from "@/lib/utils";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  catalogUrl: string;
  metrics: OrderMetrics | null;
}

export function DashboardClient({
  products,
  storeName,
  catalogUrl,
  metrics,
}: DashboardClientProps) {
  const { copied, toast, handleCopy, activeProducts, soldOutProducts, total, orderStats } =
    useDashboard(products, catalogUrl, metrics);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {orderStats.map((stat) => (
              <StatCard key={stat.label} value={stat.value} label={stat.label} />
            ))}
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

Note: `Image` (from `next/image`) and `formatCents` were only used by the removed section — both imports are dropped. `formatCents` is unused in this file now (it moves fully into `use-dashboard.ts`, which already imports it for `confirmedCentsThisMonth`).

- [ ] **Step 3: Remove the `recent` calculation from `use-dashboard.ts`**

Replace the full file content with:

```ts
"use client";

import { useState } from "react";
import { formatCents } from "@/lib/utils";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";

export function useDashboard(
  products: StoreProduct[],
  catalogUrl: string,
  metrics: OrderMetrics | null
) {
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(catalogUrl).catch(() => {});
    setCopied(true);
    flash("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const activeProducts = products.filter((p) => p.isActive && p.stock > 0);
  const soldOutProducts = products.filter((p) => p.stock === 0);

  // `null` = plano sem histórico de pedidos: nenhum número real existe aqui.
  const orderStats = metrics
    ? [
        { value: metrics.ordersThisMonth, label: "Pedidos no mês" },
        {
          value: formatCents(metrics.confirmedCentsThisMonth),
          label: "Vendas confirmadas no mês",
        },
        { value: metrics.pendingCount, label: "Aguardando confirmação" },
      ]
    : null;

  return {
    copied,
    toast,
    handleCopy,
    activeProducts,
    soldOutProducts,
    total: products.length,
    orderStats,
  };
}
```

(Labels still say "no mês" here — Task 6 renames them once the period filter exists. Keeping this step scoped only to the removal avoids mixing concerns.)

- [ ] **Step 4: Run the Dashboard tests again to confirm no regression**

Run: `npx vitest run __tests__/DashboardClient.test.tsx __tests__/DashboardPage.test.tsx`
Expected: PASS (both files, all tests, same as Step 1 — the removal touched no tested behavior)

- [ ] **Step 5: Commit**

```bash
git add app/painel/DashboardClient.tsx app/painel/use-dashboard.ts
git commit -m "$(cat <<'EOF'
refactor(painel): remove lista de Produtos recentes da Dashboard

Não fazia sentido essa navegação estar num dashboard de resumo — já
existe /painel/produtos para isso.
EOF
)"
```

---

### Task 2: Extract shared São Paulo timezone helpers

**Files:**
- Create: `lib/timezone-sp.ts`
- Test: `__tests__/timezone-sp.test.ts`
- Modify: `lib/order-metrics.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `monthStartInSaoPaulo(date: Date): Date`, `dayStartInSaoPaulo(date: Date): Date`, `dayEndInSaoPaulo(date: Date): Date`, `daysAgoStartInSaoPaulo(date: Date, daysAgo: number): Date` — all exported from `lib/timezone-sp.ts`. `lib/order-metrics.ts` re-exports `monthStartInSaoPaulo` from this new module (same import path `@/lib/order-metrics` keeps working for existing consumers). Task 3 (`lib/period-filter.ts`) imports directly from `lib/timezone-sp.ts`.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/timezone-sp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  monthStartInSaoPaulo,
  dayStartInSaoPaulo,
  dayEndInSaoPaulo,
  daysAgoStartInSaoPaulo,
} from "@/lib/timezone-sp";

describe("monthStartInSaoPaulo", () => {
  it("devolve 1º de janeiro às 00:00 de São Paulo (03:00 UTC)", () => {
    const start = monthStartInSaoPaulo(new Date("2026-01-15T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("usa o mês do fuso de São Paulo, não o de UTC, na virada do mês", () => {
    const start = monthStartInSaoPaulo(new Date("2026-08-01T01:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-01T03:00:00.000Z");
  });
});

describe("dayStartInSaoPaulo", () => {
  it("devolve meia-noite de São Paulo (03:00 UTC) do dia informado", () => {
    const start = dayStartInSaoPaulo(new Date("2026-07-15T18:45:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-15T03:00:00.000Z");
  });

  it("usa o dia do fuso de São Paulo, não o de UTC, na virada do dia", () => {
    // 01:00 UTC de 16/07 ainda é 22:00 de 15/07 em São Paulo.
    const start = dayStartInSaoPaulo(new Date("2026-07-16T01:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-07-15T03:00:00.000Z");
  });
});

describe("dayEndInSaoPaulo", () => {
  it("devolve 23:59:59.999 de São Paulo (02:59:59.999 UTC do dia seguinte)", () => {
    const end = dayEndInSaoPaulo(new Date("2026-07-15T12:00:00.000Z"));
    expect(end.toISOString()).toBe("2026-07-16T02:59:59.999Z");
  });
});

describe("daysAgoStartInSaoPaulo", () => {
  it("devolve a meia-noite de São Paulo de N dias antes do dia informado", () => {
    const start = daysAgoStartInSaoPaulo(new Date("2026-07-15T18:45:00.000Z"), 6);
    expect(start.toISOString()).toBe("2026-07-09T03:00:00.000Z");
  });

  it("com 0 dias devolve a meia-noite do próprio dia (mesmo resultado de dayStartInSaoPaulo)", () => {
    const now = new Date("2026-07-15T18:45:00.000Z");
    expect(daysAgoStartInSaoPaulo(now, 0).toISOString()).toBe(
      dayStartInSaoPaulo(now).toISOString()
    );
  });

  it("atravessa a virada de mês corretamente", () => {
    const start = daysAgoStartInSaoPaulo(new Date("2026-07-03T12:00:00.000Z"), 6);
    expect(start.toISOString()).toBe("2026-06-27T03:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/timezone-sp.test.ts`
Expected: FAIL — `Cannot find module '@/lib/timezone-sp'` (or similar resolution error), since the module doesn't exist yet.

- [ ] **Step 3: Implement `lib/timezone-sp.ts`**

```ts
const TIME_ZONE = "America/Sao_Paulo";

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(date: Date): ZonedParts {
  const parts: Record<string, number> = {};
  for (const { type, value } of zonedFormatter.formatToParts(date)) {
    if (type !== "literal") parts[type] = Number(value);
  }
  // "24" aparece na meia-noite em algumas implementações de hourCycle.
  if (parts.hour === 24) parts.hour = 0;
  return parts as unknown as ZonedParts;
}

// Quanto o relógio de São Paulo está adiantado/atrasado em relação a UTC no instante dado.
function zoneOffsetMs(date: Date): number {
  const p = zonedParts(date);
  const asIfUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asIfUTC - date.getTime();
}

function zonedInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return new Date(naive - zoneOffsetMs(new Date(naive)));
}

/** Instante (em UTC) do dia 1 do mês de `date`, às 00:00, no fuso do lojista brasileiro. */
export function monthStartInSaoPaulo(date: Date): Date {
  const { year, month } = zonedParts(date);
  return zonedInstant(year, month, 1);
}

/** Instante (em UTC) do dia de `date`, às 00:00, no fuso do lojista brasileiro. */
export function dayStartInSaoPaulo(date: Date): Date {
  const { year, month, day } = zonedParts(date);
  return zonedInstant(year, month, day);
}

/** Instante (em UTC) do dia de `date`, às 23:59:59.999, no fuso do lojista brasileiro. */
export function dayEndInSaoPaulo(date: Date): Date {
  const { year, month, day } = zonedParts(date);
  return zonedInstant(year, month, day, 23, 59, 59, 999);
}

/** Meia-noite (fuso São Paulo) de `daysAgo` dias antes do dia de `date`. */
export function daysAgoStartInSaoPaulo(date: Date, daysAgo: number): Date {
  const { year, month, day } = zonedParts(date);
  return zonedInstant(year, month, day - daysAgo);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/timezone-sp.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Point `lib/order-metrics.ts` at the shared helper**

Replace the full file content with:

```ts
import type { OrderStatus } from "@/lib/orders";

export { monthStartInSaoPaulo } from "@/lib/timezone-sp";

export interface OrderMetrics {
  ordersThisMonth: number;
  confirmedCentsThisMonth: number;
  pendingCount: number;
}

export interface OrderMetricRow {
  status: OrderStatus;
  total_cents: number;
}

/**
 * `monthRows` são os pedidos já filtrados pelo período desejado (ver
 * `lib/period-filter.ts`); `pendingTotal` é a contagem de pendentes do mesmo
 * período (ou de todo o histórico quando o período é "tudo").
 */
export function computeOrderMetrics(
  monthRows: OrderMetricRow[],
  pendingTotal: number
): OrderMetrics {
  let ordersThisMonth = 0;
  let confirmedCentsThisMonth = 0;

  for (const row of monthRows) {
    if (row.status === "cancelado") continue;
    ordersThisMonth += 1;
    if (row.status === "confirmado") confirmedCentsThisMonth += row.total_cents;
  }

  return { ordersThisMonth, confirmedCentsThisMonth, pendingCount: pendingTotal };
}
```

- [ ] **Step 6: Run the existing order-metrics test to confirm no regression**

Run: `npx vitest run __tests__/order-metrics.test.ts`
Expected: PASS (all tests — `monthStartInSaoPaulo` behaves identically, `computeOrderMetrics` untouched)

- [ ] **Step 7: Commit**

```bash
git add lib/timezone-sp.ts lib/order-metrics.ts __tests__/timezone-sp.test.ts
git commit -m "$(cat <<'EOF'
refactor: extrai helpers de fuso de São Paulo para lib/timezone-sp.ts

Prepara o terreno para o filtro de período (lib/period-filter.ts), que
precisa dos mesmos cálculos de início/fim de dia, não só de mês.
EOF
)"
```

---

### Task 3: Period-resolution logic (`lib/period-filter.ts`)

**Files:**
- Create: `lib/period-filter.ts`
- Test: `__tests__/period-filter.test.ts`

**Interfaces:**
- Consumes: `dayStartInSaoPaulo`, `dayEndInSaoPaulo`, `daysAgoStartInSaoPaulo`, `monthStartInSaoPaulo` from `@/lib/timezone-sp` (Task 2).
- Produces: `type PeriodPreset = "hoje" | "7d" | "mes" | "tudo"`, `PERIOD_PRESETS: PeriodPreset[]`, `interface PeriodRange { from: Date; to: Date }`, `interface PeriodParams { periodo?: string; de?: string; ate?: string }`, `resolvePeriodRange(params: PeriodParams, now?: Date): PeriodRange | null`, `activePeriodToken(params: PeriodParams): PeriodPreset | "custom"`. Tasks 4, 5, 6 and 7 all import from here.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/period-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  resolvePeriodRange,
  activePeriodToken,
  PERIOD_PRESETS,
} from "@/lib/period-filter";

const NOW = new Date("2026-07-15T18:45:00.000Z"); // 15:45 em São Paulo

describe("resolvePeriodRange — presets", () => {
  it('"hoje" cobre desde a meia-noite de São Paulo até agora', () => {
    const range = resolvePeriodRange({ periodo: "hoje" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-15T03:00:00.000Z"), to: NOW });
  });

  it('"7d" cobre os últimos 7 dias corridos (hoje + 6 dias atrás) até agora', () => {
    const range = resolvePeriodRange({ periodo: "7d" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-09T03:00:00.000Z"), to: NOW });
  });

  it('"mes" cobre desde o dia 1 do mês corrente (fuso São Paulo) até agora', () => {
    const range = resolvePeriodRange({ periodo: "mes" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it('"tudo" não filtra por data (range null)', () => {
    const range = resolvePeriodRange({ periodo: "tudo" }, NOW);
    expect(range).toBeNull();
  });

  it("sem periodo informado usa o default (mes)", () => {
    const range = resolvePeriodRange({}, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("preset desconhecido cai no default (mes)", () => {
    const range = resolvePeriodRange({ periodo: "ano" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });
});

describe("resolvePeriodRange — range customizado", () => {
  it("de/ate válidos geram range do início do dia De até o fim do dia Até, fuso São Paulo", () => {
    const range = resolvePeriodRange({ de: "2026-07-01", ate: "2026-07-10" }, NOW);
    expect(range).toEqual({
      from: new Date("2026-07-01T03:00:00.000Z"),
      to: new Date("2026-07-11T02:59:59.999Z"),
    });
  });

  it("de/ate têm prioridade sobre periodo quando os dois vêm juntos", () => {
    const range = resolvePeriodRange(
      { periodo: "hoje", de: "2026-07-01", ate: "2026-07-10" },
      NOW
    );
    expect(range).toEqual({
      from: new Date("2026-07-01T03:00:00.000Z"),
      to: new Date("2026-07-11T02:59:59.999Z"),
    });
  });

  it("de sem ate ignora o range customizado e usa o preset (ou default)", () => {
    const range = resolvePeriodRange({ de: "2026-07-01" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("data malformada ignora o range customizado e cai no default (mes)", () => {
    const range = resolvePeriodRange({ de: "01-07-2026", ate: "2026-07-10" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("data inexistente (ex: 30 de fevereiro) ignora o range customizado", () => {
    const range = resolvePeriodRange({ de: "2026-02-30", ate: "2026-03-01" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });

  it("ate anterior a de ignora o range customizado e cai no default (mes)", () => {
    const range = resolvePeriodRange({ de: "2026-07-10", ate: "2026-07-01" }, NOW);
    expect(range).toEqual({ from: new Date("2026-07-01T03:00:00.000Z"), to: NOW });
  });
});

describe("activePeriodToken", () => {
  it("devolve o preset informado", () => {
    expect(activePeriodToken({ periodo: "hoje" })).toBe("hoje");
    expect(activePeriodToken({ periodo: "7d" })).toBe("7d");
    expect(activePeriodToken({ periodo: "tudo" })).toBe("tudo");
  });

  it("devolve mes quando nenhum periodo é informado", () => {
    expect(activePeriodToken({})).toBe("mes");
  });

  it('devolve "custom" quando de/ate válidos estão presentes', () => {
    expect(activePeriodToken({ de: "2026-07-01", ate: "2026-07-10" })).toBe("custom");
  });

  it("ignora de/ate inválidos e devolve o preset (ou default)", () => {
    expect(activePeriodToken({ de: "2026-07-10", ate: "2026-07-01" })).toBe("mes");
  });
});

describe("PERIOD_PRESETS", () => {
  it("lista os quatro presets na ordem esperada pela UI", () => {
    expect(PERIOD_PRESETS).toEqual(["hoje", "7d", "mes", "tudo"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/period-filter.test.ts`
Expected: FAIL — `Cannot find module '@/lib/period-filter'`

- [ ] **Step 3: Implement `lib/period-filter.ts`**

```ts
import {
  dayEndInSaoPaulo,
  dayStartInSaoPaulo,
  daysAgoStartInSaoPaulo,
  monthStartInSaoPaulo,
} from "@/lib/timezone-sp";

export type PeriodPreset = "hoje" | "7d" | "mes" | "tudo";

export const PERIOD_PRESETS: PeriodPreset[] = ["hoje", "7d", "mes", "tudo"];

export interface PeriodRange {
  from: Date;
  to: Date;
}

export interface PeriodParams {
  periodo?: string;
  de?: string;
  ate?: string;
}

function isPeriodPreset(value: string | undefined): value is PeriodPreset {
  return (PERIOD_PRESETS as string[]).includes(value ?? "");
}

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Meio-dia UTC do dia informado — evita ambiguidade de fuso ao validar o calendário. */
function parseDateInputAsUtcNoon(value: string): Date | null {
  if (!DATE_INPUT_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return date;
}

function resolveCustomRange(de?: string, ate?: string): PeriodRange | null {
  if (!de || !ate) return null;
  const deDate = parseDateInputAsUtcNoon(de);
  const ateDate = parseDateInputAsUtcNoon(ate);
  if (!deDate || !ateDate) return null;
  const from = dayStartInSaoPaulo(deDate);
  const to = dayEndInSaoPaulo(ateDate);
  if (from.getTime() > to.getTime()) return null;
  return { from, to };
}

/**
 * `null` = "tudo" (sem filtro de data). Range customizado (`de`/`ate` válidos)
 * tem prioridade sobre `periodo`. Combinações inválidas (preset desconhecido,
 * datas malformadas, `ate` antes de `de`) caem no default "mes" — nunca lança,
 * nunca vira "tudo" por engano.
 */
export function resolvePeriodRange(
  params: PeriodParams,
  now: Date = new Date()
): PeriodRange | null {
  const customRange = resolveCustomRange(params.de, params.ate);
  if (customRange) return customRange;

  const preset = isPeriodPreset(params.periodo) ? (params.periodo as PeriodPreset) : "mes";
  if (preset === "tudo") return null;
  if (preset === "hoje") return { from: dayStartInSaoPaulo(now), to: now };
  if (preset === "7d") return { from: daysAgoStartInSaoPaulo(now, 6), to: now };
  return { from: monthStartInSaoPaulo(now), to: now };
}

/** Preset ou "custom" atualmente ativo, para destacar o botão certo na UI. */
export function activePeriodToken(params: PeriodParams): PeriodPreset | "custom" {
  if (resolveCustomRange(params.de, params.ate)) return "custom";
  return isPeriodPreset(params.periodo) ? (params.periodo as PeriodPreset) : "mes";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/period-filter.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/period-filter.ts __tests__/period-filter.test.ts
git commit -m "$(cat <<'EOF'
feat: adiciona lib/period-filter.ts (presets + range customizado)

Lógica pura de resolução de período, compartilhada pela Dashboard e por
Pedidos — fuso America/Sao_Paulo, default "mes", fallback silencioso
para combinações inválidas de de/ate.
EOF
)"
```

---

### Task 4: Period-range filtering in `lib/server/pedidos.ts`

**Files:**
- Modify: `lib/server/pedidos.ts`
- Modify: `__tests__/server-pedidos.test.ts`

**Interfaces:**
- Consumes: `type PeriodRange` from `@/lib/period-filter` (Task 3).
- Produces: `getStoreOrders(storeId: string, page: number, query?: string, range?: PeriodRange | null): Promise<StoreOrdersPage>` (range defaults to `null`, so existing 2-arg/3-arg call sites keep working unchanged), `getOrderMetrics(storeId: string, range: PeriodRange | null): Promise<OrderMetrics>` (range is now **required** — no more implicit "current month"). Tasks 6 and 7 call these with a `range` resolved by `resolvePeriodRange`.

- [ ] **Step 1: Replace `__tests__/server-pedidos.test.ts` with the updated test suite**

This rewrites the whole file: adds `"lte"` to the fake chain's method list, adds a new `getStoreOrders` describe block for the period filter, and replaces the three `getOrderMetrics` describe blocks (they no longer receive a `now: Date` — they receive an already-resolved `range: PeriodRange | null`).

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PeriodRange } from "@/lib/period-filter";

const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from }),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_ID = "22222222-2222-4222-8222-222222222222";

type Result = { data?: unknown; error?: unknown; count?: number | null };

interface FakeChain {
  calls: Record<string, unknown[][]>;
  [key: string]: unknown;
}

const CHAIN_METHODS = ["select", "eq", "gte", "lte", "or", "order", "range"] as const;

/** Mesmo padrão de fake chain de `__tests__/registrar-pedido.test.ts:36-49`. */
function makeChain(result: Result): FakeChain {
  const calls: Record<string, unknown[][]> = {};
  const chain = { calls } as FakeChain;
  for (const method of CHAIN_METHODS) {
    chain[method] = (...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return chain;
    };
  }
  chain.then = (resolve: (value: Result) => unknown, reject?: () => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

/**
 * `results` são consumidos em ordem a cada `from("orders")`. Em `getStoreOrders`
 * a ordem é [contagem, lista]; em `getOrderMetrics` é [pedidos do período, pendentes].
 */
function setupSupabase(results: Result[]): FakeChain[] {
  const made: FakeChain[] = [];
  let index = 0;
  from.mockImplementation(() => {
    const chain = makeChain(results[index] ?? {});
    index += 1;
    made.push(chain);
    return chain;
  });
  return made;
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    code: "HS0L52",
    created_at: "2026-07-27T15:30:00.000Z",
    customer_name: "Ana",
    payment_method: "pix",
    delivery_method: "retirada",
    delivery_address: null,
    items_count: 2,
    total_cents: 39800,
    status: "pendente",
    order_items: [
      {
        product_name: "Vestido midi",
        unit_price_cents: 19900,
        qty: 2,
        size: "M",
        color: "Areia",
      },
    ],
    ...overrides,
  };
}

async function loadModule() {
  return import("@/lib/server/pedidos");
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  from.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("getStoreOrders — só os pedidos da própria loja, mais recentes primeiro (ORD-12)", () => {
  it("filtra a listagem por store_id", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("filtra a contagem total por store_id", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("ordena por created_at decrescente", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.order).toEqual([["created_at", { ascending: false }]]);
  });

  it("devolve os pedidos mapeados para o view model, com os itens aninhados", async () => {
    setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1);

    expect(result.orders).toEqual([
      {
        id: ORDER_ID,
        code: "HS0L52",
        createdAt: "2026-07-27T15:30:00.000Z",
        customerName: "Ana",
        paymentMethod: "pix",
        deliveryMethod: "retirada",
        deliveryAddress: null,
        itemsCount: 2,
        totalCents: 39800,
        status: "pendente",
        items: [
          {
            productName: "Vestido midi",
            unitPriceCents: 19900,
            qty: 2,
            size: "M",
            color: "Areia",
          },
        ],
      },
    ]);
  });
});

describe("getStoreOrders — páginas de 20 (ORD-13)", () => {
  it("pede as 20 primeiras linhas na página 1", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.range).toEqual([[0, 19]]);
    expect(result).toMatchObject({ total: 45, page: 1, totalPages: 3 });
  });

  it("pede as linhas 20..39 na página 2", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 2);

    expect(made[1].calls.range).toEqual([[20, 39]]);
    expect(result.page).toBe(2);
  });

  it("aplica clampPage: página acima do total cai na última", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 99);

    expect(result.page).toBe(3);
    expect(made[1].calls.range).toEqual([[40, 59]]);
  });

  it("aplica clampPage: página menor que 1 cai na primeira", async () => {
    const made = setupSupabase([{ count: 45 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 0);

    expect(result.page).toBe(1);
    expect(made[1].calls.range).toEqual([[0, 19]]);
  });

  it("loja sem pedidos → lista vazia com 1 página", async () => {
    setupSupabase([{ count: 0 }, { data: [] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1);

    expect(result).toEqual({ orders: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe("getStoreOrders — busca por código ou nome (ORD-35.10)", () => {
  const FILTER = "code.ilike.%ana%,customer_name.ilike.%ana%";

  it("filtra a listagem por código ou nome, case-insensitive via ilike", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "ana");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  it("aplica o mesmo filtro na contagem, mantendo o isolamento por loja", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "ana");

    expect(made[0].calls.or).toEqual([[FILTER]]);
    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
    expect(made[1].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("recalcula a paginação sobre o resultado filtrado", async () => {
    const made = setupSupabase([{ count: 25 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 2, "ana");

    expect(result).toMatchObject({ total: 25, page: 2, totalPages: 2 });
    expect(made[1].calls.range).toEqual([[20, 39]]);
  });

  it("busca com código parcial e em caixa baixa monta o filtro com o termo cru", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "hs0l");

    expect(made[1].calls.or).toEqual([
      ["code.ilike.%hs0l%,customer_name.ilike.%hs0l%"],
    ]);
  });

  it("aplica trim no termo", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "   ana   ");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  it("descarta vírgula, parênteses e curingas que quebrariam o filtro do PostgREST", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "an,a()%*\\");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  // `_` é curinga de 1 caractere no LIKE: sem descartá-lo, "h_0l52" casaria com
  // "HS0L52" e a busca devolveria mais do que o lojista pediu (achado da
  // validação do ciclo 2).
  it("descarta o underscore, que é curinga de um caractere no LIKE", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "an_a");

    expect(made[1].calls.or).toEqual([[FILTER]]);
  });

  it("não aplica filtro nenhum quando a busca está vazia ou só com espaços", async () => {
    for (const query of ["", "   ", "()"]) {
      const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
      const { getStoreOrders } = await loadModule();

      await getStoreOrders(STORE_ID, 1, query);

      expect(made[0].calls.or).toBeUndefined();
      expect(made[1].calls.or).toBeUndefined();
    }
  });

  it("sem argumento de busca continua listando o histórico inteiro", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.or).toBeUndefined();
  });

  it("busca sem resultado devolve lista vazia com total 0, sem erro", async () => {
    setupSupabase([{ count: 0 }, { data: [] }]);
    const { getStoreOrders } = await loadModule();

    const result = await getStoreOrders(STORE_ID, 1, "zzzzzz");

    expect(result).toEqual({ orders: [], total: 0, page: 1, totalPages: 1 });
  });
});

describe("getStoreOrders — filtro de período (ORD-46)", () => {
  const RANGE: PeriodRange = {
    from: new Date("2026-07-01T03:00:00.000Z"),
    to: new Date("2026-07-15T12:00:00.000Z"),
  };

  it("aplica gte/lte de created_at na contagem e na listagem quando o range é informado", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "", RANGE);

    expect(made[0].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[0].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
    expect(made[1].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[1].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
  });

  it("combina o filtro de período com a busca por código/nome", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "ana", RANGE);

    expect(made[1].calls.or).toEqual([["code.ilike.%ana%,customer_name.ilike.%ana%"]]);
    expect(made[1].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
  });

  it("sem range (default) não aplica gte/lte, mantendo o comportamento atual", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1);

    expect(made[1].calls.gte).toBeUndefined();
    expect(made[1].calls.lte).toBeUndefined();
  });

  it("com range explicitamente null não aplica gte/lte", async () => {
    const made = setupSupabase([{ count: 1 }, { data: [orderRow()] }]);
    const { getStoreOrders } = await loadModule();

    await getStoreOrders(STORE_ID, 1, "", null);

    expect(made[1].calls.gte).toBeUndefined();
    expect(made[1].calls.lte).toBeUndefined();
  });
});

describe("getStoreOrders — erro do banco nunca vira lista vazia", () => {
  it("lança e loga quando a contagem falha", async () => {
    setupSupabase([{ count: null, error: { message: "permission denied" } }]);
    const { getStoreOrders } = await loadModule();

    await expect(getStoreOrders(STORE_ID, 1)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("lança e loga quando a listagem falha", async () => {
    setupSupabase([{ count: 1 }, { data: null, error: { message: "permission denied" } }]);
    const { getStoreOrders } = await loadModule();

    await expect(getStoreOrders(STORE_ID, 1)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("getOrderMetrics — filtra por período quando informado (ORD-17, ORD-18, ORD-46)", () => {
  const RANGE: PeriodRange = {
    from: new Date("2026-07-01T03:00:00.000Z"),
    to: new Date("2026-07-15T12:00:00.000Z"),
  };

  it("aplica gte/lte de created_at nas duas queries (período e pendentes)", async () => {
    const made = setupSupabase([{ data: [] }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, RANGE);

    expect(made[0].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[0].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
    expect(made[1].calls.gte).toEqual([["created_at", RANGE.from.toISOString()]]);
    expect(made[1].calls.lte).toEqual([["created_at", RANGE.to.toISOString()]]);
  });

  it("filtra os pedidos do período por store_id", async () => {
    const made = setupSupabase([{ data: [] }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, RANGE);

    expect(made[0].calls.eq).toEqual([["store_id", STORE_ID]]);
  });

  it("conta os não cancelados e soma só os confirmados do período", async () => {
    setupSupabase([
      {
        data: [
          { status: "pendente", total_cents: 1000 },
          { status: "confirmado", total_cents: 2500 },
          { status: "confirmado", total_cents: 7500 },
          { status: "cancelado", total_cents: 9900 },
        ],
      },
      { count: 4 },
    ]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, RANGE);

    expect(metrics).toEqual({
      ordersThisMonth: 3,
      confirmedCentsThisMonth: 10000,
      pendingCount: 4,
    });
  });

  it("também filtra a contagem de pendentes pelo período, além do status", async () => {
    const made = setupSupabase([{ data: [] }, { count: 4 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, RANGE);

    expect(made[1].calls.eq).toEqual([
      ["store_id", STORE_ID],
      ["status", "pendente"],
    ]);
  });
});

describe("getOrderMetrics — sem filtro de data quando o range é null (todo o período)", () => {
  it("não aplica gte/lte em nenhuma das duas queries", async () => {
    const made = setupSupabase([{ data: [] }, { count: 7 }]);
    const { getOrderMetrics } = await loadModule();

    await getOrderMetrics(STORE_ID, null);

    expect(made[0].calls.gte).toBeUndefined();
    expect(made[0].calls.lte).toBeUndefined();
    expect(made[1].calls.gte).toBeUndefined();
    expect(made[1].calls.lte).toBeUndefined();
  });

  it("conta pendentes de todo o histórico, filtrando só por status e store_id", async () => {
    const made = setupSupabase([{ data: [] }, { count: 7 }]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, null);

    expect(made[1].calls.eq).toEqual([
      ["store_id", STORE_ID],
      ["status", "pendente"],
    ]);
    expect(metrics.pendingCount).toBe(7);
  });
});

describe("getOrderMetrics — sem pedidos e caminhos de erro (ORD-20)", () => {
  const RANGE: PeriodRange = {
    from: new Date("2026-07-01T03:00:00.000Z"),
    to: new Date("2026-07-15T12:00:00.000Z"),
  };

  it("devolve zeros quando não há pedido nenhum", async () => {
    setupSupabase([{ data: null }, { count: null }]);
    const { getOrderMetrics } = await loadModule();

    const metrics = await getOrderMetrics(STORE_ID, RANGE);

    expect(metrics).toEqual({
      ordersThisMonth: 0,
      confirmedCentsThisMonth: 0,
      pendingCount: 0,
    });
  });

  it("lança e loga quando a query do período falha", async () => {
    setupSupabase([{ data: null, error: { message: "permission denied" } }, { count: 0 }]);
    const { getOrderMetrics } = await loadModule();

    await expect(getOrderMetrics(STORE_ID, RANGE)).rejects.toThrow("permission denied");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("lança e loga quando a contagem de pendentes falha", async () => {
    setupSupabase([{ data: [] }, { count: null, error: { message: "boom" } }]);
    const { getOrderMetrics } = await loadModule();

    await expect(getOrderMetrics(STORE_ID, RANGE)).rejects.toThrow("boom");
    expect(errorSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/server-pedidos.test.ts`
Expected: FAIL — the new "filtro de período" tests fail (no `gte`/`lte` calls happen yet since `getStoreOrders`/`getOrderMetrics` don't accept/apply a range), and the rewritten `getOrderMetrics` tests fail (current signature takes `now`, not `range`, so passing a `PeriodRange` object as the second argument breaks the existing `monthStartInSaoPaulo`-based internal computation).

- [ ] **Step 3: Implement the range filtering in `lib/server/pedidos.ts`**

Replace the full file content with:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getTotalPages, clampPage } from "@/lib/pagination";
import { mapOrderRow, type OrderRow } from "@/lib/orders";
import { computeOrderMetrics, type OrderMetricRow, type OrderMetrics } from "@/lib/order-metrics";
import type { PeriodRange } from "@/lib/period-filter";
import type { StoreOrder } from "@/lib/types";

export const ORDERS_PAGE_SIZE = 20;

const ORDER_COLS =
  "id, code, created_at, customer_name, payment_method, delivery_method, delivery_address, items_count, total_cents, status, order_items(product_name, unit_price_cents, qty, size, color)";

/**
 * Busca por código **ou** nome do cliente, case-insensitive (ORD-35.10). Vírgula,
 * parênteses e `%`/`*`/`\`/`_` são descartados: o PostgREST usa vírgula para separar
 * os termos do `or` e parênteses para agrupá-los, e os curingas mudariam o LIKE —
 * nenhum deles faz sentido num código ou nome. O `_` entrou depois da validação do
 * ciclo 2: é curinga de exatamente 1 caractere no LIKE, então `h_0l52` casava com
 * `HS0L52` e a busca ficava mais larga do que o lojista pediu.
 */
function orderSearchTerm(query: string): string {
  return query.trim().replace(/[,()%*\\_]/g, "");
}

function searchFilter(term: string): string {
  return `code.ilike.%${term}%,customer_name.ilike.%${term}%`;
}

export interface StoreOrdersPage {
  orders: StoreOrder[];
  total: number;
  page: number;
  totalPages: number;
}

// Erro de banco nunca vira lista vazia: um permission denied disfarçado de
// "loja sem pedidos" esconderia a falha (docs/CONVENTIONS.md → Supabase).
function fail(context: string, error: { message: string }): never {
  console.error(`${context}:`, error);
  throw new Error(`${context}: ${error.message}`);
}

/**
 * Histórico da loja, 20 por página, mais recentes primeiro. RLS restringe à loja
 * do dono e o `.eq("store_id")` mantém o isolamento explícito também na busca.
 * A contagem usa o mesmo filtro (busca + período) da listagem — a paginação é
 * recalculada sobre o resultado filtrado (ORD-35.10, ORD-46). `range: null`
 * (padrão) = todo o histórico, sem filtro de data.
 */
export async function getStoreOrders(
  storeId: string,
  page: number,
  query = "",
  range: PeriodRange | null = null
): Promise<StoreOrdersPage> {
  const supabase = await createClient();
  const term = orderSearchTerm(query);

  let countQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  if (term) countQuery = countQuery.or(searchFilter(term));
  if (range) {
    countQuery = countQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
  }

  const { count, error: countError } = await countQuery;

  if (countError) fail(`getStoreOrders(${storeId}) — erro ao contar pedidos`, countError);

  const total = count ?? 0;
  const totalPages = getTotalPages(total, ORDERS_PAGE_SIZE);
  const currentPage = clampPage(page, totalPages);
  const from = (currentPage - 1) * ORDERS_PAGE_SIZE;

  let listQuery = supabase.from("orders").select(ORDER_COLS).eq("store_id", storeId);
  if (term) listQuery = listQuery.or(searchFilter(term));
  if (range) {
    listQuery = listQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
  }

  const { data, error } = await listQuery
    .order("created_at", { ascending: false })
    .range(from, from + ORDERS_PAGE_SIZE - 1);

  if (error) fail(`getStoreOrders(${storeId}) — erro ao listar pedidos`, error);

  return {
    orders: ((data ?? []) as unknown as OrderRow[]).map(mapOrderRow),
    total,
    page: currentPage,
    totalPages,
  };
}

/**
 * Métricas de "Vendas pela vitrine" no período informado (fuso do lojista).
 * `range: null` = todo o histórico, sem filtro de data — inclusive na contagem
 * de pendentes, que passou a respeitar o período (ORD-46).
 */
export async function getOrderMetrics(
  storeId: string,
  range: PeriodRange | null
): Promise<OrderMetrics> {
  const supabase = await createClient();

  let periodQuery = supabase
    .from("orders")
    .select("status, total_cents")
    .eq("store_id", storeId);
  let pendingQuery = supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "pendente");

  if (range) {
    periodQuery = periodQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
    pendingQuery = pendingQuery
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());
  }

  const [periodResult, pendingResult] = await Promise.all([periodQuery, pendingQuery]);

  if (periodResult.error)
    fail(`getOrderMetrics(${storeId}) — erro ao ler pedidos do período`, periodResult.error);
  if (pendingResult.error)
    fail(`getOrderMetrics(${storeId}) — erro ao contar pendentes`, pendingResult.error);

  return computeOrderMetrics(
    (periodResult.data ?? []) as OrderMetricRow[],
    pendingResult.count ?? 0
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/server-pedidos.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add lib/server/pedidos.ts __tests__/server-pedidos.test.ts
git commit -m "$(cat <<'EOF'
feat: getOrderMetrics/getStoreOrders aceitam filtro de período

getOrderMetrics agora recebe um PeriodRange já resolvido em vez de
computar "mês corrente" internamente — inclusive a contagem de
pendentes passa a respeitar o período. getStoreOrders ganha o mesmo
range como 4º parâmetro opcional (default null = comportamento atual).
EOF
)"
```

---

### Task 5: Shared `PeriodoFiltro` component

**Files:**
- Create: `components/painel/PeriodoFiltro.tsx`
- Test: `__tests__/PeriodoFiltro.test.tsx`

**Interfaces:**
- Consumes: `activePeriodToken`, `type PeriodPreset` from `@/lib/period-filter` (Task 3); `Input` from `@/components/ui/Input`; `cn` from `@/lib/utils`; `useRouter` from `next/navigation`.
- Produces: `<PeriodoFiltro basePath={string} periodo?={string} de?={string} ate?={string} extraParams?={Record<string,string>} />`. Tasks 6 and 7 render this in `DashboardClient.tsx` and `PedidosClient.tsx`.

- [ ] **Step 1: Write the failing test file**

Create `__tests__/PeriodoFiltro.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

beforeEach(() => {
  replace.mockReset();
});

describe("PeriodoFiltro — presets (ORD-46)", () => {
  it("mostra os quatro presets e o botão Personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.getByRole("button", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "7 dias" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Este mês" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Todo período" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Personalizado" })).toBeTruthy();
  });

  it('marca "Este mês" como ativo por padrão, sem nenhum prop de período', () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(
      screen.getByRole("button", { name: "Este mês" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Hoje" }).getAttribute("aria-pressed")
    ).toBe("false");
  });

  it('marca o preset correspondente a "periodo" como ativo', () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    expect(
      screen.getByRole("button", { name: "Hoje" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Este mês" }).getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("navega para o basePath com ?periodo=hoje ao clicar em Hoje", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel?periodo=hoje", { scroll: false });
  });

  it("navega sem parâmetro de período ao clicar em Este mês (é o default)", () => {
    render(<PeriodoFiltro basePath="/painel" periodo="hoje" />);

    fireEvent.click(screen.getByRole("button", { name: "Este mês" }));

    expect(replace).toHaveBeenCalledWith("/painel", { scroll: false });
  });

  it("navega com ?periodo=tudo ao clicar em Todo período", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    fireEvent.click(screen.getByRole("button", { name: "Todo período" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=tudo", {
      scroll: false,
    });
  });

  it("preserva extraParams (ex: busca) ao trocar de preset", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" extraParams={{ q: "ana" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });
});

describe("PeriodoFiltro — range customizado (ORD-46)", () => {
  it("esconde os campos De/Até até clicar em Personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    expect(screen.queryByLabelText("De")).toBeNull();
    expect(screen.queryByLabelText("Até")).toBeNull();
  });

  it("revela os campos De/Até ao clicar em Personalizado", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));

    expect(screen.getByLabelText("De")).toBeTruthy();
    expect(screen.getByLabelText("Até")).toBeTruthy();
  });

  it("começa com os campos abertos e preenchidos quando de/ate vêm por prop", () => {
    render(<PeriodoFiltro basePath="/painel" de="2026-07-01" ate="2026-07-10" />);

    expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("2026-07-01");
    expect((screen.getByLabelText("Até") as HTMLInputElement).value).toBe("2026-07-10");
    expect(
      screen.getByRole("button", { name: "Personalizado" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("desabilita Aplicar até as duas datas estarem preenchidas", () => {
    render(<PeriodoFiltro basePath="/painel" />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    const aplicar = screen.getByRole("button", { name: "Aplicar" });
    expect(aplicar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-07-01" } });
    expect(aplicar).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-07-10" } });
    expect(aplicar).not.toBeDisabled();
  });

  it("navega com de/ate e sem periodo ao clicar em Aplicar", () => {
    render(<PeriodoFiltro basePath="/painel/pedidos" />);

    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-07-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?de=2026-07-01&ate=2026-07-10", {
      scroll: false,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run __tests__/PeriodoFiltro.test.tsx`
Expected: FAIL — `Cannot find module '@/components/painel/PeriodoFiltro'`

- [ ] **Step 3: Implement `components/painel/PeriodoFiltro.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [showCustom, setShowCustom] = useState(active === "custom");
  const [customDe, setCustomDe] = useState(de ?? "");
  const [customAte, setCustomAte] = useState(ate ?? "");

  const navigate = (params: Record<string, string>) => {
    const qs = new URLSearchParams({ ...extraParams, ...params }).toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  };

  const selectPreset = (preset: PeriodPreset) => {
    setShowCustom(false);
    navigate(preset === "mes" ? {} : { periodo: preset });
  };

  const applyCustomRange = () => {
    if (!customDe || !customAte) return;
    navigate({ de: customDe, ate: customAte });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por período">
        {PRESET_ORDER.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => selectPreset(preset)}
            aria-pressed={active === preset}
            className={cn(
              "h-9 px-3.5 rounded-pill border font-body text-[13px] transition-colors",
              active === preset
                ? "bg-obsidian border-obsidian text-white"
                : "bg-transparent border-sand text-obsidian hover:bg-surface-hover"
            )}
          >
            {PRESET_LABELS[preset]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((value) => !value)}
          aria-pressed={active === "custom"}
          className={cn(
            "h-9 px-3.5 rounded-pill border font-body text-[13px] transition-colors",
            active === "custom"
              ? "bg-obsidian border-obsidian text-white"
              : "bg-transparent border-sand text-obsidian hover:bg-surface-hover"
          )}
        >
          Personalizado
        </button>
      </div>

      {showCustom && (
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
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!customDe || !customAte}
            className="h-11 px-4 rounded-btn bg-obsidian text-white font-body font-medium text-[14px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run __tests__/PeriodoFiltro.test.tsx`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add components/painel/PeriodoFiltro.tsx __tests__/PeriodoFiltro.test.tsx
git commit -m "$(cat <<'EOF'
feat: adiciona componente PeriodoFiltro (presets + range customizado)

Componente compartilhado entre Dashboard e Pedidos: presets em pills
(Hoje/7 dias/Este mês/Todo período) + range customizado com dois
<input type="date"> nativos. Escreve o período na URL, mesmo padrão de
busca/paginação já usado no painel.
EOF
)"
```

---

### Task 6: Wire the period filter into the Dashboard

**Files:**
- Modify: `app/painel/page.tsx`
- Modify: `app/painel/DashboardClient.tsx`
- Modify: `app/painel/use-dashboard.ts`
- Modify: `__tests__/DashboardClient.test.tsx`
- Modify: `__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `resolvePeriodRange` from `@/lib/period-filter` (Task 3); `getOrderMetrics(storeId, range)` from `@/lib/server/pedidos` (Task 4); `<PeriodoFiltro>` from `@/components/painel/PeriodoFiltro` (Task 5).
- Produces: `DashboardClient` now accepts optional `periodo`/`de`/`ate` props and renders `<PeriodoFiltro basePath="/painel" .../>` next to "Vendas pela vitrine" — only when the plan is unlocked (`orderStats` truthy).

- [ ] **Step 1: Replace `__tests__/DashboardClient.test.tsx`**

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

- [ ] **Step 2: Replace `__tests__/DashboardPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Plan, StoreSettings } from "@/lib/types";
import type { PeriodRange } from "@/lib/period-filter";

const getCurrentStore = vi.fn();
const getOrderMetrics = vi.fn();
const from = vi.fn();
const resolvePeriodRange = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
  mapProduct: (row: unknown) => row,
}));
vi.mock("@/lib/server/pedidos", () => ({
  getOrderMetrics: (...args: unknown[]) => getOrderMetrics(...args),
}));
vi.mock("@/lib/period-filter", () => ({
  resolvePeriodRange: (...args: unknown[]) => resolvePeriodRange(...args),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ replace: vi.fn() }),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const RANGE: PeriodRange = {
  from: new Date("2026-07-01T03:00:00.000Z"),
  to: new Date("2026-07-15T12:00:00.000Z"),
};

function makeStore(plan: Plan, trialEndsAt: string | null = null): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan,
    trialEndsAt,
    whatsapp: "35999999999",
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

function setupProductsQuery() {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: { data: unknown[] }) => unknown) =>
    Promise.resolve({ data: [] }).then(resolve);
  from.mockImplementation(() => chain);
}

async function renderPage(params: { periodo?: string; de?: string; ate?: string } = {}) {
  const { default: DashboardPage } = await import("@/app/painel/page");
  return render(await DashboardPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getOrderMetrics.mockReset();
  from.mockReset();
  resolvePeriodRange.mockReset();
  resolvePeriodRange.mockReturnValue(RANGE);
  setupProductsQuery();
  getOrderMetrics.mockResolvedValue({
    ordersThisMonth: 7,
    confirmedCentsThisMonth: 123450,
    pendingCount: 3,
  });
});

describe("/painel — gate de plano dos cards de ROI (ORD-29)", () => {
  it("no plano Free não busca métricas nem resolve o período, e mostra o aviso de upgrade", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    const { container } = await renderPage();

    expect(getOrderMetrics).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.queryByText("Pedidos")).toBeNull();
    expect(container.textContent).not.toContain("R$");
  });
});

describe("/painel — cards de ROI nos planos pagos (ORD-30)", () => {
  it("no plano Starter busca as métricas da loja com o range resolvido e mostra os três cards", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getOrderMetrics).toHaveBeenCalledWith(STORE_ID, RANGE);
    expect(screen.getByText("Pedidos")).toBeTruthy();
    expect(screen.getByText("Vendas confirmadas")).toBeTruthy();
    expect(screen.getByText("Aguardando confirmação")).toBeTruthy();
  });

  it("rebaixa Starter com trial_ends_at vencido para o estado bloqueado", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter", "2020-01-01T00:00:00.000Z"));

    await renderPage();

    expect(getOrderMetrics).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
  });
});

describe("/painel — filtro de período (ORD-46)", () => {
  it("repassa periodo de searchParams para resolvePeriodRange", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage({ periodo: "hoje" });

    expect(resolvePeriodRange).toHaveBeenCalledWith({
      periodo: "hoje",
      de: undefined,
      ate: undefined,
    });
  });

  it("repassa o período customizado (de/ate) para resolvePeriodRange", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage({ de: "2026-07-01", ate: "2026-07-10" });

    expect(resolvePeriodRange).toHaveBeenCalledWith({
      periodo: undefined,
      de: "2026-07-01",
      ate: "2026-07-10",
    });
  });
});
```

- [ ] **Step 3: Run both test files to verify they fail**

Run: `npx vitest run __tests__/DashboardClient.test.tsx __tests__/DashboardPage.test.tsx`
Expected: FAIL — labels still say "Pedidos no mês" etc., no `PeriodoFiltro` rendered, `app/painel/page.tsx` doesn't accept `searchParams` yet, `getOrderMetrics` still called with a single argument.

- [ ] **Step 4: Update `app/painel/page.tsx`**

Replace the full file content with:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { getOrderMetrics } from "@/lib/server/pedidos";
import { resolvePeriodRange } from "@/lib/period-filter";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  const params = await searchParams;

  // Gate antes do I/O: no plano Free nenhum número de pedido/faturamento é
  // buscado nem o período é resolvido, então nada real pode chegar ao HTML
  // (ORD-29).
  const metrics = getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory
    ? await getOrderMetrics(store.id, resolvePeriodRange(params))
    : null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(
      "id, name, price_cents, description, category_id, sizes, sold_sizes, colors, images, stock, is_active, is_new, is_featured"
    )
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const products = (data ?? []).map(mapProduct);
  const catalogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${store.slug}`;

  return (
    <DashboardClient
      products={products}
      storeName={store.name}
      catalogUrl={catalogUrl}
      metrics={metrics}
      periodo={params.periodo}
      de={params.de}
      ate={params.ate}
    />
  );
}
```

- [ ] **Step 5: Update `app/painel/DashboardClient.tsx`**

Replace the full file content with:

```tsx
"use client";

import Link from "next/link";
import { Plus, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import { formatCents } from "@/lib/utils";
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
            <PeriodoFiltro basePath="/painel" periodo={periodo} de={de} ate={ate} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {orderStats.map((stat) => (
                <StatCard key={stat.label} value={stat.value} label={stat.label} />
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

- [ ] **Step 6: Rename the metric labels in `app/painel/use-dashboard.ts`**

In the `orderStats` array, change:

```ts
  const orderStats = metrics
    ? [
        { value: metrics.ordersThisMonth, label: "Pedidos no mês" },
        {
          value: formatCents(metrics.confirmedCentsThisMonth),
          label: "Vendas confirmadas no mês",
        },
        { value: metrics.pendingCount, label: "Aguardando confirmação" },
      ]
    : null;
```

to:

```ts
  const orderStats = metrics
    ? [
        { value: metrics.ordersThisMonth, label: "Pedidos" },
        {
          value: formatCents(metrics.confirmedCentsThisMonth),
          label: "Vendas confirmadas",
        },
        { value: metrics.pendingCount, label: "Aguardando confirmação" },
      ]
    : null;
```

(rest of the file unchanged from Task 1's version)

- [ ] **Step 7: Run both test files to verify they pass**

Run: `npx vitest run __tests__/DashboardClient.test.tsx __tests__/DashboardPage.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 8: Commit**

```bash
git add app/painel/page.tsx app/painel/DashboardClient.tsx app/painel/use-dashboard.ts __tests__/DashboardClient.test.tsx __tests__/DashboardPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(painel): filtro de período em Vendas pela vitrine

A Dashboard lê periodo/de/ate de searchParams, resolve o range com
lib/period-filter e passa para getOrderMetrics. As 3 métricas (pedidos,
vendas confirmadas, aguardando confirmação) refletem o período
escolhido; rótulos deixam de fixar "no mês".
EOF
)"
```

---

### Task 7: Wire the period filter into Pedidos

**Files:**
- Modify: `app/painel/pedidos/page.tsx`
- Modify: `app/painel/pedidos/PedidosClient.tsx`
- Modify: `app/painel/pedidos/use-pedidos-busca.ts`
- Modify: `__tests__/PedidosClient.test.tsx`
- Modify: `__tests__/PedidosPage.test.tsx`

**Interfaces:**
- Consumes: `resolvePeriodRange`, `activePeriodToken` from `@/lib/period-filter` (Task 3); `getStoreOrders(storeId, page, query, range)` from `@/lib/server/pedidos` (Task 4); `<PeriodoFiltro>` from `@/components/painel/PeriodoFiltro` (Task 5).
- Produces: `PedidosClient` accepts optional `periodo`/`de`/`ate` props; `usePedidosBusca(initialQuery, extraParams?)` gains a second parameter so a search doesn't drop the active period from the URL.

- [ ] **Step 1: Extend `app/painel/pedidos/use-pedidos-busca.ts`**

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
 * (ORD-35.10).
 */
export function usePedidosBusca(
  initialQuery: string,
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
      router.replace(qs ? `/painel/pedidos?${qs}` : "/painel/pedidos", { scroll: false });
    }, DEBOUNCE_MS);
  };

  return { query, onQueryChange };
}
```

- [ ] **Step 2: Replace `__tests__/PedidosClient.test.tsx`**

This is the existing file with: (a) new `periodo`/`de`/`ate` props passed through in a few tests, (b) two new describe blocks for the period filter, and (c) the empty-state / subtitle logic extended for "period filtered, no results".

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

beforeEach(() => {
  updateOrderStatus.mockReset();
  updateOrderStatus.mockResolvedValue({ ok: true });
  replace.mockReset();
});

function makeOrder(overrides: Partial<StoreOrder> = {}): StoreOrder {
  return {
    id: "o1",
    code: "HS0L52",
    createdAt: "2026-07-27T15:30:00.000Z",
    customerName: "Ana",
    paymentMethod: "pix",
    deliveryMethod: "retirada",
    deliveryAddress: null,
    itemsCount: 3,
    totalCents: 47800,
    status: "pendente",
    items: [
      {
        productName: "Vestido midi",
        unitPriceCents: 19900,
        qty: 2,
        size: "M",
        color: "Areia",
      },
      { productName: "Blusa", unitPriceCents: 8000, qty: 1, size: null, color: null },
    ],
    ...overrides,
  };
}

function openDetail(order: StoreOrder): HTMLElement {
  fireEvent.click(
    screen.getByLabelText(
      `Ver detalhe do pedido de ${order.customerName ?? "Sem nome"}`
    )
  );
  return screen.getByRole("dialog", { name: "Detalhe do pedido" });
}

describe("PedidosClient — lista do histórico (ORD-12)", () => {
  it("mostra data/hora, nome do cliente, quantidade de itens, total e status", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("27/07/2026, 12:30 · 3 itens")).toBeTruthy();
    expect(screen.getByText("R$ 478,00")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
  });

  it('mostra "Sem nome" quando o cliente não informou o nome', () => {
    render(
      <PedidosClient
        orders={[makeOrder({ customerName: null })]}
        total={1}
        page={1}
        totalPages={1}
      />
    );

    expect(screen.getByText("Sem nome")).toBeTruthy();
  });

  it("preserva a ordem recebida do servidor (mais recente primeiro)", () => {
    render(
      <PedidosClient
        orders={[
          makeOrder({ id: "o1", customerName: "Recente" }),
          makeOrder({ id: "o2", customerName: "Antigo" }),
        ]}
        total={2}
        page={1}
        totalPages={1}
      />
    );

    const rows = screen.getAllByRole("button", { name: /Ver detalhe do pedido/ });
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Ver detalhe do pedido de Recente",
      "Ver detalhe do pedido de Antigo",
    ]);
  });
});

describe("PedidosClient — código do pedido (ORD-35.9)", () => {
  it("mostra o código em cada linha da lista", () => {
    render(
      <PedidosClient
        orders={[
          makeOrder({ id: "o1", code: "HS0L52" }),
          makeOrder({ id: "o2", code: "MIXICD" }),
        ]}
        total={2}
        page={1}
        totalPages={1}
      />
    );

    expect(screen.getByText("HS0L52")).toBeTruthy();
    expect(screen.getByText("MIXICD")).toBeTruthy();
  });

  it("mostra o código no detalhe do pedido", () => {
    const order = makeOrder({ code: "MIXICD" });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("MIXICD")).toBeTruthy();
  });
});

describe("PedidosClient — busca por código ou nome (ORD-35.10)", () => {
  it("oferece o campo de busca quando há pedidos", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.getByLabelText("Buscar por código ou nome do cliente")).toBeTruthy();
  });

  it("leva o termo digitado para a URL, sem page, depois do debounce", () => {
    vi.useFakeTimers();
    try {
      render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

      fireEvent.change(screen.getByLabelText("Buscar por código ou nome do cliente"), {
        target: { value: " HS0L52 " },
      });
      vi.advanceTimersByTime(400);

      expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=HS0L52", { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("volta para a URL sem busca quando o campo é limpo", () => {
    vi.useFakeTimers();
    try {
      render(
        <PedidosClient
          orders={[makeOrder()]}
          total={1}
          page={1}
          totalPages={1}
          query="HS0L52"
        />
      );

      fireEvent.change(screen.getByLabelText("Buscar por código ou nome do cliente"), {
        target: { value: "" },
      });
      vi.advanceTimersByTime(400);

      expect(replace).toHaveBeenCalledWith("/painel/pedidos", { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reflete a busca vinda do servidor no campo", () => {
    render(
      <PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} query="ana" />
    );

    expect(
      (screen.getByLabelText("Buscar por código ou nome do cliente") as HTMLInputElement)
        .value
    ).toBe("ana");
  });

  it("preserva a busca nos links de paginação", () => {
    render(
      <PedidosClient
        orders={[makeOrder()]}
        total={30}
        page={1}
        totalPages={2}
        query="ana"
      />
    );

    const nav = screen.getByLabelText("Paginação");
    expect(within(nav).getByRole("link", { name: "2" }).getAttribute("href")).toBe(
      "/painel/pedidos?page=2&q=ana"
    );
  });
});

describe("PedidosClient — paginação (ORD-13)", () => {
  it("renderiza a paginação apontando para /painel/pedidos quando há mais de uma página", () => {
    render(<PedidosClient orders={[makeOrder()]} total={21} page={1} totalPages={2} />);

    const nav = screen.getByLabelText("Paginação");
    expect(
      within(nav).getByRole("link", { name: "2" }).getAttribute("href")
    ).toBe("/painel/pedidos?page=2");
  });

  it("esconde a paginação quando há uma única página", () => {
    render(<PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} />);

    expect(screen.queryByLabelText("Paginação")).toBeNull();
  });
});

describe("PedidosClient — detalhe do pedido (ORD-14)", () => {
  it("mostra cada item com nome, tamanho, cor, quantidade, unitário e subtotal", () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Vestido midi")).toBeTruthy();
    expect(within(dialog).getByText("Tamanho M · Cor Areia")).toBeTruthy();
    expect(within(dialog).getByText("2x R$ 199,00")).toBeTruthy();
    expect(within(dialog).getByText("R$ 398,00")).toBeTruthy();
    expect(within(dialog).getByText("Blusa")).toBeTruthy();
    expect(within(dialog).getByText("1x R$ 80,00")).toBeTruthy();
    expect(within(dialog).getByText("R$ 80,00")).toBeTruthy();
  });

  it("mostra forma de pagamento e entrega com endereço quando a entrega é no endereço", () => {
    const order = makeOrder({
      deliveryMethod: "entrega",
      deliveryAddress: "Rua X, 123",
    });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Forma de pagamento: Pix")).toBeTruthy();
    expect(
      within(dialog).getByText("Entrega: Enviar no endereço — Rua X, 123")
    ).toBeTruthy();
  });

  it("mostra a entrega sem endereço quando o cliente escolheu retirada", () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Entrega: Retirar no local")).toBeTruthy();
  });

  it("mostra o total e o status do pedido no detalhe", () => {
    const order = makeOrder({ status: "confirmado" });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Total")).toBeTruthy();
    expect(within(dialog).getByText("R$ 478,00")).toBeTruthy();
    const statusBadge = within(dialog)
      .getAllByText("Confirmado")
      .find((el) => el.tagName === "SPAN");
    expect(statusBadge).toBeTruthy();
  });

  it("exibe o snapshot do item mesmo com o produto já excluído do catálogo", () => {
    const order = makeOrder({
      itemsCount: 1,
      totalCents: 12900,
      items: [
        {
          productName: "Saia plissada (produto excluído)",
          unitPriceCents: 12900,
          qty: 1,
          size: null,
          color: null,
        },
      ],
    });
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByText("Saia plissada (produto excluído)")).toBeTruthy();
    expect(within(dialog).getByText("1x R$ 129,00")).toBeTruthy();
  });
});

describe("PedidosClient — mudança de status (ORD-21, ORD-22)", () => {
  it("oferece os três status no detalhe do pedido", () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);

    expect(within(dialog).getByRole("button", { name: "Pendente" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Confirmado" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Cancelado" })).toBeTruthy();
  });

  it.each(["Pendente", "Confirmado", "Cancelado"])(
    "envia o id do pedido e o status %s para a action",
    async (label) => {
      const order = makeOrder();
      render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

      const dialog = openDetail(order);
      fireEvent.click(within(dialog).getByRole("button", { name: label }));

      await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledTimes(1));
      const sent = updateOrderStatus.mock.calls[0][1] as FormData;
      expect(sent.get("id")).toBe(order.id);
      expect(sent.get("status")).toBe(label.toLowerCase());
    }
  );

  it("mostra o erro devolvido pela action sem trocar o status exibido", async () => {
    updateOrderStatus.mockResolvedValue({ error: "Pedido não encontrado." });
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Pedido não encontrado."
      )
    );
    const row = screen.getByLabelText("Ver detalhe do pedido de Ana");
    expect(within(row).getByText("Pendente")).toBeTruthy();
  });

  it("confirma a mudança com feedback de sucesso", async () => {
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Status atualizado")
    );
  });

  it("desabilita os controles de status enquanto a mudança está em andamento", async () => {
    let finish: ((value: { ok: true }) => void) | undefined;
    updateOrderStatus.mockImplementation(
      () => new Promise<{ ok: true }>((resolve) => (finish = resolve))
    );
    const order = makeOrder();
    render(<PedidosClient orders={[order]} total={1} page={1} totalPages={1} />);

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Cancelado" })).toBeDisabled()
    );

    finish?.({ ok: true });
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Cancelado" })
      ).not.toBeDisabled()
    );
  });

  it("reflete na lista o status vindo da revalidação, sem recarregar a página", async () => {
    const order = makeOrder();
    const { rerender } = render(
      <PedidosClient orders={[order]} total={1} page={1} totalPages={1} />
    );

    const dialog = openDetail(order);
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmado" }));
    await waitFor(() => expect(updateOrderStatus).toHaveBeenCalledTimes(1));

    rerender(
      <PedidosClient
        orders={[{ ...order, status: "confirmado" }]}
        total={1}
        page={1}
        totalPages={1}
      />
    );

    const row = screen.getByLabelText("Ver detalhe do pedido de Ana");
    expect(within(row).getByText("Confirmado")).toBeTruthy();
    expect(within(row).queryByText("Pendente")).toBeNull();
  });
});

describe("PedidosClient — estado vazio (ORD-15)", () => {
  it("explica que os pedidos aparecem quando um cliente envia a sacola", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} />);

    expect(screen.getByText("Nenhum pedido ainda")).toBeTruthy();
    expect(
      screen.getByText(
        "Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui com os itens e o total."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Ver detalhe do pedido/ })).toBeNull();
  });

  it("não mostra o campo de busca numa loja que ainda não tem pedido", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} />);

    expect(screen.queryByLabelText("Buscar por código ou nome do cliente")).toBeNull();
  });
});

describe("PedidosClient — estado vazio de busca (ORD-35.11)", () => {
  it("distingue busca sem resultado de loja sem nenhum pedido", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} query="ZZZZZZ" />);

    expect(screen.getByText("Nenhum pedido encontrado")).toBeTruthy();
    expect(screen.queryByText("Nenhum pedido ainda")).toBeNull();
    expect(
      screen.queryByText(
        "Quando um cliente enviar a sacola pelo WhatsApp, o pedido aparece aqui com os itens e o total."
      )
    ).toBeNull();
  });

  it("cita o termo buscado e mantém o campo de busca na tela", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} query="ZZZZZZ" />);

    expect(screen.getByText(/desta loja combina com/).textContent).toContain("ZZZZZZ");
    expect(
      (screen.getByLabelText("Buscar por código ou nome do cliente") as HTMLInputElement)
        .value
    ).toBe("ZZZZZZ");
  });
});

describe("PedidosClient — filtro de período (ORD-46)", () => {
  it("mostra o filtro de período mesmo quando a loja ainda não tem pedido", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} />);

    expect(screen.getByRole("group", { name: "Filtrar por período" })).toBeTruthy();
  });

  it("ao trocar de período, preserva a busca ativa na URL", () => {
    render(
      <PedidosClient orders={[makeOrder()]} total={1} page={1} totalPages={1} query="ana" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));

    expect(replace).toHaveBeenCalledWith("/painel/pedidos?q=ana&periodo=hoje", {
      scroll: false,
    });
  });

  it("ao buscar com um período ativo, preserva o período na URL da busca", () => {
    vi.useFakeTimers();
    try {
      render(
        <PedidosClient
          orders={[makeOrder()]}
          total={1}
          page={1}
          totalPages={1}
          periodo="hoje"
        />
      );

      fireEvent.change(screen.getByLabelText("Buscar por código ou nome do cliente"), {
        target: { value: "HS0L52" },
      });
      vi.advanceTimersByTime(400);

      expect(replace).toHaveBeenCalledWith("/painel/pedidos?periodo=hoje&q=HS0L52", {
        scroll: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("mostra a paginação com período e busca combinados", () => {
    render(
      <PedidosClient
        orders={[makeOrder()]}
        total={30}
        page={1}
        totalPages={2}
        query="ana"
        periodo="hoje"
      />
    );

    const nav = screen.getByLabelText("Paginação");
    expect(within(nav).getByRole("link", { name: "2" }).getAttribute("href")).toBe(
      "/painel/pedidos?page=2&q=ana&periodo=hoje"
    );
  });

  it("mostra o subtítulo de contagem por período quando não há busca", () => {
    render(
      <PedidosClient
        orders={[makeOrder()]}
        total={5}
        page={1}
        totalPages={1}
        periodo="hoje"
      />
    );

    expect(screen.getByText("5 pedidos no período")).toBeTruthy();
  });

  it("mostra estado vazio específico quando o período filtrado não tem pedidos", () => {
    render(<PedidosClient orders={[]} total={0} page={1} totalPages={1} periodo="hoje" />);

    expect(screen.getByText("Nenhum pedido no período")).toBeTruthy();
    expect(screen.getByText("Nenhum pedido no período selecionado.")).toBeTruthy();
    expect(screen.queryByText("Nenhum pedido ainda")).toBeNull();
  });
});
```

- [ ] **Step 3: Replace `__tests__/PedidosPage.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Plan, StoreOrder, StoreSettings } from "@/lib/types";
import type { PeriodRange } from "@/lib/period-filter";

const getCurrentStore = vi.fn();
const getStoreOrders = vi.fn();
const resolvePeriodRange = vi.fn();
const redirect = vi.fn((_path: string) => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
vi.mock("@/lib/server/pedidos", () => ({
  getStoreOrders: (...args: unknown[]) => getStoreOrders(...args),
}));
vi.mock("@/lib/period-filter", () => ({
  resolvePeriodRange: (...args: unknown[]) => resolvePeriodRange(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
  useRouter: () => ({ replace: vi.fn() }),
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const RANGE: PeriodRange = {
  from: new Date("2026-07-01T03:00:00.000Z"),
  to: new Date("2026-07-15T12:00:00.000Z"),
};

function makeStore(plan: Plan, trialEndsAt: string | null = null): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan,
    trialEndsAt,
    whatsapp: "35999999999",
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

function makeOrder(): StoreOrder {
  return {
    id: "o1",
    code: "HS0L52",
    createdAt: "2026-07-27T15:30:00.000Z",
    customerName: "Ana",
    paymentMethod: "pix",
    deliveryMethod: "retirada",
    deliveryAddress: null,
    itemsCount: 2,
    totalCents: 39800,
    status: "pendente",
    items: [
      {
        productName: "Vestido midi",
        unitPriceCents: 19900,
        qty: 2,
        size: "M",
        color: "Areia",
      },
    ],
  };
}

async function renderPage(pageParam?: string, q?: string, periodo?: string) {
  const { default: PedidosPage } = await import("@/app/painel/pedidos/page");
  const ui = await PedidosPage({
    searchParams: Promise.resolve({
      ...(pageParam ? { page: pageParam } : {}),
      ...(q === undefined ? {} : { q }),
      ...(periodo === undefined ? {} : { periodo }),
    }),
  });
  return render(ui);
}

beforeEach(() => {
  getCurrentStore.mockReset();
  getStoreOrders.mockReset();
  redirect.mockClear();
  resolvePeriodRange.mockReset();
  resolvePeriodRange.mockReturnValue(RANGE);
  getStoreOrders.mockResolvedValue({
    orders: [makeOrder()],
    total: 1,
    page: 1,
    totalPages: 1,
  });
});

describe("/painel/pedidos — gate de plano (ORD-28)", () => {
  it("no plano Free renderiza o bloqueio sem executar a query de pedidos", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    await renderPage();

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Falar no WhatsApp →" })).toBeTruthy();
  });

  it("no plano Free nenhum dado do histórico chega ao HTML", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    const { container } = await renderPage();

    expect(container.textContent).not.toContain("Ana");
    expect(container.textContent).not.toContain("R$");
    expect(screen.queryByRole("button", { name: /Ver detalhe do pedido/ })).toBeNull();
  });

  it("no plano Free com busca preenchida nenhuma query roda (ORD-35.12)", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    const { container } = await renderPage(undefined, "HS0L52");

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
    expect(container.textContent).not.toContain("Ana");
    expect(container.textContent).not.toContain("HS0L52");
    expect(
      screen.queryByLabelText("Buscar por código ou nome do cliente")
    ).toBeNull();
  });
});

describe("/painel/pedidos — busca vinda da URL (ORD-35.10)", () => {
  it("repassa searchParams.q para a leitura do histórico", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage(undefined, "hs0l");

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "hs0l", RANGE);
  });

  it("combina busca e página na mesma leitura", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro"));
    getStoreOrders.mockResolvedValue({
      orders: [makeOrder()],
      total: 30,
      page: 2,
      totalPages: 2,
    });

    await renderPage("2", "ana");

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 2, "ana", RANGE);
  });

  it("mostra o código do pedido na lista renderizada pela página", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(screen.getByText("HS0L52")).toBeTruthy();
  });
});

describe("/painel/pedidos — planos pagos (ORD-30)", () => {
  it("no plano Starter lista os pedidos da loja", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "", RANGE);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("R$ 398,00")).toBeTruthy();
  });

  it("no plano Pro sem prazo de expiração lista os pedidos", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro", null));

    await renderPage();

    expect(getStoreOrders).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("rebaixa Starter com trial_ends_at vencido para o estado bloqueado", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter", "2020-01-01T00:00:00.000Z"));

    await renderPage();

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(screen.getByText("Disponível a partir do plano Starter")).toBeTruthy();
  });

  it("repassa a página pedida na URL para a leitura do histórico", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));
    getStoreOrders.mockResolvedValue({
      orders: [makeOrder()],
      total: 21,
      page: 2,
      totalPages: 2,
    });

    await renderPage("2");

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 2, "", RANGE);
  });
});

describe("/painel/pedidos — histórico do período Free ao virar pago (ORD-30.7)", () => {
  it("os pedidos gravados no Free aparecem quando o plano efetivo vira starter, sem migração", async () => {
    getStoreOrders.mockResolvedValue({
      orders: [makeOrder()],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    getCurrentStore.mockResolvedValue(makeStore("free"));
    const bloqueado = await renderPage();

    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(bloqueado.container.textContent).not.toContain("Ana");
    bloqueado.unmount();

    getCurrentStore.mockResolvedValue(makeStore("starter"));
    const liberado = await renderPage();

    expect(getStoreOrders).toHaveBeenCalledTimes(1);
    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "", RANGE);
    expect(liberado.getByText("Ana")).toBeTruthy();
    expect(liberado.getByText("R$ 398,00")).toBeTruthy();
  });
});

describe("/painel/pedidos — sessão ausente", () => {
  it("redireciona para /login quando não há loja do usuário", async () => {
    getCurrentStore.mockResolvedValue(null);

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getStoreOrders).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
  });
});

describe("/painel/pedidos — filtro de período (ORD-46)", () => {
  it("repassa periodo de searchParams para resolvePeriodRange", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage(undefined, undefined, "hoje");

    expect(resolvePeriodRange).toHaveBeenCalledWith({
      periodo: "hoje",
      de: undefined,
      ate: undefined,
    });
  });

  it("usa o range resolvido na leitura do histórico", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(getStoreOrders).toHaveBeenCalledWith(STORE_ID, 1, "", RANGE);
  });
});
```

- [ ] **Step 4: Run both test files to verify they fail**

Run: `npx vitest run __tests__/PedidosClient.test.tsx __tests__/PedidosPage.test.tsx`
Expected: FAIL — `PedidosClient` doesn't render `PeriodoFiltro` yet, `getStoreOrders` calls in the page test are missing the 4th `range` argument, `app/painel/pedidos/page.tsx` doesn't resolve a period yet.

- [ ] **Step 5: Update `app/painel/pedidos/page.tsx`**

Replace the full file content with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/server/store";
import { getPlanLimits } from "@/lib/plan-limits";
import { getStoreOrders } from "@/lib/server/pedidos";
import { resolvePeriodRange } from "@/lib/period-filter";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PedidosClient } from "./PedidosClient";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    periodo?: string;
    de?: string;
    ate?: string;
  }>;
}) {
  const store = await getCurrentStore();
  if (!store) redirect("/login");

  // Gate antes de qualquer I/O: no plano Free nenhum dado do histórico chega
  // ao HTML (ORD-28).
  if (!getPlanLimits(store.plan, store.trialEndsAt).hasOrderHistory) {
    return (
      <RecursoBloqueado
        titulo="Histórico de pedidos"
        descricao="Cada pedido enviado pela sacola já está sendo registrado. Faça upgrade para ver o histórico completo, com itens, total e status de cada venda."
      />
    );
  }

  const { page: pageParam, q, periodo, de, ate } = await searchParams;
  const query = q ?? "";
  const range = resolvePeriodRange({ periodo, de, ate });
  const { orders, total, page, totalPages } = await getStoreOrders(
    store.id,
    Number(pageParam ?? "1"),
    query,
    range
  );

  return (
    <PedidosClient
      orders={orders}
      total={total}
      page={page}
      totalPages={totalPages}
      query={query}
      periodo={periodo}
      de={de}
      ate={ate}
    />
  );
}
```

- [ ] **Step 6: Update `app/painel/pedidos/PedidosClient.tsx`**

Replace the full file content with:

```tsx
"use client";

import { Receipt, Search, CalendarSearch } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Toast } from "@/components/ui/Toast";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
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

  const periodParams: Record<string, string> = {};
  if (periodo) periodParams.periodo = periodo;
  if (de) periodParams.de = de;
  if (ate) periodParams.ate = ate;

  const { query: searchTerm, onQueryChange } = usePedidosBusca(query, periodParams);

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
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite pointer-events-none z-10"
            />
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
        />
      </div>

      {orders.length === 0 ? (
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

- [ ] **Step 7: Run both test files to verify they pass**

Run: `npx vitest run __tests__/PedidosClient.test.tsx __tests__/PedidosPage.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 8: Commit**

```bash
git add app/painel/pedidos/page.tsx app/painel/pedidos/PedidosClient.tsx app/painel/pedidos/use-pedidos-busca.ts __tests__/PedidosClient.test.tsx __tests__/PedidosPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(painel): filtro de período em Pedidos

/painel/pedidos lê periodo/de/ate de searchParams, resolve o range com
lib/period-filter e combina com a busca por código/nome já existente.
Busca e filtro de período preservam um ao outro na URL; novo estado
vazio distingue "período sem pedidos" de "loja sem pedidos" e de
"busca sem resultado".
EOF
)"
```

---

### Task 8: Final verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS — every test file in `__tests__/` green, including all files touched in Tasks 1–7 and every pre-existing file left untouched (e.g. `__tests__/order-metrics.test.ts`, `__tests__/registrar-pedido.test.ts`, `__tests__/pedido-validation.test.ts`).

- [ ] **Step 2: Type-check the project**

Run: `npx tsc --noEmit`
Expected: no errors. Pay special attention to `app/painel/page.tsx` and `app/painel/pedidos/page.tsx` (both now take a `searchParams` prop with a wider shape) and to `PedidosClientProps`/`DashboardClientProps` (both gained `periodo`/`de`/`ate`).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors (watch for unused imports — e.g. confirm `next/image` and `formatCents` were actually dropped from `DashboardClient.tsx` in Task 1, and that `CalendarSearch`/`activePeriodToken`/`PeriodoFiltro` are actually used in `PedidosClient.tsx`).

- [ ] **Step 4: Manual browser verification — Dashboard**

Start the dev server (`npm run dev` or the project's preview tooling) and, logged in as a Starter/Pro store:
- Open `/painel`. Confirm "Produtos recentes" is gone and no empty gap is left where it used to be.
- Confirm "Vendas pela vitrine" shows the period filter with "Este mês" active by default, and the three stat cards show non-"no mês" labels ("Pedidos", "Vendas confirmadas", "Aguardando confirmação").
- Click "Hoje", "7 dias", "Todo período" — confirm the URL updates (`?periodo=...`) and the three numbers change accordingly.
- Click "Personalizado", pick a date range, click "Aplicar" — confirm the URL shows `?de=...&ate=...` and the numbers update.
- Log in as a Free-plan store — confirm the period filter does not appear and the upgrade card (`RecursoBloqueado`) is shown instead.

- [ ] **Step 5: Manual browser verification — Pedidos**

On the same session:
- Open `/painel/pedidos`. Confirm it loads pre-filtered to "Este mês" and the period filter is visible even if the list is empty.
- Type a search term with a period filter active (e.g. "Hoje" selected) — confirm the list narrows and the URL keeps both `periodo` and `q`.
- Switch back to "Todo período" — confirm the full history reappears and the search term is preserved.
- Trigger a period with zero results (e.g. "Hoje" on a store with no orders today) — confirm the "Nenhum pedido no período" empty state appears (not "Nenhum pedido ainda").
- Paginate with a period+search combination active — confirm both params survive in the pagination links.

- [ ] **Step 6: Report results**

No commit for this task — it's verification only. If any step surfaces a regression, fix it within the task where it belongs (re-open that task's file/tests) rather than patching ad hoc here.
