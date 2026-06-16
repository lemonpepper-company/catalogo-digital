# Autenticação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o fluxo completo de autenticação com Supabase — cadastro (e-mail + Google), login, recuperação de senha, proteção de rotas e escolha de plano.

**Architecture:** Supabase Auth para sessões (cookie httpOnly via `@supabase/ssr`), Server Actions para mutações, middleware Next.js para proteção de rotas. Rotas de auth movidas para o route group `(auth)/` sem alterar URLs. Callback único em `/auth/callback` serve tanto OAuth quanto confirmação de e-mail.

**Tech Stack:** Next.js 16 App Router, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), Zod, Vitest + Testing Library

**Design spec:** `docs/superpowers/specs/2026-06-15-autenticacao-design.md`

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| CRIAR | `lib/auth/slugify.ts` |
| CRIAR | `lib/supabase/client.ts` |
| CRIAR | `lib/supabase/server.ts` |
| CRIAR | `middleware.ts` |
| CRIAR | `app/actions/auth.ts` |
| CRIAR | `app/(auth)/layout.tsx` |
| CRIAR | `app/auth/callback/route.ts` |
| CRIAR | `app/api/slug/check/route.ts` |
| CRIAR | `components/ui/PasswordInput.tsx` |
| CRIAR | `components/ui/SlugInput.tsx` |
| CRIAR | `app/(auth)/verificar-email/page.tsx` |
| CRIAR | `app/(auth)/recuperar-senha/page.tsx` |
| CRIAR | `app/(auth)/redefinir-senha/page.tsx` |
| CRIAR | `__tests__/slugify.test.ts` |
| CRIAR | `__tests__/SlugInput.test.tsx` |
| MOVER | `app/login/` → `app/(auth)/login/` |
| MOVER | `app/cadastro/` → `app/(auth)/cadastro/` |
| MOVER | `app/planos/` → `app/(auth)/escolha-de-plano/` |
| MODIFICAR | `app/(auth)/login/LoginForm.tsx` |
| MODIFICAR | `app/(auth)/login/use-login-form.ts` |
| MODIFICAR | `app/(auth)/login/page.tsx` |
| MODIFICAR | `app/(auth)/cadastro/CadastroForm.tsx` |
| MODIFICAR | `app/(auth)/cadastro/use-cadastro-form.ts` |
| MODIFICAR | `app/(auth)/escolha-de-plano/PlanosContent.tsx` |
| MODIFICAR | `app/painel/layout.tsx` |

---

## Task 1: Supabase project setup (manual)

**Files:** `.env.local` (não commitar)

- [ ] **Step 1: Criar projeto no Supabase**

Acesse https://supabase.com → New project → escolha uma região próxima (ex: South America / São Paulo).

- [ ] **Step 2: Executar migrations no SQL Editor**

No Supabase dashboard → SQL Editor → nova query → cole e execute:

```sql
-- Perfil do lojista (complementa auth.users)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  created_at timestamptz default now()
);

-- Loja do lojista (1:1 com profiles no V1)
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

-- RLS
alter table public.profiles enable row level security;
alter table public.stores enable row level security;

create policy "profiles: own row only"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "stores: own store only"
  on public.stores for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Slug lookup é público (a URL da loja é pública por design)
create policy "stores: slug lookup public"
  on public.stores for select
  using (true);
```

- [ ] **Step 3: Configurar Google OAuth**

No Supabase dashboard → Authentication → Providers → Google → habilitar.

Siga o guia em Authentication → Providers → Google para criar o OAuth App no Google Cloud Console e obter Client ID + Secret. Cole-os no Supabase.

- [ ] **Step 4: Configurar URL de callback no Supabase**

No Supabase dashboard → Authentication → URL Configuration:
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** adicionar `http://localhost:3000/auth/callback`

- [ ] **Step 5: Criar `.env.local`**

Na raiz do projeto, crie `.env.local` com as seguintes variáveis (valores nas Settings → API do projeto Supabase):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

⚠️ Não commitar `.env.local`. Verificar que `.gitignore` já o exclui:

```bash
grep ".env.local" .gitignore
```

---

## Task 2: Instalar pacotes

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar dependências**

```bash
npm install @supabase/supabase-js @supabase/ssr zod
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "require('@supabase/supabase-js'); require('@supabase/ssr'); require('zod'); console.log('OK')"
```

Esperado: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install supabase and zod"
```

---

## Task 3: Utilitário slugify (TDD)

**Files:**
- Criar: `lib/auth/slugify.ts`
- Criar: `__tests__/slugify.test.ts`

- [ ] **Step 1: Escrever o teste**

Crie `__tests__/slugify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slugify, isValidSlug } from '../lib/auth/slugify'

