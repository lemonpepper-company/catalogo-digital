"use client";

import Link from "next/link";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Store,
  Globe,
  Pencil,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useCadastroForm } from "./use-cadastro-form";

const inputWrap =
  "flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all";
const inputBase =
  "flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0";

export function CadastroForm() {
  const { showPw, togglePw, slug, storeRef, handleStoreChange } = useCadastroForm();

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8 py-8">
      <div className="w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="w-[34px] h-[34px] rounded-[9px] bg-obsidian flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[19px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Crie sua vitrine grátis
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Sua loja no ar em poucos minutos.
            </p>
          </div>

          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Sua conta */}
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
                    placeholder="Como você se chama"
                    autoComplete="name"
                    className={inputBase}
                  />
                </div>
                <p className="font-body text-[12px] text-graphite leading-snug">
                  Usado apenas para sua conta — não aparece no link.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  E-mail
                </label>
                <div className={inputWrap}>
                  <Mail size={18} className="text-graphite flex-shrink-0" />
                  <input
                    type="email"
                    placeholder="voce@email.com"
                    autoComplete="email"
                    className={inputBase}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Senha
                </label>
                <div className={inputWrap}>
                  <Lock size={18} className="text-graphite flex-shrink-0" />
                  <input
                    type={showPw ? "text" : "password"}
                    placeholder="Crie uma senha"
                    autoComplete="new-password"
                    className={inputBase}
                  />
                  <button
                    type="button"
                    onClick={togglePw}
                    className="text-graphite hover:text-obsidian transition-colors flex-shrink-0"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Sua loja */}
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
                    ref={storeRef}
                    type="text"
                    placeholder="Ex.: Ateliê Mira"
                    autoComplete="organization"
                    onChange={handleStoreChange}
                    className={inputBase}
                  />
                </div>
                {/* URL preview */}
                <div className="flex items-center gap-2 mt-1 px-4 py-[11px] bg-linen border border-sand rounded-input">
                  <Globe size={16} className="text-graphite flex-shrink-0" />
                  <span className="font-body text-[14px] text-graphite flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                    catalogo.app/
                    <span className="text-obsidian font-semibold">{slug}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => storeRef.current?.focus()}
                    aria-label="Editar link"
                    className="w-7 h-7 rounded-[6px] bg-transparent text-graphite hover:bg-surface-hover hover:text-obsidian transition-colors flex items-center justify-center flex-shrink-0"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 rounded-btn bg-gold text-white font-display font-medium text-[16px] flex items-center justify-center gap-2 hover:bg-gold-hover transition-colors mt-2"
            >
              Criar minha conta grátis <ArrowRight size={18} />
            </button>
          </form>

          <p className="font-body text-[12px] text-graphite text-center mt-4 leading-snug">
            Ao criar a conta, você concorda com os{" "}
            <Link href="#" className="text-obsidian font-medium">
              Termos
            </Link>{" "}
            e a{" "}
            <Link href="#" className="text-obsidian font-medium">
              Política de Privacidade
            </Link>
            .
          </p>

          <div className="flex items-center gap-3.5 my-[26px]">
            <div className="h-px bg-sand flex-1" />
            <span className="font-body text-[12px] text-graphite">ou</span>
            <div className="h-px bg-sand flex-1" />
          </div>

          <p className="text-center font-body text-[14px] text-graphite">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-display font-medium text-obsidian hover:text-gold transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>

        {/* Back link */}
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
  );
}
