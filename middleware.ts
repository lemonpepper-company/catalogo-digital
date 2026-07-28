import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createAnonClient } from '@/lib/supabase/server'
import { isOwnHost } from '@/lib/domain-routing'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = request.headers.get('host')?.split(':')[0] ?? ''

  if (pathname === '/' && !isOwnHost(hostname, process.env.NEXT_PUBLIC_SITE_URL)) {
    const anon = createAnonClient()
    const { data: store } = await anon
      .from('stores')
      .select('slug')
      .eq('custom_domain', hostname)
      .eq('custom_domain_verified', true)
      .maybeSingle()

    if (store) {
      const url = request.nextUrl.clone()
      url.pathname = `/${store.slug}`
      return NextResponse.rewrite(url)
    }
    // Domínio desconhecido ou ainda não verificado: segue o fluxo normal
    // (a rota "/" sem loja correspondente cai no 404 padrão do Next).
  }

  const needsAuth = pathname === '/login' || pathname.startsWith('/painel')

  if (!needsAuth) {
    return NextResponse.next({ request })
  }

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

  // Rota de login: redireciona usuários já autenticados para o painel
  if (pathname === '/login') {
    if (user) {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!store) {
        return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
      }
      return NextResponse.redirect(new URL('/painel', request.url))
    }
  }

  // Painel: exige sessão e loja criada
  if (pathname.startsWith('/painel')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }

    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    if (!store) {
      return NextResponse.redirect(new URL('/cadastro?step=loja', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/slug|auth/callback|landing).*)',
  ],
}
