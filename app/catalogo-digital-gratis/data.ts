import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Criar catálogo digital grátis pra vender pelo WhatsApp",
  heroSubtitle:
    "Monte seu catálogo completo, publique e comece a vender no plano gratuito — sem cartão de crédito, sem mensalidade pra testar.",
  problemSolution: {
    title: "Testar antes de pagar deveria ser o normal",
    body: "Muita ferramenta de catálogo cobra antes mesmo de você saber se funciona pro seu negócio. Aqui dá pra montar o catálogo completo — fotos, preços, categorias — e publicar no plano gratuito, sem cartão.",
  },
  benefits: [
    {
      title: "Sem cartão de crédito",
      desc: "Cadastre e publique sem informar dados de pagamento.",
    },
    {
      title: "Catálogo completo",
      desc: "Fotos, preços e categorias organizados, do jeito que o cliente entende.",
    },
    {
      title: "Cresce quando você crescer",
      desc: "Fazer upgrade de plano é opcional, só quando precisar de mais produtos ou categorias.",
    },
    {
      title: "No ar em minutos",
      desc: "Sem instalar nada, sem contratar desenvolvedor.",
    },
  ],
  faq: [
    {
      q: "O grátis tem pegadinha, expira?",
      a: "Não. O plano gratuito não expira — você usa por quanto tempo quiser.",
    },
    {
      q: "Quantos produtos cabem no grátis?",
      a: "O plano gratuito tem um limite de produtos e categorias pensado pra quem está começando; os detalhes ficam na página de preços.",
    },
    {
      q: "Dá pra migrar de plano depois?",
      a: "Sim, a qualquer momento, direto pelo painel.",
    },
  ],
  ctaLabel: "Começar grátis agora",
  relatedLinks: [
    { label: "O que é vitrine digital", href: "/vitrine-digital" },
    { label: "Vender pelo WhatsApp", href: "/vender-pelo-whatsapp" },
  ],
};
