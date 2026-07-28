import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "O que é uma vitrine digital (e por que sua loja precisa de uma)",
  heroSubtitle:
    "Vitrine digital é o catálogo online da sua marca: o cliente vê todos os produtos organizados e compra direto pelo WhatsApp, sem carrinho e sem taxa.",
  problemSolution: {
    title: "Mostrar produto por print no WhatsApp tem limite",
    body: "Hoje o lojista mostra produto por print no chat ou no Instagram — o cliente não tem visão do catálogo completo, o preço se perde na conversa e a loja não passa a imagem profissional que merece. Uma vitrine digital é um link único, com todos os produtos organizados, que substitui isso sem tirar a venda do WhatsApp.",
  },
  benefits: [
    {
      title: "Catálogo sempre atualizado",
      desc: "Sem reenviar fotos toda vez que alguém pergunta o que você vende.",
    },
    {
      title: "Um link só, pra tudo",
      desc: "Funciona na bio do Instagram ou no status do WhatsApp como sua loja.",
    },
    {
      title: "Pedido pronto no WhatsApp",
      desc: "O cliente escolhe o produto e o pedido já chega pra você com os detalhes certos.",
    },
    {
      title: "Com a cara da sua marca",
      desc: "Cor, capa e nome da loja personalizados — não é um catálogo genérico.",
    },
  ],
  faq: [
    {
      q: "Vitrine digital é a mesma coisa que loja virtual?",
      a: "Não. Uma loja virtual tem carrinho e checkout próprios. A vitrine digital mostra os produtos e manda o pedido pronto pro seu WhatsApp — a venda continua sendo você que fecha.",
    },
    {
      q: "Preciso saber programar?",
      a: "Não. Você monta o catálogo direto no painel, sem precisar de site nem código.",
    },
    {
      q: "É pago?",
      a: "Tem plano gratuito pra começar, sem cartão de crédito.",
    },
  ],
  ctaLabel: "Criar minha vitrine grátis",
  relatedLinks: [
    { label: "Catálogo digital grátis", href: "/catalogo-digital-gratis" },
    { label: "Vender pelo WhatsApp", href: "/vender-pelo-whatsapp" },
  ],
};
