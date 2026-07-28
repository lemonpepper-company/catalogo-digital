import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Vender pelo WhatsApp sem virar bagunça",
  heroSubtitle:
    "Não importa o que você vende — acessório, cosmético, comida, artesanato — um catálogo organizado tira a bagunça da conversa sem tirar a venda do WhatsApp.",
  problemSolution: {
    title: "Vender só por conversa tem um limite",
    body: "Vender só por conversa funciona até certo ponto: fotos somem no histórico do chat, a tabela de preço desatualiza e o cliente pergunta \"ainda tem?\" toda hora. Um catálogo organiza isso — o cliente vê o que existe, o preço certo, e o pedido chega pronto pra você.",
  },
  benefits: [
    {
      title: "Cliente navega sozinho",
      desc: "Ele vê o catálogo completo sem precisar te ocupar pergunta por pergunta.",
    },
    {
      title: "Preço e estoque sempre visíveis",
      desc: "Sem precisar confirmar toda vez se ainda tem o produto.",
    },
    {
      title: "Pedido chega pronto",
      desc: "Item e valor já organizados na mensagem que cai no seu WhatsApp.",
    },
    {
      title: "Funciona pra qualquer produto",
      desc: "Moda, cosméticos, comida, artesanato — não importa o nicho.",
    },
  ],
  faq: [
    {
      q: "Preciso ter site?",
      a: "Não. O catálogo já é o link que você compartilha na bio ou no status.",
    },
    {
      q: "Funciona pra qualquer tipo de produto?",
      a: "Sim — moda, cosméticos, comida, artesanato, o que você vender.",
    },
    {
      q: "O cliente sai do WhatsApp pra comprar?",
      a: "Não. A compra sempre fecha por lá, com você.",
    },
  ],
  ctaLabel: "Criar meu catálogo grátis",
  relatedLinks: [
    { label: "Catálogo digital grátis", href: "/catalogo-digital-gratis" },
    { label: "Vitrine sem carrinho", href: "/vitrine-online-sem-carrinho" },
  ],
};
