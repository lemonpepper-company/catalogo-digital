import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createAnonClient } from '@/lib/supabase/server'
import { isOwnHost, stripWwwPrefix } from '@/lib/domain-routing'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // custom_domain é gravado sempre em minúsculo (domainSchema em
  // lib/validation/painel.ts) e a comparação no Postgres é case-sensitive —
  // normaliza o Host para não perder o match com header em caixa alta.
  const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? ''

  if (pathname === '/' && !isOwnHost(hostname, process.env.NEXT_PUBLIC_SITE_URL)) {
    // Provedores de DNS/Vercel costumam redirecionar apex↔www automaticamente
    // — o Host da request pode chegar com "www." mesmo quando o lojista
    // cadastrou o domínio sem ele (domainSchema também normaliza ao salvar,
    // ver lib/validation/painel.ts). Remove o prefixo pros dois formatos
    // apontarem pra mesma loja.
    const anon = createAnonClient()
    const { data: store, error } = await anon
      .from('stores')
      .select('slug, custom_domain_verified')
      .eq('custom_domain', stripWwwPrefix(hostname))
      .maybeSingle()

    if (error) {
      console.error('[middleware] falha ao buscar domínio próprio:', error)
    }

    // Três desfechos possíveis:
    // 1. Nenhuma loja usa esse domínio → host desconhecido, segue o fluxo
    //    normal (a rota "/" é a landing de marketing, sempre 200).
    // 2. Loja com domínio verificado → rewrite transparente para a vitrine.
    // 3. Loja com domínio ainda não verificado → rewrite transparente para a
    //    página de espera, para não exibir a landing da Vtrine no domínio do
    //    lojista durante a janela de verificação.
    if (store) {
      const url = request.nextUrl.clone()
      url.pathname = store.custom_domain_verified
        ? `/${store.slug}`
        : '/dominio-pendente'
      return NextResponse.rewrite(url)
    }
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
