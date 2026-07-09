'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { PAYMENT_METHOD_VALUES, DELIVERY_METHOD_VALUES } from '@/lib/data'
import { uploadToBucket } from '@/lib/server/upload'
import { getSafeRedirect } from '@/lib/auth/safe-redirect'
import { whatsappSchema } from '@/lib/validation/painel'

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
  whatsapp: whatsappSchema,
  monogram: z.string().max(3, 'Monograma deve ter no máximo 3 letras').nullable(),
  description: z.string().max(500, 'Descrição muito longa').nullable(),
  instagram: z.string().max(100, 'Instagram muito longo').nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  paymentMethods: z.array(z.enum(PAYMENT_METHOD_VALUES)),
  deliveryMethods: z.array(z.enum(DELIVERY_METHOD_VALUES)),
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
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { full_name, email, password } = result.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
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
  redirect(getSafeRedirect(next, '/painel'))
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
    whatsapp: (formData.get('whatsapp') as string) || '',
    monogram: (formData.get('monogram') as string) || null,
    description: (formData.get('description') as string) || null,
    instagram: (formData.get('instagram') as string)?.replace(/^@+/, '').trim() || null,
    accentColor: formData.get('accentColor'),
    paymentMethods: JSON.parse((formData.get('paymentMethods') as string) || '[]'),
    deliveryMethods: JSON.parse((formData.get('deliveryMethods') as string) || '[]'),
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

  // MODO DEMO (a partir de jul/2026): toda loja nasce Starter, sem expiração.
  // Para voltar ao modelo com trial + escolha de plano, restaurar o bloco abaixo:
  //
  // const trialEndsAt = new Date()
  // trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  //
  // ... e trocar o redirect final para '/escolha-de-plano'

  const { data: store, error } = await supabase
    .from('stores')
    .insert({
      owner_id: user.id,
      name: result.data.store_name,
      slug: result.data.slug,
      plan: 'starter',
      trial_ends_at: null,
      whatsapp: result.data.whatsapp,
      monogram: result.data.monogram,
      description: result.data.description,
      instagram: result.data.instagram,
      accent_color: result.data.accentColor,
      payment_methods: result.data.paymentMethods,
      delivery_methods: result.data.deliveryMethods,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'Esse link já está em uso. Tente outro.' }
    }
    return { error: 'Erro ao criar loja. Tente novamente.' }
  }

  // Logo é opcional e só pode ser enviado depois que a loja existe (o caminho
  // no Storage usa o id da loja). Falha no upload não desfaz a loja já criada
  // — o lojista pode enviar o logo depois em Configurações.
  const logo = formData.get('logo') as File | null
  if (logo && logo.size > 0) {
    const ext = logo.name.split('.').pop() || 'png'
    const path = `${store.id}/logo/${crypto.randomUUID()}.${ext}`
    try {
      const logoUrl = await uploadToBucket(supabase, path, logo)
      await supabase.from('stores').update({ logo_url: logoUrl }).eq('id', store.id)
    } catch {
      // Ignorado de propósito — loja já foi criada com sucesso.
    }
  }

  redirect('/painel')
}

export async function selectPlan(plan: 'starter' | 'pro'): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!store) redirect('/cadastro?step=loja')

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
    if (error.code === 'same_password') {
      return { error: 'A nova senha deve ser diferente da senha atual.' }
    }
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
