# Domínio próprio no link do catálogo, Dashboard exclusiva de planos pagos e ajustes de landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o link do catálogo exibido no painel usar o domínio próprio quando verificado, tornar a Dashboard (`/painel`) exclusiva de planos pagos (Free nunca a vê), atualizar os planos da landing com a informação da Dashboard, e remover da Dashboard o card de link do catálogo e o botão de novo produto (ambos redundantes com a Sidebar e com `/painel/produtos`).

**Architecture:** Um helper puro novo (`lib/catalog-url.ts`) centraliza a decisão "domínio próprio vs. `{site}/{slug}`" e substitui o cálculo manual hoje duplicado em `Sidebar.tsx` e `ConfiguracoesClient.tsx`. A exclusividade de plano segue o padrão já usado em `/painel/pedidos` (gate síncrono antes de qualquer I/O, usando `getEffectivePlan`), mas aqui redireciona em vez de bloquear — a Dashboard some da navegação e da URL para quem está no Free. As remoções na Dashboard são só exclusão de JSX e do estado que ele consumia.

**Tech Stack:** Next.js App Router (Server Components + Client Components), TypeScript, Vitest + Testing Library.

## Global Constraints

- Nenhuma query de produtos/pedidos pode rodar para uma loja Free acessando `/painel` — o gate vem antes de qualquer I/O (mesmo espírito de ORD-28/ORD-29 já aplicado em Pedidos).
- `getEffectivePlan`/`getPlanLimits` (`lib/plan-limits.ts`) são a única fonte de verdade sobre capability de plano — nunca comparar `store.plan === "pro"` diretamente, sempre passar por eles (cobre o rebaixamento automático quando `trial_ends_at` vence).
- `NEXT_PUBLIC_SITE_URL` é a única env var usada para montar o link de fallback — nunca hardcodar um domínio.
- Componentes de UI existentes (`Sidebar`, `MobileTabBar`) devem continuar funcionando sem a nova prop opcional sendo passada (retrocompatibilidade dentro desta mesma rodada de tasks, já que várias tasks tocam os mesmos arquivos em sequência).

---

### Task 1: `getCatalogUrl` — helper puro de resolução do link do catálogo

**Files:**
- Create: `lib/catalog-url.ts`
- Test: `__tests__/catalog-url.test.ts`

**Interfaces:**
- Produces: `getCatalogUrl(store: { slug: string; plan: Plan; trialEndsAt: string | null; customDomain: string | null; customDomainVerified: boolean }): string` — usada pelas Tasks 2 e 5.

- [ ] **Step 1: Write the failing test**

Create `__tests__/catalog-url.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getCatalogUrl } from "@/lib/catalog-url";
import type { Plan } from "@/lib/plan-limits";

function makeStore(overrides: {
  plan: Plan;
  trialEndsAt?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
}) {
  return {
    slug: "ateliemira",
    trialEndsAt: null,
    customDomain: null,
    customDomainVerified: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vtrine.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCatalogUrl", () => {
  it("usa o domínio próprio quando o plano tem a capability e o domínio está verificado", () => {
    const url = getCatalogUrl(
      makeStore({ plan: "pro", customDomain: "minhaloja.com.br", customDomainVerified: true })
    );

    expect(url).toBe("https://minhaloja.com.br");
  });

  it("usa o link de slug quando o domínio ainda não foi verificado", () => {
    const url = getCatalogUrl(
      makeStore({ plan: "pro", customDomain: "minhaloja.com.br", customDomainVerified: false })
    );

    expect(url).toBe("https://vtrine.test/ateliemira");
  });

  it("usa o link de slug quando não há domínio cadastrado", () => {
    const url = getCatalogUrl(makeStore({ plan: "pro" }));

    expect(url).toBe("https://vtrine.test/ateliemira");
  });

  it("usa o link de slug quando o plano não tem a capability de domínio próprio (Starter)", () => {
    const url = getCatalogUrl(
      makeStore({ plan: "starter", customDomain: "minhaloja.com.br", customDomainVerified: true })
    );

    expect(url).toBe("https://vtrine.test/ateliemira");
  });

  it("cai para o link de slug quando o acesso Pro expirou (trial_ends_at vencido)", () => {
    const url = getCatalogUrl(
      makeStore({
        plan: "pro",
        trialEndsAt: "2020-01-01T00:00:00.000Z",
        customDomain: "minhaloja.com.br",
        customDomainVerified: true,
      })
    );

    expect(url).toBe("https://vtrine.test/ateliemira");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/catalog-url.test.ts`
