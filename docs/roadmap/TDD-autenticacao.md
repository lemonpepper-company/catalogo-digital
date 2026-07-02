# TDD — Fluxo de Autenticação

**Versão:** 1.1  
**Data:** 2 de julho de 2026  
**Escopo de referência:** Escopo.md §3.1, §4.3, §7, §9

> **Modo demo:** a etapa "Escolha de plano" (§3.3) foi retirada do fluxo de cadastro. Toda loja nova nasce com `plan='starter'` e `trial_ends_at=null` (indeterminado). Os CTAs "Começar" dos cards de preço na landing também ficam ocultos. As seções abaixo descrevem o fluxo original com escolha de plano — mantidas como referência para quando a cobrança for reativada. O comportamento atual está resumido em §4 (Server Actions) e no `docs/ARCHITECTURE.md`.

---

## 1. Contexto e objetivos

O fluxo de autenticação cobre o ciclo de vida completo do lojista desde o primeiro acesso até o início da sessão ativa no painel. Inclui cadastro de conta + loja, escolha de plano, login e recuperação de senha.

**Objetivos:**
- Zero fricção no cadastro: sem cartão de crédito, trial imediato
- Slug único e amigável como identidade da loja desde o cadastro
- Sessão segura e persistida entre abas/refreshes
- Experiência de trial clara: 14 dias, acesso Pro, sem surpresas

**Fora de escopo deste TDD:** cobrança recorrente, gestão de assinatura, cancelamento (cobertos em TDD separado de Billing).

---

## 2. Telas do fluxo

```
Landing page
    ↓ CTA "Começar grátis"
Cadastro (Sua conta + Sua loja)
    ↓ submit + confirmação de e-mail
Painel (loja já criada com plan='starter', trial_ends_at=null)

Login
    ↓ credenciais válidas
Painel

Login → "Esqueci minha senha"
    ↓ e-mail enviado
Redefinição de senha
    ↓ nova senha salva
Login
```

> Modo demo: "Escolha de plano" não faz parte do fluxo ativo — mantida em §3.3 como referência para reativação futura.

---

## 3. Telas e especificações

### 3.1 Landing page

Já implementada (V1). Ponto de entrada; CTAs "Começar grátis" e "Entrar" no header.

- "Começar grátis" → `/cadastro`
- "Entrar" → `/login`
- Sem mudanças de comportamento neste fluxo

---

### 3.2 Tela de cadastro (`/cadastro`)

Formulário dividido em duas seções sequenciais na mesma página.

#### Seção A — Sua conta

| Campo | Tipo | Validação |
|---|---|---|
| Nome completo | text | obrigatório, min 2 chars |
| E-mail | email | obrigatório, formato válido, unicidade assíncrona |
| Senha | password | obrigatório, min 8 chars, 1 maiúscula, 1 número |
| Confirmar senha | password | deve ser igual à senha |

#### Seção B — Sua loja

| Campo | Tipo | Validação |
|---|---|---|
| Nome da loja | text | obrigatório, min 2 chars |
| Slug | text (gerado + editável) | obrigatório, único, regex `^[a-z0-9-]+$` |

**Comportamento do slug:**
- Gerado automaticamente ao digitar nome da loja
- Transformação: lowercase → remove acentos → espaços → hífens → remove especiais
- Preview em tempo real: `vtrinedigital.com.br/boutique-da-ana`
- Validação de unicidade via debounce de 400ms (chamada à API)
- Se slug existir: sugestão automática com sufixo numérico (`-2`, `-3`…)
- Campo editável manualmente; nova validação ao perder foco

**Submit:**
- Cria conta + loja (`plan='starter'`, `trial_ends_at=null`) + inicia sessão
- Redireciona para `/painel` (modo demo — sem passar por `/escolha-de-plano`)
- Em caso de e-mail duplicado: inline error no campo de e-mail

---

### 3.3 Tela de escolha de plano (`/escolha-de-plano`) — fora do fluxo em modo demo

> Mantida como referência para quando a cobrança for reativada. Hoje a rota e a UI (`PlanosContent.tsx`) continuam exatamente como antes — Server Action `selectPlan` funciona — mas nenhuma loja nova chega até ela porque o cadastro já define `plan='starter'`. Como fica inacessível no fluxo, essa tela não foi revisada para o modo demo (preços continuam exibidos normalmente).

Exibida uma única vez, logo após o cadastro. Inacessível se o lojista já escolheu um plano.

#### Cards de plano

| | Starter | Pro |
|---|---|---|
| **Preço** | R$ 49/mês | R$ 99/mês |
| Produtos | Até 30 | Ilimitados |
| Categorias | Até 5 | Ilimitadas |
| Fotos/produto | Até 3 | Até 5 |
| GA + Pixel | ✓ | ✓ |
| Template WhatsApp | ✓ | ✓ |

**Ação:** botão CTA em cada card → Server Action `selectPlan('starter' | 'pro')` → redireciona para `/painel`.

