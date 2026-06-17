# Arquitetura — Catálogo Digital

## Duas superfícies

1. **Catálogo público** (`/catalogo`) — vitrine para o cliente final, mobile-first. Sempre público, sem login. Grid de produtos + filtro por categoria + detalhe do produto com seleção de variação.

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

`middleware.ts` intercepta todas as rotas exceto `_next/`, `api/slug/`, `auth/callback`, `catalogo/` e `landing/`.

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
profiles (id → auth.users, full_name, created_at)
stores   (id, owner_id → profiles, name, slug unique, plan, trial_ends_at, is_active, created_at)
```

RLS habilitado em ambas as tabelas. Políticas:
- `profiles` — usuário lê/escreve apenas a própria linha
- `stores` — usuário lê/escreve apenas a própria loja; leitura pública de `slug` (para verificação de disponibilidade)

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
| `lib/data.ts` | Mock data (STORE, PRODUCTS) — ainda usado pelo catálogo público |
| `lib/types.ts` | Tipos TypeScript do domínio |
| `lib/utils.ts` | `parsePrice`, `formatMoney`, `buildWhatsAppMessage` |
| `lib/auth/slugify.ts` | `slugify()` e `isValidSlug()` com testes |
| `lib/supabase/client.ts` | `createBrowserClient` para componentes client-side |
| `lib/supabase/server.ts` | `createServerClient` para Server Components e Actions |
| `middleware.ts` | Proteção de rotas e redirecionamentos por estado de auth |
| `app/actions/auth.ts` | Server Actions: `signUp`, `signIn`, `signInWithGoogle`, `createStore`, `selectPlan`, `requestPasswordReset`, `resetPassword`, `resendConfirmation`, `signOut` |
| `app/auth/callback/route.ts` | Route Handler OAuth/PKCE: cria `profiles` + `stores` após confirmação |
| `app/api/slug/check/route.ts` | Endpoint público de verificação de slug disponível |
| `app/globals.css` | Tokens CSS como custom properties |
| `tailwind.config.ts` | Mapeamento dos tokens para classes Tailwind |
| `components/ui/` | Primitivos reutilizáveis (Button, Badge, Pill, Input, Switch, PasswordInput, SlugInput…) |
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

---

## Estado atual

- **Autenticação**: completa — cadastro, login, OAuth Google, recuperação de senha, confirmação de email, seleção de plano
- **Catálogo público** (`/catalogo`): ainda usa mock data de `lib/data.ts`
- **Painel** (`/painel`): sessão verificada; conteúdo das seções (produtos, categorias, configurações) ainda mockado
- Toasts, modais e toggles funcionam com React state local

## Próximos passos (backend do painel)

Substituir dados de `lib/data.ts` por Server Components que leem do Supabase. Padrão a seguir:

```
app/painel/produtos/page.tsx          ← Server Component, busca produtos
app/painel/produtos/use-produto-form.ts ← hook client, useActionState
app/actions/produtos.ts               ← Server Actions (create, update, delete)
```

A tipagem em `lib/types.ts` já representa o contrato esperado do banco.
