'use client'

import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { VtrineLogo } from '@/components/ui/VtrineLogo'
import { useActionState } from 'react'
import { requestPasswordReset } from '@/app/actions/auth'

type ResetState = void | null

export default function RecuperarSenhaPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    null
  )

  const inputWrap =
    'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
  const inputBase =
    'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

  // `state` passes from null to void (undefined) after submit — indicates success
  const submitted = state !== null

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-9">
          <Link href="/landing">
            <VtrineLogo />
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Recuperar senha
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
          </div>

          {submitted ? (
            <div className="px-4 py-5 bg-linen border border-sand rounded-input text-center">
              <p className="font-body text-[14px] text-graphite leading-relaxed">
                Se esse e-mail estiver cadastrado, você receberá um link em
                breve. Verifique também sua caixa de spam.
              </p>
            </div>
          ) : (
            <form action={action} className="flex flex-col gap-6">
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
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors disabled:opacity-60"
              >
                {pending ? 'Enviando…' : 'Enviar link'}
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
