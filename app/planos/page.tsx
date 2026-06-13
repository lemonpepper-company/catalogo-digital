import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { starterFeatures, proFeatures } from "./data";

export const metadata = {
  title: "Escolha seu plano — Catálogo Digital",
};

export default function PlanosPage() {
  return (
    <div
      className="min-h-screen bg-ivory flex items-center justify-center py-12 px-8"
    >
      <div className="w-full max-w-[860px]">
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

        {/* Heading */}
        <div className="text-center mb-10">
          <h1 className="font-display font-semibold text-[32px] text-obsidian leading-[1.2] tracking-tight">
            Escolha seu plano —{" "}
            <em className="not-italic text-gold">14 dias grátis</em> nos dois
          </h1>
          <p className="font-body text-[15px] text-graphite mt-2.5">
            Sua loja já está pronta. Escolha como quer crescer.
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-2 gap-6">
          {/* Starter */}
          <div className="bg-white border border-sand rounded-card p-8 flex flex-col gap-6">
            <div className="font-display font-semibold text-[16px] tracking-[0.04em] uppercase text-obsidian">
              Starter
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-semibold text-[40px] text-obsidian leading-none tracking-tight">
                  R$49
                </span>
                <span className="font-body text-[15px] text-graphite">/mês</span>
              </div>
              <div className="font-body text-[13px] text-graphite">
                Sem cartão de crédito agora
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {starterFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 font-body text-[15px] text-graphite"
                >
                  <Check size={18} className="text-gold flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/painel"
              className="mt-auto w-full h-12 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[15px] flex items-center justify-center hover:bg-linen transition-colors"
            >
              Começar com Starter
            </Link>
          </div>

          {/* Pro */}
          <div className="relative bg-white border-2 border-gold rounded-card p-8 flex flex-col gap-6">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 px-3.5 rounded-pill bg-gold text-white font-body font-semibold text-[11px] tracking-[0.06em] uppercase flex items-center whitespace-nowrap">
              Mais popular
            </span>
            <div className="font-display font-semibold text-[16px] tracking-[0.04em] uppercase text-obsidian">
              Pro
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-1">
                <span className="font-display font-semibold text-[40px] text-obsidian leading-none tracking-tight">
                  R$99
                </span>
                <span className="font-body text-[15px] text-graphite">/mês</span>
              </div>
              <div className="font-body text-[13px] text-graphite">
                Sem cartão de crédito agora
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {proFeatures.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 font-body text-[15px] text-graphite"
                >
                  <Check size={18} className="text-gold flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/painel"
              className="mt-auto w-full h-12 rounded-btn bg-gold text-white font-display font-medium text-[15px] flex items-center justify-center gap-2 hover:bg-gold-hover transition-colors"
            >
              Começar com Pro <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center font-body text-[14px] text-graphite mt-8">
          Você escolhe o plano — a cobrança só começa no{" "}
          <strong className="text-obsidian font-semibold">dia 15</strong>.
        </p>
      </div>
    </div>
  );
}
