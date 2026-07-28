# Arquitetura — Catálogo Digital

## Duas superfícies

1. **Catálogo público** (`/{slug}`) — vitrine para o cliente final, mobile-first. Sempre público, sem login. Grid de produtos + filtro por categoria + detalhe do produto com seleção de variação.

2. **Painel do lojista** (`/painel`) — área administrativa desktop-first. Dashboard, Produtos (listagem/cadastro/edição), Pedidos (histórico), Categorias, Configurações.

---

## Autenticação

Implementada com **Supabase Auth** + **`@supabase/ssr`** (cookies httpOnly). Sem JWT exposto no cliente.

### Fluxo de cadastro

```
/cadastro (etapa 1: dados pessoais)
  → /verificar-email?email=X (aguarda confirmação)
  → [clique no email] → /auth/callback (cria só o profile no banco)
  → /cadastro?step=loja (etapa 2: nome/slug da loja, WhatsApp, logo, monograma, Instagram, descrição, cor de destaque e formas de pagamento/entrega)
  → createStore (cria a loja, já com plan='free' e o perfil completo)
  → /painel
```

> Toda loja nasce direto com `plan = 'free'` — sem etapa de escolha de plano no cadastro, sem cobrança. Starter e Pro são liberados manualmente (edição direta na tabela `stores` do Supabase) após contato via WhatsApp pela landing ("Fale conosco"). As rotas e ações de seleção de plano foram removidas. Ver `docs/roadmap/Escopo.md` §4.3 e §6.

### Fluxo de login

```
/login → [email/senha]
  → /painel (tem loja) | /cadastro?step=loja (sem loja)
```

### Proteção de rotas (middleware)

`middleware.ts` intercepta rotas protegidas (`/painel`). Rotas públicas excluídas do matcher: `_next/`, `api/slug/`, `auth/callback`, `landing/`, e qualquer rota com extensão de arquivo.

| Situação | Destino |
|---|---|
| Não autenticado → `/painel` | `/login?next=/painel` |
| Autenticado sem loja → qualquer rota protegida | `/cadastro?step=loja` |
| Autenticado com loja → `/login` ou `/cadastro` | `/painel` |

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
orders     (id, store_id → stores (cascade), client_order_id, customer_name, payment_method,
            delivery_method, delivery_address, items_count, total_cents,
            status ('pendente'|'confirmado'|'cancelado'), created_at,
            unique (store_id, client_order_id))
order_items(id, order_id → orders (cascade), product_id → products (set null),
            product_name, unit_price_cents, qty (1..99), size, color, created_at)
```

RLS habilitado em todas as tabelas. Políticas:
- `profiles` — usuário lê/escreve apenas a própria linha
- `stores` — usuário lê/escreve apenas a própria loja; leitura pública de `slug` (para verificação de disponibilidade e catálogo)
- `categories` — authenticated: escrita apenas da própria loja; anon: leitura pública
- `products` — authenticated: escrita apenas da própria loja; anon: leitura apenas de produtos ativos (`is_active=true AND stock>0`)
- `orders` / `order_items` — authenticated: leitura apenas dos pedidos da própria loja (`stores.owner_id = auth.uid()`); update permitido só na coluna `status` de `orders`. **Nenhum privilégio para `anon`** e nenhum `insert` para `authenticated`: a escrita é exclusiva da service role, dentro da Server Action `registrarPedido` (`supabase/migrations/20260727000000_orders.sql`)

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
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

> `SUPABASE_SERVICE_ROLE_KEY` é **server-only** — sem prefixo `NEXT_PUBLIC_`, lida apenas por `lib/supabase/admin.ts` (que tem `import "server-only"`). É a única chave capaz de gravar em `orders`/`order_items` e ignora RLS: nunca deve chegar ao bundle do cliente nem ser logada. Local: `supabase status -o env | grep SERVICE_ROLE_KEY`; produção: Supabase Dashboard → Project Settings → API keys → `service_role`, cadastrada nas env vars da Vercel. Sem ela o catálogo continua funcionando e apenas a captura do pedido é descartada (`{ ok: false }` + `console.error`).

Emails de confirmação ficam em **Mailpit**: `http://localhost:54324`

---

## Arquivos importantes

