import NextLink from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { VtrineLogo } from "@/components/ui/VtrineLogo";
import { WhatsAppFloatingButton } from "@/components/landing/WhatsAppFloatingButton";
import type { SeoLandingContent } from "./types";

interface SeoLandingPageProps {
  content: SeoLandingContent;
}

export function SeoLandingPage({ content }: SeoLandingPageProps) {
  const { h1, heroSubtitle, problemSolution, benefits, faq, ctaLabel, relatedLinks } =
    content;

  return (
    <div className="min-h-screen bg-ivory">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-sand bg-ivory/[0.92] backdrop-blur">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 h-[72px] flex items-center justify-between">
          <NextLink href="/">
            <VtrineLogo size="sm" />
          </NextLink>
          <div className="flex items-center gap-4">
            <NextLink
              href="/login"
              className="hidden md:block font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Entrar
            </NextLink>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center justify-center h-9 sm:h-11 px-4 sm:px-6 rounded-btn bg-gold text-white font-display font-medium text-[13px] sm:text-[15px] hover:bg-gold-hover transition-colors whitespace-nowrap"
            >
              Criar catálogo grátis
            </NextLink>
          </div>
        </div>
      </nav>

      <section className="bg-ivory pt-[120px] pb-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[640px]">
            <h1 className="font-display font-semibold text-[36px] sm:text-[44px] text-obsidian leading-[1.08] tracking-tight mb-5 text-balance">
              {h1}
            </h1>
            <p className="font-body text-[18px] text-graphite leading-relaxed mb-8 text-pretty max-w-[560px]">
              {heroSubtitle}
            </p>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
            >
              {ctaLabel}
            </NextLink>
          </div>
        </div>
      </section>

      <section className="bg-linen py-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[720px]">
            <h2 className="font-display font-semibold text-[26px] md:text-[32px] text-obsidian leading-[1.15] tracking-tight mb-4 text-balance">
              {problemSolution.title}
            </h2>
            <p className="font-body text-[17px] text-graphite leading-relaxed text-pretty">
              {problemSolution.body}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ivory py-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-8 max-w-[760px]">
            {benefits.map((b) => (
              <div key={b.title} className="flex gap-3">
                <Check size={20} className="text-success flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-display font-medium text-[17px] text-obsidian mb-1">
                    {b.title}
                  </h3>
                  <p className="font-body text-[14px] text-graphite">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-linen py-20">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[720px]">
            <h2 className="font-display font-semibold text-[26px] md:text-[32px] text-obsidian leading-[1.15] tracking-tight mb-8 text-balance">
              Perguntas frequentes
            </h2>
            {faq.map((item, i) => (
              <details
                key={item.q}
                className="group border-b border-sand"
                {...(i === 0 ? { open: true } : {})}
              >
                <summary className="list-none cursor-pointer py-[22px] flex items-center justify-between gap-6">
                  <span className="font-display font-medium text-[16px] text-obsidian">
                    {item.q}
                  </span>
                  <ChevronDown
                    size={18}
                    className="text-graphite flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="pb-[22px] font-body text-[14px] text-graphite">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {relatedLinks.length > 0 && (
        <section className="bg-ivory py-12">
          <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-[720px]">
              <span className="font-body font-medium text-[12px] tracking-[0.1em] uppercase text-graphite">
                Veja também
              </span>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
                {relatedLinks.map((link) => (
                  <NextLink
                    key={link.href}
                    href={link.href}
                    className="font-body text-[14px] text-obsidian underline underline-offset-4 hover:text-gold transition-colors"
                  >
                    {link.label}
                  </NextLink>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="bg-obsidian py-24">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="text-center max-w-[600px] mx-auto">
            <h2 className="font-display font-semibold text-[28px] md:text-[36px] text-white leading-[1.1] tracking-tight mb-6 text-balance">
              Sua vitrine pode estar no ar ainda hoje.
            </h2>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
            >
              {ctaLabel}
            </NextLink>
          </div>
        </div>
      </section>

      <footer className="bg-linen border-t border-sand py-10">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row gap-4 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
          <NextLink href="/">
            <VtrineLogo size="sm" />
          </NextLink>
          <div className="flex items-center gap-4">
            <NextLink
              href="/politica-de-privacidade"
              className="hover:text-obsidian transition-colors"
            >
              Política de Privacidade
            </NextLink>
            <NextLink href="/termos-de-uso" className="hover:text-obsidian transition-colors">
              Termos de Uso
            </NextLink>
          </div>
        </div>
      </footer>

      <WhatsAppFloatingButton />
    </div>
  );
}
