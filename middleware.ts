import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createAnonClient } from '@/lib/supabase/server'
import { isOwnHost, stripWwwPrefix } from '@/lib/domain-routing'
import { getPlanLimits, type Plan } from '@/lib/plan-limits'

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
    const { data, error } = await anon.rpc('resolve_custom_domain', {
      p_hostname: stripWwwPrefix(hostname),
    })

    if (error) {
      console.error('[middleware] falha ao resolver domínio próprio:', error)
    }

    const store = data?.[0] ?? null

    // Quatro desfechos:
    // 1. Nenhuma loja usa esse domínio (ou a RPC falhou) → host desconhecido,
    //    segue o fluxo normal. Fail-open: preferível a derrubar o site inteiro.
    // 2. Domínio ainda não verificado → página de espera, para não exibir a
    //    landing da Vtrine no domínio do lojista durante a verificação.
    // 3. Verificado, mas o plano não inclui domínio próprio (rebaixamento) →
    //    redirect para o slug. 307 e nunca 301: o rebaixamento é reversível e
    //    um 301 fica cacheado no browser do visitante mesmo após o re-upgrade.
    // 4. Verificado e plano com domínio → rewrite transparente.
    if (store) {
      const url = request.nextUrl.clone()

      if (!store.domain_verified) {
        url.pathname = '/dominio-pendente'
        return NextResponse.rewrite(url)
      }

      const limits = getPlanLimits(store.effective_plan as Plan, null)
      if (!limits.customDomain) {
        return NextResponse.redirect(
          new URL(`/${store.store_slug}`, process.env.NEXT_PUBLIC_SITE_URL),
          307
        )
      }

      url.pathname = `/${store.store_slug}`
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
