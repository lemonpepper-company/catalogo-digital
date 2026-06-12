import Link from "next/link";
import { Check } from "lucide-react";

export const metadata = {
  title: "Planos — Catálogo Digital",
};

const plans = [
  {
    name: "Básico",
    price: "R$ 49",
    period: "/mês",
    desc: "Para quem está começando",
    features: [
      "Até 30 produtos",
      "Catálogo público",
      "Pedidos via WhatsApp",
      "1 categoria",
      "Suporte por e-mail",
    ],
    cta: "Começar grátis",
    href: "/painel",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "R$ 99",
    period: "/mês",
    desc: "Para quem quer crescer",
    features: [
      "Produtos ilimitados",
      "Catálogo público",
      "Pedidos via WhatsApp",
      "Categorias ilimitadas",
      "Cor de destaque personalizada",
      "Google Analytics + Meta Pixel",
      "Suporte prioritário",
    ],
    cta: "Assinar Pro",
    href: "/painel",
    highlighted: true,
  },
];

export default function PlanosPage() {
  return (
    <div className="min-h-screen bg-ivory">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-sand">
        <Link href="/landing" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-obsidian flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-gold block" />
          </div>
          <span className="font-display font-semibold text-[16px] text-obsidian">
            Catálogo Digital
          </span>
        </Link>
        <Link
          href="/login"
          className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
        >
          Já tenho conta
        </Link>
      </nav>

      <div className="max-w-[800px] mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
            Planos e preços
          </span>
          <h1 className="font-display font-semibold text-[38px] text-obsidian leading-tight tracking-tight mt-3 mb-4">
            Escolha seu plano
          </h1>
          <p className="font-body text-[17px] text-graphite">
            14 dias grátis em qualquer plano. Cancele quando quiser.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-card p-8 flex flex-col gap-6 ${
                plan.highlighted
                  ? "bg-obsidian text-white"
                  : "bg-white border border-sand"
              }`}
            >
              {plan.highlighted && (
                <div className="inline-flex self-start">
                  <span className="h-[22px] px-3 rounded-pill bg-gold text-white font-body font-medium text-[11px] tracking-[0.06em] uppercase flex items-center">
                    Mais popular
                  </span>
                </div>
              )}
              <div>
                <div
                  className={`font-display font-semibold text-[18px] ${plan.highlighted ? "text-white" : "text-obsidian"}`}
                >
                  {plan.name}
                </div>
                <div
                  className={`font-body text-[14px] mt-1 ${plan.highlighted ? "text-white/70" : "text-graphite"}`}
                >
                  {plan.desc}
                </div>
              </div>

              <div className="flex items-baseline gap-1">
                <span
                  className={`font-display font-semibold text-[42px] leading-none ${plan.highlighted ? "text-white" : "text-obsidian"}`}
                >
                  {plan.price}
                </span>
                <span
                  className={`font-body text-[15px] ${plan.highlighted ? "text-white/60" : "text-graphite"}`}
                >
                  {plan.period}
                </span>
              </div>

              <ul className="flex flex-col gap-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check
                      size={16}
                      className={plan.highlighted ? "text-gold" : "text-success"}
                    />
                    <span
                      className={`font-body text-[14px] ${plan.highlighted ? "text-white/90" : "text-graphite"}`}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-auto w-full h-11 rounded-btn flex items-center justify-center font-display font-medium text-[15px] transition-colors ${
                  plan.highlighted
                    ? "bg-gold text-white hover:bg-gold-hover"
                    : "bg-obsidian text-white hover:bg-[#1f1f1f]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
