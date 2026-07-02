# Arquitetura — Catálogo Digital

## Duas superfícies

1. **Catálogo público** (`/{slug}`) — vitrine para o cliente final, mobile-first. Sempre público, sem login. Grid de produtos + filtro por categoria + detalhe do produto com seleção de variação.

2. **Painel do lojista** (`/painel`) — área administrativa desktop-first. Dashboard, Produtos (listagem/cadastro/edição), Categorias, Configurações.

---

## Autenticação

Implementada com **Supabase Auth** + **`@supabase/ssr`** (cookies httpOnly). Sem JWT exposto no cliente.

### Fluxo de cadastro

```
/cadastro (etapa 1: dados pessoais)
  → /cadastro?step=loja (etapa 2: nome e slug da loja)
  → /verificar-email?email=X (aguarda confirmação)
  → [clique no email] → /auth/callback (cria profile + store no banco)
  → /escolha-de-plano
  → /painel
```

### Fluxo de login

```
/login → [email/senha ou Google OAuth]
  → /auth/callback (OAuth) ou direto ao destino (email/senha)
  → /painel (se tem plano) | /escolha-de-plano (sem plano) | /cadastro?step=loja (sem loja)
```

### Proteção de rotas (middleware)

`middleware.ts` intercepta rotas protegidas (`/painel`). Rotas públicas excluídas do matcher: `_next/`, `api/slug/`, `auth/callback`, `landing/`, e qualquer rota com extensão de arquivo.

| Situação | Destino |
|---|---|
| Não autenticado → `/painel` | `/login?next=/painel` |
| Autenticado sem loja → qualquer rota protegida | `/cadastro?step=loja` |
| Autenticado com loja, sem plano → `/painel` | `/escolha-de-plano` |
| Autenticado com plano → `/login` ou `/cadastro` | `/painel` |

---

## Banco de dados (Supabase / PostgreSQL)

### Schema (`supabase/migrations/`)

```sql
profiles   (id → auth.users, full_name, created_at)
stores     (id, owner_id → profiles, name, slug unique, plan, trial_ends_at, is_active,
            whatsapp, accent_color, logo_url, description, monogram,
            analytics_id, pixel_id, message_template, created_at)
categories (id, store_id → stores, name, position, created_at)
products   (id, store_id → stores, name, price_cents, description, category_id → categories,
            sizes[], sold_sizes[], colors jsonb, images[], stock, is_active, is_new, created_at)
```

RLS habilitado em todas as tabelas. Políticas:
- `profiles` — usuário lê/escreve apenas a própria linha
- `stores` — usuário lê/escreve apenas a própria loja; leitura pública de `slug` (para verificação de disponibilidade e catálogo)
- `categories` — authenticated: escrita apenas da própria loja; anon: leitura pública
- `products` — authenticated: escrita apenas da própria loja; anon: leitura apenas de produtos ativos (`is_active=true AND stock>0`)

### Storage

- Bucket `product-images` (público): imagens de produtos
- Upload permitido apenas pelo dono da loja (path `{store_id}/{filename}`)
- Leitura pública irrestrita

### Configuração local

```bash
supabase start          # sobe Docker com Postgres + Auth + Mailpit
supabase stop           # persiste dados em volume Docker
```

Variáveis em `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Emails de confirmação ficam em **Mailpit**: `http://localhost:54324`

---

## Arquivos importantes