**Cobrança:** suspensa em modo demo. Quando reativada, ocorre no dia 15 após o cadastro; até lá, ambos os planos têm acesso Pro completo.

---

### 3.4 Tela de login (`/login`)

| Campo | Tipo | Validação |
|---|---|---|
| E-mail | email | obrigatório |
| Senha | password | obrigatório |

**Links:**
- "Esqueci minha senha" → `/recuperar-senha`
- "Cadastre-se" → `/cadastro` (estilizado em Gold Dust `#C9A96E`)

**Submit:**
- Credenciais válidas → redireciona para `/painel`
- Credenciais inválidas → mensagem genérica ("E-mail ou senha incorretos") sem revelar qual campo errou
- Bloqueio temporário após 5 tentativas falhas em 15min (rate limiting no backend)

**Sessão persistida:** `remember me` implícito — sessão não expira ao fechar a aba (cookie httpOnly com validade de 30 dias).

---

### 3.5 Fluxo de recuperação de senha

**Tela `/recuperar-senha`:**
- Campo e-mail + botão "Enviar link"
- Resposta sempre neutra: "Se esse e-mail estiver cadastrado, você receberá um link em breve." (não revela se e-mail existe)
- Rate limit: 3 tentativas por e-mail a cada 15min

**E-mail enviado:**
- Link com token de uso único, validade de 1 hora
- Template: assunto "Redefinição de senha — Catálogo Digital"

**Tela `/redefinir-senha?token=<token>`:**
- Valida o token ao carregar a página; se inválido/expirado → mensagem de erro + link para solicitar novo
- Campos: nova senha + confirmar senha (mesmas regras do cadastro)
- Submit → invalida o token + encerra todas as sessões ativas + redireciona para `/login` com mensagem de sucesso

---

## 4. Arquitetura técnica

### 4.1 Provedor de autenticação

**Supabase Auth** — alinhado com o roadmap de backend (Escopo.md §11, etapa 5).

Justificativa:
- Row Level Security (RLS) nativo: garante isolamento de dados por lojista sem código extra
- `supabase.auth.signUp()` + `signInWithPassword()` + `resetPasswordForEmail()` cobrem o fluxo completo
- Cookie httpOnly gerenciado pelo `@supabase/ssr` — sem exposição de token no localStorage

---

### 4.2 Estrutura de rotas Next.js

```
app/
  (auth)/                    ← route group sem layout do painel
    login/
      page.tsx
    cadastro/
      page.tsx
    escolha-de-plano/
      page.tsx               ← protegida: só acessível após cadastro sem plano
    recuperar-senha/
      page.tsx
    redefinir-senha/
      page.tsx
  painel/
    layout.tsx               ← verifica sessão; redireciona para /login se ausente
    page.tsx                 ← dashboard
```

**Middleware (`middleware.ts`):**
```ts
// Rotas protegidas: /painel/** → exige sessão ativa
// Rotas pós-cadastro: /escolha-de-plano → exige sessão sem plano definido
// Rotas de auth: /login, /cadastro → redireciona para /painel se já autenticado
```

---

### 4.3 Modelo de dados (Supabase)

```sql
-- Gerenciado pelo Supabase Auth
auth.users (
  id uuid PK,
  email text UNIQUE,
  created_at timestamptz
)

-- Dados adicionais do lojista
public.profiles (
  id           uuid PK REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  created_at   timestamptz DEFAULT now()
)

-- Loja do lojista (1:1 com profiles no V1)
public.stores (
  id           uuid PK DEFAULT gen_random_uuid(),
  owner_id     uuid UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  name         text NOT NULL,
  slug         text UNIQUE NOT NULL,
  plan         text CHECK (plan IN ('starter', 'pro')) DEFAULT NULL,
  trial_ends_at timestamptz,  -- nullable; NULL = indeterminado (modo demo). No modelo pago: created_at + 14 days
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
)
```

Em modo demo, todo INSERT em `stores` já define `plan = 'starter'` e `trial_ends_at = NULL` (migration `20260702000000_demo_mode_plan_defaults.sql` removeu o `NOT NULL` de `trial_ends_at`).

**RLS mínimo:**
- `profiles`: SELECT/UPDATE só para o próprio `auth.uid()`
- `stores`: SELECT/UPDATE só onde `owner_id = auth.uid()`

---

### 4.4 Server Actions

