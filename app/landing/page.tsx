import Link from "next/link";
import { ArrowRight, MessageCircle, Star, Zap, BarChart3 } from "lucide-react";

export const metadata = {
  title: "Catálogo Digital — Sua vitrine no WhatsApp",
};

const features = [
  {
    icon: <MessageCircle size={22} />,
    title: "WhatsApp como checkout",
    desc: "Sem carrinho, sem complicação. O cliente clica em Comprar e cai direto no seu WhatsApp com a mensagem pronta.",
  },
  {
    icon: <Star size={22} />,
    title: "Vitrine premium",
    desc: "Design de boutique sofisticada. Sua loja parece grande mesmo sendo pequena.",
  },
  {
    icon: <Zap size={22} />,
    title: "Pronto em minutos",
    desc: "Cadastre seus produtos e compartilhe o link. Seu catálogo fica ativo na hora.",
  },
  {
    icon: <BarChart3 size={22} />,
    title: "Painel completo",
    desc: "Gerencie produtos, estoque, categorias e configurações da loja em um só lugar.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory">
      {/* Navbar */}
      <nav
        className="fixed top-0 inset-x-0 z-50 border-b border-sand"
        style={{ background: "rgba(249,249,247,0.92)", backdropFilter: "blur(8px)" }}
      >
        <div className="max-w-page mx-auto px-12 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-obsidian flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[17px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </div>
          <div className="flex items-center gap-8">
            <Link
              href="#funcionalidades"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Funcionalidades
            </Link>
            <Link
              href="/planos"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Planos
            </Link>
            <Link
              href="/login"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="inline-flex items-center gap-2 h-[44px] px-6 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] hover:bg-[#1f1f1f] transition-colors"
            >
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-[168px] pb-24 px-12">
        <div className="max-w-page mx-auto">
          <div className="grid grid-cols-[1.05fr_0.95fr] gap-16 items-center">
            <div>
              <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
                SaaS para lojistas de moda
              </span>
              <h1 className="font-display font-semibold text-[54px] text-obsidian leading-[1.06] tracking-tight mt-4 mb-5 text-balance">
                Sua vitrine online, pedidos pelo WhatsApp
              </h1>
              <p className="font-body text-[17px] text-graphite leading-relaxed mb-8 text-pretty">
                Crie um catálogo digital premium em minutos. Seus clientes navegam,
                escolhem e pedem diretamente pelo WhatsApp — sem app, sem cadastro, sem
                complicação.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/cadastro"
                  className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
                >
                  Criar meu catálogo <ArrowRight size={18} />
                </Link>
                <Link
                  href="/catalogo"
                  className="inline-flex items-center gap-2 h-[52px] px-8 rounded-btn bg-transparent text-obsidian border border-sand font-display font-medium text-[16px] hover:bg-surface-hover transition-colors"
                >
                  Ver exemplo
                </Link>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="relative flex justify-center">
              <div className="w-[280px] h-[560px] rounded-[32px] bg-obsidian border-[6px] border-obsidian shadow-none overflow-hidden">
                <div className="w-full h-full bg-ivory rounded-[26px] overflow-hidden flex flex-col">
                  <div className="bg-ivory border-b border-sand px-3 py-2.5 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-obsidian flex items-center justify-center font-display font-semibold text-[11px] text-white">
                      AM
                    </div>
                    <div>
                      <div className="font-display font-semibold text-[12px] text-obsidian">
                        Ateliê Mira
                      </div>
                      <div className="font-body text-[9px] text-graphite">
                        48 produtos
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 p-3 grid grid-cols-2 gap-2 content-start overflow-hidden">
                    {[
                      { name: "Vestido midi linho", price: "R$ 289,90", bg: "#E8DECE" },
                      { name: "Blusa tricô off-white", price: "R$ 169,90", bg: "#EDE8E0" },
                      { name: "Calça pantalona", price: "R$ 249,90", bg: "#D8CFBE" },
                      { name: "Saia midi plissada", price: "R$ 159,90", bg: "#E4DDD4" },
                    ].map((p) => (
                      <div
                        key={p.name}
                        className="rounded-[10px] overflow-hidden border border-sand/50 bg-ivory"
                      >
                        <div
                          className="aspect-square w-full"
                          style={{ background: p.bg }}
                        />
                        <div className="p-1.5">
                          <div className="font-display font-medium text-[9px] text-obsidian leading-tight truncate">
                            {p.name}
                          </div>
                          <div className="font-body text-[9px] text-graphite mt-0.5">
                            {p.price}
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

      {/* Features */}
      <section id="funcionalidades" className="py-28 px-12 bg-linen">
        <div className="max-w-page mx-auto">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Funcionalidades
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Tudo que você precisa para vender mais
            </h2>
            <p className="font-body text-[17px] text-graphite text-pretty">
              Uma plataforma pensada para lojistas de moda que querem profissionalismo
              sem complicação.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-ivory border border-sand/50 rounded-card p-6 flex flex-col gap-4"
              >
                <div className="w-11 h-11 rounded-[10px] bg-obsidian text-white flex items-center justify-center flex-shrink-0">
                  {f.icon}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-[16px] text-obsidian mb-2">
                    {f.title}
                  </h3>
                  <p className="font-body text-[14px] text-graphite leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-28 px-12 bg-obsidian">
        <div className="max-w-page mx-auto text-center">
          <h2 className="font-display font-semibold text-[42px] text-white leading-tight tracking-tight mb-5">
            Pronto para ter sua vitrine online?
          </h2>
          <p className="font-body text-[17px] text-white/70 mb-10">
            Comece grátis por 14 dias. Sem cartão de crédito.
          </p>
          <Link
            href="/cadastro"
            className="inline-flex items-center gap-2 h-[52px] px-10 rounded-btn bg-gold text-white font-display font-medium text-[16px] hover:bg-gold-hover transition-colors"
          >
            Criar meu catálogo grátis <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-12 border-t border-sand">
        <div className="max-w-page mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-[6px] bg-obsidian flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[14px] text-obsidian">
              Catálogo Digital
            </span>
          </div>
          <p className="font-body text-[13px] text-inactive">
            © 2024 Catálogo Digital. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
