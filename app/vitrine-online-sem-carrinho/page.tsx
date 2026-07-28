import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Vitrine Online Sem Carrinho de Compras | Vtrine Digital",
  description:
    "Loja virtual sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp.",
  openGraph: {
    title: "Vitrine Online Sem Carrinho de Compras | Vtrine Digital",
    description:
      "Loja virtual sem carrinho, sem checkout, sem taxa por venda. O cliente escolhe o produto e finaliza a compra direto com você, pelo WhatsApp.",
    url: "/vitrine-online-sem-carrinho",
  },
};

export default function VitrineOnlineSemCarrinhoPage() {
  return <SeoLandingPage content={content} />;
}
