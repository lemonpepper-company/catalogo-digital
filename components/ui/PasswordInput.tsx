'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface PasswordInputProps {
  name: string
  placeholder?: string
  autoComplete?: string
}

export function PasswordInput({
  name,
  placeholder = 'Sua senha',
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [show, setShow] = useState(false)

  return (
    <div className={inputWrap}>
      <Lock size={18} className="text-graphite flex-shrink-0" />
      <input
        type={show ? 'text' : 'password'}
        name={name}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputBase}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        className="text-graphite hover:text-obsidian transition-colors flex-shrink-0"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
