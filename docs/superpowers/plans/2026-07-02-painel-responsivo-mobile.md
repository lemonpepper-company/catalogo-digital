# Painel Responsivo Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar as 5 telas do painel do lojista (`/painel`) totalmente utilizáveis em smartphone, sem regredir o layout desktop atual.

**Architecture:** Tailwind mobile-first, sem detecção de viewport via JS. Um único breakpoint de troca (`lg:`, 1024px) decide entre layout mobile (bottom tab bar, cards empilhados, formulários em coluna única) e o layout desktop atual (sidebar fixa, tabela, grids de 2 colunas), inalterado acima de `lg:`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v3, Lucide React. Nenhuma dependência nova.

## Global Constraints

- Breakpoint de troca mobile↔desktop é `lg:` (1024px) — Tailwind default, não customizado em `tailwind.config.ts`.
- Zero JS de detecção de viewport (`useState`/`matchMedia`) — toda adaptação via classes Tailwind responsivas.
- Layout em `lg:` e acima deve permanecer pixel-idêntico ao atual — nenhuma regressão desktop.
- Sem dependências novas.
- Mudança é puramente de CSS/layout — não há teste automatizado (Vitest) aplicável; verificação é visual via dev server em 375px (mobile) e 1440px (desktop).
- Depois de cada task, rodar `npm run lint` (pega imports/props não usados — relevante porque várias tasks removem props).
- Spec de referência: `docs/superpowers/specs/2026-07-02-painel-responsivo-mobile-design.md`.

---

## File Structure

**Criar:**
- `components/painel/MobileTabBar.tsx` — bottom tab bar de navegação, visível apenas abaixo de `lg:`.

**Modificar:**
- `app/painel/layout.tsx` — padding responsivo, banner de trial sem `whitespace-nowrap`, renderiza `Sidebar` + `MobileTabBar`.
- `components/painel/Sidebar.tsx` — oculto abaixo de `lg:`; remove o bloco "Sair"/link do catálogo (migra para Configurações).
- `app/painel/configuracoes/ConfiguracoesClient.tsx` — novo Card "Conta" (catálogo + Sair) fora do `<form>` de configurações; grids de campo em coluna única no mobile.
- `app/painel/configuracoes/loading.tsx` — grids do skeleton acompanham os breakpoints do componente real.
- `app/painel/DashboardClient.tsx` — grid de StatCards e card de link do catálogo empilham no mobile.
- `app/painel/loading.tsx` — skeleton acompanha os mesmos breakpoints.
- `app/painel/produtos/ProdutosClient.tsx` — lista vira cards empilhados abaixo de `lg:`; tabela atual só acima de `lg:`.
- `app/painel/produtos/loading.tsx` — skeleton com variante mobile/desktop, sem overflow horizontal.
- `app/painel/produtos/ProdutoFormClient.tsx` — grid de fotos e grids de campos em coluna única/reduzida no mobile.
- `app/painel/produtos/novo/loading.tsx` e `app/painel/produtos/[id]/loading.tsx` — mesmos ajustes de skeleton.
- `components/ui/Card.tsx` — padding padrão reduzido no mobile.
- `components/ui/Modal.tsx` — padding interno reduzido no mobile.

**Sem mudança de código** (verificado nesta rodada de planejamento — já funcionam sem overflow em 375px, não usam grid de múltiplas colunas):
- `app/painel/categorias/CategoriasClient.tsx`
- `app/painel/categorias/loading.tsx`

---

### Task 1: Bottom tab bar + Sidebar/layout responsivos

**Files:**
- Create: `components/painel/MobileTabBar.tsx`
- Modify: `components/painel/Sidebar.tsx`
- Modify: `app/painel/layout.tsx`

**Interfaces:**
- Produces: `MobileTabBar()` — componente client sem props, renderiza `<nav>` fixo no rodapé com os 4 links de navegação do painel. Usado por `app/painel/layout.tsx`.
- Produces: `Sidebar` perde a prop `slug` (não é mais consumida internamente). Assinatura nova: `Sidebar({ name, monogram, logoUrl }: { name: string; monogram: string | null; logoUrl: string | null })`.
- Consumes: nenhuma interface de outras tasks.

