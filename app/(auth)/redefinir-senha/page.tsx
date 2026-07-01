'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useActionState, useState } from 'react'
import { resetPassword } from '@/app/actions/auth'
import { PasswordInput } from '@/components/ui/PasswordInput'

type ResetState = { error: string } | null

export default function RedefinirSenhaPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    resetPassword,
    null
  )
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-9">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Nova senha
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Escolha uma senha segura com ao menos 8 caracteres, uma maiúscula
              e um número.
            </p>
          </div>

          {state?.error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-input">
              <p className="font-body text-[13px] text-red-700">{state.error}</p>
              <Link
                href="/recuperar-senha"
                className="font-body text-[13px] text-obsidian font-medium hover:underline mt-1 block"
              >
                Solicitar novo link →
              </Link>
            </div>
          )}

          <form action={action} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="font-body font-medium text-[13px] text-obsidian">
                Nova senha
              </label>
              <PasswordInput
                name="password"
                placeholder="Nova senha"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-body font-medium text-[13px] text-obsidian">
                Confirmar nova senha
              </label>
              <PasswordInput
                name="confirm_password"
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors disabled:opacity-60"
            >
              {pending ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        </div>

        <div className="flex justify-center mt-7">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
          >
            <ArrowLeft size={15} /> Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
