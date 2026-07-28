import { describe, it, expect } from 'vitest'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'

function staticRouteSegments(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory())
  const segments: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('[') || entry.name === 'actions') continue
    if (entry.name.startsWith('(')) {
      segments.push(...staticRouteSegments(join(dir, entry.name)))
      continue
    }
    segments.push(entry.name)
  }
  return segments
}

describe('RESERVED_SLUGS', () => {
  it('contém as rotas estáticas principais', () => {
    expect(RESERVED_SLUGS.has('login')).toBe(true)
    expect(RESERVED_SLUGS.has('painel')).toBe(true)
    expect(RESERVED_SLUGS.has('cadastro')).toBe(true)
    expect(RESERVED_SLUGS.has('api')).toBe(true)
  })

  it('contém as 5 novas páginas de SEO', () => {
    expect(RESERVED_SLUGS.has('vitrine-digital')).toBe(true)
    expect(RESERVED_SLUGS.has('catalogo-digital-gratis')).toBe(true)
    expect(RESERVED_SLUGS.has('vender-pelo-whatsapp')).toBe(true)
    expect(RESERVED_SLUGS.has('vitrine-online-sem-carrinho')).toBe(true)
    expect(RESERVED_SLUGS.has('alternativa-linktree-para-vender')).toBe(true)
  })

  it('não contém um slug de loja normal', () => {
    expect(RESERVED_SLUGS.has('boutique-da-ana')).toBe(false)
  })

  it('cobre toda rota estática de nível superior em app/', () => {
    const segments = staticRouteSegments(join(process.cwd(), 'app'))
    for (const segment of segments) {
      expect(RESERVED_SLUGS.has(segment), `slug "${segment}" não está em RESERVED_SLUGS`).toBe(true)
    }
  })
})