| Arquivo | Propósito |
|---|---|
| `lib/data.ts` | Mock data legada (`STORE`, `PRODUCTS`) mantida como referência; também guarda listas de opções usadas em produção (`ACCENT_COLOR_OPTIONS`, `FASHION_COLORS`, `PAYMENT_METHODS`, `DELIVERY_METHODS`) |
| `lib/types.ts` | Tipos TypeScript do domínio |
| `lib/utils.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage`, `renderWhatsAppMessage`, `formatPaymentLine`, `formatDeliveryLine`, `formatCents` |
| `lib/auth/slugify.ts` | `slugify()` e `isValidSlug()` com testes |
| `lib/plan-limits.ts` | `getPlanLimits()`, `getEffectivePlan()` — limites por plano (Free/Starter/Pro), capability `hasOrderHistory` e rebaixamento automático quando o acesso pago liberado manualmente expira |
| `lib/orders.ts` | Módulo puro do pedido: `ORDER_STATUSES`/`isOrderStatus`, `sanitizeCustomerName`, `resolveOrderItems` (preço sempre do banco), `mapOrderRow`, `newClientOrderId` |
| `lib/order-metrics.ts` | Módulo puro das métricas de ROI: `monthStartInSaoPaulo()` (corte do mês no fuso `America/Sao_Paulo`) e `computeOrderMetrics()` |
| `lib/supabase/client.ts` | `createBrowserClient` para componentes client-side |
| `lib/supabase/server.ts` | `createServerClient` para Server Components e Actions |
| `lib/supabase/admin.ts` | `createAdminClient()` — client com service role, `import "server-only"`; único caminho de escrita em `orders`/`order_items` |
| `lib/server/store.ts` | `getCurrentStore()`, `mapProduct()` — busca a loja do usuário autenticado |
| `lib/server/catalog.ts` | `getPublicCatalog()` — busca catálogo público por slug (com RLS anon) |
| `lib/server/pedidos.ts` | `getStoreOrders()` (histórico paginado, 20/página, itens aninhados) e `getOrderMetrics()` — leituras do painel via RLS |
| `lib/server/upload.ts` | `uploadPhotos()`, `uploadToBucket()`, `publicUrlToPath()` — Supabase Storage |
| `lib/image-compress.ts` | Compressão de imagens no cliente antes do upload |
| `lib/validation/painel.ts` | Schemas Zod para produtos, categorias, configurações da loja |
| `lib/validation/pedido.ts` | `orderPayloadSchema` — validação do payload público de captura (uuid, ≤20 itens, qty 1..99, enums de pagamento/entrega) |
| `middleware.ts` | Proteção de rotas e redirecionamentos por estado de auth |
| `app/actions/auth.ts` | Server Actions: `signUp`, `signIn`, `signInWithGoogle`, `createStore`, `requestPasswordReset`, `resetPassword`, `resendConfirmation`, `signOut`. `createStore` agora coleta o perfil completo (WhatsApp obrigatório, logo, monograma, Instagram, descrição, cor de destaque, formas de pagamento/entrega) durante a etapa 2 do cadastro |
| `app/actions/produtos.ts` | Server Actions: `createProduct`, `updateProduct`, `deleteProduct`, `toggleProductActive` |
| `app/actions/categorias.ts` | Server Actions: `createCategory`, `updateCategory`, `deleteCategory` |
| `app/actions/store.ts` | Server Actions: `updateStoreSettings` |
| `app/actions/pedidos.ts` | Server Actions: `registrarPedido` (pública, grava o pedido antes do redirect ao WhatsApp — nunca lança, nunca consulta plano) e `updateOrderStatus` (painel, exige `hasOrderHistory`) |
| `app/painel/pedidos/` | Histórico de pedidos: `page.tsx` (gate de plano antes da query), `PedidosClient.tsx` (lista + `Modal` de detalhe + troca de status), `use-pedidos.ts`, `loading.tsx` |
| `app/auth/callback/route.ts` | Route Handler OAuth/PKCE: cria `profiles` após confirmação; sem loja, redireciona para `/cadastro?step=loja` |
| `app/api/slug/check/route.ts` | Endpoint público de verificação de slug disponível |
| `app/globals.css` | Tokens CSS como custom properties |
| `tailwind.config.ts` | Mapeamento dos tokens para classes Tailwind |
| `components/ui/` | Primitivos reutilizáveis (Button, Badge, Pill, Input, Switch, PasswordInput, SlugInput, StatCard…) |
| `components/catalogo/` | Componentes do catálogo público (BagDrawer, ProductCard, ProductDetail, StoreHeader, CatalogExpired) |
| `components/painel/` | `Sidebar`, `MobileTabBar` (6 abas) e `RecursoBloqueado` — o card de bloqueio de recurso pago (título, descrição e CTA de WhatsApp), usado no histórico e nos cards de ROI quando o plano efetivo é Free |
| `components/loja/` | `IdentidadeFields`, `CorDestaqueFields`, `PagamentoEntregaFields` e o hook `useLojaFields` — compartilhados entre Configurações e a etapa 2 do cadastro, para não duplicar a mesma UI/lógica nas duas telas |
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
- **Planos**: Free (automático no cadastro), Starter e Pro (liberados manualmente após contato via "Fale conosco" na landing). A landing exibe os 3 planos — preço "Grátis" no Free, "Sob consulta" em Starter/Pro. A seção de depoimentos (fictícios) segue oculta
- **Painel do lojista** (`/painel`): totalmente conectado ao Supabase — dashboard, produtos (CRUD + upload de fotos), pedidos (histórico paginado + detalhe + status), categorias (CRUD + limites de plano), configurações da loja
- **Catálogo público** (`/[slug]`): dados reais do Supabase via RLS anon — grid de produtos, detalhe, sacola (drawer), checkout WhatsApp com template customizável, header com descrição e links de WhatsApp/Instagram, página de loja expirada. A cor de destaque (`accentColor`) configurada pela loja é injetada como `--color-primary` na raiz da página e reflete no monograma, na busca ativa e nos botões de CTA (adicionar à sacola, comprar, enviar pedido)
- **Checkout**: pagamento e forma de entrega configuráveis por loja (`stores.payment_methods`/`delivery_methods`); o cliente escolhe entre as opções habilitadas antes de enviar o pedido — grupos sem nenhuma opção configurada não aparecem na sacola
- **Captura de pedidos**: o checkout pré-abre a aba do WhatsApp no clique, chama `registrarPedido` com timeout de 2500 ms e só então aponta a aba para o `wa.me` — falha ou lentidão na gravação nunca bloqueia a venda (erro só no log do servidor). A sacola tem um campo opcional "Seu nome (opcional)" (60 caracteres) que não entra no template da mensagem. Preço e total são recalculados no servidor a partir de `products.price_cents` (nenhum valor monetário do cliente é aceito), com idempotência por `client_order_id` e teto anti-abuso de 20 pedidos/60 s por loja. **A gravação acontece em qualquer plano, inclusive Free** — só a visualização é paga
- **Histórico e ROI no painel**: `/painel/pedidos` lista os pedidos da loja (20/página) com detalhe em `Modal` (itens em snapshot, pagamento, entrega, total) e troca de status (`pendente`/`confirmado`/`cancelado`, qualquer transição); o dashboard mostra "Pedidos no mês", "Vendas confirmadas no mês" e "Aguardando confirmação". Ambas as telas são gated por `getPlanLimits(...).hasOrderHistory`: no plano efetivo Free o gate roda **antes da query** e a tela mostra `RecursoBloqueado` sem nenhum dado real. O item "Pedidos" aparece na navegação em todos os planos (é o que gera o upgrade)
- **Limites de plano**: `getPlanLimits()` aplicado em Server Actions de produtos e categorias — Free (8 produtos/1 categoria/1 foto), Starter (30/5/3) e Pro (ilimitado/ilimitado/5). Um Starter/Pro liberado manualmente cai para os limites do Free automaticamente quando `trial_ends_at` vence (`getEffectivePlan()`, calculado a cada checagem, sem job)
- **Storage**: bucket `product-images` com upload, compressão no cliente e remoção de imagens antigas ao editar

## Próximo passo

Validação com lojistas no plano Free, com Starter/Pro liberados manualmente enquanto não há gateway de pagamento. Depois: integrar pagamento (Stripe ou Pagar.me) com cobrança recorrente automática e webhooks para ativação/cancelamento de plano. Ver `docs/roadmap/Escopo.md` §6.

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
