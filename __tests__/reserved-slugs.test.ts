import { describe, it, expect } from 'vitest'
import { RESERVED_SLUGS } from '@/lib/reserved-slugs'

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
})