- [ ] **Step 1: Criar `components/painel/MobileTabBar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Tag, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

function TabItem({ href, icon, label, active }: TabItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2",
        "font-body text-[11px] transition-colors duration-200",
        active ? "text-obsidian font-medium" : "text-graphite font-normal"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel" ? pathname === "/painel" : pathname.startsWith(path);

  return (
    <nav
      aria-label="Navegação do painel"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch h-16 bg-ivory border-t border-sand/50"
    >
      <TabItem
        href="/painel"
        icon={<LayoutDashboard size={20} />}
        label="Dashboard"
        active={isActive("/painel")}
      />
      <TabItem
        href="/painel/produtos"
        icon={<Tag size={20} />}
        label="Produtos"
        active={isActive("/painel/produtos")}
      />
      <TabItem
        href="/painel/categorias"
        icon={<Layers size={20} />}
        label="Categorias"
        active={isActive("/painel/categorias")}
      />
      <TabItem
        href="/painel/configuracoes"
        icon={<Settings size={20} />}
        label="Config."
        active={isActive("/painel/configuracoes")}
      />
    </nav>
  );
}
```

- [ ] **Step 2: Editar `components/painel/Sidebar.tsx`** — ocultar abaixo de `lg:`, remover prop `slug` e o bloco "Sair"/catálogo (migra para Configurações na Task 2)

