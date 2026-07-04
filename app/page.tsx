import NextLink from "next/link";
import { VtrineLogo } from "@/components/ui/VtrineLogo";
import {
  CheckCircle2,
  Check,
  MessageCircle,
  ChevronDown,
  Image as ImageIcon,
} from "lucide-react";
import {
  painCards,
  steps,
  features,
  starterFeatures,
  proFeatures,
  faqs,
  phoneMockProducts,
} from "./landing/data";

export const metadata = {
  title: "Vtrine Digital — Vitrine e catálogo online para vender no WhatsApp",
  description:
    "Monte uma vitrine bonita e catálogo de produtos em minutos. O cliente navega, escolhe e finaliza no WhatsApp. Sem carrinho, sem maquininha, sem taxa.",
  openGraph: {
    title: "Vtrine Digital — Vitrine e catálogo online para vender no WhatsApp",
    description:
      "Monte uma vitrine bonita e catálogo de produtos em minutos. O cliente navega, escolhe e finaliza no WhatsApp. Sem carrinho, sem maquininha, sem taxa.",
    url: "/",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory">
      {/* ─── Navbar ─── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 border-b border-sand bg-ivory/[0.92] backdrop-blur"
      >
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12 h-[72px] flex items-center justify-between">
          <NextLink href="#top">
            <VtrineLogo size="sm" />
          </NextLink>

          <div className="flex items-center gap-4 md:gap-8">
            <NextLink
              href="#recursos"
              className="hidden md:block font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Recursos
            </NextLink>
            <NextLink
              href="#precos"
              className="hidden md:block font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Preços
            </NextLink>
            {/* MODO DEMO: link "Depoimentos" oculto junto com a seção. Original:
            <NextLink
              href="#depoimentos"
              className="hidden md:block font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Depoimentos
            </NextLink>
            */}
            <NextLink
              href="/login"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors whitespace-nowrap"
            >
              Entrar
            </NextLink>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center justify-center gap-2 h-9 sm:h-11 px-4 sm:px-6 rounded-btn bg-gold text-white font-display font-medium text-[13px] sm:text-[15px] hover:bg-gold-hover transition-colors whitespace-nowrap"
            >
              Criar meu catálogo grátis
            </NextLink>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section
        id="top"
        className="bg-ivory pt-24 md:pt-[168px] pb-16 md:pb-24"
      >
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-10 lg:gap-16">
            {/* Left */}
            <div>
              <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
                Vitrine digital · venda no WhatsApp
              </span>
              <h1 className="font-display font-semibold text-[36px] sm:text-[48px] lg:text-[54px] text-obsidian leading-[1.06] tracking-tight mt-[18px] mb-[22px] text-balance">
                Sua loja como uma{" "}
                <em className="not-italic text-gold">boutique online</em>, sem
                complicação.
              </h1>
              <p className="font-body text-[17px] sm:text-[18px] text-graphite leading-relaxed mb-8 text-pretty max-w-[480px]">
                Monte um catálogo bonito em minutos. O cliente navega, escolhe a
                peça e finaliza a compra direto no seu WhatsApp. Sem carrinho,
                sem maquininha, sem taxa.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <NextLink
                  href="/cadastro"
                  className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
                >
                  Criar meu catálogo grátis
                </NextLink>
                <NextLink
                  href="/atelie-mira"
                  className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[16px] hover:bg-surface-hover transition-colors"
                >
                  Ver um catálogo
                </NextLink>
              </div>
              <div className="flex items-center gap-2 mt-6 font-body text-[13px] text-graphite">
                <CheckCircle2 size={16} className="text-success" />
                Grátis para começar · sem cartão de crédito
              </div>
            </div>

            {/* Phone mockup */}
            <div className="hidden md:flex justify-center">
              <div
                className="relative flex-none bg-ivory overflow-hidden w-[320px] h-[650px] rounded-[40px] border-[9px] border-obsidian"
              >
                {/* Notch */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 bg-obsidian z-10 w-[120px] h-[22px] rounded-b-[14px]"
                />
                {/* Screen */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Store header */}
                  <div className="pt-[30px] px-[18px] pb-[14px]">
                    <div className="font-display font-semibold text-[18px] text-obsidian">
                      Ateliê Mira
                    </div>
                    <div className="font-body text-[11px] text-graphite mt-0.5">
                      48 produtos · atualizado hoje
                    </div>
                  </div>
                  {/* Pills */}
                  <div className="flex gap-[7px] px-[18px] pb-[14px]">
                    {["Todos", "Blusas", "Vestidos"].map((label, i) => (
                      <span
                        key={label}
                        className={[
                          "font-body font-medium text-[9px] tracking-[0.08em] uppercase px-3 py-[6px] rounded-pill",
                          i === 0
                            ? "bg-obsidian text-white"
                            : "bg-linen text-graphite",
                        ].join(" ")}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {/* Product grid */}
                  <div className="grid grid-cols-2 gap-3 px-[18px]">
                    {phoneMockProducts.map((p) => (
                      <div
                        key={p.name}
                        className="bg-white border border-sand/50 rounded-[12px] overflow-hidden"
                      >
                        <div className="aspect-square bg-linen flex flex-col items-center justify-center gap-1.5 text-inactive">
                          <ImageIcon size={22} />
                          <span
                            className="font-mono text-[8px] tracking-[0.08em]"
                          >
                            FOTO
                          </span>
                        </div>
                        <div className="px-[10px] pt-2 pb-2.5">
                          <div className="font-display font-medium text-[11px] text-obsidian">
                            {p.name}
                          </div>
                          <div className="font-body text-[11px] text-graphite mt-0.5">
                            {p.price}
                          </div>
                          <div className="mt-2 h-[26px] rounded-[6px] bg-gold text-white flex items-center justify-center gap-1">
                            <MessageCircle size={11} />
                            <span className="font-display font-medium text-[9.5px]">
                              Comprar
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pain ─── */}
      <section className="bg-linen py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              O problema
            </span>
            <h2 className="font-display font-semibold text-[28px] md:text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Vender pelo WhatsApp não precisa ser uma bagunça.
            </h2>
            <p className="font-body text-[17px] text-graphite text-pretty">
              Fotos perdidas no chat, tabela de preços desatualizada, cliente
              perguntando &quot;ainda tem?&quot;. Você merece uma vitrine de
              verdade.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {painCards.map((c) => (
              <div
                key={c.title}
                className="bg-white border border-sand/50 rounded-card p-8"
              >
                <div className="w-11 h-11 rounded-[10px] bg-ivory flex items-center justify-center mb-[18px]">
                  {c.icon}
                </div>
                <h3 className="font-display font-medium text-[18px] text-obsidian mb-2">
                  {c.title}
                </h3>
                <p className="font-body text-[14px] text-graphite">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="recursos" className="bg-ivory py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Como funciona
            </span>
            <h2 className="font-display font-semibold text-[28px] md:text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 text-balance">
              Do zero ao catálogo no ar em três passos.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((s) => (
              <div key={s.num}>
                <div className="font-display font-semibold text-[52px] text-gold leading-none tracking-tight">
                  {s.num}
                </div>
                <h3 className="font-display font-medium text-[20px] text-obsidian mt-[18px] mb-2.5">
                  {s.title}
                </h3>
                <p className="font-body text-[15px] text-graphite">{s.desc}</p>
                <div className="h-px bg-sand mt-[22px]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="bg-linen py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Tudo que você precisa
            </span>
            <h2 className="font-display font-semibold text-[28px] md:text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Feito para quem vende com capricho.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6">
            {features.map((f) => (
              <div key={f.title} className="py-1">
                <div className="w-10 h-10 rounded-[10px] bg-white border border-sand/50 flex items-center justify-center text-obsidian mb-4">
                  {f.icon}
                </div>
                <h3 className="font-display font-medium text-[17px] text-obsidian mb-1.5">
                  {f.title}
                </h3>
                <p className="font-body text-[14px] text-graphite">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODO DEMO: seção de depoimentos oculta — são depoimentos fictícios de
          lojistas exemplo, não faz sentido exibir antes de ter clientes reais.
          Bloco original:
      <section id="depoimentos" className="bg-ivory py-28">
        ...
      </section>
      */}

      {/* ─── Pricing ─── */}
      <section id="precos" className="bg-linen py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Planos
            </span>
            <h2 className="font-display font-semibold text-[28px] md:text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Planos sob medida para sua loja.
            </h2>
            <p className="font-body text-[17px] text-graphite text-pretty">
              Comece agora com acesso completo. Preços em breve.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 justify-center gap-6 sm:max-w-[712px] mx-auto">
            {/* Starter */}
            <div className="bg-white border border-sand/50 rounded-card p-9 flex flex-col">
              <div className="font-display font-medium text-[18px] text-obsidian">
                Starter
              </div>
              <div className="mt-4 mb-1.5">
                <span className="font-display font-semibold text-[28px] text-obsidian tracking-tight">
                  Em breve
                </span>
              </div>
              <p className="font-body text-[14px] text-graphite mb-6">
                Para quem está começando a organizar a vitrine.
              </p>
              <ul className="flex flex-col gap-3 mb-7 flex-1">
                {starterFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 font-body text-[14px] text-graphite"
                  >
                    <Check
                      size={17}
                      className="text-success flex-shrink-0 mt-px"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="relative bg-white border border-gold rounded-card p-9 flex flex-col">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-white font-body font-medium text-[10px] tracking-[0.08em] uppercase px-3.5 py-1.5 rounded-pill whitespace-nowrap">
                Mais popular
              </span>
              <div className="font-display font-medium text-[18px] text-obsidian">
                Pro
              </div>
              <div className="mt-4 mb-1.5">
                <span className="font-display font-semibold text-[28px] text-obsidian tracking-tight">
                  Em breve
                </span>
              </div>
              <p className="font-body text-[14px] text-graphite mb-6">
                Para a loja que vende todo dia e quer crescer.
              </p>
              <ul className="flex flex-col gap-3 mb-7 flex-1">
                {proFeatures.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 font-body text-[14px] text-graphite"
                  >
                    <Check
                      size={17}
                      className="text-success flex-shrink-0 mt-px"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="bg-ivory py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Dúvidas
            </span>
            <h2 className="font-display font-semibold text-[28px] md:text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 text-balance">
              Perguntas frequentes.
            </h2>
          </div>
          <div className="max-w-[760px] mx-auto">
            {faqs.map((faq, i) => (
              <details
                key={faq.q}
                className="group border-b border-sand"
                {...(i === 0 ? { open: true } : {})}
              >
                <summary className="list-none cursor-pointer py-[26px] flex items-center justify-between gap-6">
                  <span className="font-display font-medium text-[18px] text-obsidian">
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={20}
                    className="text-graphite flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <div className="pb-[26px] font-body text-[15px] text-graphite max-w-[640px]">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="bg-obsidian py-28">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="text-center max-w-[660px] mx-auto">
            <h2 className="font-display font-semibold text-[30px] md:text-[42px] text-white leading-[1.1] tracking-tight mb-[18px] text-balance">
              Sua vitrine pode estar no ar ainda hoje.
            </h2>
            <p className="font-body text-[17px] mb-[34px] text-ivory/70">
              Crie seu catálogo grátis e transforme conversas em vendas com a
              cara da sua marca.
            </p>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
            >
              Criar meu catálogo grátis
            </NextLink>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-linen border-t border-sand pt-[72px] pb-10">
        <div className="max-w-page mx-auto px-4 sm:px-8 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-5 pb-12 gap-8">
            <div className="col-span-2 md:col-span-1">
              <NextLink href="#top">
                <VtrineLogo size="sm" />
              </NextLink>
              <p className="font-body text-[14px] text-graphite mt-4 max-w-[280px]">
                A vitrine digital premium para lojistas que vendem pelo WhatsApp.
                Sem carrinho — a conversa é o checkout.
              </p>
            </div>

            <div>
              <h4 className="font-display font-medium text-[13px] text-obsidian mb-4">
                Produto
              </h4>
              <div className="flex flex-col gap-[11px]">
                {[
                  { label: "Recursos", href: "#recursos" },
                  { label: "Preços", href: "#precos" },
                  { label: "Ver um catálogo", href: "/atelie-mira" },
                  { label: "Painel do lojista", href: "/painel" },
                ].map((l) => (
                  <NextLink
                    key={l.label}
                    href={l.href}
                    className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
                  >
                    {l.label}
                  </NextLink>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-display font-medium text-[13px] text-obsidian mb-4">
                Empresa
              </h4>
              <div className="flex flex-col gap-[11px]">
                {[
                  { label: "Sobre", href: "#" },
                  { label: "Contato", href: "#" },
                ].map((l) => (
                  <NextLink
                    key={l.label}
                    href={l.href}
                    className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
                  >
                    {l.label}
                  </NextLink>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-display font-medium text-[13px] text-obsidian mb-4">
                Legal
              </h4>
              <div className="flex flex-col gap-[11px]">
                <NextLink
                  href="/politica-de-privacidade"
                  className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
                >
                  Política de Privacidade
                </NextLink>
                <NextLink
                  href="/termos-de-uso"
                  className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
                >
                  Termos de Uso
                </NextLink>
              </div>
            </div>

            <div>
              <h4 className="font-display font-medium text-[13px] text-obsidian mb-4">
                Conta
              </h4>
              <div className="flex flex-col gap-[11px]">
                <NextLink
                  href="/login"
                  className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
                >
                  Entrar
                </NextLink>
                <NextLink
                  href="/cadastro"
                  className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
                >
                  Criar grátis
                </NextLink>
              </div>
            </div>
          </div>

          <div className="border-t border-sand pt-7 flex flex-col sm:flex-row gap-2 sm:gap-0 items-center justify-between font-body text-[13px] text-graphite">
            <span>© 2026 Vtrine Digital. Todos os direitos reservados.</span>
            <div className="flex items-center gap-4">
              <NextLink
                href="/politica-de-privacidade"
                className="hover:text-obsidian transition-colors"
              >
                Política de Privacidade
              </NextLink>
              <NextLink
                href="/termos-de-uso"
                className="hover:text-obsidian transition-colors"
              >
                Termos de Uso
              </NextLink>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
