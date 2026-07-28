import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Uma vitrine online sem carrinho — porque a conversa é o checkout",
  heroSubtitle:
    "Sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp.",
  problemSolution: {
    title: "Loja virtual tradicional tem fricção que você não precisa",
    body: "Uma loja virtual completa exige carrinho, gateway de pagamento, taxa por transação e uma configuração bem mais complexa. Pra quem vende no relacionamento, isso é fricção desnecessária — o cliente já quer falar com você antes de fechar.",
  },
  benefits: [
    {
      title: "Sem taxa por venda",
      desc: "Nada de maquininha ou gateway de pagamento cobrando por transação.",
    },
    {
      title: "Sem carrinho abandonado",
      desc: "O pedido nasce como conversa, não como um carrinho esquecido.",
    },
    {
      title: "Você negocia direto",
      desc: "Combine forma de pagamento e entrega do seu jeito, sem sistema no meio.",
    },
    {
      title: "Mais simples de configurar",
      desc: "Sem integração de pagamento nem cálculo de frete pra montar.",
    },
  ],
  faq: [
    {
      q: "Como o cliente paga então?",
      a: "Combinado direto com você pelo WhatsApp — Pix, cartão na entrega, o que preferir.",
    },
    {
      q: "Isso serve pra qualquer nicho?",
      a: "Sim, qualquer loja que venda ou queira vender por relacionamento.",
    },
    {
      q: "É mais simples que montar uma loja virtual?",
      a: "Sim — não tem configuração de pagamento nem de frete.",
    },
  ],
  ctaLabel: "Criar minha vitrine grátis",
  relatedLinks: [
    { label: "Vender pelo WhatsApp", href: "/vender-pelo-whatsapp" },
    { label: "Alternativa ao Linktree", href: "/alternativa-linktree-para-vender" },
  ],
};
