'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useLoginForm } from './use-login-form'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { VtrineLogo } from '@/components/ui/VtrineLogo'
import { signInWithGoogle } from '@/app/actions/auth'

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

          <div className="flex items-center gap-3.5 my-5">
            <div className="h-px bg-sand flex-1" />
            <span className="font-body text-[12px] text-graphite">ou</span>
            <div className="h-px bg-sand flex-1" />
          </div>

          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="w-full h-12 rounded-btn border border-sand bg-white text-obsidian font-display font-medium text-[15px] hover:bg-linen transition-colors flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"/>
              </svg>
              Entrar com Google
            </button>
          </form>

          <div className="flex items-center gap-3.5 my-5">
            <div className="h-px bg-sand flex-1" />
          </div>

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
