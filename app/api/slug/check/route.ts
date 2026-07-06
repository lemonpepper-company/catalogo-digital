import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/server/rate-limit'
import { buildSlugCandidates, pickAvailableSlug } from '@/lib/server/slug-suggest'
import { NextRequest, NextResponse } from 'next/server'

const SLUG_REGEX = /^[a-z0-9-]{2,50}$/

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}

export async function GET(request: NextRequest) {
  const allowed = await checkRateLimit(`slug-check:${getClientIp(request)}`)
  if (!allowed) {
    return NextResponse.json(
      { available: false, error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429 }
    )
  }

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
