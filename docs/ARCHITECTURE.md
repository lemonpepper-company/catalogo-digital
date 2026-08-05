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
stores     (id, owner_id → profiles, name, slug unique, is_active,
            plan, plan_expires_at, subscription_status, billing_cycle, pending_plan,
            asaas_customer_id, asaas_subscription_id,
            document, address, address_number, address_province, address_city,
            address_postal_code,
            whatsapp, accent_color, logo_url, description, monogram, instagram,
            payment_methods[], delivery_methods[],
            analytics_id, pixel_id, message_template, created_at)
            -- trial_ends_at ainda existe no schema, mas não é lida por ninguém:
            -- substituída por plan_expires_at. Drop pendente (ver Próximo passo).
categories (id, store_id → stores, name, position, created_at)
products   (id, store_id → stores, name, price_cents, description, category_id → categories,
            sizes[], sold_sizes[], colors jsonb, images[], stock, is_active, is_new, created_at)
orders     (id, store_id → stores (cascade), client_order_id, code, customer_name,
            payment_method, delivery_method, delivery_address, items_count, total_cents,
            status ('pendente'|'confirmado'|'cancelado'), created_at,
            unique (store_id, client_order_id), index (store_id, code))
order_items(id, order_id → orders (cascade), product_id → products (set null),
            product_name, unit_price_cents, qty (1..99), size, color, created_at)