Substituir o arquivo inteiro por:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Tag, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  name: string;
  monogram: string | null;
  logoUrl: string | null;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 w-full px-3.5 py-[11px] rounded-btn",
        "font-body text-[15px] transition-all duration-200",
        active
          ? "bg-linen text-obsidian font-medium"
          : "text-graphite font-normal hover:bg-surface-hover"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Sidebar({ name, monogram, logoUrl }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel"
      ? pathname === "/painel"
      : pathname.startsWith(path);

  const initials = monogram ?? name.slice(0, 2).toUpperCase();

  return (
    <aside className="hidden lg:flex w-[248px] flex-shrink-0 border-r border-sand/50 p-5 flex-col gap-6 h-full">
      <div className="flex items-center gap-3 px-1.5 py-1">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-obsidian text-white flex items-center justify-center font-display font-semibold text-[15px] flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-display font-semibold text-[15px] text-obsidian truncate">
            {name}
          </div>
          <div className="font-body text-[12px] text-graphite">
            Painel do lojista
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        <NavItem
          href="/painel"
          icon={<LayoutDashboard size={19} />}
          label="Dashboard"
          active={isActive("/painel")}
        />
        <NavItem
          href="/painel/produtos"
          icon={<Tag size={19} />}
          label="Produtos"
          active={isActive("/painel/produtos")}
        />
        <NavItem
          href="/painel/categorias"
          icon={<Layers size={19} />}
          label="Categorias"
          active={isActive("/painel/categorias")}
        />
        <NavItem
          href="/painel/configuracoes"
          icon={<Settings size={19} />}
          label="Configurações"
          active={isActive("/painel/configuracoes")}
        />
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Editar `app/painel/layout.tsx`** — remover prop `slug` da chamada de `Sidebar`, renderizar `MobileTabBar`, ajustar padding e banner de trial

Localizar o import da `Sidebar` (linha 3) e adicionar o import de `MobileTabBar` logo abaixo:

```tsx
import { Sidebar } from '@/components/painel/Sidebar'
import { MobileTabBar } from '@/components/painel/MobileTabBar'
```

Substituir o bloco do banner de trial (o `<div>` com `whitespace-nowrap`) por:

```tsx
      {showTrialBanner && (
        <div className="flex-shrink-0 flex flex-wrap lg:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 lg:h-10 lg:py-0 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold text-center">
          <span className="font-semibold tracking-[0.02em]">Trial Pro</span>
          <span className="opacity-55">·</span>
          <span>{trialDaysLeft} dias restantes</span>
          <span className="opacity-55">·</span>
          <a
            href="/escolha-de-plano"
            className="font-display font-semibold text-[13.5px] text-gold hover:underline"
          >
            Assinar agora →
          </a>
        </div>
      )}
```

Substituir o bloco final (`<div className="flex flex-1 min-h-0">...</div>`) por:

```tsx
      <div className="flex flex-1 min-h-0">
        <Sidebar
          name={store?.name ?? ''}
          monogram={store?.monogram ?? null}
          logoUrl={store?.logo_url ?? null}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 pb-24 lg:px-12 lg:py-10 lg:pb-10">{children}</div>
        </main>
      </div>

      <MobileTabBar />
```

- [ ] **Step 4: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros — nenhuma referência restante a `slug` em `Sidebar`, nenhum import não usado.

- [ ] **Step 5: Verificar visualmente**

Run: `npm run dev`

Abrir `/painel` no navegador:
- Em 1440px (desktop): sidebar lateral aparece como antes, sem tab bar no rodapé, banner de trial (se houver) em uma linha só.
- Redimensionar para 375px (mobile): sidebar desaparece, tab bar fixa aparece no rodapé com os 4 itens, item da rota atual destacado, conteúdo não fica coberto pela tab bar ao rolar até o fim da página, banner de trial (se houver) quebra em duas linhas sem vazar da tela.
- Clicar nos 4 itens da tab bar em mobile e confirmar que navegam para as rotas corretas.

- [ ] **Step 6: Commit**

```bash
git add components/painel/MobileTabBar.tsx components/painel/Sidebar.tsx app/painel/layout.tsx
git commit -m "feat: navegação mobile do painel com bottom tab bar"
```

---

### Task 2: Configurações — Card "Conta" (catálogo + Sair) e grids responsivos

**Files:**
- Modify: `app/painel/configuracoes/ConfiguracoesClient.tsx`
- Modify: `app/painel/configuracoes/loading.tsx`

**Interfaces:**
- Consumes: `signOut` de `@/app/actions/auth` (Server Action existente, `app/actions/auth.ts:282`, assinatura `(): Promise<never>`, usada em `<form action={signOut}>`). `StoreSettings.slug: string` (`lib/types.ts:84`, não nulo).
- Consumes: nenhuma interface criada na Task 1 (independente, mas deve ser executada logo após — a Task 1 remove "Sair" da Sidebar; esta task o reintroduz em Configurações).

- [ ] **Step 1: Editar imports de `ConfiguracoesClient.tsx`**

No topo do arquivo, trocar:

```tsx
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { ACCENT_COLOR_OPTIONS } from "@/lib/data";
import type { StoreSettings } from "@/lib/types";
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";
```

por:

```tsx
import { Upload, ExternalLink, LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Toast } from "@/components/ui/Toast";
import { ACCENT_COLOR_OPTIONS } from "@/lib/data";
import { signOut } from "@/app/actions/auth";
import type { StoreSettings } from "@/lib/types";
import { useConfiguracoes, MSG_VARS } from "./use-configuracoes";
```

- [ ] **Step 2: Envolver o formulário com o Card "Conta" e mover o `<h1>` para dentro do form**

Substituir a abertura do componente (de `export function ConfiguracoesClient` até o `<h1>` inclusive):

```tsx
export function ConfiguracoesClient({ settings }: { settings: StoreSettings }) {
  const f = useConfiguracoes(settings);
  const catalogUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${settings.slug}`;
  const catalogLabel = catalogUrl.replace(/^https?:\/\//, "");

  return (
    <div className="max-w-form flex flex-col gap-5">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="font-body font-medium text-[11px] tracking-[0.08em] uppercase text-graphite">
              Catálogo público
            </div>
            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-display font-medium text-[15px] text-obsidian flex items-center gap-1.5 hover:underline mt-1 min-w-0"
            >
              <span className="truncate">{catalogLabel}</span>
              <ExternalLink size={13} className="flex-shrink-0" />
            </a>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" iconLeft={<LogOut size={18} />}>
              Sair
            </Button>
          </form>
        </div>
      </Card>

      <form action={f.formAction} className="flex flex-col gap-5">
        <h1 className="font-display font-semibold text-[28px] text-obsidian">
          Configurações da loja
        </h1>
```

- [ ] **Step 3: Fechar a nova `<div>` externa no final do componente**

Localizar o fim do componente:

```tsx
      {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
    </form>
  );
}
```

Substituir por:

```tsx
        {f.toast && <Toast msg={f.toast.msg} tone={f.toast.tone} />}
      </form>
    </div>
  );
}
```

(A indentação do conteúdo entre o `<h1>` e este trecho não muda — apenas a abertura/fechamento acima ganham um nível a mais de indentação lógica; não é necessário reindentar o corpo inteiro do arquivo.)

- [ ] **Step 4: Grid "Identidade" em coluna única no mobile**

Trocar:

```tsx
        <div className="grid grid-cols-2 gap-[18px]">
          <Input
            name="name"
            label="Nome da loja"
            value={f.storeName}
            onChange={(e) => f.setStoreName(e.target.value)}
          />
          <Input
            name="whatsapp"
            label="WhatsApp para pedidos"
            prefix="+55"
            value={f.whatsapp}
            onChange={(e) => f.setWhatsapp(e.target.value)}
          />
          <Input
            name="monogram"
            label="Monograma (até 3 letras)"
            placeholder="Ex: MR"
            maxLength={3}
            value={f.monogram}
            onChange={(e) => f.setMonogram(e.target.value)}
          />
          <div className="col-span-1" />
          <div className="col-span-2">
            <Input
              name="description"
              label="Descrição curta"
              value={f.storeDescription}
              onChange={(e) => f.setStoreDescription(e.target.value)}
            />
          </div>
        </div>
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <Input
            name="name"
            label="Nome da loja"
            value={f.storeName}
            onChange={(e) => f.setStoreName(e.target.value)}
          />
          <Input
            name="whatsapp"
            label="WhatsApp para pedidos"
            prefix="+55"
            value={f.whatsapp}
            onChange={(e) => f.setWhatsapp(e.target.value)}
          />
          <Input
            name="monogram"
            label="Monograma (até 3 letras)"
            placeholder="Ex: MR"
            maxLength={3}
            value={f.monogram}
            onChange={(e) => f.setMonogram(e.target.value)}
          />
          <div className="hidden sm:block" />
          <div className="sm:col-span-2">
            <Input
              name="description"
              label="Descrição curta"
              value={f.storeDescription}
              onChange={(e) => f.setStoreDescription(e.target.value)}
            />
          </div>
        </div>
```

- [ ] **Step 5: Grid "Mensagem do pedido" em coluna única no mobile**

Trocar:

```tsx
        <div className="grid grid-cols-2 gap-6 items-start">
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
```

- [ ] **Step 6: Atualizar `app/painel/configuracoes/loading.tsx`** para acompanhar os mesmos breakpoints

Trocar as três ocorrências de grid no arquivo:

```tsx
        <div className="grid grid-cols-2 gap-[18px]">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
```

e:

```tsx
        <div className="grid grid-cols-2 gap-6">
          <Sk w="w-full" h="h-48" rounded="rounded-input" />
          <Sk w="w-full" h="h-48" rounded="rounded-card" />
        </div>
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Sk w="w-full" h="h-48" rounded="rounded-input" />
          <Sk w="w-full" h="h-48" rounded="rounded-card" />
        </div>
```

e (o último bloco, com 2 `FieldSkeleton`):

```tsx
        <div className="grid grid-cols-2 gap-[18px]">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
```

- [ ] **Step 7: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 8: Verificar visualmente**

Run: `npm run dev`

Abrir `/painel/configuracoes`:
- Em 1440px: Card "Conta" no topo com link do catálogo à esquerda e botão "Sair" à direita, na mesma linha; grids de campos em 2 colunas como antes.
- Em 375px: Card "Conta" empilha (link em cima, botão "Sair" embaixo, largura total); todos os grids de campo em coluna única; botão "Sair" efetivamente desloga o usuário e redireciona para `/login`.
- Confirmar que o link do catálogo abre a URL correta em nova aba.

- [ ] **Step 9: Commit**

```bash
git add app/painel/configuracoes/ConfiguracoesClient.tsx app/painel/configuracoes/loading.tsx
git commit -m "feat: card de conta (catálogo + sair) e layout responsivo em Configurações"
```

---

### Task 3: Dashboard responsivo

**Files:**
- Modify: `app/painel/DashboardClient.tsx`
- Modify: `app/painel/loading.tsx`

**Interfaces:**
- Nenhuma nova — apenas classes Tailwind.

- [ ] **Step 1: Grid de StatCards em coluna única no mobile**

Em `app/painel/DashboardClient.tsx`, trocar:

```tsx
      <div className="grid grid-cols-3 gap-4">
```

por:

```tsx
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
```

- [ ] **Step 2: Card "Link do catálogo" empilha no mobile**

Trocar:

```tsx
      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
```

por:

```tsx
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
```

- [ ] **Step 3: Atualizar `app/painel/loading.tsx`** para acompanhar os mesmos breakpoints

Trocar:

```tsx
      <div className="grid grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6">
        <div className="flex items-center justify-between gap-4">
```

por:

```tsx
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="bg-white border border-sand/50 rounded-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
```

- [ ] **Step 4: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 5: Verificar visualmente**

Run: `npm run dev`

Abrir `/painel`:
- Em 1440px: 3 StatCards lado a lado, card de link do catálogo com texto à esquerda e botões à direita na mesma linha.
- Em 375px: StatCards empilhados verticalmente (1 por linha), card de link do catálogo com texto em cima e botões "Abrir"/"Copiar link" embaixo, nenhum overflow horizontal.
- Lista "Produtos recentes" sem alteração visual, sem overflow em 375px.

- [ ] **Step 6: Commit**

```bash
git add app/painel/DashboardClient.tsx app/painel/loading.tsx
git commit -m "feat: layout responsivo do Dashboard"
```

---

### Task 4: Produtos — lista vira cards empilhados no mobile

**Files:**
- Modify: `app/painel/produtos/ProdutosClient.tsx`
- Modify: `app/painel/produtos/loading.tsx`

**Interfaces:**
- Produces: 4 componentes locais não exportados em `ProdutosClient.tsx` — `ProductThumbnail({ src, alt, active })`, `StockLabel({ stock, tone })`, `VisibilityToggle({ active, onToggle })`, `ProductActions({ editHref, onDelete })` — usados apenas dentro deste arquivo, pelas variantes mobile e desktop da lista.
- Consumes: `useProdutos` (hook) não muda.

- [ ] **Step 1: Resumo de contadores empilha no mobile**

Em `ProdutosClient.tsx`, trocar:

```tsx
          <Card className="bg-linen">
            <div className="flex items-center gap-10 flex-wrap">
```

por:

```tsx
          <Card className="bg-linen">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10">
```

- [ ] **Step 2: Ocultar cabeçalho de colunas abaixo de `lg:`**

Trocar:

```tsx
          <Card pad={0} className="overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-3 bg-linen">
```

por:

```tsx
          <Card pad={0} className="overflow-hidden">
            <div className="hidden lg:flex items-center gap-4 px-5 py-3 bg-linen">
```

- [ ] **Step 3: Extrair componentes auxiliares reutilizados pelas duas variantes**

O card mobile e a linha desktop compartilham conteúdo idêntico (thumbnail da foto, texto de estoque, toggle de visibilidade, botões de ação) — para não duplicar esses trechos, extrair 4 componentes locais. Adicionar ao final de `ProdutosClient.tsx`, depois do fechamento da função `ProdutosClient`:

```tsx
function ProductThumbnail({
  src,
  alt,
  active,
}: {
  src: string | undefined;
  alt: string;
  active: boolean;
}) {
  return (
    <div
      className="relative w-[52px] h-16 rounded-[8px] overflow-hidden bg-linen flex-shrink-0"
      style={{ opacity: active ? 1 : 0.5 }}
    >
      {src && (
        <Image src={src} alt={alt} fill sizes="52px" className="object-cover" />
      )}
    </div>
  );
}

function StockLabel({ stock, tone }: { stock: number; tone: string }) {
  return (
    <span className={cn("font-body text-[13px]", tone)}>
      {stock === 0 ? "Esgotado" : `${stock} em estoque`}
    </span>
  );
}

function VisibilityToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch checked={active} onChange={onToggle} />
      <span
        className={cn(
          "font-body text-[13px]",
          active ? "text-success" : "text-inactive"
        )}
      >
        {active ? "Ativo" : "Inativo"}
      </span>
    </div>
  );
}

