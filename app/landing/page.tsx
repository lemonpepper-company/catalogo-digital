import NextLink from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Check,
  MessagesSquare,
  RefreshCw,
  Store,
  Image as ImageIcon,
  MessageCircle,
  Link as LinkIcon,
  Package,
  Smartphone,
  BarChart3,
  ChevronDown,
} from "lucide-react";

export const metadata = {
  title: "Catálogo Digital — Sua vitrine no WhatsApp",
};

const painCards = [
  {
    icon: <MessagesSquare size={22} className="text-obsidian" />,
    title: "Catálogo no chat se perde",
    desc: "Mandar foto por foto cansa o cliente e some no histórico de conversas. Nada fica organizado.",
  },
  {
    icon: <RefreshCw size={22} className="text-obsidian" />,
    title: "Preço e estoque desatualizados",
    desc: "Atualizar tabela no Excel e reenviar a cada conversa é trabalhoso — e gera mal-entendido na hora da venda.",
  },
  {
    icon: <Store size={22} className="text-obsidian" />,
    title: "Sua loja parece amadora",
    desc: "Sem uma vitrine própria, é difícil passar a imagem de marca que o seu produto realmente tem.",
  },
];

const steps = [
  {
    num: "01",
    title: "Cadastre seus produtos",
    desc: "Adicione foto, nome, preço, tamanhos e descrição. Em poucos minutos sua vitrine começa a tomar forma.",
  },
  {
    num: "02",
    title: "Personalize sua loja",
    desc: "Nome, número de WhatsApp e identidade. Tudo com a cara da sua marca, do jeito boutique.",
  },
  {
    num: "03",
    title: "Compartilhe o link",
    desc: "Copie e cole na bio, no status ou no grupo. O cliente compra e a conversa cai direto no seu WhatsApp.",
  },
];

const features = [
  {
    icon: <ImageIcon size={20} />,
    title: "Vitrine editorial",
    desc: "Layout limpo e premium que valoriza cada peça. Nada de cara de marketplace.",
  },
  {
    icon: <MessageCircle size={20} />,
    title: "Checkout no WhatsApp",
    desc: 'O botão "Comprar" abre uma mensagem pronta com produto, tamanho e quantidade.',
  },
  {
    icon: <LinkIcon size={20} />,
    title: "Link único da loja",
    desc: "Um endereço só seu para colocar na bio e compartilhar onde quiser.",
  },
  {
    icon: <Package size={20} />,
    title: "Controle de estoque",
    desc: "Marque o que esgotou e mantenha a vitrine sempre certa, sem retrabalho.",
  },
  {
    icon: <Smartphone size={20} />,
    title: "Pensado no celular",
    desc: "Seus clientes compram pelo telefone — e tudo é desenhado para essa tela.",
  },
  {
    icon: <BarChart3 size={20} />,
    title: "Painel simples",
    desc: "Gerencie produtos e veja o que está ativo em um painel direto ao ponto.",
  },
];

const testimonials = [
  {
    quote:
      '"Minhas clientes elogiam o link toda semana. Parece site de loja grande, mas montei sozinha em uma tarde."',
    initial: "M",
    name: "Mariana Reis",
    role: "Ateliê Mira · Moda feminina",
  },
  {
    quote:
      '"Parei de mandar foto por foto. Agora é só o link, e a venda já chega no WhatsApp com tudo certinho."',
    initial: "C",
    name: "Camila Souza",
    role: "Loja Camé · Acessórios",
  },
  {
    quote:
      '"O visual é o que mais me conquistou. Minha marca finalmente tem a vitrine que ela merecia."',
    initial: "J",
    name: "Juliana Alves",
    role: "Studio JA · Calçados",
  },
];

const starterFeatures = [
  "Até 30 produtos",
  "Link único da loja",
  "Checkout no WhatsApp",
  "Painel do lojista",
];

const proFeatures = [
  "Produtos ilimitados",
  "Controle de estoque",
  "Categorias e destaques",
  "Personalização da marca",
  "Suporte prioritário",
];

const faqs = [
  {
    q: "Preciso de maquininha ou gateway de pagamento?",
    a: "Não. O pagamento é combinado com você direto no WhatsApp, como já acontece hoje. O Catálogo Digital cuida da vitrine e leva o cliente até a conversa — você fecha do seu jeito.",
  },
  {
    q: "Meus clientes precisam baixar algum aplicativo?",
    a: 'Nenhum. O cliente abre o link no navegador do celular, navega pela loja e toca em "Comprar". Cai no WhatsApp com a mensagem pronta. Simples assim.',
  },
  {
    q: "Consigo montar minha loja sozinha?",
    a: "Sim. O painel foi feito para ser direto: você cadastra produtos, define preços e tamanhos e publica. A maioria dos lojistas coloca a vitrine no ar no mesmo dia.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Quando quiser, sem multa. Você começa no plano grátis e só assina um plano pago se decidir que vale a pena para o tamanho da sua loja.",
  },
];

