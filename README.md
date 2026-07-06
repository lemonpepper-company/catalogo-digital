# Catálogo Digital

SaaS de assinatura para lojistas de moda criarem uma vitrine online premium e converterem visitantes em compradores **via WhatsApp**. Não há carrinho: o WhatsApp é o checkout.

## Visão geral

O sistema tem duas superfícies:

| Superfície | Rota | Audiência |
|---|---|---|
| **Catálogo público (Vitrine)** | `/{slug}` | Cliente final — mobile-first |
| **Painel do lojista** | `/painel/**` | Lojista (B2B) — desktop-first |

### Tema visual

**Bold Minimal Premium.** Obsidian (`#0D0D0D`) como âncora, neutros quentes Ivory/Linen, muito espaço em branco. Sem gradientes, sem box-shadow. No catálogo público, o CTA de compra usa a cor de destaque escolhida por cada loja (padrão Gold Dust `#C9A96E`) — ver `docs/DESIGN_SYSTEM.md` §5.8.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript** (strict mode)
- **Tailwind CSS v3**
- **Supabase** (Auth, PostgreSQL, Storage)
- **Lucide React** (ícones outline)
- **Vitest + Testing Library** (testes unitários)

## Documentação

| Arquivo | Descrição |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Superfícies, schema do banco, arquivos-chave, estado atual |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Convenções de código, stack, regras de estilo |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Design system — paleta, tipografia, espaçamento, componentes, tokens CSS |
| [`docs/roadmap/Escopo.md`](docs/roadmap/Escopo.md) | Escopo do produto V1, funcionalidades e roadmap |

---

## Estrutura do projeto

```
app/
  landing/              # Landing page de marketing
  (auth)/
    login/              # Login (email/senha + Google OAuth)
    cadastro/           # Criação de conta (2 etapas)
    verificar-email/    # Aguarda confirmação de email
    recuperar-senha/    # Reset de senha
    redefinir-senha/    # Nova senha via token
    escolha-de-plano/   # Seleção de plano (Starter/Pro)
  [slug]/               # Catálogo público da loja (mobile-first)
  painel/
    page.tsx            # Dashboard
    produtos/           # Listagem, novo produto, edição
    categorias/         # Gestão de categorias
    configuracoes/      # Identidade, cor, WhatsApp, integrações
  actions/              # Server Actions (auth, produtos, categorias, store)
  api/slug/check/       # Endpoint público de verificação de slug
  auth/callback/        # Route Handler OAuth/PKCE
components/
  ui/                   # Primitivos reutilizáveis (Button, Badge, Pill, Input…)
  catalogo/             # Componentes da vitrine (BagDrawer, ProductCard, StoreHeader…)
  loja/                 # Identidade/cor/pagamento-entrega compartilhados (Configurações + cadastro)
lib/
  server/               # Funções server-side (store, catalog, upload)
  supabase/             # Clients Supabase (browser + server)
  auth/                 # slugify, isValidSlug
  validation/           # Schemas Zod (painel)
  types.ts              # Tipos TypeScript do domínio
  utils.ts              # parsePrice, formatMoney, buildWhatsAppMessage
  plan-limits.ts        # getPlanLimits, isTrialActive
supabase/
  migrations/           # Migrations SQL versionadas
  config.toml           # Configuração local (auth, email, rate limits)
__tests__/              # Suíte de testes unitários
```

## Pré-requisitos

- Node.js 20.9+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (para desenvolvimento local)
- Docker (necessário para o Supabase local)

## Instalação

```bash
npm install
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key do supabase start>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Executar em desenvolvimento

**1. Suba o Supabase local:**

```bash
supabase start
```

Isso sobe Postgres + Auth + Storage. Os emails de confirmação ficam em **Mailpit**: [http://localhost:54324](http://localhost:54324).

**2. Suba o Next.js:**

```bash
npm run dev
```

Acesse em [http://localhost:3000](http://localhost:3000). O root redireciona para `/landing`.

### Rotas principais

| Rota | Descrição |
|---|---|
| `/landing` | Landing page de marketing |
| `/cadastro` | Criação de conta (2 etapas) |
| `/login` | Login do lojista |
| `/escolha-de-plano` | Seleção de plano (Starter/Pro) |
| `/painel` | Dashboard do lojista |
| `/painel/produtos` | Listagem de produtos |
| `/painel/produtos/novo` | Cadastro de produto |
| `/painel/produtos/[id]` | Edição de produto |
| `/painel/categorias` | Gestão de categorias |
| `/painel/configuracoes` | Configurações da loja |
| `/{slug}` | Catálogo público da loja |

## Build de produção

```bash
npm run build
npm run start
```

## Testes

```bash
npm test                  # todos os testes
npm test -- --watch       # modo watch
npm run test:ui           # interface visual (Vitest UI)
npm run test:coverage     # relatório de cobertura (gerado em coverage/)
```

### O que está coberto

| Arquivo de teste | O que testa |
|---|---|
| `utils.test.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage`, `formatCents` |
| `slugify.test.ts` | `slugify()`, `isValidSlug()` |
| `plan-limits.test.ts` | `getPlanLimits()`, `isTrialActive()` |
| `catalog.test.ts` | `mapPublicStore()`, `mapPublicProduct()`, visibilidade |
| `painel-validation.test.ts` | Schemas Zod de produtos, categorias, configurações |
| `upload.test.ts` | `publicUrlToPath()`, helpers de Storage |
| `Button.test.tsx` | Variantes, eventos, estado disabled |
| `Pill.test.tsx` | Estado active/inactive, callbacks |
| `Switch.test.tsx` | Toggle, callbacks |
| `SlugInput.test.tsx` | Validação e feedback de slug |
| `StoreHeader.test.tsx` | Renderização do header do catálogo |
| `BagDrawer.test.tsx` | Sacola — itens, quantidades, total |
| `ConfiguracoesClient.test.tsx` | Formulário de configurações da loja |
| `Sidebar.test.tsx` | Navegação do painel |
| `data.test.ts` | Integridade dos dados mock legados |
| `next-config.test.ts` | Configuração do Next.js |

## Lint

```bash
npm run lint
```

## Design tokens

Os tokens ficam em `app/globals.css` como variáveis CSS. O `tailwind.config.ts` mapeia as mesmas cores e espaçamentos como classes utilitárias.

| Token | Valor | Uso |
|---|---|---|
| `obsidian` | `#0D0D0D` | Botões primários, textos, navbar |
| `gold` | `#C9A96E` | CTA de compra — use com extrema parcimônia |
| `ivory` | `#F9F9F7` | Background da página |
| `linen` | `#F0EDE8` | Cards, inputs, superfícies |
| `graphite` | `#3D3D3D` | Textos secundários, preços |
| `sand` | `#E2DFDA` | Bordas, divisores |

## Fontes

**Sora** (display, headings, botões) + **DM Sans** (body, descrições, preços), carregadas via `next/font/google`.

## Ícones

**Lucide React** — outline, ~2px stroke. Importar individualmente: `import { X } from 'lucide-react'`.