function ProductActions({
  editHref,
  onDelete,
}: {
  editHref: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1 flex-shrink-0">
      <Link
        href={editHref}
        aria-label="Editar"
        className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-obsidian flex items-center justify-center hover:bg-surface-hover transition-colors"
      >
        <Pencil size={15} />
      </Link>
      <button
        onClick={onDelete}
        aria-label="Excluir"
        className="w-9 h-9 rounded-btn border border-sand/50 bg-transparent text-error flex items-center justify-center hover:bg-error-surface transition-colors"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Substituir o corpo do `.map()` por card mobile + linha desktop, usando os componentes do Step 3**

Localizar o bloco (de `{products.map((p, i) => {` até o `})}` que fecha o `.map`) e substituir por:

```tsx
            {products.map((p, i) => {
              const isSoldOut = p.stock === 0;
              const stockTone =
                isSoldOut || p.stock <= 5
                  ? "text-soldout font-semibold"
                  : "text-graphite";
              return (
                <div
                  key={p.id}
                  style={{
                    borderTop: i > 0 ? "0.5px solid var(--color-border)" : "none",
                  }}
                >
                  {/* Card mobile (abaixo de lg:) */}
                  <div className="lg:hidden flex flex-col gap-3 px-5 py-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <ProductThumbnail
                        src={p.images[0]}
                        alt={p.name}
                        active={p.isActive}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-medium text-[15px] text-obsidian truncate">
                          {p.name}
                        </div>
                        <div className="font-body text-[13px] text-graphite mt-0.5">
                          {formatCents(p.priceCents)}
                        </div>
                      </div>
                      <ProductActions
                        editHref={`/painel/produtos/${p.id}`}
                        onDelete={() => setConfirm(p)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-[68px]">
                      <StockLabel stock={p.stock} tone={stockTone} />
                      <VisibilityToggle
                        active={p.isActive}
                        onToggle={() => toggleActive(p)}
                      />
                    </div>
                  </div>

                  {/* Linha desktop (lg: e acima) */}
                  <div className="hidden lg:flex items-center gap-4 px-5 py-3.5">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <ProductThumbnail
                        src={p.images[0]}
                        alt={p.name}
                        active={p.isActive}
                      />
                      <div className="min-w-0">
                        <div className="font-display font-medium text-[15px] text-obsidian truncate">
                          {p.name}
                        </div>
                        <div className="font-body text-[13px] text-graphite mt-0.5">
                          {formatCents(p.priceCents)}
                        </div>
                      </div>
                    </div>

                    <div className="w-[120px] flex-shrink-0 text-right">
                      <StockLabel stock={p.stock} tone={stockTone} />
                    </div>

                    <div className="w-[140px] flex-shrink-0">
                      <VisibilityToggle
                        active={p.isActive}
                        onToggle={() => toggleActive(p)}
                      />
                    </div>

                    <div className="w-[76px] flex-shrink-0">
                      <ProductActions
                        editHref={`/painel/produtos/${p.id}`}
                        onDelete={() => setConfirm(p)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
```

- [ ] **Step 5: Atualizar `app/painel/produtos/loading.tsx`** para não estourar 375px

Substituir o arquivo inteiro por:

```tsx
function Sk({ w, h, rounded = "rounded-[6px]" }: { w: string; h: string; rounded?: string }) {
  return <div className={`bg-sand/70 animate-pulse ${rounded} ${w} ${h}`} />;
}

function ProductRowSkeleton({ first = false }: { first?: boolean }) {
  return (
    <div
      style={{ borderTop: !first ? "0.5px solid var(--color-border)" : "none" }}
    >
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

export default function ProdutosLoading() {
  return (
    <div className="max-w-content flex flex-col gap-6">
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

- [ ] **Step 6: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Verificar visualmente**

Run: `npm run dev`

Abrir `/painel/produtos` (com pelo menos 2 produtos cadastrados):
- Em 1440px: layout de tabela idêntico ao atual (cabeçalho de colunas visível, linha única por produto).
- Em 375px: cabeçalho de colunas não aparece; cada produto é um card com foto+nome+preço e ícones de editar/excluir na primeira linha, estoque + switch de visibilidade na segunda linha; nenhum overflow horizontal.
- Testar em mobile: tocar no switch alterna ativo/inativo; tocar em excluir abre o modal de confirmação; tocar em editar navega para `/painel/produtos/[id]`.
- Recarregar a página e observar rapidamente o skeleton de loading — não deve haver scroll horizontal em 375px.

- [ ] **Step 8: Commit**

```bash
git add app/painel/produtos/ProdutosClient.tsx app/painel/produtos/loading.tsx
git commit -m "feat: lista de produtos em cards empilhados no mobile"
```

---

### Task 5: Formulário de produto responsivo (novo + editar)

**Files:**
- Modify: `app/painel/produtos/ProdutoFormClient.tsx`
- Modify: `app/painel/produtos/novo/loading.tsx`
- Modify: `app/painel/produtos/[id]/loading.tsx`

**Interfaces:**
- Nenhuma nova — apenas classes Tailwind. `useProdutoForm` (hook) não muda.

- [ ] **Step 1: Grid de fotos — 3 colunas no mobile, 5 a partir de `sm:`**

Em `ProdutoFormClient.tsx`, trocar:

```tsx
        <div className="grid grid-cols-5 gap-3">
```

por:

```tsx
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
```

- [ ] **Step 2: Grid "Informações" em coluna única no mobile**

Trocar:

```tsx
        <div className="grid grid-cols-2 gap-[18px]">
          <div className="col-span-2">
            <Input
              name="name"
              label="Nome do produto"
              value={f.name}
              onChange={(e) => f.setName(e.target.value)}
              placeholder="Ex: Vestido midi linho"
            />
          </div>
          <div className="col-span-2">
            <Textarea
              name="description"
              label="Descrição"
              rows={3}
              value={f.description}
              onChange={(e) => f.setDescription(e.target.value)}
              placeholder="Conte sobre o caimento, tecido e cuidados…"
            />
          </div>
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <div className="sm:col-span-2">
            <Input
              name="name"
              label="Nome do produto"
              value={f.name}
              onChange={(e) => f.setName(e.target.value)}
              placeholder="Ex: Vestido midi linho"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              name="description"
              label="Descrição"
              rows={3}
              value={f.description}
              onChange={(e) => f.setDescription(e.target.value)}
              placeholder="Conte sobre o caimento, tecido e cuidados…"
            />
          </div>
```

- [ ] **Step 3: Grid "Estoque & visibilidade" em coluna única no mobile**

Trocar:

```tsx
        <div className="grid grid-cols-2 gap-[18px] pb-2">
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] pb-2">
```

- [ ] **Step 4: Atualizar `app/painel/produtos/novo/loading.tsx`**

Trocar a definição de `FieldSkeleton`:

```tsx
function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "col-span-2" : ""}`}>
      <Sk w="w-24" h="h-3" />
      <Sk w="w-full" h="h-11" rounded="rounded-input" />
    </div>
  );
}
```

