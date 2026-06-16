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
