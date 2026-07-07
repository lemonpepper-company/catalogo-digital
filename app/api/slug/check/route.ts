import { createClient } from '@/lib/supabase/server'
import { buildSlugCandidates, pickAvailableSlug } from '@/lib/server/slug-suggest'
import { NextRequest, NextResponse } from 'next/server'

const SLUG_REGEX = /^[a-z0-9-]{2,50}$/

// Único consumidor: o passo "step=loja" do cadastro, alcançado apenas por quem
// já confirmou a conta (ver app/(auth)/cadastro/page.tsx). Por isso a rota exige
// sessão em vez de ficar pública — fecha o caminho de abuso/enumeração anônima.
export async function GET(request: NextRequest) {
  const slug = new URL(request.url).searchParams.get('slug') ?? ''

  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json(
      { available: false, error: 'Slug inválido' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ available: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ available: true })
  }

  // Busca todos os candidatos de uma vez (1 query) em vez de checar um a um
  const candidates = buildSlugCandidates(slug)
  const { data: taken } = await supabase
    .from('stores')
    .select('slug')
    .in('slug', candidates)

  const suggestion = pickAvailableSlug(
    candidates,
    (taken ?? []).map((row) => row.slug)
  )

  if (!suggestion) {
    return NextResponse.json({ available: false })
  }

  return NextResponse.json({ available: false, suggestion })
}
