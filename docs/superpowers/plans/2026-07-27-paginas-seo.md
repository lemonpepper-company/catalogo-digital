# Páginas de Conteúdo para SEO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar 5 páginas estáticas de nicho/caso de uso otimizadas para SEO, ampliando a superfície indexável do site além da home, sem depender de um pipeline de blog.

**Architecture:** Um template compartilhado (`SeoLandingPage`) recebe conteúdo tipado (`SeoLandingContent`) e renderiza a mesma estrutura visual da home (cores, tipografia, navbar simplificada, footer, `WhatsAppFloatingButton`). Cada rota (`app/<slug>/page.tsx`) só define `generateMetadata`-equivalente (export `metadata`) e importa o conteúdo de `app/<slug>/data.ts`. As 5 URLs entram em `app/sitemap.ts`. Como efeito colateral necessário, uma lista de slugs reservados passa a bloquear a criação de lojas com slug igual a uma rota estática (existente ou nova).

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript strict, Tailwind CSS v3, Zod v4, Vitest + Testing Library.

## Global Constraints

- Sem lógica em `page.tsx` (`docs/CONVENTIONS.md`) — só composição e `metadata`.
- Tailwind com os tokens já definidos em `tailwind.config.ts`/`app/globals.css` — nunca CSS inline para valores com token.
- Ícones sempre Lucide React, outline, `~2px` stroke, import nomeado.
- Sem `box-shadow`; transições no máximo `200ms ease`.
- Zod v4: ler erro com `.error.issues[0].message`.
- Nenhuma mudança em `app/page.tsx` (home), `app/robots.ts` ou rotas existentes fora do escopo listado abaixo.
- Server Actions (`'use server'`) só podem exportar funções async — por isso `storeSchema` precisa morar em `lib/validation/`, não em `app/actions/auth.ts`.

---

### Task 1: Lista de slugs reservados

**Files:**
- Create: `lib/reserved-slugs.ts`
- Test: `__tests__/reserved-slugs.test.ts`

**Interfaces:**
- Produces: `RESERVED_SLUGS: Set<string>` — usado por Task 2.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/reserved-slugs.test.ts
import { describe, it, expect } from 'vitest'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'