const phoneMockProducts = [
  { name: "Blusa Linho", price: "R$ 189,90" },
  { name: "Vestido Midi", price: "R$ 249,90" },
  { name: "Saia Plissada", price: "R$ 159,90" },
  { name: "Camisa Seda", price: "R$ 279,90" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory">
      {/* ─── Navbar ─── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 border-b border-sand"
        style={{ background: "rgba(249,249,247,0.92)", backdropFilter: "blur(8px)" }}
      >
        <div className="max-w-page mx-auto px-12 h-[72px] flex items-center justify-between">
          <NextLink href="#top" className="flex items-center gap-2.5">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-obsidian flex items-center justify-center flex-shrink-0">
              <span className="w-[9px] h-[9px] rounded-full bg-gold block" />
            </div>
            <span className="font-display font-semibold text-[17px] text-obsidian tracking-tight">
              Catálogo Digital
            </span>
          </NextLink>

          <div className="flex items-center gap-8">
            <NextLink
              href="#recursos"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Recursos
            </NextLink>
            <NextLink
              href="#precos"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Preços
            </NextLink>
            <NextLink
              href="#depoimentos"
              className="font-body font-medium text-[14px] text-graphite hover:text-obsidian transition-colors"
            >
              Depoimentos
            </NextLink>
            <NextLink
              href="/cadastro"
              className="inline-flex items-center justify-content-center gap-2 h-11 px-6 rounded-btn bg-gold text-white font-display font-medium text-[15px] hover:bg-gold-hover transition-colors whitespace-nowrap"
            >
              Criar meu catálogo grátis
            </NextLink>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section
        id="top"
        className="bg-ivory"
        style={{ paddingTop: 168, paddingBottom: 96 }}
      >
        <div className="max-w-page mx-auto px-12">
          <div className="grid items-center gap-16" style={{ gridTemplateColumns: "1.05fr 0.95fr" }}>
            {/* Left */}
            <div>
              <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
                Vitrine digital · venda no WhatsApp
              </span>
              <h1 className="font-display font-semibold text-[54px] text-obsidian leading-[1.06] tracking-tight mt-[18px] mb-[22px] text-balance">
                Sua loja como uma{" "}
                <em className="not-italic text-gold">boutique online</em>, sem
                complicação.
              </h1>
              <p className="font-body text-[18px] text-graphite leading-relaxed mb-8 text-pretty max-w-[480px]">
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
                  href="/catalogo"
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
            <div className="flex justify-center">
              <div
                className="relative flex-none bg-ivory overflow-hidden"
                style={{
                  width: 320,
                  height: 650,
                  borderRadius: 40,
                  border: "9px solid #0D0D0D",
                }}
              >
                {/* Notch */}
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 bg-obsidian z-10"
                  style={{ width: 120, height: 22, borderRadius: "0 0 14px 14px" }}
                />
                {/* Screen */}
                <div className="absolute inset-0 overflow-hidden">
                  {/* Store header */}
                  <div style={{ padding: "30px 18px 14px" }}>
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
                            style={{ fontFamily: "ui-monospace,monospace" }}
                            className="text-[8px] tracking-[0.08em]"
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
        <div className="max-w-page mx-auto px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              O problema
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Vender pelo WhatsApp não precisa ser uma bagunça.
            </h2>
            <p className="font-body text-[17px] text-graphite text-pretty">
              Fotos perdidas no chat, tabela de preços desatualizada, cliente
              perguntando &quot;ainda tem?&quot;. Você merece uma vitrine de
              verdade.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
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
        <div className="max-w-page mx-auto px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Como funciona
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 text-balance">
              Do zero ao catálogo no ar em três passos.
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-12">
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
        <div className="max-w-page mx-auto px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Tudo que você precisa
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Feito para quem vende com capricho.
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-y-8 gap-x-6">
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

      {/* ─── Testimonials ─── */}
      <section id="depoimentos" className="bg-ivory py-28">
        <div className="max-w-page mx-auto px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Quem já usa
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 text-balance">
              Lojistas que deixaram a bagunça para trás.
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white border border-sand/50 rounded-card p-8 flex flex-col"
                style={{ borderTop: "3px solid #C9A96E" }}
              >
                <p className="font-body text-[15px] text-graphite leading-[1.65] flex-1">
                  {t.quote}
                </p>
                <div className="flex items-center gap-3 mt-[26px]">
                  <div className="w-[42px] h-[42px] rounded-full bg-linen flex items-center justify-center font-display font-semibold text-[15px] text-obsidian flex-shrink-0">
                    {t.initial}
                  </div>
                  <div>
                    <div className="font-display font-medium text-[14px] text-obsidian">
                      {t.name}
                    </div>
                    <div className="font-body text-[12px] text-graphite">
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="precos" className="bg-linen py-28">
        <div className="max-w-page mx-auto px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Planos
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 mb-4 text-balance">
              Preço simples, sem surpresa.
            </h2>
            <p className="font-body text-[17px] text-graphite text-pretty">
              Comece grátis. Quando crescer, escolha o plano que acompanha sua
              loja.
            </p>
          </div>
          <div
            className="grid justify-center gap-6"
            style={{ gridTemplateColumns: "repeat(2, minmax(0, 340px))" }}
          >
            {/* Starter */}
            <div className="bg-white border border-sand/50 rounded-card p-9 flex flex-col">
              <div className="font-display font-medium text-[18px] text-obsidian">
                Starter
              </div>
              <div className="flex items-baseline gap-1 mt-4 mb-1.5">
                <span className="font-display font-medium text-[20px] text-obsidian">
                  R$
                </span>
                <span className="font-display font-semibold text-[44px] text-obsidian tracking-tight leading-none">
                  49
                </span>
                <span className="font-body text-[14px] text-graphite">/mês</span>
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
              <NextLink
                href="/cadastro"
                className="w-full h-[52px] rounded-btn border border-sand bg-transparent text-obsidian font-display font-medium text-[16px] flex items-center justify-center hover:bg-surface-hover transition-colors"
              >
                Começar grátis
              </NextLink>
            </div>

            {/* Pro */}
            <div className="relative bg-white border border-gold rounded-card p-9 flex flex-col">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-white font-body font-medium text-[10px] tracking-[0.08em] uppercase px-3.5 py-1.5 rounded-pill whitespace-nowrap">
                Mais popular
              </span>
              <div className="font-display font-medium text-[18px] text-obsidian">
                Pro
              </div>
              <div className="flex items-baseline gap-1 mt-4 mb-1.5">
                <span className="font-display font-medium text-[20px] text-obsidian">
                  R$
                </span>
                <span className="font-display font-semibold text-[44px] text-obsidian tracking-tight leading-none">
                  99
                </span>
                <span className="font-body text-[14px] text-graphite">/mês</span>
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
              <NextLink
                href="/cadastro"
                className="w-full h-[52px] rounded-btn bg-gold text-white font-display font-medium text-[16px] flex items-center justify-center hover:bg-gold-hover transition-colors"
              >
                Assinar o Pro
              </NextLink>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="bg-ivory py-28">
        <div className="max-w-page mx-auto px-12">
          <div className="max-w-[660px] mx-auto text-center mb-16">
            <span className="font-body font-medium text-[11px] tracking-[0.14em] uppercase text-gold">
              Dúvidas
            </span>
            <h2 className="font-display font-semibold text-[38px] text-obsidian leading-[1.12] tracking-tight mt-3.5 text-balance">
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
        <div className="max-w-page mx-auto px-12">
          <div className="text-center max-w-[660px] mx-auto">
            <h2 className="font-display font-semibold text-[42px] text-white leading-[1.1] tracking-tight mb-[18px] text-balance">
              Sua vitrine pode estar no ar ainda hoje.
            </h2>
            <p
              className="font-body text-[17px] mb-[34px]"
              style={{ color: "rgba(249,249,247,0.7)" }}
            >
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
        <div className="max-w-page mx-auto px-12">
          <div
            className="grid pb-12"
            style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32 }}
          >
            <div>
              <NextLink href="#top" className="flex items-center gap-2.5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-obsidian flex items-center justify-center flex-shrink-0">
                  <span className="w-[9px] h-[9px] rounded-full bg-gold block" />
                </div>
                <span className="font-display font-semibold text-[17px] text-obsidian tracking-tight">
                  Catálogo Digital
                </span>
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
                  { label: "Ver um catálogo", href: "/catalogo" },
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
                  { label: "Depoimentos", href: "#depoimentos" },
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

          <div className="border-t border-sand pt-7 flex items-center justify-between font-body text-[13px] text-graphite">
            <span>© 2026 Catálogo Digital. Todos os direitos reservados.</span>
            <span>Feito no Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
