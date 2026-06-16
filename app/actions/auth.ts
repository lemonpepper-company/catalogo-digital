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
    return { error: result.error.issues[0].message }
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

  redirect(`/verificar-email?email=${encodeURIComponent(email)}`)
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
  redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/painel')
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
    return { error: result.error.issues[0].message }
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

  const { error } = await supabase
    .from('stores')
    .update({ plan })
    .eq('owner_id', user.id)
    .is('plan', null)

  if (error) {
    redirect('/escolha-de-plano?error=plan')
  }

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
    return { error: result.error.issues[0].message }
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
