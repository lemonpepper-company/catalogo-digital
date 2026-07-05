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
  → /verificar-email?email=X (aguarda confirmação)
  → [clique no email] → /auth/callback (cria só o profile no banco)
  → /cadastro?step=loja (etapa 2: nome e slug da loja)
  → createStore (cria a loja, já com plan='starter')
  → /painel
```

> **Modo demo (jul/2026):** a etapa `/escolha-de-plano` foi retirada do fluxo. Toda loja nasce direto com `plan = 'starter'` e `trial_ends_at = null` (indeterminado — nunca expira). A rota `/escolha-de-plano` e a Server Action `selectPlan` continuam existindo no código, mas ficam inacessíveis na prática porque nenhuma loja nova tem `plan IS NULL`. Ver `docs/roadmap/Escopo.md` §6 para o plano de reativar cobrança.

### Fluxo de login

```
/login → [email/senha]
  → /painel (se tem plano) | /escolha-de-plano (sem plano — não ocorre para lojas criadas em modo demo) | /cadastro?step=loja (sem loja)
```

### Proteção de rotas (middleware)

`middleware.ts` intercepta rotas protegidas (`/painel`). Rotas públicas excluídas do matcher: `_next/`, `api/slug/`, `auth/callback`, `landing/`, e qualquer rota com extensão de arquivo.

| Situação | Destino |
|---|---|
| Não autenticado → `/painel` | `/login?next=/painel` |
| Autenticado sem loja → qualquer rota protegida | `/cadastro?step=loja` |
| Autenticado com loja, sem plano → `/painel` | `/escolha-de-plano` (não ocorre em modo demo) |
| Autenticado com plano → `/login` ou `/cadastro` | `/painel` |

---

## Banco de dados (Supabase / PostgreSQL)

### Schema (`supabase/migrations/`)

```sql
profiles   (id → auth.users, full_name, created_at)
stores     (id, owner_id → profiles, name, slug unique, plan, trial_ends_at (nullable), is_active,
            whatsapp, accent_color, logo_url, description, monogram, instagram,
            payment_methods[], delivery_methods[],
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
| `lib/data.ts` | Mock data legada (`STORE`, `PRODUCTS`) mantida como referência; também guarda listas de opções usadas em produção (`ACCENT_COLOR_OPTIONS`, `FASHION_COLORS`, `PAYMENT_METHODS`, `DELIVERY_METHODS`) |
| `lib/types.ts` | Tipos TypeScript do domínio |
| `lib/utils.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage`, `renderWhatsAppMessage`, `formatPaymentLine`, `formatDeliveryLine`, `formatCents` |
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
| `app/auth/callback/route.ts` | Route Handler OAuth/PKCE: cria `profiles` após confirmação; sem loja, redireciona para `/cadastro?step=loja` |
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
| `/login` | Email/senha |
| `/cadastro` | Duas etapas: dados pessoais (`step` ausente) e dados da loja (`?step=loja`) |
| `/verificar-email` | Aguarda confirmação; botão de reenvio com email via query param |
| `/recuperar-senha` | Solicita email para reset |
| `/redefinir-senha` | Nova senha (requer token do email) |
| `/escolha-de-plano` | Starter (R$49/mês) ou Pro (R$99/mês) — UI original, inalterada. Inacessível no fluxo normal em modo demo — toda loja nova já nasce com plano Starter |

## Catálogo público (`app/[slug]/`)

Route dinâmica na raiz. Sem autenticação. `force-dynamic` na página, mas `getPublicCatalog()` (`lib/server/catalog.ts`) cacheia a busca via `unstable_cache`, tag `catalog-{slug}` — dados só são recalculados quando o lojista edita produtos/categorias/configurações (invalidação por `revalidateTag`).

| Rota | Descrição |
|---|---|
| `/{slug}` | Catálogo da loja — grid de produtos, filtro por categoria, sacola, checkout WhatsApp |
| `/{slug}` (loja oculta) | Exibe `CatalogExpired` quando trial expirou e loja sem plano ativo |
| `/{slug}` (not found) | `notFound()` quando slug não existe |

A função `getPublicCatalog(slug)` em `lib/server/catalog.ts` encapsula toda a lógica de visibilidade.

---

## Estado atual (jul/2026)

- **Autenticação**: completa — cadastro 2 etapas, login email/senha, recuperação/redefinição de senha, confirmação de email
- **Modo demo**: cadastro pula a escolha de plano; toda loja nova nasce com `plan = 'starter'` e `trial_ends_at = null` (indeterminado). Na landing: preços ocultos (texto "Em breve"), botões "Começar" removidos dos cards de plano, e a seção de depoimentos (fictícios) oculta. A página `/escolha-de-plano` mantém a UI original com preços — não é revisada porque fica inacessível no fluxo
- **Painel do lojista** (`/painel`): totalmente conectado ao Supabase — dashboard, produtos (CRUD + upload de fotos), categorias (CRUD + limites de plano), configurações da loja
- **Catálogo público** (`/[slug]`): dados reais do Supabase via RLS anon — grid de produtos, detalhe, sacola (drawer), checkout WhatsApp com template customizável, header com descrição e links de WhatsApp/Instagram, página de loja expirada
- **Checkout**: pagamento e forma de entrega configuráveis por loja (`stores.payment_methods`/`delivery_methods`); o cliente escolhe entre as opções habilitadas antes de enviar o pedido — grupos sem nenhuma opção configurada não aparecem na sacola
- **Limites de plano**: `getPlanLimits()` aplicado em Server Actions de produtos e categorias — como toda loja demo nasce Starter, os limites de Starter (30 produtos, 5 categorias, 3 fotos) se aplicam normalmente
- **Storage**: bucket `product-images` com upload, compressão no cliente e remoção de imagens antigas ao editar

## Próximo passo

Validação com lojistas em modo demo (sem cobrança). Depois: reintroduzir a página de escolha de plano no cadastro, exibir preços e integrar pagamento (Stripe ou Pagar.me) com cobrança recorrente e webhooks para ativação/cancelamento de plano. Ver `docs/roadmap/Escopo.md` §6 e §11.

---

## Integrações pendentes (UI oculta)

### Google OAuth

O botão "Entrar com Google" / "Criar conta com Google" está temporariamente oculto nas páginas `/login` e `/cadastro`. A Server Action `signInWithGoogle` em `app/actions/auth.ts` e o Route Handler `/auth/callback/route.ts` já existem e estão funcionais.

**Para reativar:**
1. Restaurar o bloco "ou" + `<form action={signInWithGoogle}>` em `app/(auth)/login/LoginForm.tsx`
2. Restaurar o bloco "ou" + `<form action={signInWithGoogle}>` em `app/(auth)/cadastro/CadastroForm.tsx`
3. Restaurar o import `signInWithGoogle` em ambos os arquivos
4. Configurar o provider Google no Supabase (dashboard → Auth → Providers) e adicionar as credenciais OAuth do Google Cloud Console
5. Ajustar `NEXT_PUBLIC_SITE_URL` para que o callback OAuth aponte para o ambiente correto

### Google Analytics e Facebook Pixel

Os campos `analytics_id` e `pixel_id` existem na tabela `stores` e são preservados no banco, mas a UI de configuração está temporariamente oculta (`app/painel/configuracoes/ConfiguracoesClient.tsx`).

**Para reativar:**
1. Descomentar o Card "Integrações" em `ConfiguracoesClient.tsx`
2. Restaurar o estado `analyticsId`/`pixelId` em `use-configuracoes.ts`
3. Restaurar a leitura de `formData.get("analyticsId")` e `formData.get("pixelId")` em `app/actions/store.ts`
4. Implementar a injeção dos scripts no layout do catálogo público (`app/[slug]/layout.tsx` ou similar) — ainda não implementada
