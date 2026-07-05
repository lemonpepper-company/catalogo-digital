'use client'

import Link from 'next/link'
import { User, Mail, ArrowLeft, ArrowRight, Store, Instagram } from 'lucide-react'
import { useCadastroForm } from './use-cadastro-form'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { SlugInput } from '@/components/ui/SlugInput'
import { VtrineLogo } from '@/components/ui/VtrineLogo'

const inputWrap =
  'flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all'
const inputBase =
  'flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0'

interface CadastroFormProps {
  stepLoja?: boolean
}

export function CadastroForm({ stepLoja = false }: CadastroFormProps) {
  const {
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    storeName, handleStoreNameChange,
    slug, setSlug,
    instagram, setInstagram,
    state, action, pending,
  } = useCadastroForm(stepLoja)

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8 py-8">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/landing">
            <VtrineLogo />
          </Link>
        </div>

        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              {stepLoja ? 'Qual é o nome da sua loja?' : 'Crie sua vitrine grátis'}
            </h1>
            <p className="font-body text-[14px] text-graphite">
              {stepLoja
                ? 'Esse será o link da sua vitrine.'
                : 'Sua loja no ar em poucos minutos.'}
            </p>
          </div>

          {state?.error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-input">
              <p className="font-body text-[13px] text-red-700">{state.error}</p>
            </div>
          )}

          <form action={action} className="flex flex-col gap-6">
            {/* Seção A: Sua conta — oculta no step=loja */}
            {!stepLoja && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Sua conta
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Seu nome
                  </label>
                  <div className={inputWrap}>
                    <User size={18} className="text-graphite flex-shrink-0" />
                    <input
                      type="text"
                      name="full_name"
                      placeholder="Como você se chama"
                      autoComplete="name"
                      className={inputBase}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

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
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Senha
                  </label>
                  <PasswordInput
                    name="password"
                    placeholder="Crie uma senha"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Confirmar senha
                  </label>
                  <PasswordInput
                    name="confirm_password"
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Seção B: Sua loja — só na etapa 2 (após confirmar e-mail) */}
            {stepLoja && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display font-semibold text-[13px] tracking-[0.08em] uppercase text-obsidian whitespace-nowrap">
                    Sua loja
                  </h2>
                  <div className="h-px bg-sand flex-1" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Nome da loja
                  </label>
                  <div className={inputWrap}>
                    <Store size={18} className="text-graphite flex-shrink-0" />
                    <input
                      type="text"
                      name="store_name"
                      placeholder="Ex.: Ateliê Mira"
                      autoComplete="organization"
                      className={inputBase}
                      value={storeName}
                      onChange={(e) => handleStoreNameChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Link da loja
                  </label>
                  <SlugInput name="slug" value={slug} onChange={setSlug} />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-body font-medium text-[13px] text-obsidian">
                    Instagram <span className="text-graphite font-normal">(opcional)</span>
                  </label>
                  <div className={inputWrap}>
                    <Instagram size={18} className="text-graphite flex-shrink-0" />
                    <span className="font-body text-[15px] text-graphite flex-shrink-0">@</span>
                    <input
                      type="text"
                      name="instagram"
                      placeholder="seu.usuario"
                      autoComplete="off"
                      className={inputBase}
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full h-12 rounded-btn bg-gold text-white font-display font-medium text-[16px] flex items-center justify-center gap-2 hover:bg-gold-hover transition-colors mt-2 disabled:opacity-60"
            >
              {pending
                ? 'Criando…'
                : stepLoja
                  ? 'Salvar e continuar'
                  : 'Criar minha conta grátis'}
              {!pending && <ArrowRight size={18} />}
            </button>
          </form>

          {!stepLoja && (
            <>
              <p className="font-body text-[12px] text-graphite text-center mt-4 leading-snug">
                Ao criar a conta, você concorda com os{' '}
                <Link href="#" className="text-obsidian font-medium">
                  Termos
                </Link>{' '}
                e a{' '}
                <Link href="#" className="text-obsidian font-medium">
                  Política de Privacidade
                </Link>
                .
              </p>

              <div className="flex items-center gap-3.5 my-[26px]">
                <div className="h-px bg-sand flex-1" />
              </div>

              <p className="text-center font-body text-[14px] text-graphite">
                Já tem conta?{' '}
                <Link
                  href="/login"
                  className="font-display font-medium text-obsidian hover:text-gold transition-colors"
                >
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>

        <div className="flex justify-center mt-[26px]">
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