Expected: FAIL — `Cannot find module '@/lib/catalog-url'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/catalog-url.ts`:

```ts
import { getPlanLimits, type Plan } from "@/lib/plan-limits";

export function getCatalogUrl(store: {
  slug: string;
  plan: Plan;
  trialEndsAt: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
}): string {
  const limits = getPlanLimits(store.plan, store.trialEndsAt);

  if (limits.customDomain && store.customDomainVerified && store.customDomain) {
    return `https://${store.customDomain}`;
  }

  return `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${store.slug}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/catalog-url.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/catalog-url.ts __tests__/catalog-url.test.ts
git commit -m "feat: helper getCatalogUrl resolve link do catálogo por domínio próprio"
```

---

### Task 2: Sidebar — usa `catalogUrl` resolvido e esconde Dashboard via `hideDashboard`

**Files:**
- Modify: `components/painel/Sidebar.tsx`
- Test: `__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: nenhuma (recebe `catalogUrl: string | null` já resolvido pelo chamador — Task 4).
- Produces: `Sidebar({ name, monogram, logoUrl, catalogUrl, hideDashboard }: SidebarProps)` — chamado pela Task 4 (`app/painel/layout.tsx`).

- [ ] **Step 1: Write the failing test**

Em `__tests__/Sidebar.test.tsx`, substitua todo o conteúdo por:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "@/components/painel/Sidebar";
import { VTRINE_WHATSAPP_NUMBER } from "@/lib/contact";

let pathname = "/painel";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

beforeEach(() => {
  pathname = "/painel";
});

describe("Sidebar", () => {
  it("renders the logo image when logoUrl is present", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl="https://cdn.test/logo.jpg"
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    const img = screen.getByRole("img", { name: "Ateliê Mira" });
    expect(img.getAttribute("src")).toBe("https://cdn.test/logo.jpg");
    expect(screen.queryByText("AM")).toBeNull();
  });

  it("falls back to the monogram when there is no logo", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    expect(screen.getByText("AM")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the real store name", () => {
    render(
      <Sidebar
        name="Loja Nova"
        monogram={null}
        logoUrl={null}
        catalogUrl="https://vtrine.test/loja-nova"
      />
    );
    expect(screen.getByText("Loja Nova")).toBeTruthy();
    // monogram derived from name when null
    expect(screen.getByText("LO")).toBeTruthy();
  });

  it("mostra o item de navegação Personalização", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    expect(screen.getByText("Personalização")).toBeTruthy();
  });
});

describe("Sidebar — item Pedidos (ORD-16)", () => {
  it("mostra o link Pedidos logo depois de Produtos", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    const pedidos = screen.getByRole("link", { name: "Pedidos" });
    expect(pedidos.getAttribute("href")).toBe("/painel/pedidos");

    const nav = screen.getByRole("navigation");
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual([
      "Dashboard",
      "Produtos",
      "Pedidos",
      "Categorias",
      "Personalização",
      "Configurações",
    ]);
  });

  it("marca Pedidos como ativo em /painel/pedidos", () => {
    pathname = "/painel/pedidos";
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("aria-current")
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")
    ).toBeNull();
  });

  it("mantém Pedidos inativo no dashboard", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    expect(
      screen.getByRole("link", { name: "Pedidos" }).getAttribute("aria-current")
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")
    ).toBe("page");
  });
});

describe("Sidebar — link de suporte", () => {
  it("mostra um link de Suporte apontando para o WhatsApp da Vtrine", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );
    const link = screen.getByRole("link", { name: /suporte/i });
    expect(link.getAttribute("href")).toBe(
      `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Olá! Preciso de suporte com minha loja na Vtrine Digital."
      )}`
    );
  });
});

describe("Sidebar — link do catálogo com domínio próprio", () => {
  it("mostra o domínio próprio quando o link já vem resolvido para ele", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://minhaloja.com.br"
      />
    );

    const link = screen.getByRole("link", { name: /minhaloja\.com\.br/ });
    expect(link.getAttribute("href")).toBe("https://minhaloja.com.br");
  });

  it("não mostra o card de catálogo quando catalogUrl é null", () => {
    render(
      <Sidebar name="Ateliê Mira" monogram="AM" logoUrl={null} catalogUrl={null} />
    );

    expect(screen.queryByText("Catálogo público em")).toBeNull();
  });
});

describe("Sidebar — Dashboard exclusiva de planos pagos", () => {
  it("esconde o item Dashboard quando hideDashboard é true", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
        hideDashboard
      />
    );

    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    const nav = screen.getByRole("navigation");
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual([
      "Produtos",
      "Pedidos",
      "Categorias",
      "Personalização",
      "Configurações",
    ]);
  });

  it("mostra o item Dashboard por padrão (hideDashboard ausente)", () => {
    render(
      <Sidebar
        name="Ateliê Mira"
        monogram="AM"
        logoUrl={null}
        catalogUrl="https://vtrine.test/ateliemira"
      />
    );

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/Sidebar.test.tsx`
Expected: FAIL — `slug` era a prop antiga; TypeScript/render reclama de `catalogUrl`/`hideDashboard` não existirem em `SidebarProps`, e o teste "esconde o item Dashboard" falha porque o componente ainda sempre renderiza o item.

