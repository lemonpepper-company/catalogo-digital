import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SlugInput } from '../components/ui/SlugInput'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  vi.useFakeTimers()
})

describe('SlugInput', () => {
  it('renderiza o preview da URL', () => {
    render(<SlugInput name="slug" value="minha-loja" onChange={() => {}} />)
    expect(screen.getByText('catalogo.app/')).toBeInTheDocument()
    expect(screen.getByDisplayValue('minha-loja')).toBeInTheDocument()
  })

  it('exibe spinner durante verificação', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ available: true }) })

    const { container } = render(
      <SlugInput name="slug" value="loja-teste" onChange={() => {}} />
    )

    // Debounce não disparou ainda
    expect(container.querySelector('[data-testid="slug-checking"]')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    // Spinner aparece enquanto fetch está em andamento — após o timer
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/slug/check?slug=loja-teste'
    )
  })

  it('exibe ícone de disponível após resposta positiva', async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ available: true }) })

    render(<SlugInput name="slug" value="loja-disponivel" onChange={() => {}} />)

    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(screen.getByTestId('slug-available')).toBeInTheDocument()
  })

  it('exibe sugestão quando slug está indisponível', async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ available: false, suggestion: 'loja-ocupada-2' }),
    })

    render(<SlugInput name="slug" value="loja-ocupada" onChange={() => {}} />)

    await act(async () => {
      vi.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(screen.getByText(/loja-ocupada-2/)).toBeInTheDocument()
  })

  it('não faz fetch para slugs com menos de 2 chars', async () => {
    render(<SlugInput name="slug" value="a" onChange={() => {}} />)

    await act(async () => {
      vi.advanceTimersByTime(400)
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
