import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Alternativa ao Linktree Pra Vender Produtos",
  description:
    "Link na bio genérico não vende. Troque por uma vitrine com produtos, preços e fotos — o cliente compra direto pelo WhatsApp, sem sair do link.",
  openGraph: {
    title: "Alternativa ao Linktree Pra Vender Produtos",
    description:
      "Link na bio genérico não vende. Troque por uma vitrine com produtos, preços e fotos — o cliente compra direto pelo WhatsApp, sem sair do link.",
    url: "/alternativa-linktree-para-vender",
  },
};

export default function AlternativaLinktreeParaVenderPage() {
  return <SeoLandingPage content={content} />;
}
