import { describe, it, expect } from 'vitest'
import { slugify, isValidSlug } from '../lib/auth/slugify'

describe('slugify', () => {
  it('converte para lowercase', () => {
    expect(slugify('Boutique')).toBe('boutique')
  })

  it('remove acentos', () => {
    expect(slugify('Ateliê Mirá')).toBe('atelie-mira')
  })

  it('substitui espaços por hífens', () => {
    expect(slugify('Loja da Ana')).toBe('loja-da-ana')
  })

  it('remove caracteres especiais', () => {
    expect(slugify('Loja & Cia!')).toBe('loja-cia')
  })

  it('colapsa múltiplos hífens', () => {
    expect(slugify('a  b')).toBe('a-b')
  })

  it('remove hífens no início e fim', () => {
    expect(slugify(' loja ')).toBe('loja')
  })

  it('retorna string vazia para entrada vazia', () => {
    expect(slugify('')).toBe('')
  })
})

describe('isValidSlug', () => {
  it('aceita slug válido', () => {
    expect(isValidSlug('boutique-da-ana')).toBe(true)
  })

  it('aceita slug com números', () => {
    expect(isValidSlug('loja-123')).toBe(true)
  })

  it('rejeita slug com maiúsculas', () => {
    expect(isValidSlug('Boutique')).toBe(false)
  })

  it('rejeita slug com espaços', () => {
    expect(isValidSlug('minha loja')).toBe(false)
  })

  it('rejeita slug com menos de 2 chars', () => {
    expect(isValidSlug('a')).toBe(false)
  })

  it('rejeita slug com mais de 50 chars', () => {
    expect(isValidSlug('a'.repeat(51))).toBe(false)
  })

  it('rejeita slug com caracteres especiais', () => {
    expect(isValidSlug('loja@moda')).toBe(false)
  })
})
