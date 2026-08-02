import { describe, it, expect } from 'vitest'
import { storeSchema } from '@/lib/validation/auth'

const validInput = {
  store_name: 'Loja da Ana',
  slug: 'loja-da-ana',
  whatsapp: '11999999999',
  monogram: 'LA',
  description: null,
  instagram: null,
  paymentMethods: [],
  deliveryMethods: [],
  document: null,
}

describe('storeSchema', () => {
  it('aceita um slug válido', () => {
    const r = storeSchema.safeParse(validInput)
    expect(r.success).toBe(true)
  })

  it('rejeita slug de rota estática existente', () => {
    const r = storeSchema.safeParse({ ...validInput, slug: 'painel' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Esse link não está disponível.')
  })

  it('rejeita slug igual a uma das novas páginas de SEO', () => {
    const r = storeSchema.safeParse({ ...validInput, slug: 'vitrine-digital' })
    expect(r.success).toBe(false)
  })

  it('rejeita slug com formato inválido', () => {
    const r = storeSchema.safeParse({ ...validInput, slug: 'Loja Ana' })
    expect(r.success).toBe(false)
  })
})
