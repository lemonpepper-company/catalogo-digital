import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "O que é Vitrine Digital? — Vtrine Digital",
  description:
    "Vitrine digital é a loja online da sua marca, sem carrinho: o cliente vê os produtos e compra direto no WhatsApp. Veja como criar a sua grátis.",
  openGraph: {
    title: "O que é Vitrine Digital? — Vtrine Digital",
    description:
      "Vitrine digital é a loja online da sua marca, sem carrinho: o cliente vê os produtos e compra direto no WhatsApp. Veja como criar a sua grátis.",
    url: "/vitrine-digital",
  },
};

export default function VitrineDigitalPage() {
  return <SeoLandingPage content={content} />;
}
