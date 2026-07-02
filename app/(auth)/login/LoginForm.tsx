'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useLoginForm } from './use-login-form'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { VtrineLogo } from '@/components/ui/VtrineLogo'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:border-obsidian focus-within:ring-2 focus-within:ring-obsidian focus-within:ring-offset-2 transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface LoginFormProps {
  next?: string
  resetSuccess?: boolean
}

export function LoginForm({ next, resetSuccess }: LoginFormProps) {
  const { state, action, pending, email, setEmail, password, setPassword } = useLoginForm()
  const formRef = useRef<HTMLFormElement>(null)

  function focusPassword() {
    formRef.current?.querySelector<HTMLInputElement>('input[name="password"]')?.focus()
  }

  function submitForm() {
    if (!pending) formRef.current?.requestSubmit()
  }

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex justify-center mb-9">
          <Link href="/landing">
            <VtrineLogo />
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Bem-vindo de volta
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Entre para gerenciar sua vitrine.
            </p>
          </div>

          {resetSuccess && (
            <div className="mb-5 px-4 py-3 bg-green-50 border border-green-200 rounded-input">
              <p className="font-body text-[13px] text-green-700">
                Senha redefinida com sucesso. Faça login com sua nova senha.
              </p>
            </div>
          )}

          {state?.error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-input">
              <p className="font-body text-[13px] text-red-700">{state.error}</p>
            </div>
          )}

          <form ref={formRef} action={action} className="flex flex-col gap-6">
            {next && <input type="hidden" name="next" value={next} />}

            <div className="flex flex-col gap-2">
              <label className="font-body font-medium text-[13px] text-obsidian">
                E-mail
              </label>
              <div className={inputWrap}>
                <Mail size={18} className="text-graphite flex-shrink-0" />
                <input
                  type="email"
                  name="email"
                  placeholder="voce@email.com"
                  autoComplete="email"
                  className={inputBase}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); focusPassword() } }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Senha
                </label>
                <Link
                  href="/recuperar-senha"
                  className="font-body font-medium text-[13px] text-graphite hover:text-obsidian transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <PasswordInput
                name="password"
                placeholder="Sua senha"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitForm() } }}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors disabled:opacity-60"
            >
              {pending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <p className="text-center font-body text-[14px] text-graphite">
            Não tem conta?{' '}
            <Link
              href="/cadastro"
              className="font-display font-medium text-gold hover:text-gold-hover transition-colors"
            >
              Criar grátis →
            </Link>
          </p>
        </div>

        <div className="flex justify-center mt-7">
          <Link
            href="/landing"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  )
}
