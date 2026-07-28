import type { SeoLandingContent } from "@/components/seo/types";

export const content: SeoLandingContent = {
  h1: "Seu link na bio pode vender — não só listar links",
  heroSubtitle:
    "Linktree agrupa links. Uma vitrine mostra produto, preço e foto — e o cliente compra direto pelo WhatsApp, sem sair do link.",
  problemSolution: {
    title: "Link na bio genérico não foi feito pra vender",
    body: "Linktree e ferramentas parecidas são ótimas pra agrupar links, mas não mostram produto, preço nem foto. Quem clica não sabe o que você vende até abrir outro app — e nesse caminho, perde venda.",
  },
  benefits: [
    {
      title: "Um link, catálogo completo",
      desc: "Mostra todos os produtos, não só uma lista de links.",
    },
    {
      title: "Produto, preço e foto visíveis",
      desc: "O cliente decide sem sair da página.",
    },
    {
      title: "Botão Comprar direto pro WhatsApp",
      desc: "Leva o pedido pronto pra você, sem fricção.",
    },
    {
      title: "Mesmo lugar que você já usa",
      desc: "Troque o link da bio do Instagram por esse, sem mudar seu hábito.",
    },
  ],
  faq: [
    {
      q: "Preciso trocar meu link na bio?",
      a: "Sim, é só substituir pelo link da sua vitrine.",
    },
    {
      q: "Dá pra usar junto com outros links (Linktree etc.)?",
      a: "Sim, você pode incluir a vitrine como um dos links de lá.",
    },
    {
      q: "Funciona no celular?",
      a: "Sim — é o formato principal de uso, pensado pra quem clica vindo do Instagram.",
    },
  ],
  ctaLabel: "Criar minha vitrine grátis",
  relatedLinks: [
    { label: "O que é vitrine digital", href: "/vitrine-digital" },
    { label: "Vitrine sem carrinho", href: "/vitrine-online-sem-carrinho" },
  ],
};
