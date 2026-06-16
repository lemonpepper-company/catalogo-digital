import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const SLUG_REGEX = /^[a-z0-9-]{2,50}$/

export async function GET(request: NextRequest) {
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

  // Encontra sugestão disponível com sufixo numérico
  let suffix = 2
  let suggestion = `${slug}-${suffix}`

  while (suffix <= 10) {
    const { data } = await supabase
      .from('stores')
      .select('id')
      .eq('slug', suggestion)
      .maybeSingle()

    if (!data) break

    suffix++
    suggestion = `${slug}-${suffix}`
  }

  // Verify the suggestion is actually available (handles loop exhaustion)
  const { data: verify } = await supabase
    .from('stores')
    .select('id')
    .eq('slug', suggestion)
    .maybeSingle()

  if (verify) {
    // No good suggestion found
    return NextResponse.json({ available: false })
  }

  return NextResponse.json({ available: false, suggestion })
}