describe('slugify', () => {
  it('converte para lowercase', () => {
    expect(slugify('Boutique')).toBe('boutique')
  })

  it('remove acentos', () => {
    expect(slugify('Ateliê Mirá')).toBe('atelie-mira')
  })

  it('substitui espaços por hífens', () => {
    expect(slugify('Loja da Ana')).toBe('loja-da-ana')
  })

  it('remove caracteres especiais', () => {
    expect(slugify('Loja & Cia!')).toBe('loja-cia')
  })

  it('colapsa múltiplos hífens', () => {
    expect(slugify('a  b')).toBe('a-b')
  })

  it('remove hífens no início e fim', () => {
    expect(slugify(' loja ')).toBe('loja')
  })

  it('retorna string vazia para entrada vazia', () => {
    expect(slugify('')).toBe('')
  })
})

describe('isValidSlug', () => {
  it('aceita slug válido', () => {
    expect(isValidSlug('boutique-da-ana')).toBe(true)
  })

  it('aceita slug com números', () => {
    expect(isValidSlug('loja-123')).toBe(true)
  })

  it('rejeita slug com maiúsculas', () => {
    expect(isValidSlug('Boutique')).toBe(false)
  })

  it('rejeita slug com espaços', () => {
    expect(isValidSlug('minha loja')).toBe(false)
  })

  it('rejeita slug com menos de 2 chars', () => {
    expect(isValidSlug('a')).toBe(false)
  })

  it('rejeita slug com mais de 50 chars', () => {
    expect(isValidSlug('a'.repeat(51))).toBe(false)
  })

  it('rejeita slug com caracteres especiais', () => {
    expect(isValidSlug('loja@moda')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e verificar falha**

```bash
cd "/Users/wagnerdutra/Projetos/Código/catalogo-digital" && npx vitest run __tests__/slugify.test.ts
```

Esperado: FAIL — `Cannot find module '../lib/auth/slugify'`

- [ ] **Step 3: Implementar o utilitário**

Crie `lib/auth/slugify.ts`:

```ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,50}$/.test(slug)
}
```

- [ ] **Step 4: Rodar e verificar aprovação**

```bash
npx vitest run __tests__/slugify.test.ts
```

Esperado: PASS — 14 testes

- [ ] **Step 5: Commit**

```bash
git add lib/auth/slugify.ts __tests__/slugify.test.ts
git commit -m "feat: add slugify utility with tests"
```

---

## Task 4: Clientes Supabase

**Files:**
- Criar: `lib/supabase/client.ts`
- Criar: `lib/supabase/server.ts`

- [ ] **Step 1: Criar client browser**

Crie `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Criar client servidor**

Crie `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — middleware atualiza os cookies
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros relacionados a `lib/supabase/`

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: add supabase client utilities"
```

---

## Task 5: Middleware de proteção de rotas

**Files:**
- Criar: `middleware.ts` (na raiz, ao lado de `next.config.mjs`)

- [ ] **Step 1: Criar middleware**

Crie `middleware.ts` na raiz do projeto:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rotas de auth: redireciona usuários autenticados
  if (pathname === '/login' || pathname === '/cadastro') {
    if (user) {
      const { data: store } = await supabase
        .from('stores')
        .select('plan')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!store) {
        return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
      }
      if (!store.plan) {
        return NextResponse.redirect(new URL('/escolha-de-plano', request.url))
      }
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  // Painel: exige sessão e plano definido
  if (pathname.startsWith('/painel')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const { data: store } = await supabase
      .from('stores')
      .select('plan')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!store?.plan) {
      return NextResponse.redirect(new URL('/escolha-de-plano', request.url))
    }
  }

  // Escolha de plano: exige sessão; redireciona se já tem plano
  if (pathname === '/escolha-de-plano') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: store } = await supabase
      .from('stores')
      .select('plan')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (store?.plan) {
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/slug|auth/callback|catalogo|landing).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware"
```

---

## Task 6: Server Actions de autenticação

**Files:**
- Criar: `app/actions/auth.ts`

- [ ] **Step 1: Criar o arquivo de actions**

Crie `app/actions/auth.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ── Schemas ──────────────────────────────────────────────────────────────────

const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter ao menos uma letra maiúscula')
  .regex(/[0-9]/, 'Senha deve ter ao menos um número')

const signUpSchema = z
  .object({
    full_name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: passwordSchema,
    confirm_password: z.string(),
    store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
    slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Link inválido'),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'As senhas não coincidem',
    path: ['confirm_password'],
  })

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'As senhas não coincidem',
    path: ['confirm_password'],
  })

const storeSchema = z.object({
  store_name: z.string().min(2, 'Nome da loja deve ter ao menos 2 caracteres'),
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'Link inválido'),
})

// ── Actions ───────────────────────────────────────────────────────────────────

export async function signUp(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = signUpSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
    store_name: formData.get('store_name'),
    slug: formData.get('slug'),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const { full_name, email, password, store_name, slug } = result.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, store_name, slug },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) {
    if (error.code === 'user_already_exists') {
      return { error: 'Esse e-mail já está cadastrado.' }
    }
    return { error: 'Erro ao criar conta. Tente novamente.' }
  }

  redirect('/verificar-email')
}

export async function signIn(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!result.success) {
    return { error: 'E-mail ou senha incorretos.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: result.data.email,
    password: result.data.password,
  })

  if (error) {
    return { error: 'E-mail ou senha incorretos.' }
  }

  const next = formData.get('next') as string | null
  redirect(next && next.startsWith('/') ? next : '/painel')
}

export async function signInWithGoogle(): Promise<never> {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=oauth')
  }

  redirect(data.url)
}

export async function createStore(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = storeSchema.safeParse({
    store_name: formData.get('store_name'),
    slug: formData.get('slug'),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado.' }

  // Upsert profile (Google pode ter criado no callback; email signup não cria antes da confirmação)
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? '',
  })

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const { error } = await supabase.from('stores').insert({
    owner_id: user.id,
    name: result.data.store_name,
    slug: result.data.slug,
    trial_ends_at: trialEndsAt.toISOString(),
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Esse link já está em uso. Tente outro.' }
    }
    return { error: 'Erro ao criar loja. Tente novamente.' }
  }

  redirect('/escolha-de-plano')
}

export async function selectPlan(plan: 'starter' | 'pro'): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  await supabase
    .from('stores')
    .update({ plan })
    .eq('owner_id', user.id)
    .is('plan', null)

  redirect('/painel')
}

export async function requestPasswordReset(
  prevState: void | null,
  formData: FormData
): Promise<void> {
  const email = formData.get('email') as string

  if (!email) return

  const supabase = await createClient()

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/redefinir-senha`,
  })

  // Resposta sempre neutra — não revela se e-mail existe
}

export async function resetPassword(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const result = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
  })

  if (!result.success) {
    return { error: result.error.errors[0].message }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  })

  if (error) {
    return { error: 'Não foi possível redefinir a senha. Solicite um novo link.' }
  }

  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login?reset=success')
}

