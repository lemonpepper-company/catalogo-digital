'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Globe, Loader2, X } from 'lucide-react'

type SlugStatus = 'idle' | 'checking' | 'available' | 'unavailable'

interface SlugInputProps {
  name: string
  value: string
  onChange: (slug: string) => void
}

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

export function SlugInput({ name, value, onChange }: SlugInputProps) {
  const [status, setStatus] = useState<SlugStatus>('idle')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!value || value.length < 2) {
      setStatus('idle')
      setSuggestion(null)
      return
    }

    setSuggestion(null)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      setStatus('checking')
      const res = await fetch(`/api/slug/check?slug=${encodeURIComponent(value)}`)
      const data = await res.json()

      if (data.available) {
        setStatus('available')
      } else {
        setStatus('unavailable')
        setSuggestion(data.suggestion ?? null)
      }
    }, 400)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      <div className={inputWrap}>
        <Globe size={16} className="text-graphite flex-shrink-0" />
        <span className="font-body text-[14px] text-graphite whitespace-nowrap">
          catalogo.app/
        </span>
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          }
          placeholder="minha-loja"
          className={inputBase}
        />
        {status === 'checking' && (
          <Loader2
            size={16}
            className="text-graphite animate-spin flex-shrink-0"
            data-testid="slug-checking"
          />
        )}
        {status === 'available' && (
          <Check
            size={16}
            className="text-green-600 flex-shrink-0"
            data-testid="slug-available"
          />
        )}
        {status === 'unavailable' && (
          <X
            size={16}
            className="text-red-500 flex-shrink-0"
            data-testid="slug-unavailable"
          />
        )}
      </div>

      {status === 'unavailable' && suggestion && (
        <p className="font-body text-[12px] text-graphite">
          Sugestão:{' '}
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="text-obsidian font-medium hover:underline"
          >
            {suggestion}
          </button>
        </p>
      )}
    </div>
  )
}