```

RLS habilitado em todas as tabelas. Políticas:
- `profiles` — usuário lê/escreve apenas a própria linha
- `stores` — usuário lê/escreve apenas a própria loja; leitura pública de `slug` (para verificação de disponibilidade e catálogo)
- `categories` — authenticated: escrita apenas da própria loja; anon: leitura pública
- `products` — authenticated: escrita apenas da própria loja; anon: leitura apenas de produtos ativos (`is_active=true AND stock>0`)
- `orders` / `order_items` — authenticated: leitura apenas dos pedidos da própria loja (`stores.owner_id = auth.uid()`); update permitido só na coluna `status` de `orders`. **Nenhum privilégio para `anon`** e nenhum `insert` para `authenticated`: a escrita é exclusiva da service role, dentro da Server Action `registrarPedido` (`supabase/migrations/20260727000000_orders.sql`). O papel `service_role` tem `select, insert, delete` em `orders` (sem `update` — status é do lojista) e `select, insert` em `order_items`, concedidos em `supabase/migrations/20260728000000_orders_service_role_grants.sql`

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

> `SUPABASE_SERVICE_ROLE_KEY` é **server-only** — sem prefixo `NEXT_PUBLIC_`, lida apenas por `lib/supabase/admin.ts` (que tem `import "server-only"`). É a única chave que grava em `orders`/`order_items` e ignora RLS: nunca deve chegar ao bundle do cliente nem ser logada. A chave só funciona porque o papel `service_role` recebeu grants explícitos em `20260728000000_orders_service_role_grants.sql` — `select, insert, delete` em `orders`, `select, insert` em `order_items` e `select` em `stores`/`products`. Ignorar RLS **não** dispensa GRANT: sem esses grants a captura falha com `permission denied`, porque o default ACL de `public` não concede DML a nenhum papel do PostgREST em tabela nova (ver o cuidado crítico no `AGENTS.md`). O `service_role` de propósito **não** tem UPDATE em `orders`: mudar status é do lojista autenticado. Local: `supabase status -o env | grep SERVICE_ROLE_KEY`; produção: Supabase Dashboard → Project Settings → API keys → `service_role`, cadastrada nas env vars da Vercel. Sem ela o catálogo continua funcionando e apenas a captura do pedido é descartada (`{ ok: false }` + `console.error`).

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
| `lib/orders.ts` | Módulo puro do pedido: `ORDER_STATUSES`/`isOrderStatus`, `sanitizeCustomerName`/`isValidCustomerName` (nome obrigatório, mín. 2 / máx. 60 após `trim()`), `deriveOrderCode` (código de 6 caracteres derivado do `client_order_id`), `resolveOrderItems` (preço sempre do banco), `mapOrderRow`, `newClientOrderId` |
| `lib/order-metrics.ts` | Módulo puro das métricas de ROI: `monthStartInSaoPaulo()` (corte do mês no fuso `America/Sao_Paulo`) e `computeOrderMetrics()` |
| `lib/supabase/client.ts` | `createBrowserClient` para componentes client-side |
| `lib/supabase/server.ts` | `createServerClient` para Server Components e Actions |
| `lib/supabase/admin.ts` | `createAdminClient()` — client com service role, `import "server-only"`; único caminho de escrita em `orders`/`order_items` |
| `lib/server/store.ts` | `getCurrentStore()`, `mapProduct()` — busca a loja do usuário autenticado |
| `lib/server/catalog.ts` | `getPublicCatalog()` — busca catálogo público por slug (com RLS anon) |
| `lib/server/pedidos.ts` | `getStoreOrders()` (histórico paginado, 20/página, itens aninhados, busca opcional por código **ou** nome via `ilike` com a contagem usando o mesmo filtro) e `getOrderMetrics()` — leituras do painel via RLS |
| `lib/server/upload.ts` | `uploadPhotos()`, `uploadToBucket()`, `publicUrlToPath()` — Supabase Storage |
| `lib/image-compress.ts` | Compressão de imagens no cliente antes do upload |
| `lib/validation/painel.ts` | Schemas Zod para produtos, categorias, configurações da loja |
| `lib/validation/pedido.ts` | `orderPayloadSchema` — validação do payload público de captura (uuid, nome obrigatório com ≥2 caracteres, `code` no formato `[A-Z0-9]{6}`, ≤20 itens, qty 1..99, enums de pagamento/entrega) |
| `middleware.ts` | Proteção de rotas e redirecionamentos por estado de auth |
| `app/actions/auth.ts` | Server Actions: `signUp`, `signIn`, `signInWithGoogle`, `createStore`, `requestPasswordReset`, `resetPassword`, `resendConfirmation`, `signOut`. `createStore` agora coleta o perfil completo (WhatsApp obrigatório, logo, monograma, Instagram, descrição, cor de destaque, formas de pagamento/entrega) durante a etapa 2 do cadastro |
| `app/actions/produtos.ts` | Server Actions: `createProduct`, `updateProduct`, `deleteProduct`, `toggleProductActive` |
| `app/actions/categorias.ts` | Server Actions: `createCategory`, `updateCategory`, `deleteCategory` |
| `app/actions/store.ts` | Server Actions: `updateStoreSettings` |
| `app/actions/assinatura.ts` | Server Actions: `iniciarAssinatura` (cartão via checkout hospedado, Pix via assinatura direta), `trocarPlano`, `cancelarAssinatura`, `salvarDocumento`. **Nunca gravam `plan` nem `plan_expires_at`** — só identificadores do Asaas e `pending_plan` |
| `app/actions/cep.ts` | Server Action de autofill de endereço pelo CEP (ViaCEP, best-effort com timeout de 5 s) |
| `lib/asaas/` | `client.ts` (HTTP, `server-only`), `subscriptions.ts` (operações), `plans.ts` (tabela de preços e cálculo proporcional) e `events.ts` (**puro**: traduz evento do Asaas em mudança de estado, sem I/O) |
| `app/api/webhooks/asaas/route.ts` | Webhook do gateway. Autentica com `timingSafeEqual` no header `asaas-access-token`. **Única superfície que concede ou estende acesso** |
| `app/actions/pedidos.ts` | Server Actions: `registrarPedido` (pública, grava o pedido antes do redirect ao WhatsApp — nunca lança, nunca consulta plano) e `updateOrderStatus` (painel, exige `hasOrderHistory`) |
| `app/painel/pedidos/` | Histórico de pedidos: `page.tsx` (gate de plano antes da query, lê `page` e `q` de `searchParams`), `PedidosClient.tsx` (lista com código + busca + `Modal` de detalhe + troca de status), `use-pedidos.ts`, `use-pedidos-busca.ts` (debounce do termo para a URL), `loading.tsx` |
| `app/auth/callback/route.ts` | Route Handler OAuth/PKCE: cria `profiles` após confirmação; sem loja, redireciona para `/cadastro?step=loja` |
| `app/api/slug/check/route.ts` | Endpoint público de verificação de slug disponível |
| `app/globals.css` | Tokens CSS como custom properties |
| `tailwind.config.ts` | Mapeamento dos tokens para classes Tailwind |
| `components/ui/` | Primitivos reutilizáveis (Button, Badge, Pill, Input, Switch, PasswordInput, SlugInput, StatCard…) |
| `components/catalogo/` | Componentes do catálogo público (BagDrawer, ProductCard, ProductDetail, StoreHeader, CatalogExpired) |
| `components/painel/` | `Sidebar`, `MobileTabBar`, `RecursoBloqueado` — card de bloqueio de recurso pago (título, descrição, selo do plano mínimo e CTA para `/painel/assinatura`) — e `AvisoPixPendente`, banner de cobrança Pix a vencer, carregado sob `Suspense` para não bloquear o render do painel |
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
- **Captura de pedidos**: o checkout pré-abre a aba do WhatsApp no clique, chama `registrarPedido` com timeout de 2500 ms e só então aponta a aba para o `wa.me` — falha ou lentidão na gravação nunca bloqueia a venda (erro só no log do servidor). A sacola tem o campo **obrigatório** "Seu nome" (mín. 2 e máx. 60 caracteres após `trim()`): sem ele o botão de envio fica desabilitado e o servidor rejeita o payload, então `orders.customer_name` nunca é nulo em pedido novo. Nome e código do pedido viajam na mensagem do WhatsApp (variáveis `{nome}` e `{pedido}`) — o código tem 6 caracteres e é **derivado do `client_order_id` no cliente**, para que a mensagem nunca dependa da resposta do servidor. Preço e total são recalculados no servidor a partir de `products.price_cents` (nenhum valor monetário do cliente é aceito), com idempotência por `client_order_id` e teto anti-abuso de 20 pedidos/60 s por loja. **A gravação acontece em qualquer plano, inclusive Free** — só a visualização é paga
- **Histórico e ROI no painel**: `/painel/pedidos` lista os pedidos da loja (20/página) exibindo o código de cada um, com busca server-side por código ou nome do cliente (`?q=`, case-insensitive, dentro da loja, paginação recalculada sobre o filtro e estado vazio próprio), detalhe em `Modal` (itens em snapshot, pagamento, entrega, total) e troca de status (`pendente`/`confirmado`/`cancelado`, qualquer transição); o dashboard mostra "Pedidos no mês", "Vendas confirmadas no mês" e "Aguardando confirmação". Ambas as telas são gated por `getPlanLimits(...).hasOrderHistory`: no plano efetivo Free o gate roda **antes da query** e a tela mostra `RecursoBloqueado` sem nenhum dado real. O item "Pedidos" aparece na navegação em todos os planos (é o que gera o upgrade)
- **Limites de plano**: `getPlanLimits()` aplicado em Server Actions de produtos e categorias — Free (8 produtos/1 categoria/1 foto), Starter (50/7/3) e Pro (ilimitado/ilimitado/5). O plano cai para Free automaticamente quando `plan_expires_at` vence (`getEffectivePlan()`, calculado a cada checagem, sem job). **Os limites valem também na leitura**: `lib/plan-visibility.ts` recorta produtos, fotos, destaques e categorias da vitrine pública, e o domínio próprio deixa de resolver no rebaixamento — nada é apagado, tudo volta no re-upgrade
- **Assinatura**: cobrança recorrente pelo Asaas — cartão via checkout hospedado (nenhum dado de cartão passa pelo Vtrine) e Pix via assinatura direta, que gera uma cobrança por ciclo. Upgrade cobra a diferença proporcional e só promove quando o webhook confirma; downgrade agenda em `pending_plan` e vale na virada; cancelamento mantém o acesso até `plan_expires_at`; falha de pagamento dá 3 dias de graça. `subscription_status` (`active`/`past_due`/`canceled`) é informativo e **nunca entra na regra de acesso** — quem decide é `plan` + `plan_expires_at`
- **Storage**: bucket `product-images` com upload, compressão no cliente e remoção de imagens antigas ao editar

## Próximo passo

Cobrança self-service implementada com o Asaas (Starter R$ 29,90/mês ou R$ 299/ano; Pro R$ 59,90/mês ou R$ 599/ano). Falta a validação em produção: variáveis do Asaas na Vercel, webhook cadastrado no painel deles e o primeiro ciclo real de cobrança.

Depois disso, dois itens conscientemente adiados:

- **Pix Automático.** É produto distinto de Assinaturas: a aplicação precisa criar cada cobrança, de 2 a 10 dias úteis antes do vencimento, o que exigiria cron, idempotência de cobrança e tratamento de autorização revogada. A R$ 29,90, a economia de ~3 pontos de taxa não paga esse pipeline enquanto o volume for baixo.
- **Anual parcelado.** Assinatura no Asaas não aceita `installmentCount` — parcelar significaria abrir mão da renovação automática. Revisar se a adoção do anual à vista for baixa.

Pendência de limpeza: a coluna `trial_ends_at` foi substituída por `plan_expires_at` e não é mais lida por ninguém, mas segue no schema. O `drop` foi separado de propósito — `supabase-migrations.yml` aplica migrations no push para a `main` independente do deploy da Vercel, e remover a coluna junto derrubaria o painel durante o build (a vitrine pública não é afetada: ela resolve plano pela RPC).

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
