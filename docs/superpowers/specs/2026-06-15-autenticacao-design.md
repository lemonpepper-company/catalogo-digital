# Design — Fluxo de Autenticação

**Data:** 15 de junho de 2026
**Referência:** `docs/roadmap/TDD-autenticacao.md`

---

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Confirmação de e-mail | **Sim** — acesso bloqueado até confirmar |
| OAuth social | **Google no V1** |
| Supabase project | **Criar do zero** |

---

## Estrutura de arquivos

```
app/
  (auth)/
    layout.tsx                   ← layout vazio (sem barra do painel)
    login/
      page.tsx                   ← existente, movido
      LoginForm.tsx              ← existente, movido + wiring real
      use-login-form.ts          ← existente, movido + lógica signIn/Google
    cadastro/
      page.tsx                   ← existente, movido
      CadastroForm.tsx           ← existente, movido + wiring real + step=loja
      use-cadastro-form.ts       ← existente, movido + validação + slug check
    verificar-email/
      page.tsx                   ← NOVO
    escolha-de-plano/            ← RENOMEADO de /planos
      page.tsx
      PlanosContent.tsx
      data.ts
    recuperar-senha/
      page.tsx                   ← NOVO
    redefinir-senha/
      page.tsx                   ← NOVO
  auth/
    callback/
      route.ts                   ← NOVO (handler Supabase OAuth + email confirm)
  painel/
    layout.tsx                   ← ganha verificação de sessão
    page.tsx
  api/
    slug/
      check/
        route.ts                 ← NOVO (GET ?slug=xxx)

app/actions/
  auth.ts                        ← NOVO (Server Actions)

lib/
  supabase/
    client.ts                    ← NOVO (browser client)
    server.ts                    ← NOVO (server client com cookies)

middleware.ts                    ← NOVO

components/ui/
  SlugInput.tsx                  ← NOVO (campo slug + preview + estados visuais)
  PasswordInput.tsx              ← NOVO (campo senha com toggle show/hide)
```

**Pacotes a instalar:** `@supabase/supabase-js`, `@supabase/ssr`, `zod`

---

## Fluxos de autenticação

### Cadastro por e-mail
```
/cadastro
  → signUp() — passa nome, email, senha, nome da loja, slug como metadata
  → Supabase envia e-mail de confirmação
  → redirect /verificar-email
  → usuário clica no link → /auth/callback?code=...
  → callback: exchangeCodeForSession → lê user.user_metadata (full_name, store_name, slug) → cria profiles + stores
  → redirect /escolha-de-plano
  → selectPlan() → redirect /painel
```

### Cadastro/login com Google
```
Botão "Entrar com Google"
  → signInWithGoogle() → supabase.auth.signInWithOAuth({ provider: 'google' })
  → /auth/callback?code=...
  → callback: exchangeCodeForSession → verifica se stores existe para o usuário
    - Sem store (novo usuário) → redirect /cadastro?step=loja
    - Store sem plano → redirect /escolha-de-plano
    - Store com plano → redirect /painel
```

Quando `?step=loja`: o formulário de cadastro exibe apenas a Seção B (nome da loja + slug). O submit chama uma action `createStore()` separada.

### Login por e-mail
```
/login → signIn() → redirect /painel (ou ?next= se vier de rota protegida)
```

### Recuperação de senha
```
/recuperar-senha → requestPasswordReset() → e-mail enviado
  → /redefinir-senha?token=... → resetPassword()
  → signOut({ scope: 'global' }) → redirect /login?reset=success
```

---

## Middleware — tabela de redirecionamentos

| Estado do usuário | `/painel` | `/login` `/cadastro` | `/escolha-de-plano` |
|---|---|---|---|
| Não autenticado | → `/login` | ✓ | → `/login` |
| Autenticado, sem plano | → `/escolha-de-plano` | → `/escolha-de-plano` | ✓ |
| Autenticado, com plano | ✓ | → `/painel` | → `/painel` |

Rotas `/recuperar-senha` e `/redefinir-senha` são sempre públicas.
Rota `/auth/callback` é sempre pública.

---

## Banco de dados (Supabase)

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  created_at timestamptz default now()
);

create table public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid unique references profiles(id) on delete cascade,
  name          text not null,
  slug          text unique not null,
  plan          text check (plan in ('starter', 'pro')) default null,
  trial_ends_at timestamptz not null,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.stores enable row level security;