describe('RESERVED_SLUGS', () => {
  it('contém as rotas estáticas principais', () => {
    expect(RESERVED_SLUGS.has('login')).toBe(true)
    expect(RESERVED_SLUGS.has('painel')).toBe(true)
    expect(RESERVED_SLUGS.has('cadastro')).toBe(true)
    expect(RESERVED_SLUGS.has('api')).toBe(true)
  })

  it('contém as 5 novas páginas de SEO', () => {
    expect(RESERVED_SLUGS.has('vitrine-digital')).toBe(true)
    expect(RESERVED_SLUGS.has('catalogo-digital-gratis')).toBe(true)
    expect(RESERVED_SLUGS.has('vender-pelo-whatsapp')).toBe(true)
    expect(RESERVED_SLUGS.has('vitrine-online-sem-carrinho')).toBe(true)
    expect(RESERVED_SLUGS.has('alternativa-linktree-para-vender')).toBe(true)
  })

  it('não contém um slug de loja normal', () => {
    expect(RESERVED_SLUGS.has('boutique-da-ana')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/reserved-slugs.test.ts`
Expected: FAIL — `Cannot find module '@/lib/reserved-slugs'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/reserved-slugs.ts
export const RESERVED_SLUGS = new Set([
  'login',
  'cadastro',
  'painel',
  'api',
  'auth',
  'landing',
  'termos-de-uso',
  'politica-de-privacidade',
  'recuperar-senha',
  'redefinir-senha',
  'verificar-email',
  'vitrine-digital',
  'catalogo-digital-gratis',
  'vender-pelo-whatsapp',
  'vitrine-online-sem-carrinho',
  'alternativa-linktree-para-vender',
])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/reserved-slugs.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/reserved-slugs.ts __tests__/reserved-slugs.test.ts
git commit -m "feat: adiciona lista de slugs reservados"
```

---

### Task 2: Extrair `storeSchema` para `lib/validation/auth.ts` e bloquear slugs reservados

**Files:**
- Create: `lib/validation/auth.ts`
- Test: `__tests__/auth-validation.test.ts`
- Modify: `app/actions/auth.ts:1-56`

**Interfaces:**
- Consumes: `RESERVED_SLUGS` de `lib/reserved-slugs.ts` (Task 1); `whatsappSchema` de `lib/validation/painel.ts` (já existe); `PAYMENT_METHOD_VALUES`, `DELIVERY_METHOD_VALUES` de `lib/data.ts` (já existe).
- Produces: `storeSchema: ZodObject` — consumido por `app/actions/auth.ts` (`createStore`).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/auth-validation.test.ts
import { describe, it, expect } from 'vitest'
import { storeSchema } from '@/lib/validation/auth'

const validInput = {
  store_name: 'Loja da Ana',
  slug: 'loja-da-ana',
  whatsapp: '11999999999',
  monogram: 'LA',
  description: null,
  instagram: null,
  paymentMethods: [],
  deliveryMethods: [],
}

describe('storeSchema', () => {
  it('aceita um slug válido', () => {
    const r = storeSchema.safeParse(validInput)
    expect(r.success).toBe(true)
  })

  it('rejeita slug de rota estática existente', () => {
    const r = storeSchema.safeParse({ ...validInput, slug: 'painel' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Esse link não está disponível.')
  })

  it('rejeita slug igual a uma das novas páginas de SEO', () => {
    const r = storeSchema.safeParse({ ...validInput, slug: 'vitrine-digital' })
    expect(r.success).toBe(false)
  })

  it('rejeita slug com formato inválido', () => {
    const r = storeSchema.safeParse({ ...validInput, slug: 'Loja Ana' })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/auth-validation.test.ts`
Expected: FAIL — `Cannot find module '@/lib/validation/auth'`

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/validation/auth.ts
import { z } from 'zod'
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from '@/lib/data'
import { whatsappSchema } from '@/lib/validation/painel'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'

export const storeSchema = z.object({
  store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
  slug: z
    .string()
    .regex(/^[a-z0-9-]{2,50}$/, 'Link inválido')
    .refine((slug) => !RESERVED_SLUGS.has(slug), 'Esse link não está disponível.'),
  whatsapp: whatsappSchema,
  monogram: z.string().max(3, 'Monograma deve ter no máximo 3 letras').nullable(),
  description: z.string().max(500, 'Descrição muito longa').nullable(),
  instagram: z.string().max(100, 'Instagram muito longo').nullable(),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
})
```

Agora atualize `app/actions/auth.ts` para importar o schema em vez de defini-lo — troque:

```ts
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from '@/lib/data'
import { DEFAULT_ACCENT_COLOR } from '@/lib/theme'
import { uploadToBucket } from '@/lib/server/upload'
import { getSafeRedirect } from '@/lib/auth/safe-redirect'
import { whatsappSchema } from '@/lib/validation/painel'
```

por:

```ts
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_ACCENT_COLOR } from '@/lib/theme'
import { uploadToBucket } from '@/lib/server/upload'
import { getSafeRedirect } from '@/lib/auth/safe-redirect'
import { storeSchema } from '@/lib/validation/auth'
```

E remova o bloco `const storeSchema = z.object({ ... })` (linhas 47-56 do arquivo original) por completo — o schema agora vem do import. Nenhuma outra linha do arquivo muda (`passwordSchema`, `signUpSchema`, `signInSchema`, `resetPasswordSchema` continuam definidos localmente, ainda usam `z`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/auth-validation.test.ts`
Expected: PASS (4 tests)

Depois rode a suíte completa pra garantir que `app/actions/auth.ts` ainda compila e nenhum outro teste quebrou:

Run: `npx vitest run`
Expected: todos os testes existentes continuam passando.

- [ ] **Step 5: Commit**

```bash
git add lib/validation/auth.ts app/actions/auth.ts __tests__/auth-validation.test.ts
git commit -m "feat: bloqueia slugs reservados na criação de loja"
```

---

### Task 3: Template compartilhado `SeoLandingPage`

**Files:**
- Create: `components/seo/types.ts`
- Create: `components/seo/SeoLandingPage.tsx`
- Test: `__tests__/SeoLandingPage.test.tsx`

**Interfaces:**
- Produces: `SeoLandingContent` (interface) e `SeoLandingPage` (componente) — consumidos por Tasks 4-8.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/SeoLandingPage.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import type { SeoLandingContent } from "@/components/seo/types";

const content: SeoLandingContent = {
  h1: "Título de teste",
  heroSubtitle: "Subtítulo de teste",
  problemSolution: { title: "Problema", body: "Solução do problema" },
  benefits: [{ title: "Benefício 1", desc: "Descrição 1" }],
  faq: [{ q: "Pergunta 1?", a: "Resposta 1" }],
  ctaLabel: "Criar grátis",
  relatedLinks: [{ label: "Outra página", href: "/outra-pagina" }],
};

describe("SeoLandingPage", () => {
  it("renderiza o H1 e o subtítulo", () => {
    render(<SeoLandingPage content={content} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Título de teste" })
    ).toBeTruthy();
    expect(screen.getByText("Subtítulo de teste")).toBeTruthy();
  });

  it("renderiza os benefícios", () => {
    render(<SeoLandingPage content={content} />);
    expect(screen.getByText("Benefício 1")).toBeTruthy();
  });

  it("renderiza o FAQ", () => {
    render(<SeoLandingPage content={content} />);
    expect(screen.getByText("Pergunta 1?")).toBeTruthy();
  });

  it("renderiza os links relacionados", () => {
    render(<SeoLandingPage content={content} />);
    const link = screen.getByText("Outra página").closest("a");
    expect(link?.getAttribute("href")).toBe("/outra-pagina");
  });

  it("não renderiza a seção de links relacionados quando vazia", () => {
    render(<SeoLandingPage content={{ ...content, relatedLinks: [] }} />);
    expect(screen.queryByText("Veja também")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/SeoLandingPage.test.tsx`
Expected: FAIL — `Cannot find module '@/components/seo/SeoLandingPage'`

- [ ] **Step 3: Write minimal implementation**

```ts
// components/seo/types.ts
export interface SeoLandingContent {
  h1: string;
  heroSubtitle: string;
  problemSolution: { title: string; body: string };
  benefits: { title: string; desc: string }[];
  faq: { q: string; a: string }[];
  ctaLabel: string;
  relatedLinks: { label: string; href: string }[];
}
```

```tsx
// components/seo/SeoLandingPage.tsx
import NextLink from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { VtrineLogo } from "@/components/ui/VtrineLogo";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import type { SeoLandingContent } from "./types";

interface SeoLandingPageProps {
  content: SeoLandingContent;
}

export function SeoLandingPage({ content }: SeoLandingPageProps) {
  const { h1, heroSubtitle, problemSolution, benefits, faq, ctaLabel, relatedLinks } =
    content;

  return (
    <div className="min-h-screen bg-ivory">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-sand bg-ivory/[0.92] backdrop-blur">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 h-[72px] flex items-center justify-between">
          <NextLink href="/">
            <VtrineLogo size="sm" />
          </NextLink>
          <div className="flex items-center gap-4">
            <NextLink
              href="/login"
              className="hidden md:block font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Entrar
            </NextLink>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center justify-center h-9 sm:h-11 px-4 sm:px-6 rounded-btn bg-gold text-white font-display font-medium text-[13px] sm:text-[15px] hover:bg-gold-hover transition-colors whitespace-nowrap"
            >
              Criar catálogo grátis
            </NextLink>
          </div>
        </div>
      </nav>

      <section className="bg-ivory pt-[120px] pb-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[640px]">
            <h1 className="font-display font-semibold text-[36px] sm:text-[44px] text-obsidian leading-[1.08] tracking-tight mb-5 text-balance">
              {h1}
            </h1>
            <p className="font-body text-[18px] text-graphite leading-relaxed mb-8 text-pretty max-w-[560px]">
              {heroSubtitle}
            </p>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
            >
              {ctaLabel}
            </NextLink>
          </div>
        </div>
      </section>

      <section className="bg-linen py-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[720px]">
            <h2 className="font-display font-semibold text-[26px] md:text-[32px] text-obsidian leading-[1.15] tracking-tight mb-4 text-balance">
              {problemSolution.title}
            </h2>
            <p className="font-body text-[17px] text-graphite leading-relaxed text-pretty">
              {problemSolution.body}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ivory py-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8 max-w-[760px]">
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-3">
                <Check size={20} className="text-success flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-display font-medium text-[17px] text-obsidian mb-1">
                    {b.title}
                  </h3>
                  <p className="font-body text-[14px] text-graphite">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-linen py-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[720px]">
            <h2 className="font-display font-semibold text-[26px] md:text-[32px] text-obsidian leading-[1.15] tracking-tight mb-8 text-balance">
              Perguntas frequentes
            </h2>
            {faq.map((item, i) => (
              <details
                key={item.q}
                className="group border-b border-sand"
                {...(i === 0 ? { open: true } : {})}
              >
                <summary className="list-none cursor-pointer py-[22px] flex items-center justify-between gap-6">
                  <span className="font-display font-medium text-[16px] text-obsidian">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className="text-graphite flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="pb-[22px] font-body text-[14px] text-graphite">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {relatedLinks.length > 0 && (
        <section className="bg-ivory py-12">
          <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-[720px]">
              <span className="font-body font-medium text-[12px] tracking-[0.1em] uppercase text-graphite">
                Veja também
              </span>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
                {relatedLinks.map((link) => (
                  <NextLink
                    key={link.href}
                    href={link.href}
                    className="font-body text-[14px] text-obsidian underline underline-offset-4 hover:text-gold transition-colors"
                  >
                    {link.label}
                  </NextLink>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-obsidian py-24">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="text-center max-w-[600px] mx-auto">
            <h2 className="font-display font-semibold text-[28px] md:text-[36px] text-white leading-[1.1] tracking-tight mb-6 text-balance">
              Sua vitrine pode estar no ar ainda hoje.
            </h2>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
            >
              {ctaLabel}
            </NextLink>
          </div>
        </div>
      </section>

      <footer className="bg-linen border-t border-sand py-10">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row gap-4 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
          <NextLink href="/">
            <VtrineLogo size="sm" />
          </NextLink>
          <div className="flex items-center gap-4">
            <NextLink
              href="/politica-de-privacidade"
              className="hover:text-obsidian transition-colors"
            >
              Política de Privacidade
            </NextLink>
            <NextLink href="/termos-de-uso" className="hover:text-obsidian transition-colors">
              Termos de Uso
            </NextLink>
          </div>
        </div>
      </footer>

      <WhatsAppFloatingButton />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/SeoLandingPage.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add components/seo/types.ts components/seo/SeoLandingPage.tsx __tests__/SeoLandingPage.test.tsx
git commit -m "feat: adiciona template compartilhado para páginas de SEO"
```

---

### Task 4: Página `/vitrine-digital`

**Files:**
- Create: `app/vitrine-digital/data.ts`
- Create: `app/vitrine-digital/page.tsx`
- Test: `__tests__/vitrine-digital-page.test.tsx`

**Interfaces:**
- Consumes: `SeoLandingContent` e `SeoLandingPage` de `components/seo/` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/vitrine-digital-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VitrineDigitalPage, { metadata } from "@/app/vitrine-digital/page";

describe("VitrineDigitalPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("O que é Vitrine Digital? — Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<VitrineDigitalPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "O que é uma vitrine digital (e por que sua loja precisa de uma)",
      })
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/vitrine-digital-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/vitrine-digital/page'`

- [ ] **Step 3: Write minimal implementation**

```ts
// app/vitrine-digital/data.ts
import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "O que é uma vitrine digital (e por que sua loja precisa de uma)",
  heroSubtitle:
    "Vitrine digital é o catálogo online da sua marca: o cliente vê todos os produtos organizados e compra direto pelo WhatsApp, sem carrinho e sem taxa.",
  problemSolution: {
    title: "Mostrar produto por print no WhatsApp tem limite",
    body: "Hoje o lojista mostra produto por print no chat ou no Instagram — o cliente não tem visão do catálogo completo, o preço se perde na conversa e a loja não passa a imagem profissional que merece. Uma vitrine digital é um link único, com todos os produtos organizados, que substitui isso sem tirar a venda do WhatsApp.",
  },
  benefits: [
    {
      title: "Catálogo sempre atualizado",
      desc: "Sem reenviar fotos toda vez que alguém pergunta o que você vende.",
    },
    {
      title: "Um link só, pra tudo",
      desc: "Funciona na bio do Instagram ou no status do WhatsApp como sua loja.",
    },
    {
      title: "Pedido pronto no WhatsApp",
      desc: "O cliente escolhe o produto e o pedido já chega pra você com os detalhes certos.",
    },
    {
      title: "Com a cara da sua marca",
      desc: "Cor, capa e nome da loja personalizados — não é um catálogo genérico.",
    },
  ],
  faq: [
    {
      q: "Vitrine digital é a mesma coisa que loja virtual?",
      a: "Não. Uma loja virtual tem carrinho e checkout próprios. A vitrine digital mostra os produtos e manda o pedido pronto pro seu WhatsApp — a venda continua sendo você que fecha.",
    },
    {
      q: "Preciso saber programar?",
      a: "Não. Você monta o catálogo direto no painel, sem precisar de site nem código.",
    },
    {
      q: "É pago?",
      a: "Tem plano gratuito pra começar, sem cartão de crédito.",
    },
  ],
  ctaLabel: "Criar minha vitrine grátis",
  relatedLinks: [
    { label: "Catálogo digital grátis", href: "/catalogo-digital-gratis" },
    { label: "Vender pelo WhatsApp", href: "/vender-pelo-whatsapp" },
  ],
};
```

```tsx
// app/vitrine-digital/page.tsx
import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "O que é Vitrine Digital? — Vtrine Digital",
  description:
    "Vitrine digital é a loja online da sua marca, sem carrinho: o cliente vê os produtos e compra direto no WhatsApp. Veja como criar a sua grátis.",
  openGraph: {
    title: "O que é Vitrine Digital? — Vtrine Digital",
    description:
      "Vitrine digital é a loja online da sua marca, sem carrinho: o cliente vê os produtos e compra direto no WhatsApp. Veja como criar a sua grátis.",
    url: "/vitrine-digital",
  },
};

export default function VitrineDigitalPage() {
  return <SeoLandingPage content={content} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/vitrine-digital-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/vitrine-digital __tests__/vitrine-digital-page.test.tsx
git commit -m "feat: adiciona página de SEO /vitrine-digital"
```

---

### Task 5: Página `/catalogo-digital-gratis`

**Files:**
- Create: `app/catalogo-digital-gratis/data.ts`
- Create: `app/catalogo-digital-gratis/page.tsx`
- Test: `__tests__/catalogo-digital-gratis-page.test.tsx`

**Interfaces:**
- Consumes: `SeoLandingContent` e `SeoLandingPage` de `components/seo/` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/catalogo-digital-gratis-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CatalogoDigitalGratisPage, { metadata } from "@/app/catalogo-digital-gratis/page";

describe("CatalogoDigitalGratisPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Catálogo Digital Grátis — Crie o seu em minutos | Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<CatalogoDigitalGratisPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Criar catálogo digital grátis pra vender pelo WhatsApp",
      })
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/catalogo-digital-gratis-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/catalogo-digital-gratis/page'`

- [ ] **Step 3: Write minimal implementation**

```ts
// app/catalogo-digital-gratis/data.ts
import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Criar catálogo digital grátis pra vender pelo WhatsApp",
  heroSubtitle:
    "Monte seu catálogo completo, publique e comece a vender no plano gratuito — sem cartão de crédito, sem mensalidade pra testar.",
  problemSolution: {
    title: "Testar antes de pagar deveria ser o normal",
    body: "Muita ferramenta de catálogo cobra antes mesmo de você saber se funciona pro seu negócio. Aqui dá pra montar o catálogo completo — fotos, preços, categorias — e publicar no plano gratuito, sem cartão.",
  },
  benefits: [
    {
      title: "Sem cartão de crédito",
      desc: "Cadastre e publique sem informar dados de pagamento.",
    },
    {
      title: "Catálogo completo",
      desc: "Fotos, preços e categorias organizados, do jeito que o cliente entende.",
    },
    {
      title: "Cresce quando você crescer",
      desc: "Fazer upgrade de plano é opcional, só quando precisar de mais produtos ou categorias.",
    },
    {
      title: "No ar em minutos",
      desc: "Sem instalar nada, sem contratar desenvolvedor.",
    },
  ],
  faq: [
    {
      q: "O grátis tem pegadinha, expira?",
      a: "Não. O plano gratuito não expira — você usa por quanto tempo quiser.",
    },
    {
      q: "Quantos produtos cabem no grátis?",
      a: "O plano gratuito tem um limite de produtos e categorias pensado pra quem está começando; os detalhes ficam na página de preços.",
    },
    {
      q: "Dá pra migrar de plano depois?",
      a: "Sim, a qualquer momento, direto pelo painel.",
    },
  ],
  ctaLabel: "Começar grátis agora",
  relatedLinks: [
    { label: "O que é vitrine digital", href: "/vitrine-digital" },
    { label: "Vender pelo WhatsApp", href: "/vender-pelo-whatsapp" },
  ],
};
```

```tsx
// app/catalogo-digital-gratis/page.tsx
import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Catálogo Digital Grátis — Crie o seu em minutos | Vtrine Digital",
  description:
    "Crie um catálogo digital grátis pra mostrar seus produtos e vender pelo WhatsApp. Sem cartão de crédito, sem mensalidade pra começar.",
  openGraph: {
    title: "Catálogo Digital Grátis — Crie o seu em minutos | Vtrine Digital",
    description:
      "Crie um catálogo digital grátis pra mostrar seus produtos e vender pelo WhatsApp. Sem cartão de crédito, sem mensalidade pra começar.",
    url: "/catalogo-digital-gratis",
  },
};

export default function CatalogoDigitalGratisPage() {
  return <SeoLandingPage content={content} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/catalogo-digital-gratis-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/catalogo-digital-gratis __tests__/catalogo-digital-gratis-page.test.tsx
git commit -m "feat: adiciona página de SEO /catalogo-digital-gratis"
```

---

### Task 6: Página `/vender-pelo-whatsapp`

**Files:**
- Create: `app/vender-pelo-whatsapp/data.ts`
- Create: `app/vender-pelo-whatsapp/page.tsx`
- Test: `__tests__/vender-pelo-whatsapp-page.test.tsx`

**Interfaces:**
- Consumes: `SeoLandingContent` e `SeoLandingPage` de `components/seo/` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/vender-pelo-whatsapp-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VenderPeloWhatsappPage, { metadata } from "@/app/vender-pelo-whatsapp/page";

describe("VenderPeloWhatsappPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<VenderPeloWhatsappPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Vender pelo WhatsApp sem virar bagunça",
      })
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/vender-pelo-whatsapp-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/vender-pelo-whatsapp/page'`

- [ ] **Step 3: Write minimal implementation**

```ts
// app/vender-pelo-whatsapp/data.ts
import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Vender pelo WhatsApp sem virar bagunça",
  heroSubtitle:
    "Não importa o que você vende — acessório, cosmético, comida, artesanato — um catálogo organizado tira a bagunça da conversa sem tirar a venda do WhatsApp.",
  problemSolution: {
    title: "Vender só por conversa tem um limite",
    body: "Vender só por conversa funciona até certo ponto: fotos somem no histórico do chat, a tabela de preço desatualiza e o cliente pergunta \"ainda tem?\" toda hora. Um catálogo organiza isso — o cliente vê o que existe, o preço certo, e o pedido chega pronto pra você.",
  },
  benefits: [
    {
      title: "Cliente navega sozinho",
      desc: "Ele vê o catálogo completo sem precisar te ocupar pergunta por pergunta.",
    },
    {
      title: "Preço e estoque sempre visíveis",
      desc: "Sem precisar confirmar toda vez se ainda tem o produto.",
    },
    {
      title: "Pedido chega pronto",
      desc: "Item e valor já organizados na mensagem que cai no seu WhatsApp.",
    },
    {
      title: "Funciona pra qualquer produto",
      desc: "Moda, cosméticos, comida, artesanato — não importa o nicho.",
    },
  ],
  faq: [
    {
      q: "Preciso ter site?",
      a: "Não. O catálogo já é o link que você compartilha na bio ou no status.",
    },
    {
      q: "Funciona pra qualquer tipo de produto?",
      a: "Sim — moda, cosméticos, comida, artesanato, o que você vender.",
    },
    {
      q: "O cliente sai do WhatsApp pra comprar?",
      a: "Não. A compra sempre fecha por lá, com você.",
    },
  ],
  ctaLabel: "Criar meu catálogo grátis",
  relatedLinks: [
    { label: "Catálogo digital grátis", href: "/catalogo-digital-gratis" },
    { label: "Vitrine sem carrinho", href: "/vitrine-online-sem-carrinho" },
  ],
};
```

```tsx
// app/vender-pelo-whatsapp/page.tsx
import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital",
  description:
    "Aprenda a vender pelo WhatsApp sem perder pedido, sem cliente perguntando 'ainda tem?'. Catálogo online organizado, venda continua no seu WhatsApp.",
  openGraph: {
    title: "Como Vender Pelo WhatsApp de Forma Organizada | Vtrine Digital",
    description:
      "Aprenda a vender pelo WhatsApp sem perder pedido, sem cliente perguntando 'ainda tem?'. Catálogo online organizado, venda continua no seu WhatsApp.",
    url: "/vender-pelo-whatsapp",
  },
};

export default function VenderPeloWhatsappPage() {
  return <SeoLandingPage content={content} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/vender-pelo-whatsapp-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/vender-pelo-whatsapp __tests__/vender-pelo-whatsapp-page.test.tsx
git commit -m "feat: adiciona página de SEO /vender-pelo-whatsapp"
```

---

### Task 7: Página `/vitrine-online-sem-carrinho`

**Files:**
- Create: `app/vitrine-online-sem-carrinho/data.ts`
- Create: `app/vitrine-online-sem-carrinho/page.tsx`
- Test: `__tests__/vitrine-online-sem-carrinho-page.test.tsx`

**Interfaces:**
- Consumes: `SeoLandingContent` e `SeoLandingPage` de `components/seo/` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/vitrine-online-sem-carrinho-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VitrineOnlineSemCarrinhoPage, {
  metadata,
} from "@/app/vitrine-online-sem-carrinho/page";

describe("VitrineOnlineSemCarrinhoPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Vitrine Online Sem Carrinho de Compras | Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<VitrineOnlineSemCarrinhoPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Uma vitrine online sem carrinho — porque a conversa é o checkout",
      })
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/vitrine-online-sem-carrinho-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/vitrine-online-sem-carrinho/page'`

- [ ] **Step 3: Write minimal implementation**

```ts
// app/vitrine-online-sem-carrinho/data.ts
import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Uma vitrine online sem carrinho — porque a conversa é o checkout",
  heroSubtitle:
    "Sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp.",
  problemSolution: {
    title: "Loja virtual tradicional tem fricção que você não precisa",
    body: "Uma loja virtual completa exige carrinho, gateway de pagamento, taxa por transação e uma configuração bem mais complexa. Pra quem vende no relacionamento, isso é fricção desnecessária — o cliente já quer falar com você antes de fechar.",
  },
  benefits: [
    {
      title: "Sem taxa por venda",
      desc: "Nada de maquininha ou gateway de pagamento cobrando por transação.",
    },
    {
      title: "Sem carrinho abandonado",
      desc: "O pedido nasce como conversa, não como um carrinho esquecido.",
    },
    {
      title: "Você negocia direto",
      desc: "Combine forma de pagamento e entrega do seu jeito, sem sistema no meio.",
    },
    {
      title: "Mais simples de configurar",
      desc: "Sem integração de pagamento nem cálculo de frete pra montar.",
    },
  ],
  faq: [
    {
      q: "Como o cliente paga então?",
      a: "Combinado direto com você pelo WhatsApp — Pix, cartão na entrega, o que preferir.",
    },
    {
      q: "Isso serve pra qualquer nicho?",
      a: "Sim, qualquer loja que venda ou queira vender por relacionamento.",
    },
    {
      q: "É mais simples que montar uma loja virtual?",
      a: "Sim — não tem configuração de pagamento nem de frete.",
    },
  ],
  ctaLabel: "Ver como funciona",
  relatedLinks: [
    { label: "Vender pelo WhatsApp", href: "/vender-pelo-whatsapp" },
    { label: "Alternativa ao Linktree", href: "/alternativa-linktree-para-vender" },
  ],
};
```

```tsx
// app/vitrine-online-sem-carrinho/page.tsx
import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Vitrine Online Sem Carrinho de Compras | Vtrine Digital",
  description:
    "Loja virtual sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp.",
  openGraph: {
    title: "Vitrine Online Sem Carrinho de Compras | Vtrine Digital",
    description:
      "Loja virtual sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp.",
    url: "/vitrine-online-sem-carrinho",
  },
};

export default function VitrineOnlineSemCarrinhoPage() {
  return <SeoLandingPage content={content} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/vitrine-online-sem-carrinho-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/vitrine-online-sem-carrinho __tests__/vitrine-online-sem-carrinho-page.test.tsx
git commit -m "feat: adiciona página de SEO /vitrine-online-sem-carrinho"
```

---

### Task 8: Página `/alternativa-linktree-para-vender`

**Files:**
- Create: `app/alternativa-linktree-para-vender/data.ts`
- Create: `app/alternativa-linktree-para-vender/page.tsx`
- Test: `__tests__/alternativa-linktree-para-vender-page.test.tsx`

**Interfaces:**
- Consumes: `SeoLandingContent` e `SeoLandingPage` de `components/seo/` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/alternativa-linktree-para-vender-page.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AlternativaLinktreeParaVenderPage, {
  metadata,
} from "@/app/alternativa-linktree-para-vender/page";

describe("AlternativaLinktreeParaVenderPage", () => {
  it("tem metadata de SEO com title e description próprios", () => {
    expect(metadata.title).toBe("Alternativa ao Linktree Pra Vender Produtos | Vtrine Digital");
    expect(metadata.description).toBeTruthy();
  });

  it("renderiza o H1 correspondente ao conteúdo da página", () => {
    render(<AlternativaLinktreeParaVenderPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Seu link na bio pode vender — não só listar links",
      })
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/alternativa-linktree-para-vender-page.test.tsx`
Expected: FAIL — `Cannot find module '@/app/alternativa-linktree-para-vender/page'`

- [ ] **Step 3: Write minimal implementation**

```ts
// app/alternativa-linktree-para-vender/data.ts
import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Seu link na bio pode vender — não só listar links",
  heroSubtitle:
    "Linktree agrupa links. Uma vitrine mostra produto, preço e foto — e o cliente compra direto pelo WhatsApp, sem sair do link.",
  problemSolution: {
    title: "Link na bio genérico não foi feito pra vender",
    body: "Linktree e ferramentas parecidas são ótimas pra agrupar links, mas não mostram produto, preço nem foto. Quem clica não sabe o que você vende até abrir outro app — e nesse caminho, perde venda.",
  },
  benefits: [
    {
      title: "Um link, catálogo completo",
      desc: "Mostra todos os produtos, não só uma lista de links.",
    },
    {
      title: "Produto, preço e foto visíveis",
      desc: "O cliente decide sem sair da página.",
    },
    {
      title: "Botão Comprar direto pro WhatsApp",
      desc: "Leva o pedido pronto pra você, sem fricção.",
    },
    {
      title: "Mesmo lugar que você já usa",
      desc: "Troque o link da bio do Instagram por esse, sem mudar seu hábito.",
    },
  ],
  faq: [
    {
      q: "Preciso trocar meu link na bio?",
      a: "Sim, é só substituir pelo link da sua vitrine.",
    },
    {
      q: "Dá pra usar junto com outros links (Linktree etc.)?",
      a: "Sim, você pode incluir a vitrine como um dos links de lá.",
    },
    {
      q: "Funciona no celular?",
      a: "Sim — é o formato principal de uso, pensado pra quem clica vindo do Instagram.",
    },
  ],
  ctaLabel: "Criar minha vitrine grátis",
  relatedLinks: [
    { label: "O que é vitrine digital", href: "/vitrine-digital" },
    { label: "Vitrine sem carrinho", href: "/vitrine-online-sem-carrinho" },
  ],
};
```

```tsx
// app/alternativa-linktree-para-vender/page.tsx
import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Alternativa ao Linktree Pra Vender Produtos | Vtrine Digital",
  description:
    "Link na bio genérico não vende. Troque por uma vitrine com produtos, preços e fotos — o cliente compra direto pelo WhatsApp, sem sair do link.",
  openGraph: {
    title: "Alternativa ao Linktree Pra Vender Produtos | Vtrine Digital",
    description:
      "Link na bio genérico não vende. Troque por uma vitrine com produtos, preços e fotos — o cliente compra direto pelo WhatsApp, sem sair do link.",
    url: "/alternativa-linktree-para-vender",
  },
};

export default function AlternativaLinktreeParaVenderPage() {
  return <SeoLandingPage content={content} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/alternativa-linktree-para-vender-page.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/alternativa-linktree-para-vender __tests__/alternativa-linktree-para-vender-page.test.tsx
git commit -m "feat: adiciona página de SEO /alternativa-linktree-para-vender"
```

---

### Task 9: Adicionar as 5 páginas ao sitemap

**Files:**
- Modify: `app/sitemap.ts`
- Test: `__tests__/sitemap.test.ts`

**Interfaces:**
- Consumes: nenhum novo — só literais de URL.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/sitemap.test.ts
import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

describe("sitemap", () => {
  it("inclui as 5 novas páginas de SEO", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://vtrinedigital.com.br/vitrine-digital");
    expect(urls).toContain("https://vtrinedigital.com.br/catalogo-digital-gratis");
    expect(urls).toContain("https://vtrinedigital.com.br/vender-pelo-whatsapp");
    expect(urls).toContain("https://vtrinedigital.com.br/vitrine-online-sem-carrinho");
    expect(urls).toContain("https://vtrinedigital.com.br/alternativa-linktree-para-vender");
  });

  it("mantém a home e as páginas legais", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://vtrinedigital.com.br/");
    expect(urls).toContain("https://vtrinedigital.com.br/politica-de-privacidade");
    expect(urls).toContain("https://vtrinedigital.com.br/termos-de-uso");
  });

  it("tem 8 URLs no total", () => {
    expect(sitemap()).toHaveLength(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/sitemap.test.ts`
Expected: FAIL — só 3 URLs, faltam as 5 novas (o teste de "8 URLs no total" falha).

- [ ] **Step 3: Write minimal implementation**

```ts
// app/sitemap.ts
import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vtrinedigital.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/vitrine-digital`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/catalogo-digital-gratis`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/vender-pelo-whatsapp`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/vitrine-online-sem-carrinho`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/alternativa-linktree-para-vender`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${siteUrl}/politica-de-privacidade`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/termos-de-uso`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/sitemap.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/sitemap.ts __tests__/sitemap.test.ts
git commit -m "feat: adiciona páginas de SEO ao sitemap"
```

---

### Task 10: Verificação final (suíte completa + build + browser)

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Rodar a suíte completa de testes**

Run: `npx vitest run`
Expected: todos os testes passam, incluindo os 9 arquivos novos das Tasks 1-9.

- [ ] **Step 2: Rodar o build de produção**

Run: `npm run build`
Expected: build conclui sem erros de tipo (as 5 rotas novas aparecem na lista de rotas geradas, ex: `○ /vitrine-digital`).

- [ ] **Step 3: Verificar visualmente no navegador**

Suba o servidor de dev (`npm run dev` ou equivalente) e, para cada uma das 5 rotas (`/vitrine-digital`, `/catalogo-digital-gratis`, `/vender-pelo-whatsapp`, `/vitrine-online-sem-carrinho`, `/alternativa-linktree-para-vender`):
- Confirme que a página carrega sem erro de console.
- Confirme que o H1 é único por página (compare com a tabela da spec).
- Confirme que os links "Veja também" no rodapé da página apontam pra outras 2 páginas do grupo e funcionam.
- Confirme que o botão de CTA leva pra `/cadastro`.

- [ ] **Step 4: Verificar o sitemap gerado**

Acesse `/sitemap.xml` no navegador (dev server) e confirme que as 5 novas URLs aparecem junto com `/`, `/politica-de-privacidade` e `/termos-de-uso`.

- [ ] **Step 5: Confirmar que a home não mudou**

Run: `git diff main -- app/page.tsx app/robots.ts`
Expected: nenhuma diferença — nenhum desses dois arquivos foi tocado neste plano.

---

## Self-Review

**Cobertura da spec:**
- §2 (5 páginas + conteúdo) → Tasks 4-8. ✅
- §3.1 (template compartilhado) → Task 3. ✅
- §3.2 (tipo `SeoLandingContent`) → Task 3. ✅
- §3.3 (sitemap) → Task 9. ✅
- §4 (slugs reservados) → Tasks 1-2. ✅
- §5 (critérios de aceite) → cobertos pelos testes de cada task + Task 10 (verificação manual e `git diff` confirmando que a home não mudou).

**Consistência de tipos:** `SeoLandingContent` definido uma vez em Task 3, usado sem alteração em Tasks 4-8 (`h1`, `heroSubtitle`, `problemSolution.{title,body}`, `benefits[].{title,desc}`, `faq[].{q,a}`, `ctaLabel`, `relatedLinks[].{label,href}` — mesmos nomes em todo lugar).