export async function resendConfirmation(
  prevState: { sent: boolean } | null,
  formData: FormData
): Promise<{ sent: boolean }> {
  const email = formData.get('email') as string
  const supabase = await createClient()

  await supabase.auth.resend({ type: 'signup', email })

  return { sent: true }
}

export async function signOut(): Promise<never> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros em `app/actions/auth.ts`

- [ ] **Step 3: Commit**

```bash
git add app/actions/auth.ts
git commit -m "feat: add auth server actions"
```

---

## Task 7: Handler do callback Supabase

**Files:**
- Criar: `app/auth/callback/route.ts`

- [ ] **Step 1: Criar o route handler**

Crie `app/auth/callback/route.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Redefinição de senha — redireciona direto para a tela
  if (next === '/redefinir-senha') {
    return NextResponse.redirect(`${origin}/redefinir-senha`)
  }

  // Verifica se loja já existe (login Google de usuário existente)
  const { data: store } = await supabase
    .from('stores')
    .select('plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (store) {
    return NextResponse.redirect(
      `${origin}${store.plan ? '/painel' : '/escolha-de-plano'}`
    )
  }

  // Usuário novo — verifica se veio do cadastro por e-mail (tem metadata)
  const meta = user.user_metadata ?? {}

  if (meta.store_name && meta.slug) {
    // Cadastro por e-mail confirmado: cria profile + store
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: meta.full_name ?? '',
    })

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const { error: storeError } = await supabase.from('stores').insert({
      owner_id: user.id,
      name: meta.store_name,
      slug: meta.slug,
      trial_ends_at: trialEndsAt.toISOString(),
    })

    if (storeError) {
      return NextResponse.redirect(`${origin}/cadastro?error=store`)
    }

    return NextResponse.redirect(`${origin}/escolha-de-plano`)
  }

  // Google OAuth para usuário novo — precisa preencher dados da loja
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: meta.full_name ?? meta.name ?? '',
  })

  return NextResponse.redirect(`${origin}/cadastro?step=loja`)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: add auth callback route handler"
```

---

## Task 8: API Route — validação de slug

**Files:**
- Criar: `app/api/slug/check/route.ts`

- [ ] **Step 1: Criar o route handler**

Crie `app/api/slug/check/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const SLUG_REGEX = /^[a-z0-9-]{2,50}$/

export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('slug') ?? ''

  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json(
      { available: false, error: 'Slug inválido' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ available: true })
  }

  // Encontra sugestão disponível com sufixo numérico
  let suffix = 2
  let suggestion = `${slug}-${suffix}`

  while (suffix <= 10) {
    const { data } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', suggestion)
      .maybeSingle()

    if (!data) break

    suffix++
    suggestion = `${slug}-${suffix}`
  }

  return NextResponse.json({ available: false, suggestion })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/slug/check/route.ts
git commit -m "feat: add slug availability check API route"
```

---

## Task 9: Componente PasswordInput

**Files:**
- Criar: `components/ui/PasswordInput.tsx`

- [ ] **Step 1: Criar o componente**