-- Cada lojista acessa apenas seus próprios dados
create policy "profiles: own row only"
  on public.profiles for all using (id = auth.uid());

create policy "stores: own store only"
  on public.stores for all using (owner_id = auth.uid());

-- Slug lookup é público (a URL da loja é pública por design)
create policy "stores: slug lookup public"
  on public.stores for select using (true);
```

---

## Server Actions (`app/actions/auth.ts`)

| Action | Responsabilidade |
|---|---|
| `signUp(formData)` | Valida (zod) → `auth.signUp({ email, password, options: { data: { full_name, store_name, slug } } })` → redirect `/verificar-email` |
| `signIn(formData)` | Valida → `auth.signInWithPassword` → redirect `/painel` (ou `?next=`) |
| `signInWithGoogle()` | `auth.signInWithOAuth({ provider: 'google' })` |
| `createStore(formData)` | Cria `profiles` + `stores` para usuário Google novo → redirect `/escolha-de-plano` |
| `selectPlan(plan)` | UPDATE stores SET plan → redirect `/painel` |
| `requestPasswordReset(email)` | `auth.resetPasswordForEmail` — sempre void, resposta neutra |
| `resetPassword(formData)` | `auth.updateUser({ password })` → `signOut global` → redirect `/login?reset=success` |
| `resendConfirmation(email)` | `auth.resend({ type: 'signup', email })` — chamado na tela `/verificar-email` |

---

## API Route — slug check

```
GET /api/slug/check?slug=boutique-da-ana
→ Valida formato: /^[a-z0-9-]{2,50}$/
→ SELECT id FROM stores WHERE slug = $slug
→ { available: true }
   ou { available: false, suggestion: 'boutique-da-ana-2' }
```

Público, sem autenticação. Chamado com debounce de 400ms no campo de slug.

---

## Telas novas

### `/verificar-email`
Ícone de e-mail, "Verifique sua caixa de entrada", instrução para clicar no link. Botão "Reenviar e-mail" chama `resendConfirmation()`. Sem formulário.

### `/recuperar-senha`
Campo de e-mail + botão "Enviar link". Após submit, substitui form por mensagem neutra (não revela se e-mail existe).

### `/redefinir-senha`
Valida token ao carregar (via Supabase); se inválido/expirado → erro + link para solicitar novo. Dois campos: nova senha + confirmar senha. Submit → reset + logout global → `/login?reset=success`.

### Ajustes em telas existentes

**`/login`:**
- Wiring com `signIn()`
- Botão "Entrar com Google" → `signInWithGoogle()`
- Link "Esqueci minha senha" → `/recuperar-senha`
- Banner de sucesso se `?reset=success`

**`/cadastro`:**
- Wiring com `signUp()`
- Validação real (zod) com inline errors
- Debounce 400ms no slug → `/api/slug/check`
- Estados visuais: slug loading / disponível / indisponível / sugestão
- Modo `?step=loja` para usuários Google novos (exibe só Seção B)
- Botão "Criar conta com Google" → `signInWithGoogle()`

**`/escolha-de-plano`** (renomeado de `/planos`):
- Wiring do CTA com `selectPlan()`

---

## Componentes UI novos

**`SlugInput`** — campo slug + preview `vtrinedigital.com.br/<slug>` + ícone de status (spinner / ✓ verde / ✗ vermelho + sugestão). Reutilizável em cadastro e futuras configurações da loja.

**`PasswordInput`** — campo senha com toggle show/hide (elimina duplicação em login, cadastro, redefinir-senha).

---

## Segurança

| Vetor | Mitigação |
|---|---|
| Enumeração de e-mails no login | Mensagem genérica "E-mail ou senha incorretos" |
| Enumeração de e-mails no reset | `resetPasswordForEmail` sempre retorna sucesso |
| Brute force no login | Rate limit nativo Supabase (5 tentativas/15min) |
| Token de reset reutilizado | Token de uso único, invalidado após uso |
| Sessões após reset | `signOut({ scope: 'global' })` |
| CSRF | Server Actions protegidas por origin check do Next.js |
| XSS | Cookie httpOnly via `@supabase/ssr`, sem localStorage |

---

## Fora de escopo

- Cobrança recorrente e gestão de assinatura (TDD de Billing)
- Domínio personalizado e configuração de cookie por subdomínio (V2)
- Outros provedores OAuth além do Google (V2)