por:

```tsx
function FieldSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Sk w="w-24" h="h-3" />
      <Sk w="w-full" h="h-11" rounded="rounded-input" />
    </div>
  );
}
```

Trocar o grid do bloco "Informações":

```tsx
        <div className="grid grid-cols-2 gap-[18px]">
          <FieldSkeleton wide />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton wide />
        </div>
```

por:

```tsx
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px]">
          <FieldSkeleton wide />
          <FieldSkeleton />
          <FieldSkeleton />
          <FieldSkeleton wide />
        </div>
```

Trocar a linha de skeletons de fotos:

```tsx
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} w="w-[120px]" h="h-[120px]" rounded="rounded-[10px]" />
          ))}
        </div>
```

por:

```tsx
        <div className="flex gap-3 flex-wrap">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} w="w-[100px] sm:w-[120px]" h="h-[100px] sm:h-[120px]" rounded="rounded-[10px]" />
          ))}
        </div>
```

- [ ] **Step 5: Atualizar `app/painel/produtos/[id]/loading.tsx`** com as mesmas 3 mudanças do Step 4

Aplicar exatamente as mesmas três substituições do Step 4 (definição de `FieldSkeleton`, grid "Informações", linha de skeletons de fotos) neste arquivo — o conteúdo é idêntico ao de `novo/loading.tsx` nesses trechos.