Crie `components/ui/PasswordInput.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface PasswordInputProps {
  name: string
  placeholder?: string
  autoComplete?: string
}

export function PasswordInput({
  name,
  placeholder = 'Sua senha',
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className={inputWrap}>
      <Lock size={18} className="text-graphite flex-shrink-0" />
      <input
        type={show ? 'text' : 'password'}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputBase}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        className="text-graphite hover:text-obsidian transition-colors flex-shrink-0"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/PasswordInput.tsx
git commit -m "feat: add PasswordInput component"
```

---

## Task 10: Componente SlugInput (TDD)

**Files:**
- Criar: `components/ui/SlugInput.tsx`
- Criar: `__tests__/SlugInput.test.tsx`

- [ ] **Step 1: Escrever os testes**

Crie `__tests__/SlugInput.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlugInput } from '../components/ui/SlugInput'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  vi.useFakeTimers()
})

describe('SlugInput', () => {
  it('renderiza o preview da URL', () => {
    render(<SlugInput name="slug" value="minha-loja" onChange={() => {}} />)
    expect(screen.getByText('catalogo.app/')).toBeInTheDocument()
    expect(screen.getByDisplayValue('minha-loja')).toBeInTheDocument()
  })

  it('exibe spinner durante verificação', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ available: true }) })

    const { container } = render(
      <SlugInput name="slug" value="loja-teste" onChange={() => {}} />
    )

    // Debounce não disparou ainda
    expect(container.querySelector('[data-testid="slug-checking"]')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    // Spinner aparece enquanto fetch está em andamento — após o timer
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/slug/check?slug=loja-teste'
    )
  })

  it('exibe ícone de disponível após resposta positiva', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ available: true }) })

    render(<SlugInput name="slug" value="loja-disponivel" onChange={() => {}} />)

    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(screen.getByTestId('slug-available')).toBeInTheDocument()
  })

  it('exibe sugestão quando slug está indisponível', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ available: false, suggestion: 'loja-ocupada-2' }),
    })

    render(<SlugInput name="slug" value="loja-ocupada" onChange={() => {}} />)

    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(screen.getByText(/loja-ocupada-2/)).toBeInTheDocument()
  })

  it('não faz fetch para slugs com menos de 2 chars', async () => {
    render(<SlugInput name="slug" value="a" onChange={() => {}} />)

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar e verificar falha**

```bash
npx vitest run __tests__/SlugInput.test.tsx
```

Esperado: FAIL — `Cannot find module '../components/ui/SlugInput'`

- [ ] **Step 3: Criar o componente**

Crie `components/ui/SlugInput.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Globe, Loader2, X } from 'lucide-react'

type SlugStatus = 'idle' | 'checking' | 'available' | 'unavailable'

interface SlugInputProps {
  name: string
  value: string
  onChange: (slug: string) => void
}

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

export function SlugInput({ name, value, onChange }: SlugInputProps) {
  const [status, setStatus] = useState<SlugStatus>('idle')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!value || value.length < 2) {
      setStatus('idle')
      setSuggestion(null)
      return
    }

    setStatus('checking')
    setSuggestion(null)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(value)}`)
      const data = await res.json()

      if (data.available) {
        setStatus('available')
      } else {
        setStatus('unavailable')
        setSuggestion(data.suggestion ?? null)
      }
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      <div className={inputWrap}>
        <Globe size={16} className="text-graphite flex-shrink-0" />
        <span className="font-body text-[14px] text-graphite whitespace-nowrap">
          catalogo.app/
        </span>
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          }
          placeholder="minha-loja"
          className={inputBase}
        />
        {status === 'checking' && (
          <Loader2
            size={16}
            className="text-graphite animate-spin flex-shrink-0"
            data-testid="slug-checking"
          />
        )}
        {status === 'available' && (
          <Check
            size={16}
            className="text-green-600 flex-shrink-0"
            data-testid="slug-available"
          />
        )}
        {status === 'unavailable' && (
          <X
            size={16}
            className="text-red-500 flex-shrink-0"
            data-testid="slug-unavailable"
          />
        )}
      </div>

      {status === 'unavailable' && suggestion && (
        <p className="font-body text-[12px] text-graphite">
          Sugestão:{' '}
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="text-obsidian font-medium hover:underline"
          >
            {suggestion}
          </button>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar e verificar aprovação**

```bash
npx vitest run __tests__/SlugInput.test.tsx
```

Esperado: PASS — 5 testes

- [ ] **Step 5: Commit**

```bash
git add components/ui/SlugInput.tsx __tests__/SlugInput.test.tsx
git commit -m "feat: add SlugInput component with tests"
```

---

## Task 11: Reorganizar rotas para o route group `(auth)/`

**Files:**
- Mover: `app/login/` → `app/(auth)/login/`
- Mover: `app/cadastro/` → `app/(auth)/cadastro/`
- Mover: `app/planos/` → `app/(auth)/escolha-de-plano/`
- Criar: `app/(auth)/layout.tsx`

- [ ] **Step 1: Checar referências a `/planos` no codebase**

```bash
grep -r "/planos" "/Users/wagnerdutra/Projetos/Código/catalogo-digital/app" --include="*.tsx" --include="*.ts"
```

Anote todos os arquivos que referenciam `/planos`.

- [ ] **Step 2: Mover os diretórios com git mv**

```bash
cd "/Users/wagnerdutra/Projetos/Código/catalogo-digital"
mkdir -p "app/(auth)"
git mv app/login "app/(auth)/login"
git mv app/cadastro "app/(auth)/cadastro"
git mv app/planos "app/(auth)/escolha-de-plano"
```

- [ ] **Step 3: Criar o layout do route group**

Crie `app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
```

- [ ] **Step 4: Atualizar link `/planos` no painel**

Em `app/painel/layout.tsx`, linha 24, altere:

```tsx
// de:
<a href="/planos" ...>Assinar agora →</a>