```ts
// app/actions/auth.ts

export async function signUp(formData: FormData): Promise<ActionResult>
// 1. Valida campos com zod
// 2. supabase.auth.signUp({ email, password })
// 3. INSERT INTO profiles (id, full_name)
// 4. INSERT INTO stores (owner_id, name, slug, plan='starter', trial_ends_at=null) — modo demo
// 5. redirect('/painel')

export async function signIn(formData: FormData): Promise<ActionResult>
// 1. supabase.auth.signInWithPassword({ email, password })
// 2. redirect('/painel')

export async function selectPlan(plan: 'starter' | 'pro'): Promise<ActionResult>
// Fora do fluxo em modo demo (nenhuma loja nova tem plan IS NULL). Mantida para reativação futura.
// 1. Verifica sessão ativa
// 2. UPDATE stores SET plan = $plan WHERE owner_id = auth.uid() AND plan IS NULL
// 3. redirect('/painel')

export async function requestPasswordReset(email: string): Promise<void>
// 1. supabase.auth.resetPasswordForEmail(email, { redirectTo: '/redefinir-senha' })
// Resposta sempre neutra (sem revelar se e-mail existe)

export async function resetPassword(formData: FormData): Promise<ActionResult>
// 1. Valida senha + token via supabase.auth.updateUser({ password })
// 2. supabase.auth.signOut({ scope: 'global' })
// 3. redirect('/login?reset=success')
```

---

### 4.5 Validação de slug (API Route)

```ts
// app/api/slug/check/route.ts — GET ?slug=boutique-da-ana

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug')
  // Valida formato: /^[a-z0-9-]{2,50}$/
  // SELECT id FROM stores WHERE slug = $slug
  // Retorna: { available: boolean, suggestion?: string }
}
```

Chamado via `fetch` com debounce de 400ms no componente de cadastro.

---

## 5. Estados de sessão e redirecionamentos

| Estado | Acesso a `/painel` | Acesso a `/login` | Acesso a `/escolha-de-plano` |
|---|---|---|---|
| Não autenticado | → `/login` | ✓ | → `/login` |
| Autenticado, sem plano (não ocorre para lojas criadas em modo demo) | → `/escolha-de-plano` | → `/painel` | ✓ |
| Autenticado, com plano (todo cadastro em modo demo cai aqui, com `plan='starter'`) | ✓ | → `/painel` | → `/painel` |

---

## 6. Segurança

| Vetor | Mitigação |
|---|---|
| Enumeração de e-mails no login | Mensagem genérica "E-mail ou senha incorretos" |
| Enumeração de e-mails no reset | Resposta neutra independente do e-mail |
| Enumeração de slugs | Endpoint de validação é público por design (slug é a URL da loja) |
| Brute force no login | Rate limit: 5 tentativas / 15min por IP+e-mail (Supabase Auth nativo) |
| Token de reset reutilizado | Token de uso único; invalidado após uso |
| Sessão após reset de senha | `signOut({ scope: 'global' })` encerra todas as sessões |
| CSRF | Server Actions com Next.js são protegidas por padrão via origin check |
| XSS | Sem `localStorage` para tokens; cookie httpOnly gerenciado pelo `@supabase/ssr` |

---

## 7. Comportamentos de UI/UX

| Situação | Comportamento |
|---|---|
| Submit do formulário | Botão desabilitado + spinner durante a requisição |
| Erro de validação | Inline error abaixo do campo; foco no primeiro campo inválido |
| Erro de rede | Toast de erro genérico; botão reabilitado |
| Slug disponível | Ícone ✓ verde ao lado do campo |
| Slug indisponível | Ícone ✗ + sugestão automática abaixo |
| Slug em verificação | Ícone de loading (spinner 16px) |
| Redirecionamento pós-login | Preserva `?next=` se veio de rota protegida |

---

## 8. Testes

### Unitários (Vitest + Testing Library)

- `slugify()` — transformações de texto
- `validateSlugFormat()` — regex e edge cases
- Componente `SlugPreview` — renderiza corretamente nos estados: loading, disponível, indisponível

### Integração (Vitest + Supabase local)

- Cadastro completo: cria `auth.users` + `profiles` + `stores`
- Slug duplicado: retorna sugestão com sufixo
- Login com credenciais inválidas: não cria sessão
- Reset de senha: token inválido retorna erro; token válido atualiza senha e encerra sessões

### E2E (Playwright — fase beta)

- Happy path: cadastro → escolha de plano → painel
- Login → painel
- Recuperação de senha (mock do e-mail via Supabase Inbucket local)

---

## 9. Dependências

| Pacote | Versão mínima | Uso |
|---|---|---|
| `@supabase/supabase-js` | 2.x | cliente Supabase |
| `@supabase/ssr` | 0.x | cookies httpOnly no Next.js App Router |
| `zod` | 3.x | validação de formulários nas Server Actions |

---

## 10. Aberto / decisões pendentes

| # | Questão | Opções | Impacto |
|---|---|---|---|
| 1 | Confirmação de e-mail no cadastro? | (a) sim — e-mail de confirmação antes de acessar o painel · (b) não — acesso imediato, e-mail em background | UX do onboarding; recomendo (b) para reduzir fricção no V1 |
| 2 | OAuth social (Google)? | (a) sim no V1 · (b) V2 | Escopo.md não menciona; recomendo V2 |
| 3 | Domínio do cookie de sessão | `.vtrinedigital.com.br` compartilhado ou por subdomínio | Relevante quando domínio personalizado for implementado (V2) |