- [ ] **Step 3: Write minimal implementation**

Em `components/painel/Sidebar.tsx`, troque a interface de props e o corpo do componente:

```tsx
interface SidebarProps {
  name: string;
  monogram: string | null;
  logoUrl: string | null;
  catalogUrl: string | null;
  hideDashboard?: boolean;
}
```

```tsx
export function Sidebar({
  name,
  monogram,
  logoUrl,
  catalogUrl,
  hideDashboard = false,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel"
      ? pathname === "/painel"
      : pathname.startsWith(path);

  const initials = monogram ?? name.slice(0, 2).toUpperCase();
  const catalogLabel = catalogUrl?.replace(/^https?:\/\//, "") ?? null;
```

No bloco `<nav>`, envolva o `NavItem` do Dashboard:

```tsx
      <nav className="flex flex-col gap-1">
        {!hideDashboard && (
          <NavItem
            href="/painel"
            icon={<LayoutDashboard size={19} />}
            label="Dashboard"
            active={isActive("/painel")}
          />
        )}
        <NavItem
          href="/painel/produtos"
          icon={<Tag size={19} />}
          label="Produtos"
          active={isActive("/painel/produtos")}
        />
```

E troque as duas ocorrências de `catalogHref` pelo prop `catalogUrl` direto:

```tsx
        {catalogUrl && (
          <div className="p-3.5 rounded-card bg-linen border border-sand/50">
            <p className="font-body text-[12px] text-graphite mb-1">
              Catálogo público em
            </p>
            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body font-medium text-[12px] text-obsidian flex items-center gap-1 hover:underline min-w-0"
            >
              <span className="truncate">{catalogLabel}</span>
              <ExternalLink size={11} className="flex-shrink-0" />
            </a>
          </div>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/Sidebar.test.tsx`
Expected: PASS (todos os testes, incluindo os dois novos describes)

- [ ] **Step 5: Commit**

```bash
git add components/painel/Sidebar.tsx __tests__/Sidebar.test.tsx
git commit -m "feat: Sidebar recebe catalogUrl resolvido e prop hideDashboard"
```

---

### Task 3: MobileTabBar — esconde Dashboard via `hideDashboard`