- [ ] **Step 6: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 7: Verificar visualmente**

Run: `npm run dev`

Abrir `/painel/produtos/novo`:
- Em 1440px: grid de fotos com 5 colunas, campos "Nome"/"Descrição" ocupando a largura toda, "Preço"/"Categoria" lado a lado — tudo como antes.
- Em 375px: grid de fotos com 3 colunas, todos os campos em coluna única, nenhum overflow horizontal.
- Testar o fluxo completo em mobile: adicionar uma foto (via input de arquivo), preencher nome/preço/categoria, marcar tamanhos/cores, salvar — confirmar que o produto é criado.
- Abrir `/painel/produtos/[id]` de um produto existente e repetir a checagem visual em 375px e 1440px.

- [ ] **Step 8: Commit**

```bash
git add app/painel/produtos/ProdutoFormClient.tsx app/painel/produtos/novo/loading.tsx "app/painel/produtos/[id]/loading.tsx"
git commit -m "feat: formulário de produto responsivo no mobile"
```

---

### Task 6: Componentes compartilhados — padding responsivo em Card e Modal

**Files:**
- Modify: `components/ui/Card.tsx`
- Modify: `components/ui/Modal.tsx`

**Interfaces:**
- Nenhuma mudança de props ou assinatura — apenas classes Tailwind internas.

