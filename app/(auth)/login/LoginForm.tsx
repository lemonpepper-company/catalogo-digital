"use client";

import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useLoginForm } from "./use-login-form";

const inputWrap =
  "flex items-center gap-2 h-12 px-4 bg-white border border-sand rounded-input focus-within:outline focus-within:outline-2 focus-within:outline-obsidian focus-within:outline-offset-2 focus-within:border-obsidian transition-all";
const inputBase =
  "flex-1 border-none outline-none bg-transparent font-body text-[15px] text-obsidian placeholder:text-inactive min-w-0";

export function LoginForm() {
  const { showPw, togglePw } = useLoginForm();

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center px-8">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
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

        {/* Card */}
        <div className="bg-white border border-sand/50 rounded-card p-10">
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-semibold text-[24px] text-obsidian tracking-tight mb-2">
              Bem-vindo de volta
            </h1>
            <p className="font-body text-[14px] text-graphite">
              Entre para gerenciar sua vitrine.
            </p>
          </div>

          <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
            {/* E-mail */}
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

            {/* Senha */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Senha
                </label>
                <Link
                  href="#"
                  className="font-body font-medium text-[13px] text-graphite hover:text-obsidian transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
              <div className={inputWrap}>
                <Lock size={18} className="text-graphite flex-shrink-0" />
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Sua senha"
                  autoComplete="current-password"
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

            <button
              type="submit"
              className="w-full h-12 rounded-btn bg-obsidian text-white font-display font-medium text-[16px] hover:bg-[#1f1f1f] transition-colors"
            >
              Entrar
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3.5 my-7">
            <div className="h-px bg-sand flex-1" />
            <span className="font-body text-[12px] text-graphite">ou</span>
            <div className="h-px bg-sand flex-1" />
          </div>

          <p className="text-center font-body text-[14px] text-graphite">
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="font-display font-medium text-gold hover:text-gold-hover transition-colors"
            >
              Criar grátis →
            </Link>
          </p>
        </div>

        {/* Back link */}
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
  );
}