**Files:**
- Modify: `components/painel/MobileTabBar.tsx`
- Test: `__tests__/MobileTabBar.test.tsx`

**Interfaces:**
- Produces: `MobileTabBar({ hideDashboard }: { hideDashboard?: boolean })` — chamado pela Task 4.

- [ ] **Step 1: Write the failing test**

Adicione ao final de `__tests__/MobileTabBar.test.tsx` (mantendo os describes existentes intactos):

```tsx
describe("MobileTabBar — Dashboard exclusiva de planos pagos", () => {
  it("esconde a aba Dashboard quando hideDashboard é true", () => {
    render(<MobileTabBar hideDashboard />);

    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Navegação do painel" });
    const labels = Array.from(nav.querySelectorAll("a")).map((a) => a.textContent);
    expect(labels).toEqual(["Produtos", "Pedidos", "Categorias", "Estilo", "Config."]);
  });

  it("mostra a aba Dashboard por padrão (hideDashboard ausente)", () => {
    render(<MobileTabBar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/MobileTabBar.test.tsx`
Expected: FAIL — `MobileTabBar` não aceita props / a aba Dashboard sempre aparece.

- [ ] **Step 3: Write minimal implementation**

Em `components/painel/MobileTabBar.tsx`:

```tsx
export function MobileTabBar({ hideDashboard = false }: { hideDashboard?: boolean }) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel" ? pathname === "/painel" : pathname.startsWith(path);

  return (
    <nav
      aria-label="Navegação do painel"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch h-16 bg-ivory border-t border-sand/50"
    >
      {!hideDashboard && (
        <TabItem
          href="/painel"
          icon={<LayoutDashboard size={20} />}
          label="Dashboard"
          active={isActive("/painel")}
        />
      )}
      <TabItem
        href="/painel/produtos"
        icon={<Tag size={20} />}
        label="Produtos"
        active={isActive("/painel/produtos")}
      />
```

(o restante das `TabItem` — Pedidos, Categorias, Estilo, Config. — permanece igual, sem mudanças.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/MobileTabBar.test.tsx`
Expected: PASS (todos os testes, incluindo o novo describe)

- [ ] **Step 5: Commit**

```bash
git add components/painel/MobileTabBar.tsx __tests__/MobileTabBar.test.tsx
git commit -m "feat: MobileTabBar aceita hideDashboard para ocultar a aba Dashboard"
```

---

### Task 4: `PainelLayout` — resolve `catalogUrl` e `hideDashboard` para Sidebar/MobileTabBar

**Files:**
- Modify: `app/painel/layout.tsx`
- Test: `__tests__/PainelLayout.test.tsx` (novo)

**Interfaces:**
- Consumes: `getCatalogUrl` (Task 1), `Sidebar` com `catalogUrl`/`hideDashboard` (Task 2), `MobileTabBar` com `hideDashboard` (Task 3), `getEffectivePlan` (já existente em `lib/plan-limits.ts`).

- [ ] **Step 1: Write the failing test**

Create `__tests__/PainelLayout.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { StoreSettings } from "@/lib/types";

const getCurrentStore = vi.fn();

vi.mock("@/lib/server/store", () => ({
  getCurrentStore: () => getCurrentStore(),
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("NEXT_REDIRECT");
  },
  usePathname: () => "/painel",
}));

const STORE_ID = "11111111-1111-4111-8111-111111111111";

function makeStore(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: STORE_ID,
    name: "Ateliê Mira",
    slug: "ateliemira",
    plan: "free",
    trialEndsAt: null,
    whatsapp: "35999999999",
    accentColor: "#C9A96E",
    logoUrl: null,
    coverUrl: null,
    description: null,
    monogram: "AM",
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
    ...overrides,
  };
}

async function renderLayout() {
  const { default: PainelLayout } = await import("@/app/painel/layout");
  return render(await PainelLayout({ children: <div>conteúdo da página</div> }));
}