| Arquivo | Propósito |
|---|---|
| `lib/data.ts` | Mock data legada (STORE, PRODUCTS) — mantida apenas para referência, não usada em produção |
| `lib/types.ts` | Tipos TypeScript do domínio |
| `lib/utils.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage`, `formatCents` |
| `lib/auth/slugify.ts` | `slugify()` e `isValidSlug()` com testes |
| `lib/plan-limits.ts` | `getPlanLimits()`, `isTrialActive()` — limites por plano (Starter/Pro) |
| `lib/supabase/client.ts` | `createBrowserClient` para componentes client-side |
| `lib/supabase/server.ts` | `createServerClient` para Server Components e Actions |
| `lib/server/store.ts` | `getCurrentStore()`, `mapProduct()` — busca a loja do usuário autenticado |
| `lib/server/catalog.ts` | `getPublicCatalog()` — busca catálogo público por slug (com RLS anon) |
| `lib/server/upload.ts` | `uploadPhotos()`, `uploadToBucket()`, `publicUrlToPath()` — Supabase Storage |
| `lib/image-compress.ts` | Compressão de imagens no cliente antes do upload |
| `lib/validation/painel.ts` | Schemas Zod para produtos, categorias, configurações da loja |
| `middleware.ts` | Proteção de rotas e redirecionamentos por estado de auth |
| `app/actions/auth.ts` | Server Actions: `signUp`, `signIn`, `signInWithGoogle`, `createStore`, `selectPlan`, `requestPasswordReset`, `resetPassword`, `resendConfirmation`, `signOut` |
| `app/actions/produtos.ts` | Server Actions: `createProduct`, `updateProduct`, `deleteProduct`, `toggleProductActive` |
| `app/actions/categorias.ts` | Server Actions: `createCategory`, `updateCategory`, `deleteCategory` |
| `app/actions/store.ts` | Server Actions: `updateStoreSettings` |
| `app/auth/callback/route.ts` | Route Handler OAuth/PKCE: cria `profiles` + `stores` após confirmação |
| `app/api/slug/check/route.ts` | Endpoint público de verificação de slug disponível |
| `app/globals.css` | Tokens CSS como custom properties |
| `tailwind.config.ts` | Mapeamento dos tokens para classes Tailwind |
| `components/ui/` | Primitivos reutilizáveis (Button, Badge, Pill, Input, Switch, PasswordInput, SlugInput, StatCard…) |
| `components/catalogo/` | Componentes do catálogo público (BagDrawer, ProductCard, ProductDetail, StoreHeader, CatalogExpired) |
| `supabase/config.toml` | Configuração do Supabase local (auth, email, rate limits) |
| `supabase/migrations/` | Migrations SQL versionadas |
| `docs/DESIGN_SYSTEM.md` | Design system completo |

---

## Páginas de autenticação (`app/(auth)/`)

Route group sem layout próprio. URLs sem o prefixo `(auth)`.

| Rota | Descrição |
|---|---|
| `/login` | Email/senha + botão Google OAuth |
| `/cadastro` | Duas etapas: dados pessoais (`step` ausente) e dados da loja (`?step=loja`) |
| `/verificar-email` | Aguarda confirmação; botão de reenvio com email via query param |
| `/recuperar-senha` | Solicita email para reset |
| `/redefinir-senha` | Nova senha (requer token do email) |
| `/escolha-de-plano` | Starter (R$49/mês) ou Pro (R$99/mês), 14 dias grátis |

## Catálogo público (`app/[slug]/`)

Route dinâmica na raiz. Sem autenticação. `force-dynamic` para sempre buscar dados frescos.

| Rota | Descrição |
|---|---|
| `/{slug}` | Catálogo da loja — grid de produtos, filtro por categoria, sacola, checkout WhatsApp |
| `/{slug}` (loja oculta) | Exibe `CatalogExpired` quando trial expirou e loja sem plano ativo |
| `/{slug}` (not found) | `notFound()` quando slug não existe |

A função `getPublicCatalog(slug)` em `lib/server/catalog.ts` encapsula toda a lógica de visibilidade.

---

## Estado atual (jun/2026)

- **Autenticação**: completa — cadastro 2 etapas, login email/senha, Google OAuth, recuperação/redefinição de senha, confirmação de email, seleção de plano
- **Painel do lojista** (`/painel`): totalmente conectado ao Supabase — dashboard, produtos (CRUD + upload de fotos), categorias (CRUD + limites de plano), configurações da loja
- **Catálogo público** (`/[slug]`): dados reais do Supabase via RLS anon — grid de produtos, detalhe, sacola (drawer), checkout WhatsApp com template customizável, página de loja expirada
- **Limites de plano**: `getPlanLimits()` aplicado em Server Actions de produtos e categorias
- **Storage**: bucket `product-images` com upload, compressão no cliente e remoção de imagens antigas ao editar

## Próximo passo

Integração de pagamento (Stripe ou Pagar.me) — cobrança recorrente no dia 15 do trial, webhooks para ativação/cancelamento de plano.

---

## Integrações pendentes (UI oculta)

### Google Analytics e Facebook Pixel

Os campos `analytics_id` e `pixel_id` existem na tabela `stores` e são preservados no banco, mas a UI de configuração está temporariamente oculta (`app/painel/configuracoes/ConfiguracoesClient.tsx`).

**Para reativar:**
1. Descomentar o Card "Integrações" em `ConfiguracoesClient.tsx`
2. Restaurar o estado `analyticsId`/`pixelId` em `use-configuracoes.ts`
3. Restaurar a leitura de `formData.get("analyticsId")` e `formData.get("pixelId")` em `app/actions/store.ts`
4. Implementar a injeção dos scripts no layout do catálogo público (`app/[slug]/layout.tsx` ou similar) — ainda não implementada