- [ ] **Step 1: `Card.tsx`** — padding padrão menor no mobile (só quando `pad` não é especificado)

Trocar:

```tsx
export function Card({ children, className, pad }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-sand/50 rounded-card",
        !pad && "p-6",
        className
      )}
      style={pad !== undefined ? { padding: pad } : undefined}
    >
      {children}
    </div>
  );
}
```

por:

```tsx
export function Card({ children, className, pad }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-sand/50 rounded-card",
        !pad && "p-5 lg:p-6",
        className
      )}
      style={pad !== undefined ? { padding: pad } : undefined}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: `Modal.tsx`** — padding interno menor no mobile

Trocar:

```tsx
      <div
        className={cn(
          "relative z-10 w-full max-w-md bg-ivory rounded-modal p-6",
          "flex flex-col gap-5",
          className
        )}
```

por:

```tsx
      <div
        className={cn(
          "relative z-10 w-full max-w-md bg-ivory rounded-modal p-5 lg:p-6",
          "flex flex-col gap-5",
          className
        )}
```

- [ ] **Step 3: Verificar tipos/lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificar visualmente**

Run: `npm run dev`

Em 1440px, abrir qualquer tela do painel com Card (Dashboard, Produtos, Categorias, Configurações) e um modal (ex.: excluir produto em `/painel/produtos`) — padding deve estar igual ao atual (`24px`/`p-6`).
Em 375px, repetir — padding deve estar visivelmente um pouco menor (`20px`/`p-5`), sem nenhum conteúdo colado na borda.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Card.tsx components/ui/Modal.tsx
git commit -m "feat: padding responsivo em Card e Modal"
```