beforeEach(() => {
  getCurrentStore.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vtrine.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PainelLayout — Dashboard exclusiva de planos pagos", () => {
  it("esconde o item Dashboard da navegação no plano Free", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "free" }));

    await renderLayout();

    expect(screen.queryByRole("link", { name: "Dashboard" })).toBeNull();
  });

  it("mostra o item Dashboard no plano Pro", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "pro" }));

    await renderLayout();

    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
  });
});

describe("PainelLayout — link do catálogo com domínio próprio", () => {
  it("usa o domínio próprio verificado no Pro", async () => {
    getCurrentStore.mockResolvedValue(
      makeStore({
        plan: "pro",
        customDomain: "minhaloja.com.br",
        customDomainVerified: true,
      })
    );

    await renderLayout();

    expect(screen.getByText("minhaloja.com.br")).toBeTruthy();
  });

  it("usa o link de slug quando não há domínio verificado", async () => {
    getCurrentStore.mockResolvedValue(makeStore({ plan: "pro" }));

    await renderLayout();

    expect(screen.getByText("vtrine.test/ateliemira")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/PainelLayout.test.tsx`
Expected: FAIL — `Sidebar`/`MobileTabBar` ainda são chamados com `slug` em vez de `catalogUrl`/`hideDashboard`, então o texto do domínio e a ocultação do item Dashboard não aparecem como esperado.

- [ ] **Step 3: Write minimal implementation**

Em `app/painel/layout.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getCurrentStore } from '@/lib/server/store'
import { getEffectivePlan } from '@/lib/plan-limits'
import { getCatalogUrl } from '@/lib/catalog-url'
import { VTRINE_WHATSAPP_NUMBER } from '@/lib/contact'
import { Sidebar } from '@/components/painel/Sidebar'
import { MobileTabBar } from '@/components/painel/MobileTabBar'

export const metadata = {
  title: 'Painel — Vtrine Digital',
  robots: { index: false, follow: false },
}

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const store = await getCurrentStore()

  if (!store) {
    redirect('/login')
  }

  const isFree = getEffectivePlan(store.plan, store.trialEndsAt) === 'free'
  const catalogUrl = getCatalogUrl(store)
  const upgradeWhatsAppHref = `https://wa.me/${VTRINE_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Olá! Quero saber mais sobre os planos pagos da Vtrine.'
  )}`

  return (
    <div className="h-dvh flex flex-col bg-ivory overflow-hidden">
      {isFree && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Plano Free</span>
          <span className="opacity-55">·</span>
          <span>Fale conosco para liberar mais produtos</span>
          <a
            href={upgradeWhatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Falar no WhatsApp →
          </a>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <Sidebar
          name={store.name}
          monogram={store.monogram}
          logoUrl={store.logoUrl}
          catalogUrl={catalogUrl}
          hideDashboard={isFree}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-24 lg:px-12 lg:py-10 lg:pb-10">{children}</div>
        </main>
      </div>

      <MobileTabBar hideDashboard={isFree} />
    </div>
  )
}
```

(`showUpgradeBanner` foi renomeado para `isFree` — mesmo valor, nome que reflete os dois usos agora: banner de upgrade e ocultação do item Dashboard.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/PainelLayout.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/painel/layout.tsx __tests__/PainelLayout.test.tsx
git commit -m "feat: PainelLayout resolve domínio próprio e esconde Dashboard no Free"
```

---

### Task 5: `ConfiguracoesClient` — usa `getCatalogUrl` em vez do cálculo manual

**Files:**
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx:72-73`
- Test: `__tests__/ConfiguracoesClient.test.tsx`

**Interfaces:**
- Consumes: `getCatalogUrl` (Task 1).

- [ ] **Step 1: Write the failing test**

Adicione ao final de `__tests__/ConfiguracoesClient.test.tsx`:

```tsx
describe("ConfiguracoesClient — link do catálogo com domínio próprio", () => {
  it("mostra o domínio próprio quando verificado", () => {
    render(
      <ConfiguracoesClient
        settings={{
          ...baseSettings,
          trialEndsAt: null,
          customDomain: "minhaloja.com.br",
          customDomainVerified: true,
        }}
        limits={proLimits}
      />
    );

    expect(screen.getByText("minhaloja.com.br")).toBeTruthy();
  });

  it("mostra o link de slug quando o domínio não está verificado", () => {
    render(
      <ConfiguracoesClient
        settings={{ ...baseSettings, trialEndsAt: null }}
        limits={proLimits}
      />
    );

    expect(screen.getByText("vtrine.test/ateliemira")).toBeTruthy();
  });
});
```

No topo do arquivo de teste, adicione (junto dos outros `vi.mock`/setup, antes do primeiro `describe`):

```tsx
import { beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vtrine.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

(Se `beforeEach`/`afterEach` já estiverem importados de `"vitest"` no topo do arquivo, só adicione os dois blocos `beforeEach`/`afterEach` sem duplicar o import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: FAIL nos dois novos testes — o componente ainda monta o link só a partir de `settings.slug`, ignorando `customDomain`/`customDomainVerified`.

- [ ] **Step 3: Write minimal implementation**

Em `app/painel/configuracoes/ConfiguracoesClient.tsx`, adicione o import e troque a linha 72:

```tsx
import { getCatalogUrl } from "@/lib/catalog-url";
```

```tsx
  const f = useConfiguracoes(settings);
  const dominio = useDominio(settings);
  const catalogUrl = getCatalogUrl(settings);
  const catalogLabel = catalogUrl.replace(/^https?:\/\//, "");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ConfiguracoesClient.test.tsx`
Expected: PASS (suíte inteira, incluindo os dois novos testes)

- [ ] **Step 5: Commit**

```bash
git add app/painel/configuracoes/ConfiguracoesClient.tsx __tests__/ConfiguracoesClient.test.tsx
git commit -m "feat: Configurações usa getCatalogUrl para exibir domínio próprio"
```

---

### Task 6: `/painel` — gate de plano redireciona Free para Produtos

**Files:**
- Modify: `app/painel/page.tsx`
- Test: `__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `getEffectivePlan` (`lib/plan-limits.ts`, já existente).

- [ ] **Step 1: Write the failing test**

Adicione ao final de `__tests__/DashboardPage.test.tsx` (dentro do arquivo existente, mantendo os describes atuais intactos):

```tsx
describe("/painel — Dashboard exclusiva de planos pagos", () => {
  it("redireciona Free para /painel/produtos antes de buscar produtos ou métricas", async () => {
    getCurrentStore.mockResolvedValue(makeStore("free"));

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(from).not.toHaveBeenCalled();
    expect(getOrderMetrics).not.toHaveBeenCalled();
    expect(resolvePeriodRange).not.toHaveBeenCalled();
  });

  it("rebaixa Starter/Pro com trial_ends_at vencido para o redirect do Free", async () => {
    getCurrentStore.mockResolvedValue(makeStore("pro", "2020-01-01T00:00:00.000Z"));

    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(from).not.toHaveBeenCalled();
  });

  it("não redireciona Starter no plano ativo", async () => {
    getCurrentStore.mockResolvedValue(makeStore("starter"));

    await renderPage();

    expect(from).toHaveBeenCalled();
  });
});
```

O mock de `next/navigation` já lançado por `redirect` (`throw new Error("NEXT_REDIRECT")`) já existe no topo do arquivo — nenhuma mudança de setup é necessária além do describe acima.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/DashboardPage.test.tsx`
Expected: FAIL nos dois primeiros testes do novo describe — hoje `/painel` nunca redireciona por plano, só por ausência de loja.

- [ ] **Step 3: Write minimal implementation**

Em `app/painel/page.tsx`, adicione o import e o gate logo após o redirect de loja ausente:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStore, mapProduct } from "@/lib/server/store";
import { getPlanLimits, getEffectivePlan } from "@/lib/plan-limits";
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

  // Dashboard é exclusiva de planos pagos: no Free, nada dela é buscado nem
  // renderizado — redireciona antes de qualquer I/O.
  if (getEffectivePlan(store.plan, store.trialEndsAt) === "free") {
    redirect("/painel/produtos");
  }

  const params = await searchParams;
  // ...restante do arquivo sem mudanças
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/DashboardPage.test.tsx`
Expected: PASS (suíte inteira, incluindo o novo describe)

- [ ] **Step 5: Commit**

```bash
git add app/painel/page.tsx __tests__/DashboardPage.test.tsx
git commit -m "feat: /painel redireciona planos Free para /painel/produtos"
```

---

### Task 7: `DashboardClient` — remove o card de link do catálogo e o botão de novo produto

**Files:**
- Modify: `app/painel/DashboardClient.tsx`
- Modify: `app/painel/use-dashboard.ts`
- Modify: `app/painel/page.tsx`
- Test: `__tests__/DashboardClient.test.tsx`

**Interfaces:**
- Produces: `DashboardClient({ products, storeName, metrics, periodo, de, ate })` — sem mais `catalogUrl` (era consumido só internamente, nenhuma outra task depende dele).
- Produces: `useDashboard(products, metrics)` — sem mais o parâmetro `catalogUrl`.

- [ ] **Step 1: Write the failing test**

Em `__tests__/DashboardClient.test.tsx`, remova a linha `catalogUrl="https://vtrine.test/ateliemira"` da função `renderDashboard` (linha 35) e adicione o describe abaixo ao final do arquivo:

```tsx
describe("DashboardClient — dashboard paga não tem link de catálogo nem novo produto (ORD-48)", () => {
  it("não mostra o botão de cadastrar produto", () => {
    renderDashboard(null);

    expect(screen.queryByRole("link", { name: /cadastrar produto/i })).toBeNull();
  });

  it("não mostra o card de link do catálogo", () => {
    renderDashboard(null);

    expect(screen.queryByText("Link do catálogo")).toBeNull();
    expect(screen.queryByRole("button", { name: /copiar link/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/DashboardClient.test.tsx`
Expected: FAIL no novo describe — botão e card ainda existem. (A remoção da prop `catalogUrl` da chamada não quebra nada sozinha, pois TypeScript aceita prop a menos ser removida do tipo — o teste real que importa é o describe novo.)

- [ ] **Step 3: Write minimal implementation**

Em `app/painel/DashboardClient.tsx`, remova os imports não usados e a prop `catalogUrl`:

```tsx
"use client";

import { useTransition } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { RecursoBloqueado } from "@/components/painel/RecursoBloqueado";
import { PeriodoFiltro } from "@/components/painel/PeriodoFiltro";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";
import { useDashboard } from "./use-dashboard";

interface DashboardClientProps {
  products: StoreProduct[];
  storeName: string;
  metrics: OrderMetrics | null;
  periodo?: string;
  de?: string;
  ate?: string;
}

export function DashboardClient({
  products,
  storeName,
  metrics,
  periodo,
  de,
  ate,
}: DashboardClientProps) {
  const { activeProducts, soldOutProducts, total, orderStats } = useDashboard(
    products,
    metrics
  );
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6 w-full lg:max-w-content">
      <div>
        <h1 className="font-display font-semibold text-[28px] text-obsidian">
          Olá, {storeName}
        </h1>
        <p className="font-body text-[15px] text-graphite mt-1.5">
          Aqui está um resumo da sua loja hoje.
        </p>
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
    </div>
  );
}
```

(O `Toast`/`toast` some junto, já que só existia para o "Link copiado" do card removido.)

Em `app/painel/use-dashboard.ts`, remove `catalogUrl`, `copied`, `handleCopy` e o `toast`/`flash` (não sobra nenhum outro consumidor deles):

```ts
"use client";

import { formatCents } from "@/lib/utils";
import type { OrderMetrics } from "@/lib/order-metrics";
import type { StoreProduct } from "@/lib/types";

export function useDashboard(products: StoreProduct[], metrics: OrderMetrics | null) {
  const activeProducts = products.filter((p) => p.isActive && p.stock > 0);
  const soldOutProducts = products.filter((p) => p.stock === 0);

  // `null` = plano sem histórico de pedidos: nenhum número real existe aqui.
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

  return {
    activeProducts,
    soldOutProducts,
    total: products.length,
    orderStats,
  };
}
```

Em `app/painel/page.tsx`, remova a linha `const catalogUrl = ...` e a prop `catalogUrl={catalogUrl}` passada ao `DashboardClient`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/DashboardClient.test.tsx __tests__/DashboardPage.test.tsx`
Expected: PASS em ambos os arquivos

- [ ] **Step 5: Commit**

```bash
git add app/painel/DashboardClient.tsx app/painel/use-dashboard.ts app/painel/page.tsx __tests__/DashboardClient.test.tsx
git commit -m "refactor: remove card de link do catálogo e botão de novo produto da Dashboard"
```

---

### Task 8: Landing — planos citam a Dashboard como recurso pago

**Files:**
- Modify: `app/landing/data.tsx:118-137`
- Test: `__tests__/landing-data.test.ts`

- [ ] **Step 1: Write the failing test**

Adicione ao final de `__tests__/landing-data.test.ts`:

```ts
const DASHBOARD_FEATURE = "Dashboard com métricas de vendas";

describe("bullets de plano — Dashboard exclusiva de planos pagos (ORD-48)", () => {
  it("Starter lista 'Dashboard com métricas de vendas'", () => {
    expect(starterFeatures).toContain(DASHBOARD_FEATURE);
  });

  it("Pro lista 'Dashboard com métricas de vendas'", () => {
    expect(proFeatures).toContain(DASHBOARD_FEATURE);
  });

  it("Free não lista Dashboard em nenhuma variação", () => {
    expect(freeFeatures).not.toContain(DASHBOARD_FEATURE);
    expect(freeFeatures.some((f) => /dashboard/i.test(f))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/landing-data.test.ts`
Expected: FAIL nos dois primeiros testes do novo describe — `starterFeatures`/`proFeatures` ainda não citam Dashboard.

- [ ] **Step 3: Write minimal implementation**

Em `app/landing/data.tsx`, adicione a linha logo após `"Histórico de pedidos"` em `starterFeatures` e `proFeatures`:

```tsx
export const starterFeatures = [
  "Até 30 produtos",
  "5 categorias",
  "3 fotos por produto",
  "Temas, fundos e formatos personalizáveis",
  "Até 3 produtos em destaque",
  "Histórico de pedidos",
  "Dashboard com métricas de vendas",
];

export const proFeatures = [
  "Produtos ilimitados",
  "Categorias ilimitadas",
  "5 fotos por produto",
  "Temas, fundos e formatos personalizáveis",
  "Produtos em destaque ilimitados",
  "Histórico de pedidos",
  "Dashboard com métricas de vendas",
  "Cor secundária exclusiva",
  "Domínio próprio",
  "Importação de produtos por planilha",
];
```

(`freeFeatures` não muda.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/landing-data.test.ts`
Expected: PASS (suíte inteira, incluindo o novo describe)

- [ ] **Step 5: Commit**

```bash
git add app/landing/data.tsx __tests__/landing-data.test.ts
git commit -m "feat: planos da landing citam a Dashboard como recurso pago"
```

---

## Verificação final

Depois da Task 8, rodar a suíte completa e o typecheck antes de considerar o trabalho pronto:

```bash
npx vitest run
npx tsc --noEmit
```

Ambos devem passar sem erros. Teste manual complementar (não coberto por Vitest): logar no navegador com uma loja Free e confirmar que `/painel` redireciona para `/painel/produtos` sem o item Dashboard na navegação (desktop e mobile); logar com uma loja Pro com domínio verificado e ver o domínio próprio na Sidebar e em Configurações; abrir a landing e conferir "Dashboard com métricas de vendas" nas listas de Starter e Pro.
