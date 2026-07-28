import type { Metadata } from "next";
import { SeoLandingPage } from "@/components/seo/SeoLandingPage";
import { content } from "./data";

export const metadata: Metadata = {
  title: "Catálogo Digital Grátis — Crie o seu em minutos",
  description:
    "Crie um catálogo digital grátis pra mostrar seus produtos e vender pelo WhatsApp. Sem cartão de crédito, sem mensalidade pra começar.",
  openGraph: {
    title: "Catálogo Digital Grátis — Crie o seu em minutos",
    description:
      "Crie um catálogo digital grátis pra mostrar seus produtos e vender pelo WhatsApp. Sem cartão de crédito, sem mensalidade pra começar.",
    url: "/catalogo-digital-gratis",
  },
  twitter: {
    title: "Catálogo Digital Grátis — Crie o seu em minutos",
    description:
      "Crie um catálogo digital grátis pra mostrar seus produtos e vender pelo WhatsApp. Sem cartão de crédito, sem mensalidade pra começar.",
  },
};

export default function CatalogoDigitalGratisPage() {
  return <SeoLandingPage content={content} />;
}
