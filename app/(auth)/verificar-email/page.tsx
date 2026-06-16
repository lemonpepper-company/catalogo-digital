'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resendConfirmation } from '@/app/actions/auth'

type ResendState = { sent: boolean } | null

export default function VerificarEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendConfirmation,
    null
  )

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

        <div className="bg-white border border-sand/50 rounded-card p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-linen flex items-center justify-center mx-auto mb-6">
            <Mail size={24} className="text-gold" />
          </div>

          <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-3">
            Verifique seu e-mail
          </h1>

          <p className="font-body text-[14px] text-graphite leading-relaxed mb-6">
            Enviamos um link de confirmação para o seu e-mail. Clique nele para
            ativar sua conta e escolher seu plano.
          </p>

          {state?.sent ? (
            <p className="font-body text-[13px] text-green-700 bg-green-50 border border-green-200 rounded-input px-4 py-3">
              E-mail reenviado! Verifique sua caixa de entrada.
            </p>
          ) : (
            <form action={action}>
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                disabled={pending}
                className="font-body text-[13px] text-graphite hover:text-obsidian transition-colors disabled:opacity-60"
              >
                {pending ? 'Enviando…' : 'Não recebeu? Reenviar e-mail'}
              </button>
            </form>
          )}
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