// para:
<a href="/escolha-de-plano" ...>Assinar agora →</a>
```

- [ ] **Step 5: Verificar build**

```bash
npx next build 2>&1 | tail -20
```

Esperado: build sem erros de rotas.

- [ ] **Step 6: Commit**

```bash
git add "app/(auth)" app/painel/layout.tsx
git commit -m "refactor: move auth pages to (auth) route group, rename /planos to /escolha-de-plano"
```

---

## Task 12: Wiring do formulário de login

**Files:**
- Modificar: `app/(auth)/login/page.tsx`
- Modificar: `app/(auth)/login/use-login-form.ts`
- Modificar: `app/(auth)/login/LoginForm.tsx`

- [ ] **Step 1: Atualizar a page para passar searchParams**

Substitua `app/(auth)/login/page.tsx` por:

```tsx
import { LoginForm } from './LoginForm'

export const metadata = {
  title: 'Entrar — Catálogo Digital',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>
}) {
  const params = await searchParams
  return <LoginForm next={params.next} resetSuccess={params.reset === 'success'} />
}
```

- [ ] **Step 2: Atualizar o hook**

Substitua `app/(auth)/login/use-login-form.ts` por:

```ts
'use client'

import { useState, useActionState } from 'react'
import { signIn } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useLoginForm() {
  const [showPw, setShowPw] = useState(false)
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null)

  return {
    showPw,
    togglePw: () => setShowPw((v) => !v),
    state,
    action,
    pending,
  }
}
```

- [ ] **Step 3: Atualizar o formulário**

Substitua `app/(auth)/login/LoginForm.tsx` por:

```tsx
'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useLoginForm } from './use-login-form'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { signInWithGoogle } from '@/app/actions/auth'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface LoginFormProps {
  next?: string
  resetSuccess?: boolean
}

export function LoginForm({ next, resetSuccess }: LoginFormProps) {
  const { showPw, togglePw, state, action, pending } = useLoginForm()

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex justify-center mb-9">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Bem-vindo de volta
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Entre para gerenciar sua vitrine.
            </p>
          </div>

          {resetSuccess && (
            <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-input">
              <p className="font-body text-[13px] text-green-700">
                Senha redefinida com sucesso. Faça login com sua nova senha.
              </p>
            </div>
          )}

          {state?.error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-input">
              <p className="font-body text-[13px] text-red-700">{state.error}</p>
            </div>
          )}

          <form action={action} className="flex flex-col gap-6">
            {next && <input type="hidden" name="next" value={next} />}

            <div className="flex flex-col gap-2">
              <label className="font-body font-medium text-[13px] text-obsidian">
                E-mail
              </label>
              <div className={inputWrap}>
                <Mail size={18} className="text-graphite flex-shrink-0" />
                <input
                  type="email"
                  name="email"
                  placeholder="voce@email.com"
                  autoComplete="email"
                  className={inputBase}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="font-body font-medium text-[13px] text-graphite hover:text-obsidian transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <PasswordInput
                name="password"
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors disabled:opacity-60"
            >
              {pending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="flex items-center gap-3.5 my-5">
            <div className="h-px bg-sand flex-1" />
            <span className="font-body text-[12px] text-graphite">ou</span>
            <div className="h-px bg-sand flex-1" />
          </div>

          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full h-12 rounded-btn border border-sand bg-white text-obsidian font-display font-medium text-[15px] hover:bg-linen transition-colors flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
              </svg>
              Entrar com Google
            </button>
          </form>

          <div className="flex items-center gap-3.5 my-5">
            <div className="h-px bg-sand flex-1" />
          </div>

          <p className="text-center font-body text-[14px] text-graphite">
            Não tem conta?{' '}
            <Link
              href="/cadastro"
              className="font-display font-medium text-gold hover:text-gold-hover transition-colors"
            >
              Criar grátis →
            </Link>
          </p>
        </div>

        <div className="flex justify-center mt-7">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/login/"
git commit -m "feat: wire login form with real auth and Google OAuth"
```

---

## Task 13: Wiring do formulário de cadastro

**Files:**
- Modificar: `app/(auth)/cadastro/page.tsx`
- Modificar: `app/(auth)/cadastro/use-cadastro-form.ts`
- Modificar: `app/(auth)/cadastro/CadastroForm.tsx`

- [ ] **Step 1: Atualizar a page para passar searchParams**

Substitua `app/(auth)/cadastro/page.tsx` por:

```tsx
import { CadastroForm } from './CadastroForm'

export const metadata = {
  title: 'Criar conta — Catálogo Digital',
}

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>
}) {
  const params = await searchParams
  return <CadastroForm stepLoja={params.step === 'loja'} />
}
```

- [ ] **Step 2: Atualizar o hook**

Substitua `app/(auth)/cadastro/use-cadastro-form.ts` por:

```ts
'use client'

