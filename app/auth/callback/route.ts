import { createServerClient } from '@supabase/ssr'
import type { EmailOtpType, User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next')

  if (!code && !token_hash) {
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

  let user: User | null = null

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?error=auth`)
    }
    user = data.user
  } else if (token_hash && type) {
    // Fluxo OTP: confirmação de e-mail ou redefinição de senha via token_hash
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })
    if (error || !data.user) {
      return NextResponse.redirect(`${origin}/login?error=auth`)
    }
    user = data.user
  }

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth`)
  }

  // Redefinição de senha — redireciona direto para a tela
  if (next === '/redefinir-senha') {
    return NextResponse.redirect(`${origin}/redefinir-senha`)
  }

  // Verifica se loja já existe (usuário existente, ex.: login Google)
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

  // Usuário novo — cria o profile e segue para a etapa de dados da loja
  const meta = user.user_metadata ?? {}
  await supabase.from('profiles').upsert({
    id: user.id,
    full_name: meta.full_name ?? meta.name ?? '',
  })

  return NextResponse.redirect(`${origin}/cadastro?step=loja`)
}