---

### Task 7: Verificação final cruzada (todas as 5 telas, mobile + desktop)

**Files:** nenhum arquivo novo — apenas verificação end-to-end do resultado das Tasks 1-6.

**Interfaces:** N/A.

- [ ] **Step 1: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros de tipo ou de lint bloqueante.

- [ ] **Step 2: Lint completo**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Testes unitários existentes continuam passando**

Run: `npm run test`
Expected: todos os testes passam (nenhuma mudança de lógica foi feita, mas confirma que nada quebrou por acidente).

- [ ] **Step 4: Passagem visual mobile (375×812) em todas as 5 telas**

Run: `npm run dev`

Com o navegador em 375×812 (ou usando a ferramenta de preview em modo mobile), navegar por, em sequência: `/painel`, `/painel/produtos`, `/painel/produtos/novo`, `/painel/categorias`, `/painel/configuracoes`. Em cada uma:
- Confirmar que a tab bar aparece fixa no rodapé e navega corretamente.
- Confirmar que não há scroll horizontal (nenhum elemento vaza a largura da tela).
- Confirmar que todo texto e botão é legível/tocável sem zoom.

- [ ] **Step 5: Passagem visual desktop (1440×900) — checar regressão**

Redimensionar para 1440×900 e repetir a navegação pelas mesmas 5 telas. Confirmar que o layout é visualmente idêntico ao que era antes desta rodada (sidebar lateral, tabelas, grids de 2/3 colunas, sem tab bar visível).

- [ ] **Step 6: Confirmar Categorias sem regressão em nenhum breakpoint**

`CategoriasClient.tsx` não foi alterado nesta rodada. Abrir `/painel/categorias` em 375px e 1440px e confirmar que a lista, o formulário inline de criação/edição e o modal de exclusão funcionam e não apresentam overflow em nenhum dos dois tamanhos — se houver algum problema, ele deve ser corrigido como parte desta task (não estava previsto, mas é coberto pelo objetivo de paridade total do spec).

- [ ] **Step 7: Commit final (se o Step 6 exigiu correções)**

Só necessário se o Step 6 encontrou e corrigiu algo:

```bash
git add app/painel/categorias/CategoriasClient.tsx
git commit -m "fix: ajuste de responsividade em Categorias"
```

---

## Self-Review

**Cobertura do spec:** as 6 seções da spec (`Estratégia`, `1. Navegação`, `2. Dashboard`, `3. Produtos — lista`, `4. Novo/Editar produto`, `5. Categorias e Configurações`, `6. Componentes compartilhados`, `Testes/Verificação`) mapeiam 1:1 para as Tasks 1-7 acima; Categorias foi verificada durante o planejamento e não precisa de mudança de código (documentado no File Structure e revalidado na Task 7).

**Placeholders:** nenhum "TBD"/"depois implementamos"/handler genérico — todo passo tem código completo.

**Consistência de tipos:** `Sidebar` perde `slug` na Task 1 e nenhuma outra task volta a passá-lo; `signOut` e `settings.slug` (não-nulo) são consumidos exatamente como definidos em `app/actions/auth.ts` e `lib/types.ts`; nomes de classes Tailwind (`lg:hidden`, `hidden lg:flex`, `sm:col-span-2`) usados de forma consistente em todas as tasks.