import { useActionState, useState } from 'react'
import { slugify } from '@/lib/auth/slugify'
import { signUp, createStore } from '@/app/actions/auth'

type FormState = { error: string } | null

export function useCadastroForm(stepLoja: boolean) {
  const [slug, setSlug] = useState('')

  const [state, action, pending] = useActionState<FormState, FormData>(
    stepLoja ? createStore : signUp,
    null
  )

  const handleStoreNameChange = (name: string) => {
    setSlug(slugify(name))
  }

  return {
    slug,
    setSlug,
    handleStoreNameChange,
    state,
    action,
    pending,
  }
}
```

- [ ] **Step 3: Atualizar o formulário**

Substitua `app/(auth)/cadastro/CadastroForm.tsx` por:

```tsx
'use client'

import Link from 'next/link'
import { User, Mail, ArrowLeft, ArrowRight, Store } from 'lucide-react'
import { useCadastroForm } from './use-cadastro-form'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { SlugInput } from '@/components/ui/SlugInput'
import { signInWithGoogle } from '@/app/actions/auth'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface CadastroFormProps {
  stepLoja?: boolean
}

export function CadastroForm({ stepLoja = false }: CadastroFormProps) {
  const { slug, setSlug, handleStoreNameChange, state, action, pending } =
    useCadastroForm(stepLoja)

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8 py-8">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              {stepLoja ? 'Qual é o nome da sua loja?' : 'Crie sua vitrine grátis'}
            </h1>
            <p className="font-body text-[14px] text-graphite">
              {stepLoja
                ? 'Esse será o link da sua vitrine.'
                : 'Sua loja no ar em poucos minutos.'}
            </p>
          </div>

          {state?.error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-input">
              <p className="font-body text-[13px] text-red-700">{state.error}</p>
            </div>
          )}

          <form action={action} className="flex flex-col gap-6">
            {/* Seção A: Sua conta — oculta no step=loja */}
            {!stepLoja && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Sua conta
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Seu nome
                  </label>
                  <div className={inputWrap}>
                    <User size={18} className="text-graphite flex-shrink-0" />
                    <input
                      type="text"
                      name="full_name"
                      placeholder="Como você se chama"
                      autoComplete="name"
                      className={inputBase}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    E-mail
                  </label>
                  <div className={inputWrap}>
                    <Mail size={18} className="text-graphite flex-shrink-0" />
                    <input
                      type="email"
                      name="email"
                      placeholder="voce@email.com"
                      autoComplete="email"
                      className={inputBase}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Senha
                  </label>
                  <PasswordInput
                    name="password"
                    placeholder="Crie uma senha"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Confirmar senha
                  </label>
                  <PasswordInput
                    name="confirm_password"
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* Seção B: Sua loja — sempre visível */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                  Sua loja
                </h2>
                <div className="h-px bg-sand flex-1" />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Nome da loja
                </label>
                <div className={inputWrap}>
                  <Store size={18} className="text-graphite flex-shrink-0" />
                  <input
                    type="text"
                    name="store_name"
                    placeholder="Ex.: Ateliê Mira"
                    autoComplete="organization"
                    onChange={(e) => handleStoreNameChange(e.target.value)}
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Link da loja
                </label>
                <SlugInput name="slug" value={slug} onChange={setSlug} />
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-btn bg-gold text-white font-display font-medium text-[16px] flex items-center justify-center gap-2 hover:bg-gold-hover transition-colors mt-2 disabled:opacity-60"
            >
              {pending
                ? 'Criando…'
                : stepLoja
                  ? 'Salvar e continuar'
                  : 'Criar minha conta grátis'}
              {!pending && <ArrowRight size={18} />}
            </button>
          </form>

          {!stepLoja && (
            <>
              <p className="font-body text-[12px] text-graphite text-center mt-4 leading-snug">
                Ao criar a conta, você concorda com os{' '}
                <Link href="#" className="text-obsidian font-medium">
                  Termos
                </Link>{' '}
                e a{' '}
                <Link href="#" className="text-obsidian font-medium">
                  Política de Privacidade
                </Link>
                .
              </p>

              <div className="flex items-center gap-3.5 my-[26px]">
                <div className="h-px bg-sand flex-1" />
                <span className="font-body text-[12px] text-graphite">ou</span>
                <div className="h-px bg-sand flex-1" />
              </div>

              <form action={signInWithGoogle}>
                <button
                  type="submit"
                  className="w-full h-12 rounded-btn border border-sand bg-white text-obsidian font-display font-medium text-[15px] hover:bg-linen transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
                  </svg>
                  Criar conta com Google
                </button>
              </form>

              <div className="flex items-center gap-3.5 my-[26px]">
                <div className="h-px bg-sand flex-1" />
              </div>

              <p className="text-center font-body text-[14px] text-graphite">
                Já tem conta?{' '}
                <Link
                  href="/login"
                  className="font-display font-medium text-obsidian hover:text-gold transition-colors"
                >
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>

        <div className="flex justify-center mt-[26px]">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/cadastro/"
git commit -m "feat: wire cadastro form with real auth, slug validation, and Google OAuth"
```

---

## Task 14: Wiring da escolha de plano

**Files:**
- Modificar: `app/(auth)/escolha-de-plano/PlanosContent.tsx`

- [ ] **Step 1: Adicionar actions nos CTAs dos cards**

Em `app/(auth)/escolha-de-plano/PlanosContent.tsx`, encontre os botões CTA de cada card e substitua-os por forms com Server Actions. Adicione no topo do arquivo:

```tsx
import { selectPlan } from '@/app/actions/auth'
```

Encontre o botão do plano Starter e substitua por:

```tsx
<form action={selectPlan.bind(null, 'starter')}>
  <button
    type="submit"
    className="w-full h-12 rounded-btn border-2 border-obsidian text-obsidian font-display font-medium text-[16px] hover:bg-obsidian hover:text-white transition-colors"
  >
    Começar com Starter
  </button>
</form>
```

Encontre o botão do plano Pro e substitua por:

```tsx
<form action={selectPlan.bind(null, 'pro')}>
  <button
    type="submit"
    className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors"
  >
    Começar com Pro
  </button>
</form>
```

- [ ] **Step 2: Verificar o arquivo atual para localizar os botões**

```bash
grep -n "button\|CTA\|Começar\|Assinar" "/Users/wagnerdutra/Projetos/Código/catalogo-digital/app/(auth)/escolha-de-plano/PlanosContent.tsx"
```

Use a saída para localizar os botões exatos e aplicar as substituições acima.

- [ ] **Step 3: Commit**

```bash
git add "app/(auth)/escolha-de-plano/PlanosContent.tsx"
git commit -m "feat: wire plan selection with selectPlan action"
```

---

## Task 15: Atualizar layout do painel

**Files:**
- Modificar: `app/painel/layout.tsx`

- [ ] **Step 1: Adicionar session check e botão de logout**

Substitua `app/painel/layout.tsx` por:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/painel/Sidebar'
import { signOut } from '@/app/actions/auth'

export const metadata = {
  title: 'Painel — Catálogo Digital',
}

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: store } = await supabase
    .from('stores')
    .select('trial_ends_at, plan')
    .eq('owner_id', user.id)
    .maybeSingle()

  const trialDaysLeft = store?.trial_ends_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(store.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : 0

  const showTrialBanner = !store?.plan || trialDaysLeft > 0

  return (
    <div className="h-screen flex flex-col bg-ivory overflow-hidden">
      {showTrialBanner && (
        <div className="flex-shrink-0 h-10 flex items-center justify-center gap-2 bg-linen border-b border-sand/50 font-body text-[13.5px] text-gold whitespace-nowrap">
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

      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="px-12 py-10">{children}</div>
        </main>
      </div>
    </div>
  )
}
```

> Nota: um botão "Sair" pode ser adicionado ao `Sidebar` em uma tarefa futura usando a action `signOut` de `@/app/actions/auth`.

- [ ] **Step 2: Commit**

```bash
git add app/painel/layout.tsx
git commit -m "feat: add session check and dynamic trial banner to painel layout"
```

---

## Task 16: Tela `/verificar-email`

**Files:**
- Criar: `app/(auth)/verificar-email/page.tsx`

- [ ] **Step 1: Criar a page com ResendButton**

Crie `app/(auth)/verificar-email/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useActionState } from 'react'
import { resendConfirmation } from '@/app/actions/auth'

type ResendState = { sent: boolean } | null

export default function VerificarEmailPage() {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendConfirmation,
    null
  )

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-9">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-linen flex items-center justify-center mx-auto mb-6">
            <Mail size={24} className="text-gold" />
          </div>

          <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-3">
            Verifique seu e-mail
          </h1>

          <p className="font-body text-[14px] text-graphite leading-relaxed mb-6">
            Enviamos um link de confirmação para o seu e-mail. Clique nele para
            ativar sua conta e escolher seu plano.
          </p>

          {state?.sent ? (
            <p className="font-body text-[13px] text-green-700 bg-green-50 border border-green-200 rounded-input px-4 py-3">
              E-mail reenviado! Verifique sua caixa de entrada.
            </p>
          ) : (
            <form action={action}>
              <button
                type="submit"
                disabled={pending}
                className="font-body text-[13px] text-graphite hover:text-obsidian transition-colors disabled:opacity-60"
              >
                {pending ? 'Enviando…' : 'Não recebeu? Reenviar e-mail'}
              </button>
            </form>
          )}
        </div>

        <div className="flex justify-center mt-7">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
```

> Nota: esta page usa `'use client'` porque precisa do `useActionState`. O Supabase não envia o `email` no redirect para `/verificar-email`; a action `resendConfirmation` sem e-mail é inócua (o Supabase ignora) — para uma UX melhor, passe o e-mail via searchParams e hidden input em uma iteração futura.

- [ ] **Step 2: Commit**

```bash
git add "app/(auth)/verificar-email/"
git commit -m "feat: add verify email page"
```

---

## Task 17: Tela `/recuperar-senha`

**Files:**
- Criar: `app/(auth)/recuperar-senha/page.tsx`

- [ ] **Step 1: Criar a page**

Crie `app/(auth)/recuperar-senha/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useActionState } from 'react'
import { requestPasswordReset } from '@/app/actions/auth'

type ResetState = void | null

export default function RecuperarSenhaPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    null
  )

  const inputWrap =
    'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
  const inputBase =
    'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

  // `state` passa de null para void (undefined) após o submit — indicativo de sucesso
  const submitted = state !== null

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-9">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Recuperar senha
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          {submitted ? (
            <div className="px-4 py-5 bg-linen border border-sand rounded-input text-center">
              <p className="font-body text-[14px] text-graphite leading-relaxed">
                Se esse e-mail estiver cadastrado, você receberá um link em
                breve. Verifique também sua caixa de spam.
              </p>
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  E-mail
                </label>
                <div className={inputWrap}>
                  <Mail size={18} className="text-graphite flex-shrink-0" />
                  <input
                    type="email"
                    name="email"
                    placeholder="voce@email.com"
                    autoComplete="email"
                    className={inputBase}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors disabled:opacity-60"
              >
                {pending ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          )}
        </div>

        <div className="flex justify-center mt-7">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(auth)/recuperar-senha/"
git commit -m "feat: add password recovery page"
```

---

## Task 18: Tela `/redefinir-senha`

**Files:**
- Criar: `app/(auth)/redefinir-senha/page.tsx`

- [ ] **Step 1: Criar a page**

Crie `app/(auth)/redefinir-senha/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useActionState } from 'react'
import { resetPassword } from '@/app/actions/auth'
import { PasswordInput } from '@/components/ui/PasswordInput'

type ResetState = { error: string } | null

export default function RedefinirSenhaPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPassword,
    null
  )

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-9">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Nova senha
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Escolha uma senha segura com ao menos 8 caracteres, uma maiúscula
              e um número.
            </p>
          </div>

          {state?.error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-input">
              <p className="font-body text-[13px] text-red-700">{state.error}</p>
              <Link
                href="/recuperar-senha"
                className="font-body text-[13px] text-obsidian font-medium hover:underline mt-1 block"
              >
                Solicitar novo link →
              </Link>
            </div>
          )}

          <form action={action} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-body font-medium text-[13px] text-obsidian">
                Nova senha
              </label>
              <PasswordInput
                name="password"
                placeholder="Nova senha"
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-body font-medium text-[13px] text-obsidian">
                Confirmar nova senha
              </label>
              <PasswordInput
                name="confirm_password"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors disabled:opacity-60"
            >
              {pending ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        </div>

        <div className="flex justify-center mt-7">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rodar todos os testes para confirmar que nada quebrou**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 3: Commit final**

```bash
git add "app/(auth)/redefinir-senha/"
git commit -m "feat: add password reset page"
```

---

## Self-review — cobertura do spec

| Requisito do spec | Tarefa |
|---|---|
| Confirmação de e-mail | Task 6 (signUp), Task 7 (callback cria profile+store), Task 16 (/verificar-email) |
| Google OAuth | Task 6 (signInWithGoogle), Task 7 (callback detecta novo usuário Google), Tasks 12–13 (botões) |
| Supabase setup | Task 1 |
| Route group (auth)/ | Task 11 |
| /escolha-de-plano (renomeado de /planos) | Task 11 + Task 14 |
| Middleware | Task 5 |
| Server Actions | Task 6 |
| /auth/callback | Task 7 |
| /api/slug/check | Task 8 |
| PasswordInput | Task 9 |
| SlugInput + debounce 400ms | Task 10 |
| Login com ?next= | Task 12 |
| Cadastro com step=loja | Task 13 |
| selectPlan | Task 14 |
| Painel com session check | Task 15 |
| /verificar-email | Task 16 |
| /recuperar-senha | Task 17 |
| /redefinir-senha | Task 18 |
| signOut | Task 6 (action criada) |
| Testes slugify | Task 3 |
| Testes SlugInput | Task 10 |
