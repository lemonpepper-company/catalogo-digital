'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:border-obsidian focus-within:ring-2 focus-within:ring-obsidian focus-within:ring-offset-2 transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface PasswordInputProps {
  name: string
  placeholder?: string
  autoComplete?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function PasswordInput({
  name,
  placeholder = 'Sua senha',
  autoComplete = 'current-password',
  value,
  onChange,
  onKeyDown,
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
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
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
