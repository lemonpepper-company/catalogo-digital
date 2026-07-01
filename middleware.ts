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
  const step = request.nextUrl.searchParams.get('step')
  const onStepLoja = pathname === '/cadastro' && step === 'loja'

  if ((pathname === '/login' || pathname === '/cadastro') && !onStepLoja) {
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

  // Painel: exige sessão, loja criada e plano definido
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

    if (!store) {
      return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
    }
    if (!store.plan) {
      return NextResponse.redirect(new URL('/escolha-de-plano', request.url))
    }
  }

  // Escolha de plano: exige sessão e loja criada; redireciona se já tem plano
  if (pathname === '/escolha-de-plano') {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const { data: store } = await supabase
      .from('stores')
      .select('plan')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
    }
    if (store.plan) {
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/slug|auth/callback|landing).*)',
  ],
}
